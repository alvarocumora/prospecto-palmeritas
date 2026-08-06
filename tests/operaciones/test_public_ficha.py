"""Operaciones · Ficha pública segura (get_trade_public_ficha).

Verifica que devuelve commodity + specs + precio de venta, y NUNCA base/margen/reparto.
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIGS = [
    "supabase/migrations/20260725240000_trade_products.sql",
    "supabase/migrations/20260804000000_trade_margin_split.sql",
    "supabase/migrations/20260804010000_margin_extra_pool.sql",
    "supabase/migrations/20260804020000_public_ficha.sql",
]

STUBS = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION public.is_gc_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE TABLE IF NOT EXISTS public.commodity_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text, reference text);
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
    c.execute("DROP FUNCTION IF EXISTS public.get_trade_products(uuid), public.get_trade_public_ficha(uuid), "
              "public.get_trade_margin_split(uuid,numeric), public.get_trade_public_price(uuid), "
              "public.import_supplier_offer_to_trade(uuid,uuid), public.import_submission_to_trade_products(uuid,uuid) CASCADE")
    c.execute("DROP TABLE IF EXISTS public.trade_commission_splits, public.trade_pricing, "
              "public.trade_products, public.commodity_trades CASCADE")
    c.execute(STUBS)
    for m in MIGS:
        c.execute((ROOT / m).read_text())
    c.execute("INSERT INTO public.commodity_trades (commodity, reference) VALUES ('Gold','GC-AU-0001') RETURNING id")
    tid = c.fetchone()[0]
    c.execute("INSERT INTO public.trade_pricing (trade_id, unit, base_price, sale_price, currency, qty_per_order, extra_pool_per_order) "
              "VALUES (%s,'g',113000,117000,'CLP',5000,5000000)", (tid,))
    c.execute("INSERT INTO public.trade_products (trade_id, product_name, presentation, purity, origin_country) "
              "VALUES (%s,'Oro doré','Doré','92-94%%','Chile')", (tid,))
    yield c, tid
    conn.close()


def test_ficha_publica_muestra_venta_no_margen(cur):
    c, tid = cur
    c.execute("SELECT public.get_trade_public_ficha(%s)", (tid,))
    f = c.fetchone()[0]
    assert f["commodity"] == "Gold" and f["reference"] == "GC-AU-0001"
    assert float(f["pricing"]["sale_price"]) == 117000          # precio de venta público
    assert f["pricing"]["currency"] == "CLP"
    assert f["products"][0]["product_name"] == "Oro doré" and f["products"][0]["purity"] == "92-94%"

    # el JSON serializado NO contiene base_price, margen ni reparto
    import json
    blob = json.dumps(f)
    assert "113000" not in blob and "base_price" not in blob
    assert "margin" not in blob and "extra_pool" not in blob and "distribut" not in blob
    assert "6250000" not in blob and "20000000" not in blob
