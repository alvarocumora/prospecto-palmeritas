"""Operaciones (spine Trades) · Productos por operación + reconciliación de oferta.

Stubs mínimos de commodity_trades / supplier_offers + stub de auth.uid().
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "supabase/migrations/20260725240000_trade_products.sql"

STUBS = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE IF NOT EXISTS public.commodity_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
CREATE TABLE IF NOT EXISTS public.supplier_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
    c.execute("DROP FUNCTION IF EXISTS public.get_trade_products(uuid), "
              "public.import_supplier_offer_to_trade(uuid,uuid), "
              "public.import_submission_to_trade_products(uuid,uuid) CASCADE")
    c.execute("DROP TABLE IF EXISTS public.trade_products, public.supplier_offers, public.commodity_trades CASCADE")
    c.execute(STUBS)
    c.execute(MIG.read_text())
    c.execute("INSERT INTO public.commodity_trades (commodity) VALUES ('Copper Cathode') RETURNING id")
    tid = c.fetchone()[0]
    yield c, tid
    conn.close()


def test_insert_directo_y_get(cur):
    c, tid = cur
    c.execute("INSERT INTO public.trade_products (trade_id, product_name, presentation, grade_value, grade_unit) "
              "VALUES (%s,'Cátodo de cobre','Cátodo LME grado A',99.99,'%%')", (tid,))
    c.execute("SELECT product_name, status, added_by_role FROM public.get_trade_products(%s)", (tid,))
    name, status, role = c.fetchone()
    assert name == "Cátodo de cobre" and status == "offered" and role == "seller"


def test_status_check(cur):
    c, tid = cur
    with pytest.raises(Exception):
        c.execute("INSERT INTO public.trade_products (trade_id, product_name, status) VALUES (%s,'X','inventado')", (tid,))


def test_import_supplier_offer_reconcilia(cur):
    c, tid = cur
    c.execute(
        "INSERT INTO public.supplier_offers (product, presentation, grade_value, grade_unit, "
        "tonnage_available_t, tonnage_monthly_t, region, incoterm, price_ask) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        ("Cátodo Cu", "Cátodo", 99.97, "%", 5000, 500, "Antofagasta", "FOB", "LME - 5%"),
    )
    offer_id = c.fetchone()[0]
    c.execute("SELECT public.import_supplier_offer_to_trade(%s,%s)", (tid, offer_id))
    prod_id = c.fetchone()[0]
    assert prod_id is not None
    c.execute("SELECT product_name, grade_value, tonnage_total_t, incoterm, price_note, "
              "source_supplier_offer_id FROM public.get_trade_products(%s)", (tid,))
    name, grade, tons, incoterm, price_note, src = c.fetchone()
    assert name == "Cátodo Cu" and float(grade) == 99.97 and float(tons) == 5000
    assert incoterm == "FOB" and price_note == "LME - 5%"
    assert str(src) == str(offer_id)      # vínculo al origen preservado


def test_import_offer_inexistente_falla(cur):
    c, tid = cur
    import uuid
    with pytest.raises(Exception):
        c.execute("SELECT public.import_supplier_offer_to_trade(%s,%s)", (tid, str(uuid.UUID(int=0))))
