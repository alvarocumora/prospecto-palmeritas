"""Operaciones · Margen y repartición de comisiones.

Verifica: público solo ve el precio de venta; el reparto interno es staff-only y
calcula bien cada share_kind; el margen y remanente cuadran.
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "supabase/migrations/20260804000000_trade_margin_split.sql"
MIG2 = ROOT / "supabase/migrations/20260804010000_margin_extra_pool.sql"

STUBS = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
  AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION public.is_gc_staff(uuid) RETURNS boolean LANGUAGE sql STABLE
  AS $$ SELECT true $$;
CREATE TABLE IF NOT EXISTS public.commodity_trades (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commodity text);
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
    c.execute("DROP TABLE IF EXISTS public.trade_commission_splits, public.trade_pricing, public.commodity_trades CASCADE")
    c.execute(STUBS)
    c.execute(MIG.read_text())
    c.execute(MIG2.read_text())      # pool extra
    c.execute("INSERT INTO public.commodity_trades (commodity) VALUES ('Gold') RETURNING id")
    tid = c.fetchone()[0]
    # base 100 / venta 120 / 10 unidades => margen 200
    c.execute("INSERT INTO public.trade_pricing (trade_id, unit, base_price, sale_price, currency, qty_per_order) "
              "VALUES (%s,'g',100,120,'CLP',10)", (tid,))
    yield c, tid
    conn.close()


def test_publico_solo_ve_precio_de_venta(cur):
    c, tid = cur
    c.execute("SELECT unit, sale_price, currency, qty_per_order FROM public.get_trade_public_price(%s)", (tid,))
    unit, sale, cur_, qty = c.fetchone()
    assert unit == "g" and float(sale) == 120 and cur_ == "CLP" and float(qty) == 10
    # el RPC público NO expone base_price ni margen (no están entre sus columnas)
    cols = [d.name for d in c.description]
    assert "base_price" not in cols and "margin" not in cols


def test_margen_y_reparto_cuadran(cur):
    c, tid = cur
    c.execute("INSERT INTO public.trade_commission_splits (trade_id, beneficiary_type, beneficiary_name, share_kind, share_value, sort) VALUES "
              "(%s,'internal_pool','GeoCapitals','fixed_per_order',50,0),"
              "(%s,'operator','Op A','pct_of_margin',25,1),"
              "(%s,'operator','Op B','per_unit',5,2)", (tid, tid, tid))
    c.execute("SELECT public.get_trade_margin_split(%s)", (tid,))
    r = c.fetchone()[0]
    assert float(r["margin"]) == 200 and float(r["order_value"]) == 1200 and float(r["seller_cost"]) == 1000
    amt = {d["name"]: float(d["amount"]) for d in r["distribution"]}
    assert amt["GeoCapitals"] == 50           # fixed_per_order
    assert amt["Op A"] == 50                  # 25% de 200
    assert amt["Op B"] == 50                  # 5 por unidad * 10
    assert float(r["distributed"]) == 150 and float(r["remaining"]) == 50


def test_qty_override(cur):
    c, tid = cur
    c.execute("INSERT INTO public.trade_commission_splits (trade_id, beneficiary_type, beneficiary_name, share_kind, share_value) "
              "VALUES (%s,'operator','Op','pct_of_margin',100)", (tid,))
    c.execute("SELECT public.get_trade_margin_split(%s, 20)", (tid,))   # qty 20 en vez de 10
    r = c.fetchone()[0]
    assert float(r["margin"]) == 400 and float(r["distribution"][0]["amount"]) == 400


def test_deal_oro_pool_extra_reparte_en_4(cur):
    # Caso real: base 113.000 / venta 117.000 / 5.000 g => margen 20.000.000.
    # + pool extra 5.000.000 => distributable 25.000.000, repartido en 4 = 6.250.000 c/u.
    c, tid = cur
    c.execute("DELETE FROM public.trade_pricing WHERE trade_id=%s", (tid,))
    c.execute("INSERT INTO public.trade_pricing (trade_id, unit, base_price, sale_price, currency, "
              "qty_per_order, extra_pool_per_order) VALUES (%s,'g',113000,117000,'CLP',5000,5000000)", (tid,))
    for i in range(1, 5):
        c.execute("INSERT INTO public.trade_commission_splits (trade_id, beneficiary_type, beneficiary_name, "
                  "share_kind, share_value, sort) VALUES (%s,'operator',%s,'fixed_per_order',6250000,%s)",
                  (tid, f"Socio {i}", i))
    c.execute("SELECT public.get_trade_margin_split(%s)", (tid,))
    r = c.fetchone()[0]
    assert float(r["margin"]) == 20000000 and float(r["extra_pool"]) == 5000000
    assert float(r["distributable"]) == 25000000
    assert float(r["distributed"]) == 25000000 and float(r["remaining"]) == 0
    assert all(float(d["amount"]) == 6250000 for d in r["distribution"])


def test_reparto_es_staff_only(cur):
    c, tid = cur
    c.execute("CREATE OR REPLACE FUNCTION public.is_gc_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$")
    with pytest.raises(Exception):
        c.execute("SELECT public.get_trade_margin_split(%s)", (tid,))
    c.execute("CREATE OR REPLACE FUNCTION public.is_gc_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$")
    # el público SÍ puede ver el precio de venta aunque no sea staff
    c.execute("CREATE OR REPLACE FUNCTION public.is_gc_staff(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$")
    c.execute("SELECT sale_price FROM public.get_trade_public_price(%s)", (tid,))
    assert float(c.fetchone()[0]) == 120
