"""Operaciones · Ficha con desglose de precio opcional (producer + fee -> final)."""
import json
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
    "supabase/migrations/20260805010000_ficha_price_breakdown.sql",
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
    yield c, tid
    conn.close()


def _ficha(c, tid):
    c.execute("SELECT public.get_trade_public_ficha(%s)", (tid,))
    return c.fetchone()[0]


def test_sin_flag_oculta_base(cur):
    c, tid = cur
    c.execute("INSERT INTO public.trade_pricing (trade_id, base_price, sale_price, currency) VALUES (%s,113000,117000,'CLP')", (tid,))
    f = _ficha(c, tid)
    assert f["pricing"]["show_breakdown"] is False
    assert f["pricing"]["producer_price"] is None and f["pricing"]["platform_fee"] is None
    assert "113000" not in json.dumps(f)          # base oculta por defecto


def test_con_flag_muestra_desglose(cur):
    c, tid = cur
    c.execute("INSERT INTO public.trade_pricing (trade_id, base_price, sale_price, currency, show_price_breakdown) "
              "VALUES (%s,113000,117000,'CLP',true)", (tid,))
    f = _ficha(c, tid)
    assert f["pricing"]["show_breakdown"] is True
    assert float(f["pricing"]["producer_price"]) == 113000      # 113
    assert float(f["pricing"]["platform_fee"]) == 4000          # comisión + DD
    assert float(f["pricing"]["sale_price"]) == 117000          # final
    # el reparto interno NO aparece
    assert "6250000" not in json.dumps(f) and "distribut" not in json.dumps(f)
