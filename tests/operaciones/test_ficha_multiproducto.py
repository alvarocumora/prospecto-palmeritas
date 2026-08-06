"""Operaciones · Ficha con varios productos (doré + bullion) y sus términos."""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIGS = [
    "supabase/migrations/20260725240000_trade_products.sql",
    "supabase/migrations/20260804000000_trade_margin_split.sql",
    "supabase/migrations/20260804010000_margin_extra_pool.sql",
    "supabase/migrations/20260804020000_public_ficha.sql",
    "supabase/migrations/20260805000000_trade_products_terms.sql",
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
              "public.import_supplier_offer_to_trade(uuid,uuid) CASCADE")
    c.execute("DROP TABLE IF EXISTS public.trade_commission_splits, public.trade_pricing, "
              "public.trade_products, public.commodity_trades CASCADE")
    c.execute(STUBS)
    for m in MIGS:
        c.execute((ROOT / m).read_text())
    c.execute("INSERT INTO public.commodity_trades (commodity, reference) VALUES ('Gold','AU-202607') RETURNING id")
    tid = c.fetchone()[0]
    c.execute("INSERT INTO public.trade_pricing (trade_id, unit, base_price, sale_price, currency, qty_per_order) "
              "VALUES (%s,'g',113000,117000,'CLP',5000)", (tid,))
    yield c, tid
    conn.close()


def test_ficha_muestra_dore_y_bullion(cur):
    c, tid = cur
    c.execute("INSERT INTO public.trade_products (trade_id, product_name, presentation, purity, "
              "qty_per_order, order_frequency, contract_months) VALUES "
              "(%s,'Oro doré','Barras doré','92-94%%',5000,'weekly',36)", (tid,))
    c.execute("INSERT INTO public.trade_products (trade_id, product_name, presentation, purity, "
              "qty_per_order, order_frequency, contract_months) VALUES "
              "(%s,'Oro bullion','Lingotes 99.99','99.9%%',1000,'weekly',12)", (tid,))
    c.execute("SELECT public.get_trade_public_ficha(%s)", (tid,))
    f = c.fetchone()[0]
    prods = {p["product_name"]: p for p in f["products"]}
    assert set(prods) == {"Oro doré", "Oro bullion"}
    assert prods["Oro doré"]["purity"] == "92-94%" and prods["Oro doré"]["contract_months"] == 36
    assert prods["Oro bullion"]["purity"] == "99.9%" and prods["Oro bullion"]["contract_months"] == 12
    assert float(prods["Oro bullion"]["qty_per_order"]) == 1000
    # sigue sin filtrar base/margen
    import json
    assert "113000" not in json.dumps(f)
