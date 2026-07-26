"""SaaS modular · get_my_modules() según plan (por planes) + bilingüe por feature.

Stubs de subscriptions / billing_plans + auth.uid().
"""
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG = ROOT / "supabase/migrations/20260726020000_saas_modules.sql"

STUBS = """
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text, name text,
  is_default boolean DEFAULT false, display_order integer DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, plan text, status text,
  current_period_end timestamptz);
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
    c.execute("DROP FUNCTION IF EXISTS public.get_my_modules() CASCADE")
    c.execute("DROP TABLE IF EXISTS public.plan_entitlements, public.modules_catalog, "
              "public.subscriptions, public.billing_plans CASCADE")
    c.execute(STUBS)
    c.execute(MIG.read_text())
    yield c
    conn.close()


def _modules(c):
    c.execute("SELECT public.get_my_modules()")
    return c.fetchone()[0]


def test_catalogo_bilingue(cur):
    c = cur
    c.execute("SELECT key, name_es, name_en FROM public.modules_catalog WHERE gated ORDER BY display_order")
    rows = c.fetchall()
    keys = [r[0] for r in rows]
    assert keys == ["catastro", "commodities", "capital"]
    assert all(r[1] and r[2] for r in rows)      # ambos idiomas


def test_sin_config_es_unrestricted_todos_los_modulos(cur):
    c = cur
    c.execute("INSERT INTO public.billing_plans (code, is_default) VALUES ('free', true)")
    r = _modules(c)
    assert r["unrestricted"] is True
    assert {m["key"] for m in r["modules"]} == {"catastro", "commodities", "capital"}
    assert r["features"] == []


def test_plan_restringe_a_commodities(cur):
    c = cur
    c.execute("INSERT INTO public.billing_plans (code, is_default) VALUES ('free', true)")
    c.execute("INSERT INTO public.subscriptions (user_id, plan, status) VALUES "
              "('00000000-0000-0000-0000-000000000001','trading','active')")
    c.execute("INSERT INTO public.plan_entitlements (plan_code, kind, key) VALUES "
              "('trading','module','commodities')")
    r = _modules(c)
    assert r["plan_code"] == "trading" and r["unrestricted"] is False
    assert {m["key"] for m in r["modules"]} == {"commodities"}


def test_bilingue_por_plan_feature(cur):
    c = cur
    c.execute("INSERT INTO public.billing_plans (code, is_default) VALUES ('pro', true)")
    c.execute("INSERT INTO public.subscriptions (user_id, plan, status) VALUES "
              "('00000000-0000-0000-0000-000000000001','pro','active')")
    c.execute("INSERT INTO public.plan_entitlements (plan_code, kind, key) VALUES "
              "('pro','module','catastro'),('pro','module','commodities'),('pro','feature','bilingual_docs')")
    r = _modules(c)
    assert "bilingual_docs" in r["features"]
    assert {m["key"] for m in r["modules"]} == {"catastro", "commodities"}


def test_suscripcion_inactiva_cae_a_default(cur):
    c = cur
    c.execute("INSERT INTO public.billing_plans (code, is_default) VALUES ('free', true)")
    c.execute("INSERT INTO public.subscriptions (user_id, plan, status) VALUES "
              "('00000000-0000-0000-0000-000000000001','trading','canceled')")
    c.execute("INSERT INTO public.plan_entitlements (plan_code, kind, key) VALUES ('trading','module','commodities')")
    r = _modules(c)
    # suscripción cancelada => usa 'free' (default) sin entitlements => unrestricted
    assert r["plan_code"] == "free" and r["unrestricted"] is True
