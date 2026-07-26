"""Operaciones · Checklist multi-commodity (oro, antimonio, base genérica).

Verifica: base '*' aplica a cualquier metal; extras específicos se suman; lo
específico no duplica; normalización ES/EN.
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIGS = [
    "supabase/migrations/20260725210000_operation_document_checklist.sql",
    "supabase/migrations/20260725220000_trade_documents_checklist.sql",
    "supabase/migrations/20260726000000_checklist_multicommodity.sql",
]

STUBS = """
CREATE TABLE IF NOT EXISTS public.operations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.operation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id uuid NOT NULL, kind text NOT NULL,
  version integer NOT NULL DEFAULT 1, review_status text DEFAULT 'pending',
  is_frozen boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.commodity_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.trade_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trade_id uuid NOT NULL, doc_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending', signed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
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
    c.execute("DROP FUNCTION IF EXISTS public.trade_documents_checklist(uuid), "
              "public.operation_documents_checklist(uuid), public._commodity_key(text) CASCADE")
    c.execute("DROP TABLE IF EXISTS public.operation_document_structure, public.operation_documents, "
              "public.operations, public.trade_documents, public.commodity_trades CASCADE")
    c.execute(STUBS)
    for m in MIGS:
        c.execute((ROOT / m).read_text())
    yield c
    conn.close()


def _trade(c, commodity):
    c.execute("INSERT INTO public.commodity_trades (commodity) VALUES (%s) RETURNING id", (commodity,))
    tid = c.fetchone()[0]
    c.execute("SELECT doc_kind FROM public.trade_documents_checklist(%s)", (tid,))
    return [r[0] for r in c.fetchall()]


def test_commodity_key_normaliza_es_en(cur):
    c = cur
    for raw, key in [("Gold", "gold"), ("Oro", "gold"), ("Copper Cathode", "copper_cathode"),
                     ("Antimonio", "antimony"), ("Antimony", "antimony"), ("Plata", "silver"),
                     ("Litio", "lithium"), ("Níquel", "nickel"), ("Cobalt", "cobalt")]:
        c.execute("SELECT public._commodity_key(%s)", (raw,))
        assert c.fetchone()[0] == key, f"{raw} -> {key}"


def test_metal_sin_extras_recibe_base_generica(cur):
    kinds = _trade(cur, "Silver")          # plata: sin extras -> solo base '*'
    assert len(kinds) == 40
    assert "mining_permit" in kinds and "ubo_declaration" in kinds
    assert not any(k.startswith("gold_") for k in kinds)


def test_oro_suma_extras_sin_duplicar(cur):
    kinds = _trade(cur, "Oro")
    assert len(kinds) == 43                 # 40 base + 3 extras de oro
    assert {"gold_responsible_sourcing", "gold_refiner_accreditation", "kimberley_provenance"} <= set(kinds)
    assert len(kinds) == len(set(kinds))    # sin duplicados


def test_antimonio_extras(cur):
    kinds = _trade(cur, "Antimony")
    assert {"end_use_statement", "export_control_declaration"} <= set(kinds)


def test_copper_no_duplica_con_base(cur):
    kinds = _trade(cur, "Copper Cathode")
    assert len(kinds) == 40 and len(kinds) == len(set(kinds))   # su propio set gana sobre '*'


def test_readiness_incluye_extras_mandatorios_de_oro(cur):
    c = cur
    c.execute("INSERT INTO public.commodity_trades (commodity) VALUES ('Oro') RETURNING id")
    tid = c.fetchone()[0]
    c.execute("SELECT mandatory_total FROM public.trade_documents_readiness(%s)", (tid,))
    total = c.fetchone()[0]
    # 20 base + gold_responsible_sourcing + kimberley_provenance (2 mandatorios) = 22
    assert total == 22
