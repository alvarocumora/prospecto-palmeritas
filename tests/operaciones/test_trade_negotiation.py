"""Operaciones (spine Trades) · Negociación estructurada de términos.

Oferta -> contraoferta -> aceptar vuelca términos al trade y supera el resto.
Stubs de commodity_trades + auth.uid().
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "supabase/migrations/20260726010000_trade_negotiation.sql"

STUBS = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE IF NOT EXISTS public.commodity_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity text, quantity_t numeric, incoterm text, unit_price_usd numeric,
  payment_instrument text, updated_at timestamptz DEFAULT now());
"""


@pytest.fixture()
def cur():
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("sin DATABASE_URL (PostGIS) — se corre en CI con el service container")
    psycopg = pytest.importorskip("psycopg")
    conn = psycopg.connect(url, autocommit=True)
    c = conn.cursor()
    for role in ("authenticated", "service_role"):
        c.execute("DO $$ BEGIN CREATE ROLE %s; EXCEPTION WHEN duplicate_object THEN NULL; END $$" % role)
    c.execute("DROP TABLE IF EXISTS public.trade_negotiations, public.commodity_trades CASCADE")
    c.execute(STUBS)
    c.execute(MIG.read_text())
    c.execute("INSERT INTO public.commodity_trades (commodity) VALUES ('Copper Cathode') RETURNING id")
    tid = c.fetchone()[0]
    yield c, tid
    conn.close()


def _propose(c, tid, party, price, replies_to=None, incoterm="CIF"):
    c.execute(
        "SELECT public.propose_trade_terms(%s,%s,%s,%s,%s,NULL,NULL,NULL,NULL,%s,NULL,NULL,%s,%s)",
        (tid, party, price, 1000, incoterm, "DLC a la vista", "Oferta", replies_to),
    )
    return c.fetchone()[0]


def test_oferta_contraoferta_marca_countered(cur):
    c, tid = cur
    o1 = _propose(c, tid, "seller", 9500)
    o2 = _propose(c, tid, "buyer", 9200, replies_to=o1)   # contraoferta
    c.execute("SELECT status FROM public.trade_negotiations WHERE id=%s", (o1,))
    assert c.fetchone()[0] == "countered"
    c.execute("SELECT status FROM public.trade_negotiations WHERE id=%s", (o2,))
    assert c.fetchone()[0] == "proposed"


def test_aceptar_vuelca_terminos_al_trade(cur):
    c, tid = cur
    o1 = _propose(c, tid, "seller", 9500, incoterm="FOB")
    c.execute("SELECT public.respond_trade_terms(%s,'accept')", (o1,))
    c.execute("SELECT unit_price_usd, quantity_t, incoterm, payment_instrument FROM public.commodity_trades WHERE id=%s", (tid,))
    price, qty, incoterm, pay = c.fetchone()
    assert float(price) == 9500 and float(qty) == 1000 and incoterm == "FOB" and pay == "DLC a la vista"
    c.execute("SELECT status FROM public.trade_negotiations WHERE id=%s", (o1,))
    assert c.fetchone()[0] == "accepted"


def test_aceptar_supera_otras_abiertas(cur):
    c, tid = cur
    o1 = _propose(c, tid, "seller", 9500)
    o2 = _propose(c, tid, "buyer", 9300)     # otra abierta, sin replies_to
    c.execute("SELECT public.respond_trade_terms(%s,'accept')", (o1,))
    c.execute("SELECT status FROM public.trade_negotiations WHERE id=%s", (o2,))
    assert c.fetchone()[0] == "superseded"


def test_rechazar(cur):
    c, tid = cur
    o1 = _propose(c, tid, "buyer", 9000)
    c.execute("SELECT public.respond_trade_terms(%s,'reject','muy bajo')", (o1,))
    c.execute("SELECT status, message FROM public.trade_negotiations WHERE id=%s", (o1,))
    st, msg = c.fetchone()
    assert st == "rejected" and msg == "muy bajo"


def test_no_responder_propuesta_cerrada(cur):
    c, tid = cur
    o1 = _propose(c, tid, "seller", 9500)
    c.execute("SELECT public.respond_trade_terms(%s,'accept')", (o1,))
    with pytest.raises(Exception):
        c.execute("SELECT public.respond_trade_terms(%s,'reject')", (o1,))


def test_hilo_de_negociacion_ordenado(cur):
    c, tid = cur
    o1 = _propose(c, tid, "seller", 9500)
    _propose(c, tid, "buyer", 9200, replies_to=o1)
    c.execute("SELECT count(*), array_agg(party ORDER BY created_at) FROM public.get_trade_negotiation(%s)", (tid,))
    n, parties = c.fetchone()
    assert n == 2 and parties == ["seller", "buyer"]
