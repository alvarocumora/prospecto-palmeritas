"""E2E · Flujo completo de una operación de intermediación, todo junto.

Simula un deal real de punta a punta contra el backend (stubs de las tablas de
Lovable): propuesta de sourcing -> trade con productos -> checklist -> subida de
documentos -> screening -> gate de readiness -> negociación -> términos acordados.
Es la prueba de cohesión de todas las piezas.
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIGS = [
    "supabase/migrations/20260725210000_operation_document_checklist.sql",
    "supabase/migrations/20260725220000_trade_documents_checklist.sql",
    "supabase/migrations/20260725230000_trade_screening.sql",
    "supabase/migrations/20260725240000_trade_products.sql",
    "supabase/migrations/20260725250000_trade_products_from_submission.sql",
    "supabase/migrations/20260726000000_checklist_multicommodity.sql",
    "supabase/migrations/20260726010000_trade_negotiation.sql",
    "supabase/migrations/20260726030000_negociacion_por_link.sql",
]

STUBS = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE IF NOT EXISTS public.operations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.operation_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id uuid NOT NULL, kind text NOT NULL,
  version integer NOT NULL DEFAULT 1, review_status text DEFAULT 'pending',
  is_frozen boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.commodity_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text, quantity_t numeric,
  incoterm text, unit_price_usd numeric, payment_instrument text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.trade_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trade_id uuid NOT NULL, doc_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending', signed_at timestamptz, created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.sourcing_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.sourcing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid, quality_grade text,
  offer_quantity_t numeric, offer_price_usd_t numeric, packaging text, supplier_country text,
  incoterm text, specs text, port_loading text, payment_terms text);
CREATE TABLE IF NOT EXISTS public.supplier_offers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL, presentation text, grade_value numeric, grade_unit text,
  tonnage_available_t numeric, tonnage_monthly_t numeric, region text, incoterm text, price_ask text);
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
              "public.trade_documents_readiness(uuid), public.operation_documents_checklist(uuid), "
              "public.get_trade_products(uuid), public.import_supplier_offer_to_trade(uuid,uuid), "
              "public.import_submission_to_trade_products(uuid,uuid), public.record_trade_screening(uuid,text,text,text[],text,text,text), "
              "public.get_trade_screenings(uuid), public._commodity_key(text), "
              "public.propose_trade_terms(uuid,text,numeric,numeric,text,text,text,date,date,text,text,date,text,uuid), "
              "public.respond_trade_terms(uuid,text,text), public.get_trade_negotiation(uuid) CASCADE")
    c.execute("DROP TABLE IF EXISTS public.trade_negotiations, public.trade_screenings, "
              "public.trade_products, public.operation_document_structure, public.operation_documents, "
              "public.operations, public.trade_documents, public.commodity_trades, "
              "public.sourcing_submissions, public.sourcing_requests, public.supplier_offers CASCADE")
    c.execute(STUBS)
    for m in MIGS:
        c.execute((ROOT / m).read_text())
    yield c
    conn.close()


def test_flujo_completo_de_una_operacion(cur):
    c = cur
    UID = "00000000-0000-0000-0000-000000000001"

    # 1) Requerimiento (sourcing) + propuesta del proveedor.
    c.execute("INSERT INTO public.sourcing_requests (commodity) VALUES ('Copper Cathode 99.99%') RETURNING id")
    rid = c.fetchone()[0]
    c.execute("INSERT INTO public.sourcing_submissions (request_id, quality_grade, offer_quantity_t, "
              "offer_price_usd_t, packaging, supplier_country, incoterm, specs, port_loading) "
              "VALUES (%s,'LME Grade A',1000,9500,'Bundles','Chile','CIF','Cátodo Cu','Mejillones') RETURNING id", (rid,))
    sid = c.fetchone()[0]

    # 2) Se convierte en trade y se poblan los productos desde la propuesta.
    c.execute("INSERT INTO public.commodity_trades (commodity) VALUES ('Copper Cathode') RETURNING id")
    tid = c.fetchone()[0]
    c.execute("SELECT public.import_submission_to_trade_products(%s,%s)", (tid, sid))
    c.execute("SELECT product_name, tonnage_total_t, source_submission_id FROM public.get_trade_products(%s)", (tid,))
    prod = c.fetchone()
    assert prod[0] == "Copper Cathode 99.99%" and float(prod[1]) == 1000 and str(prod[2]) == str(sid)

    # 3) Checklist inicial: 40 docs, gate cerrado (20 obligatorios).
    c.execute("SELECT count(*) FROM public.trade_documents_checklist(%s)", (tid,))
    assert c.fetchone()[0] == 40
    c.execute("SELECT mandatory_total, ready FROM public.trade_documents_readiness(%s)", (tid,))
    total, ready = c.fetchone()
    assert total == 20 and ready is False

    # 4) El proveedor sube los 19 documentos obligatorios del vendedor -> aprobados.
    c.execute("SELECT doc_kind FROM public.operation_document_structure "
              "WHERE commodity='copper_cathode' AND obligation='mandatory' AND required_from_role='seller'")
    seller_docs = [r[0] for r in c.fetchall()]
    assert len(seller_docs) == 19
    for k in seller_docs:
        c.execute("INSERT INTO public.trade_documents (trade_id, doc_type, status, created_by) "
                  "VALUES (%s,%s,'verified',%s)", (tid, k, UID))
    c.execute("SELECT mandatory_missing, ready FROM public.trade_documents_readiness(%s)", (tid,))
    missing, ready = c.fetchone()
    assert missing == 1 and ready is False        # falta solo el screening de GC

    # 5) GC registra el screening 'clear' -> satisface sanctions_screening -> gate abre.
    c.execute("SELECT public.record_trade_screening(%s,'ACME Copper SpA','company',%s,'clear')",
              (tid, ["OFAC", "UN", "EU", "UK"]))
    c.execute("SELECT mandatory_missing, ready FROM public.trade_documents_readiness(%s)", (tid,))
    missing, ready = c.fetchone()
    assert missing == 0 and ready is True         # gate ABIERTO: puede pasar a evaluación comercial

    # 6) Negociación: oferta -> contraoferta -> aceptar -> términos al trade.
    c.execute("SELECT public.propose_trade_terms(%s,'seller',9500,1000,'CIF',NULL,NULL,NULL,NULL,'DLC',NULL,NULL,'Oferta',NULL)", (tid,))
    o1 = c.fetchone()[0]
    c.execute("SELECT public.propose_trade_terms(%s,'buyer',9250,1000,'FOB',NULL,NULL,NULL,NULL,'DLC',NULL,NULL,'Contra',%s)", (tid, o1))
    o2 = c.fetchone()[0]
    c.execute("SELECT status FROM public.trade_negotiations WHERE id=%s", (o1,))
    assert c.fetchone()[0] == "countered"
    c.execute("SELECT public.respond_trade_terms(%s,'accept')", (o2,))
    c.execute("SELECT unit_price_usd, incoterm FROM public.commodity_trades WHERE id=%s", (tid,))
    price, incoterm = c.fetchone()
    assert float(price) == 9250 and incoterm == "FOB"   # el trade quedó con los términos acordados

    # 7) El hilo de negociación quedó trazado.
    c.execute("SELECT count(*) FROM public.get_trade_negotiation(%s)", (tid,))
    assert c.fetchone()[0] == 2
