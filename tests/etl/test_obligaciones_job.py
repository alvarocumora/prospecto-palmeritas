"""B6 · Test del job de obligaciones contra PostGIS (generación + alertas)."""
import importlib.util
import json
import os
import sys
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("obligaciones_job", ROOT / "etl" / "obligaciones_job.py")
job = importlib.util.module_from_spec(_spec)
sys.modules["obligaciones_job"] = job
_spec.loader.exec_module(job)

MIGS = [
    "supabase/migrations/20260724060000_b2_catastro_etl.sql",
    "supabase/migrations/20260724090000_b5_patentes.sql",
    "supabase/migrations/20260724100000_b6_obligaciones.sql",
]


@pytest.fixture()
def db_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("sin DATABASE_URL — se corre en CI con el service container")
    psycopg = pytest.importorskip("psycopg")
    with psycopg.connect(url, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        cur.execute("SET search_path TO public, extensions")
        for role in ("authenticated", "service_role"):
            cur.execute("DO $$ BEGIN CREATE ROLE %s; EXCEPTION WHEN duplicate_object THEN NULL; END $$" % role)
        cur.execute("DROP TABLE IF EXISTS public.obligacion_alertas, public.obligaciones, "
                    "public.catastro_concesiones, public.etl_corridas, public.fuentes_datos, "
                    "public.patentes_escala, public.valores_utm CASCADE")
        for m in MIGS:
            cur.execute((ROOT / m).read_text())
        cur.execute("INSERT INTO public.fuentes_datos (id, nombre) VALUES ('sernageomin_concesiones','x') ON CONFLICT DO NOTHING")
        cur.execute(
            "INSERT INTO public.catastro_concesiones (fuente_id, external_id, tipo, estado, hectareas, geom, origen_hash) "
            "VALUES ('sernageomin_concesiones','C1','EXPLOTACION','CONSTITUIDA',100,"
            "ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{\"type\":\"Polygon\",\"coordinates\":[[[-71,-35],[-70.99,-35],[-70.99,-34.99],[-71,-34.99],[-71,-35]]]}'),4326)),'h1')"
        )
    return url


def _counts(url):
    import psycopg
    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM public.obligaciones")
        obl = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM public.obligacion_alertas")
        al = cur.fetchone()[0]
        return obl, al


def test_genera_obligacion_de_patente_con_monto(db_url):
    r = job.run(db_url, hoy=date(2026, 1, 10))
    assert r["obligaciones_creadas"] == 1
    import psycopg
    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT tipo, monto_clp, vence_at, periodo FROM public.obligaciones")
        tipo, monto, vence, periodo = cur.fetchone()
        assert tipo == "patente" and periodo == "2026" and str(vence) == "2026-03-31"
        # 100 ha * 0,4 UTM/ha * 71.649 = 2.865.960
        assert float(monto) == pytest.approx(2_865_960, rel=1e-6)


def test_generador_idempotente(db_url):
    job.run(db_url, hoy=date(2026, 1, 10))
    r2 = job.run(db_url, hoy=date(2026, 1, 11))
    assert r2["obligaciones_creadas"] == 0
    obl, _ = _counts(db_url)
    assert obl == 1


def test_alertas_escalonadas_y_idempotentes(db_url):
    # A 6 días del vencimiento: catch-up dispara d90, d30, d7.
    r = job.run(db_url, hoy=date(2026, 3, 25))
    assert r["alertas_disparadas"] == 3
    # Re-correr el mismo día: no reenvía.
    r2 = job.run(db_url, hoy=date(2026, 3, 25))
    assert r2["alertas_disparadas"] == 0


def test_vencida_marca_estado_y_alerta(db_url):
    job.run(db_url, hoy=date(2026, 3, 25))          # crea 2026 + d90/d30/d7
    r = job.run(db_url, hoy=date(2026, 4, 5))        # 2026 vencida + genera 2027
    import psycopg
    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT estado FROM public.obligaciones WHERE periodo='2026'")
        assert cur.fetchone()[0] == "vencida"
        cur.execute("SELECT count(*) FROM public.obligacion_alertas a JOIN public.obligaciones o ON o.id=a.obligacion_id WHERE o.periodo='2026' AND a.umbral='vencido'")
        assert cur.fetchone()[0] == 1
