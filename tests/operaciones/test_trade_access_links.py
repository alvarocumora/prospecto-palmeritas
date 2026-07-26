"""Operaciones (spine Trades) · Gobernanza de accesos (get_trade_access_links).

Verifica que devuelve buyer/seller con prefix + activo, sin exponer el hash.
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "supabase/migrations/20260725260000_trade_access_links.sql"

STUBS = """
CREATE TABLE IF NOT EXISTS public.commodity_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counterparty_buyer_email text, counterparty_buyer_token_hash text, counterparty_buyer_token_prefix text,
  counterparty_seller_email text, counterparty_seller_token_hash text, counterparty_seller_token_prefix text);
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
    c.execute("DROP FUNCTION IF EXISTS public.get_trade_access_links(uuid) CASCADE")
    c.execute("DROP TABLE IF EXISTS public.commodity_trades CASCADE")
    c.execute(STUBS)
    c.execute(MIG.read_text())
    yield c
    conn.close()


def test_buyer_activo_seller_inactivo(cur):
    c = cur
    c.execute(
        "INSERT INTO public.commodity_trades "
        "(counterparty_buyer_email, counterparty_buyer_token_hash, counterparty_buyer_token_prefix, "
        " counterparty_seller_email) "
        "VALUES ('buyer@acme.com','deadbeefhash','ab12cd', 'seller@mine.cl') RETURNING id"
    )
    tid = c.fetchone()[0]
    c.execute("SELECT party, email, token_prefix, active FROM public.get_trade_access_links(%s) ORDER BY party", (tid,))
    rows = c.fetchall()
    by = {r[0]: r for r in rows}
    assert by["buyer"][1] == "buyer@acme.com" and by["buyer"][2] == "ab12cd" and by["buyer"][3] is True
    assert by["seller"][1] == "seller@mine.cl" and by["seller"][2] is None and by["seller"][3] is False


def test_no_expone_hash(cur):
    c = cur
    # el RPC no tiene ninguna columna de hash en su salida
    c.execute("INSERT INTO public.commodity_trades (counterparty_buyer_token_hash) VALUES ('secreto') RETURNING id")
    tid = c.fetchone()[0]
    c.execute("SELECT * FROM public.get_trade_access_links(%s)", (tid,))
    cols = [d.name for d in c.description]
    assert "token_hash" not in cols and all("hash" not in col for col in cols)
