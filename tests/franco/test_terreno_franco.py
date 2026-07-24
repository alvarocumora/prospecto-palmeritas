"""B4 · Tests del buscador de terreno franco (RPC PostGIS).

Determinista: siembra concesiones sintéticas en catastro_concesiones y verifica
que la función devuelve el AOI menos lo ocupado, con el filtro de superficie.
Requiere DATABASE_URL con PostGIS (service container en CI); se salta si no.
"""
import json
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG_B2 = ROOT / "supabase/migrations/20260724060000_b2_catastro_etl.sql"
MIG_B4 = ROOT / "supabase/migrations/20260724070000_b4_terreno_franco.sql"


def _poly(coords):
    return {"type": "Polygon", "coordinates": [coords]}


# AOI: cuadrado 1° (≈ grande) en zona sin importancia real (test sintético).
AOI = _poly([[-70.0, -30.0], [-69.9, -30.0], [-69.9, -29.9], [-70.0, -29.9], [-70.0, -30.0]])
# Concesión que ocupa la mitad oeste del AOI.
OCUPA = _poly([[-70.0, -30.0], [-69.95, -30.0], [-69.95, -29.9], [-70.0, -29.9], [-70.0, -30.0]])


@pytest.fixture()
def cur():
    url = os.environ.get("DATABASE_URL")
    if not url:
        pytest.skip("sin DATABASE_URL (PostGIS) — se corre en CI con el service container")
    psycopg = pytest.importorskip("psycopg")
    conn = psycopg.connect(url, autocommit=True)
    c = conn.cursor()
    c.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    c.execute("SET search_path TO public, extensions")
    for role in ("authenticated", "service_role", "anon"):
        c.execute(
            "DO $$ BEGIN CREATE ROLE %s; EXCEPTION WHEN duplicate_object THEN NULL; END $$" % role
        )
    c.execute(
        "DROP TABLE IF EXISTS public.catastro_concesiones, public.etl_corridas, "
        "public.fuentes_datos CASCADE"
    )
    c.execute(MIG_B2.read_text())
    c.execute(MIG_B4.read_text())
    c.execute(
        "INSERT INTO public.fuentes_datos (id, nombre) VALUES ('t','t') ON CONFLICT DO NOTHING"
    )
    yield c
    conn.close()


def _seed(cur, geom, estado="VIGENTE", ext="1"):
    cur.execute(
        "INSERT INTO public.catastro_concesiones (fuente_id, external_id, estado, geom, origen_hash) "
        "VALUES ('t', %s, %s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s),4326)), %s)",
        (ext, estado, json.dumps(geom), "h" + ext),
    )


def _franco(cur, aoi, min_ha=0, estados=None):
    cur.execute(
        "SELECT area_ha FROM public.tenencia_terreno_franco(%s::jsonb, %s, %s)",
        (json.dumps(aoi), min_ha, estados),
    )
    return [r[0] for r in cur.fetchall()]


def test_aoi_vacio_es_todo_franco(cur):
    # Sin concesiones: el AOI entero es franco (un solo polígono).
    areas = _franco(cur, AOI)
    assert len(areas) == 1
    assert areas[0] > 0


def test_resta_lo_ocupado(cur):
    _seed(cur, OCUPA)  # ocupa la mitad oeste
    full = _franco(cur, AOI)  # sin concesión sería el AOI completo
    # ahora franco debe ser ~la mitad este
    cur.execute("DELETE FROM public.catastro_concesiones")
    total = _franco(cur, AOI)[0]
    _seed(cur, OCUPA)
    libre = _franco(cur, AOI)
    assert len(libre) == 1
    assert libre[0] == pytest.approx(total / 2, rel=0.05)


def test_filtro_superficie_minima(cur):
    _seed(cur, OCUPA)
    libre = _franco(cur, AOI)[0]  # mitad este, área grande
    # con min_ha mayor que el remanente, no devuelve nada
    assert _franco(cur, AOI, min_ha=libre + 1) == []
    # con min_ha menor, sí
    assert len(_franco(cur, AOI, min_ha=libre - 1)) == 1


def test_filtro_por_estado(cur):
    _seed(cur, OCUPA, estado="EN TRAMITE", ext="1")
    # Si solo consideramos VIGENTE como ocupante, el trámite NO resta → AOI completo.
    assert len(_franco(cur, AOI, estados=["VIGENTE"])) == 1
    solo_vigente = _franco(cur, AOI, estados=["VIGENTE"])[0]
    # Sin filtro (default), el trámite sí ocupa → área menor.
    con_tramite = _franco(cur, AOI)[0]
    assert con_tramite < solo_vigente
