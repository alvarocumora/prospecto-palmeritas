"""Operaciones · Checklist de documentos requeridos (estructura GeoCapitals).

Prueba el RPC operation_documents_checklist / _readiness contra la estructura
sembrada (marco REICON para copper_cathode). Usa stubs mínimos de operations /
operation_documents (la migración real de Lovable arrastra muchas dependencias);
el RPC solo necesita esas columnas.
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "supabase/migrations/20260725210000_operation_document_checklist.sql"

STUBS = """
CREATE TABLE IF NOT EXISTS public.operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity text
);
CREATE TABLE IF NOT EXISTS public.operation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  kind text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  review_status text DEFAULT 'pending',
  is_frozen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
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
    c.execute("DROP TABLE IF EXISTS public.operation_document_structure, public.operation_documents, public.operations CASCADE")
    c.execute(STUBS)
    c.execute(MIG.read_text())
    c.execute("INSERT INTO public.operations (commodity) VALUES ('Copper Cathode') RETURNING id")
    op_id = c.fetchone()[0]
    yield c, op_id
    conn.close()


def _checklist(c, op_id):
    c.execute("SELECT doc_kind, obligation, required_from_role, status FROM public.operation_documents_checklist(%s)", (op_id,))
    return c.fetchall()


def _readiness(c, op_id):
    c.execute("SELECT mandatory_total, mandatory_ok, mandatory_missing, optional_total, ready "
              "FROM public.operation_documents_readiness(%s)", (op_id,))
    return c.fetchone()


def test_seed_copper_cathode_completo(cur):
    c, _ = cur
    c.execute("SELECT count(*) FROM public.operation_document_structure WHERE commodity='copper_cathode'")
    assert c.fetchone()[0] == 40
    # Todo sembrado como 'por confirmar'.
    c.execute("SELECT count(*) FROM public.operation_document_structure WHERE fecha_verificacion IS NOT NULL")
    assert c.fetchone()[0] == 0


def test_checklist_todo_falta_al_inicio(cur):
    c, op_id = cur
    rows = _checklist(c, op_id)
    assert len(rows) == 40
    assert all(r[3] == "falta" for r in rows)          # nada subido aún
    # El commodity 'Copper Cathode' se normalizó a copper_cathode y matcheó.
    assert {r[0] for r in rows} >= {"mining_permit", "ubo_declaration", "sanctions_declaration"}


def test_estados_por_documento(cur):
    c, op_id = cur
    # subido (pending), aprobado, observado, firmado
    c.execute("INSERT INTO public.operation_documents (operation_id, kind, review_status) VALUES (%s,'mining_permit','pending')", (op_id,))
    c.execute("INSERT INTO public.operation_documents (operation_id, kind, review_status) VALUES (%s,'export_authorization','approved')", (op_id,))
    c.execute("INSERT INTO public.operation_documents (operation_id, kind, review_status) VALUES (%s,'certificate_of_origin','rejected')", (op_id,))
    c.execute("INSERT INTO public.operation_documents (operation_id, kind, review_status, is_frozen) VALUES (%s,'upstream_invoice','approved',true)", (op_id,))
    st = {r[0]: r[3] for r in _checklist(c, op_id)}
    assert st["mining_permit"] == "subido"
    assert st["export_authorization"] == "aprobado"
    assert st["certificate_of_origin"] == "observado"
    assert st["upstream_invoice"] == "firmado"


def test_toma_la_ultima_version(cur):
    c, op_id = cur
    c.execute("INSERT INTO public.operation_documents (operation_id, kind, version, review_status) VALUES (%s,'mining_permit',1,'rejected')", (op_id,))
    c.execute("INSERT INTO public.operation_documents (operation_id, kind, version, review_status) VALUES (%s,'mining_permit',2,'approved')", (op_id,))
    st = {r[0]: r[3] for r in _checklist(c, op_id)}
    assert st["mining_permit"] == "aprobado"           # v2 gana


def test_readiness_bloquea_hasta_completar_obligatorios(cur):
    c, op_id = cur
    total, ok, missing, opt, ready = _readiness(c, op_id)
    # Obligatorios reales del marco (mandatory), incluye el screening de GC.
    assert total > 0 and missing == total and ok == 0 and ready is False
    assert opt > 0                                      # hay 'if_available' y 'conditional'
    # Entrego TODOS los obligatorios -> ready True.
    c.execute("SELECT doc_kind FROM public.operation_document_structure WHERE commodity='copper_cathode' AND obligation='mandatory'")
    for (k,) in c.fetchall():
        c.execute("INSERT INTO public.operation_documents (operation_id, kind, review_status) VALUES (%s,%s,'approved')", (op_id, k))
    total2, ok2, missing2, _, ready2 = _readiness(c, op_id)
    assert missing2 == 0 and ok2 == total2 and ready2 is True


def test_mandato_es_condicional_para_broker(cur):
    c, op_id = cur
    c.execute("SELECT obligation, condition FROM public.operation_documents_checklist(%s) WHERE doc_kind='mandate_letter'", (op_id,))
    obligation, condition = c.fetchone()
    assert obligation == "conditional" and condition == "intermediario_o_broker"
