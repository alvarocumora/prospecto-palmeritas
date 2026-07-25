"""Operaciones (spine Trades) · Checklist de documentos sobre commodity_trades.

Reusa el catálogo REICON (operation_document_structure) sobre el sistema cableado.
Stubs mínimos de commodity_trades / trade_documents (la migración real de Lovable
arrastra dependencias); el RPC solo necesita esas columnas.
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG_STRUCT = ROOT / "supabase/migrations/20260725210000_operation_document_checklist.sql"
MIG_TRADE = ROOT / "supabase/migrations/20260725220000_trade_documents_checklist.sql"

STUBS = """
CREATE TABLE IF NOT EXISTS public.operations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.operation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id uuid NOT NULL, kind text NOT NULL,
  version integer NOT NULL DEFAULT 1, review_status text DEFAULT 'pending',
  is_frozen boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.commodity_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.trade_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trade_id uuid NOT NULL, doc_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending', signed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now());
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
    c.execute("DROP TABLE IF EXISTS public.operation_document_structure, public.operation_documents, "
              "public.operations, public.trade_documents, public.commodity_trades CASCADE")
    c.execute(STUBS)
    c.execute(MIG_STRUCT.read_text())   # crea operation_document_structure + seed REICON
    c.execute(MIG_TRADE.read_text())    # crea los RPC sobre trades
    c.execute("INSERT INTO public.commodity_trades (commodity) VALUES ('Copper Cathode') RETURNING id")
    tid = c.fetchone()[0]
    yield c, tid
    conn.close()


def _checklist(c, tid):
    c.execute("SELECT doc_kind, obligation, status FROM public.trade_documents_checklist(%s)", (tid,))
    return c.fetchall()


def test_reusa_catalogo_reicon_sobre_trades(cur):
    c, tid = cur
    rows = _checklist(c, tid)
    assert len(rows) == 40                       # mismo catálogo copper_cathode
    assert all(r[2] == "falta" for r in rows)


def test_estados_trade_documents(cur):
    c, tid = cur
    c.execute("INSERT INTO public.trade_documents (trade_id, doc_type, status) VALUES (%s,'mining_permit','uploaded')", (tid,))
    c.execute("INSERT INTO public.trade_documents (trade_id, doc_type, status) VALUES (%s,'export_authorization','verified')", (tid,))
    c.execute("INSERT INTO public.trade_documents (trade_id, doc_type, status) VALUES (%s,'certificate_of_origin','rejected')", (tid,))
    c.execute("INSERT INTO public.trade_documents (trade_id, doc_type, status, signed_at) VALUES (%s,'upstream_invoice','signed',now())", (tid,))
    st = {r[0]: r[2] for r in _checklist(c, tid)}
    assert st["mining_permit"] == "subido"
    assert st["export_authorization"] == "aprobado"
    assert st["certificate_of_origin"] == "observado"
    assert st["upstream_invoice"] == "firmado"


def test_readiness_sobre_trades(cur):
    c, tid = cur
    c.execute("SELECT mandatory_total, mandatory_missing, ready FROM public.trade_documents_readiness(%s)", (tid,))
    total, missing, ready = c.fetchone()
    assert total > 0 and missing == total and ready is False
    c.execute("SELECT doc_kind FROM public.operation_document_structure WHERE commodity='copper_cathode' AND obligation='mandatory'")
    for (k,) in c.fetchall():
        c.execute("INSERT INTO public.trade_documents (trade_id, doc_type, status) VALUES (%s,%s,'verified')", (tid, k))
    c.execute("SELECT mandatory_missing, ready FROM public.trade_documents_readiness(%s)", (tid,))
    missing2, ready2 = c.fetchone()
    assert missing2 == 0 and ready2 is True
