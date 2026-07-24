"""B2 · Tests del ETL de catastro (versionado temporal + idempotencia).

Determinista: mockea la descarga (fetch_all) con un FeatureCollection controlado,
así corre en CI sin depender de la red. Requiere DATABASE_URL con PostGIS
(el workflow provee el service container); se salta si no está.
"""
import importlib.util
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

# Cargar el módulo ETL por ruta (el dir /etl no es un paquete importable).
_spec = importlib.util.spec_from_file_location(
    "sernageomin_concesiones", ROOT / "etl" / "sernageomin_concesiones.py"
)
etl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(etl)

MIGRATION = ROOT / "supabase/migrations/20260724060000_b2_catastro_etl.sql"


def _feature(ext_id, nombre, extra=None):
    props = {"ID_CONCESION": ext_id, "NUMERO_ROL": "R" + ext_id, "NOMBRE": nombre,
             "TIPO_CONCESION": "EXPLOTACION", "SITUACION_CONCESION": "VIGENTE",
             "TITULAR_NOMBRE": "TITULAR X", "HECTAREAS": 100, "COMUNA": "MOLINA",
             "DATUM": "0", **(extra or {})}
    geom = {"type": "Polygon", "coordinates": [[[-71.0, -35.0], [-70.99, -35.0],
             [-70.99, -34.99], [-71.0, -34.99], [-71.0, -35.0]]]}
    return {"type": "Feature", "properties": props, "geometry": geom}


@pytest.fixture()
def db_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("sin DATABASE_URL (PostGIS) — se corre en CI con el service container")
    psycopg = pytest.importorskip("psycopg")
    with psycopg.connect(url, autocommit=True) as conn, conn.cursor() as cur:
        # PostGIS en public (imagen postgis/postgis del CI); search_path lo cubre.
        cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        cur.execute("SET search_path TO public, extensions")
        for role in ("authenticated", "service_role"):
            cur.execute(
                "DO $$ BEGIN CREATE ROLE %s; EXCEPTION WHEN duplicate_object THEN NULL; END $$"
                % role
            )
        cur.execute(
            "DROP TABLE IF EXISTS public.catastro_concesiones, public.etl_corridas, "
            "public.fuentes_datos CASCADE"
        )
        cur.execute(MIGRATION.read_text())
    return url


def _run(db_url, features, monkeypatch, bbox=(-71.1, -35.1, -70.9, -34.9)):
    monkeypatch.setattr(etl, "fetch_all", lambda *_a, **_k: features)
    return etl.run(db_url, bbox, None)


def _count(db_url):
    import psycopg

    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) FILTER (WHERE valid_to IS NULL), count(*) "
            "FROM public.catastro_concesiones"
        )
        return cur.fetchone()


def test_insert_y_geom(db_url, monkeypatch):
    r = _run(db_url, [_feature("1", "A"), _feature("2", "B")], monkeypatch)
    assert r["nuevos"] == 2 and r["cerrados"] == 0
    actuales, total = _count(db_url)
    assert actuales == 2 and total == 2


def test_idempotente(db_url, monkeypatch):
    feats = [_feature("1", "A"), _feature("2", "B")]
    _run(db_url, feats, monkeypatch)
    r2 = _run(db_url, feats, monkeypatch)
    assert r2["nuevos"] == 0 and r2["cerrados"] == 0
    assert _count(db_url) == (2, 2)


def test_versionado_al_cambiar(db_url, monkeypatch):
    _run(db_url, [_feature("1", "A")], monkeypatch)
    # La concesión "1" cambia de estado → cerrar anterior + insertar nueva.
    r = _run(db_url, [_feature("1", "A", {"SITUACION_CONCESION": "CADUCADA"})], monkeypatch)
    assert r["nuevos"] == 1 and r["cerrados"] == 1
    actuales, total = _count(db_url)
    assert actuales == 1 and total == 2  # 1 vigente + 1 histórica


def test_dataset_hash_sin_cambios(db_url, monkeypatch):
    # Con bbox=None se activa el corto-circuito por hash de dataset.
    feats = [_feature("1", "A")]
    monkeypatch.setattr(etl, "fetch_all", lambda *_a, **_k: feats)
    etl.run(db_url, None, None)
    r2 = etl.run(db_url, None, None)
    assert r2["estado"] == "sin_cambios"
