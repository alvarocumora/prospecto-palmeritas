"""Operaciones (spine Trades) · Puente propuesta de sourcing -> productos del trade.

Verifica que import_submission_to_trade_products mapea la oferta del proveedor y deja
el vínculo source_submission_id. Stubs de sourcing_* + commodity_trades + auth.uid().
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG_PROD = ROOT / "supabase/migrations/20260725240000_trade_products.sql"
MIG_BRIDGE = ROOT / "supabase/migrations/20260725250000_trade_products_from_submission.sql"

STUBS = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE IF NOT EXISTS public.commodity_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.supplier_offers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL, presentation text, grade_value numeric, grade_unit text,
  tonnage_available_t numeric, tonnage_monthly_t numeric, region text, incoterm text, price_ask text);
CREATE TABLE IF NOT EXISTS public.sourcing_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.sourcing_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid,
  quality_grade text, offer_quantity_t numeric, offer_price_usd_t numeric,
  packaging text, supplier_country text, incoterm text, specs text,
  port_loading text, payment_terms text);
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
    c.execute("DROP FUNCTION IF EXISTS public.get_trade_products(uuid), "
              "public.import_supplier_offer_to_trade(uuid,uuid), "
              "public.import_submission_to_trade_products(uuid,uuid) CASCADE")
    c.execute("DROP TABLE IF EXISTS public.trade_products, public.sourcing_submissions, "
              "public.sourcing_requests, public.supplier_offers, public.commodity_trades CASCADE")
    c.execute(STUBS)
    c.execute(MIG_PROD.read_text())
    c.execute(MIG_BRIDGE.read_text())
    c.execute("INSERT INTO public.commodity_trades (commodity) VALUES ('Copper Cathode') RETURNING id")
    tid = c.fetchone()[0]
    c.execute("INSERT INTO public.sourcing_requests (commodity) VALUES ('Cátodo de cobre 99.99%') RETURNING id")
    rid = c.fetchone()[0]
    yield c, tid, rid
    conn.close()


def test_import_submission_mapea_y_vincula(cur):
    c, tid, rid = cur
    c.execute(
        "INSERT INTO public.sourcing_submissions (request_id, quality_grade, offer_quantity_t, "
        "offer_price_usd_t, packaging, supplier_country, incoterm, specs, port_loading, payment_terms) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (rid, "Grade A", 3000, 9450.5, "Bundles 2.5t", "Chile", "CIF", "LME Grade A cathode",
         "Mejillones", "LC at sight"),
    )
    sid = c.fetchone()[0]
    c.execute("SELECT public.import_submission_to_trade_products(%s,%s)", (tid, sid))
    pid = c.fetchone()[0]
    assert pid is not None
    c.execute("SELECT product_name, purity, tonnage_total_t, price_usd, incoterm, origin_country, "
              "packaging, notes, source_submission_id, added_by_role "
              "FROM public.get_trade_products(%s)", (tid,))
    name, purity, tons, price, incoterm, country, packaging, notes, src, role = c.fetchone()
    assert name == "Cátodo de cobre 99.99%"          # del commodity del requerimiento
    assert purity == "Grade A" and float(tons) == 3000 and float(price) == 9450.5
    assert incoterm == "CIF" and country == "Chile" and packaging == "Bundles 2.5t"
    assert "LME Grade A cathode" in notes and "Puerto carga: Mejillones" in notes
    assert str(src) == str(sid) and role == "seller"


def test_import_submission_inexistente_falla(cur):
    c, tid, _ = cur
    import uuid
    with pytest.raises(Exception):
        c.execute("SELECT public.import_submission_to_trade_products(%s,%s)", (tid, str(uuid.UUID(int=0))))


def test_get_trade_products_expone_source_submission(cur):
    c, tid, _ = cur
    # inserto directo sin submission: source_submission_id NULL, columna presente.
    c.execute("INSERT INTO public.trade_products (trade_id, product_name) VALUES (%s,'X')", (tid,))
    c.execute("SELECT source_submission_id FROM public.get_trade_products(%s)", (tid,))
    assert c.fetchone()[0] is None
