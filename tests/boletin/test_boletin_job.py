"""B3 · Test del job del boletín contra PostGIS.

Verifica: ingesta idempotente, cruce espacial con buffer (dentro/proximidad) y
que los registros de baja confianza queden en la cola de revisión.
"""
import importlib.util
import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


bp = _load("boletin_parser", "packages/reglas/boletin_parser.py")
job = _load("boletin_job", "etl/boletin_job.py")

MIGS = [
    "supabase/migrations/20260724060000_b2_catastro_etl.sql",
    "supabase/migrations/20260725000000_b3_boletin.sql",
]

# Coordenada PSAD56 del registro geolocalizable (huso 19). El polígono de catastro
# se construye alrededor de su proyección WGS84 para forzar el cruce.
ESTE, NORTE, HUSO = 365000.0, 6970000.0, 19
LON, LAT = bp.psad56_utm_a_wgs84(ESTE, NORTE, HUSO)

TEXTO = (
    "BOLETÍN DE PRUEBA\n---\n"
    f"Tipo: Pedimento\nRol: 03201-1234-5\nNombre: MINA EJEMPLO 1\n"
    f"Titular: Compañía Minera Ejemplo SpA\nComuna: Copiapó\n"
    f"Este: {ESTE:.0f}\nNorte: {NORTE:.0f}\nHuso: {HUSO}\n"
    "---\n"
    "Tipo: Manifestacion\nRol: 03201-9999-0\nNombre: SIN COORDENADAS\nComuna: Vallenar\n"
)


def _box(lon, lat, half=0.02):
    return json.dumps({
        "type": "Polygon",
        "coordinates": [[
            [lon - half, lat - half], [lon + half, lat - half],
            [lon + half, lat + half], [lon - half, lat + half],
            [lon - half, lat - half],
        ]],
    })


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
        cur.execute("DROP VIEW IF EXISTS public.boletin_cola_revision CASCADE")
        cur.execute("DROP TABLE IF EXISTS public.boletin_alertas, public.boletin_registros, "
                    "public.boletin_ediciones, public.catastro_concesiones, public.etl_corridas, "
                    "public.fuentes_datos CASCADE")
        for m in MIGS:
            cur.execute((ROOT / m).read_text())
    return url


def _insertar_concesion(url, external_id, geojson):
    import psycopg
    with psycopg.connect(url, autocommit=True) as conn, conn.cursor() as cur:
        cur.execute("SET search_path TO public, extensions")
        cur.execute("INSERT INTO public.fuentes_datos (id, nombre) VALUES ('sernageomin_concesiones','x') ON CONFLICT DO NOTHING")
        cur.execute(
            "INSERT INTO public.catastro_concesiones (fuente_id, external_id, tipo, estado, geom, origen_hash) "
            "VALUES ('sernageomin_concesiones',%s,'EXPLOTACION','CONSTITUIDA',"
            "ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s),4326)),'h')",
            (external_id, geojson),
        )


def test_dentro_de_concesion_genera_alerta(db_url):
    _insertar_concesion(db_url, "C-DENTRO", _box(LON, LAT, half=0.02))  # punto adentro
    r = job.run(db_url, TEXTO, {"numero": "1"})
    assert r["registros_leidos"] == 2
    assert r["registros_nuevos"] == 2
    assert r["en_cola_revision"] == 1          # el registro sin coordenadas
    assert r["alertas_creadas"] == 1
    import psycopg
    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT tipo_alerta FROM public.boletin_alertas")
        assert cur.fetchone()[0] == "dentro_de_concesion"


def test_proximidad_genera_alerta_dentro_del_buffer(db_url):
    # Polígono desplazado ~150 m: el punto queda FUERA del polígono pero dentro
    # del buffer de 500 m → alerta de proximidad.
    off = 0.0015
    _insertar_concesion(db_url, "C-CERCA", _box(LON + 0.02 + off, LAT, half=0.02))
    r = job.run(db_url, TEXTO, {"numero": "2"}, buffer_m=500.0)
    assert r["alertas_creadas"] == 1
    import psycopg
    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT tipo_alerta, distancia_m FROM public.boletin_alertas")
        tipo, dist = cur.fetchone()
        assert tipo == "proximidad" and 0 < float(dist) <= 500


def test_ingesta_idempotente(db_url):
    _insertar_concesion(db_url, "C-DENTRO", _box(LON, LAT, half=0.02))
    job.run(db_url, TEXTO, {"numero": "1"})
    r2 = job.run(db_url, TEXTO, {"numero": "1"})
    assert r2["registros_nuevos"] == 0 and r2["alertas_creadas"] == 0
    import psycopg
    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM public.boletin_ediciones")
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT count(*) FROM public.boletin_registros")
        assert cur.fetchone()[0] == 2


def test_registro_baja_confianza_en_cola(db_url):
    job.run(db_url, TEXTO, {"numero": "1"})
    import psycopg
    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM public.boletin_cola_revision")
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT geolocalizable FROM public.boletin_cola_revision")
        assert cur.fetchone()[0] is False
