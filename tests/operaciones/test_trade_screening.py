"""Operaciones (spine Trades) · Registro de screening de sanciones.

Verifica que record_trade_screening satisface (o bloquea) la fila mandatory
'sanctions_screening' del checklist REICON, destrabando el gate 'ready'.
Stubs mínimos + stub de auth.uid() (Supabase) para el SECURITY DEFINER.
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG_STRUCT = ROOT / "supabase/migrations/20260725210000_operation_document_checklist.sql"
MIG_TRADE = ROOT / "supabase/migrations/20260725220000_trade_documents_checklist.sql"
MIG_SCREEN = ROOT / "supabase/migrations/20260725230000_trade_screening.sql"

STUBS = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE IF NOT EXISTS public.operations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.operation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id uuid NOT NULL, kind text NOT NULL,
  version integer NOT NULL DEFAULT 1, review_status text DEFAULT 'pending',
  is_frozen boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.commodity_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.trade_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trade_id uuid NOT NULL, doc_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending', signed_at timestamptz, created_by uuid,
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
    c.execute("DROP TABLE IF EXISTS public.trade_screenings, public.operation_document_structure, "
              "public.operation_documents, public.operations, public.trade_documents, "
              "public.commodity_trades CASCADE")
    c.execute(STUBS)
    c.execute(MIG_STRUCT.read_text())
    c.execute(MIG_TRADE.read_text())
    c.execute(MIG_SCREEN.read_text())
    c.execute("INSERT INTO public.commodity_trades (commodity) VALUES ('Copper Cathode') RETURNING id")
    tid = c.fetchone()[0]
    yield c, tid
    conn.close()


def _status_of(c, tid, doc_kind):
    c.execute("SELECT status FROM public.trade_documents_checklist(%s) WHERE doc_kind=%s", (tid, doc_kind))
    return c.fetchone()[0]


def _screen(c, tid, outcome, subject="ACME Copper SpA"):
    c.execute("SELECT public.record_trade_screening(%s,%s,'company',%s,%s)",
              (tid, subject, ["OFAC", "UN", "EU", "UK"], outcome))


def test_pendiente_no_satisface(cur):
    c, tid = cur
    assert _status_of(c, tid, "sanctions_screening") == "falta"
    _screen(c, tid, "pending")
    assert _status_of(c, tid, "sanctions_screening") == "falta"   # sigue sin satisfacer


def test_clear_satisface(cur):
    c, tid = cur
    _screen(c, tid, "clear")
    assert _status_of(c, tid, "sanctions_screening") == "aprobado"


def test_hit_bloquea(cur):
    c, tid = cur
    _screen(c, tid, "clear", subject="Buyer Co")
    _screen(c, tid, "hit", subject="Seller UBO")     # un hit manda
    assert _status_of(c, tid, "sanctions_screening") == "observado"


def test_requiere_autenticacion(cur):
    c, tid = cur
    c.execute("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$")
    with pytest.raises(Exception):
        _screen(c, tid, "clear")
    # restaurar para no afectar otros tests del mismo proceso
    c.execute("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$")


def test_screening_destraba_ready(cur):
    c, tid = cur
    # Todos los obligatorios del vendedor (19) verificados; falta el screening de GC.
    c.execute("SELECT doc_kind FROM public.operation_document_structure "
              "WHERE commodity='copper_cathode' AND obligation='mandatory' AND required_from_role='seller'")
    for (k,) in c.fetchall():
        c.execute("INSERT INTO public.trade_documents (trade_id, doc_type, status, created_by) "
                  "VALUES (%s,%s,'verified','00000000-0000-0000-0000-000000000001')", (tid, k))
    c.execute("SELECT ready FROM public.trade_documents_readiness(%s)", (tid,))
    assert c.fetchone()[0] is False          # bloqueado por el screening
    _screen(c, tid, "clear")
    c.execute("SELECT mandatory_missing, ready FROM public.trade_documents_readiness(%s)", (tid,))
    missing, ready = c.fetchone()
    assert missing == 0 and ready is True    # screening clear destraba el gate


def test_get_screenings_lista(cur):
    c, tid = cur
    _screen(c, tid, "clear", subject="ACME")
    _screen(c, tid, "clear", subject="UBO Juan")
    c.execute("SELECT count(*) FROM public.get_trade_screenings(%s)", (tid,))
    assert c.fetchone()[0] == 2
