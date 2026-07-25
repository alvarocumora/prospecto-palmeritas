"""Reconciliación (B) · Terreno franco sobre el catastro CANÓNICO cadastre_national.

Verifica que la RPC retargeteada lee cadastre_national con el vocabulario real
(status vigente/en_tramite ocupan; vencida/cancelada liberan; archived_at IS NULL).
Requiere DATABASE_URL con PostGIS; se salta si no.
"""
import json
import os
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MIG_BASELINE = ROOT / "supabase/migrations/20260513000000_baseline_cadastre_bulletin.sql"
MIG_RECON = ROOT / "supabase/migrations/20260725200000_reconcilia_terreno_franco_cadastre.sql"


def _poly(coords):
    return {"type": "Polygon", "coordinates": [coords]}


AOI = _poly([[-70.0, -30.0], [-69.9, -30.0], [-69.9, -29.9], [-70.0, -29.9], [-70.0, -30.0]])
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
        c.execute("DO $$ BEGIN CREATE ROLE %s; EXCEPTION WHEN duplicate_object THEN NULL; END $$" % role)
    c.execute("DROP TABLE IF EXISTS public.cadastre_national CASCADE")
    c.execute(MIG_BASELINE.read_text())
    c.execute(MIG_RECON.read_text())
    yield c
    conn.close()


def _seed(cur, geom, status="vigente", ext="1"):
    cur.execute(
        "INSERT INTO public.cadastre_national (external_id, origen, status, geom) "
        "VALUES (%s, 'EXPLOTACION', %s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s),4326)))",
        (ext, status, json.dumps(geom)),
    )


def _franco(cur, aoi, min_ha=0, estados=None):
    cur.execute(
        "SELECT area_ha FROM public.tenencia_terreno_franco(%s::jsonb, %s, %s)",
        (json.dumps(aoi), min_ha, estados),
    )
    return [r[0] for r in cur.fetchall()]


def test_aoi_vacio_es_todo_franco(cur):
    areas = _franco(cur, AOI)
    assert len(areas) == 1 and areas[0] > 0


def test_vigente_resta_lo_ocupado(cur):
    cur.execute("DELETE FROM public.cadastre_national")
    total = _franco(cur, AOI)[0]
    _seed(cur, OCUPA, status="vigente")
    libre = _franco(cur, AOI)
    assert len(libre) == 1
    assert libre[0] == pytest.approx(total / 2, rel=0.05)


def test_vencida_y_cancelada_no_ocupan(cur):
    _seed(cur, OCUPA, status="vencida", ext="1")
    _seed(cur, OCUPA, status="cancelada", ext="2")
    areas = _franco(cur, AOI)
    assert len(areas) == 1  # AOI completo: extinguidas liberan


def test_en_tramite_ocupa_por_default(cur):
    _seed(cur, OCUPA, status="en_tramite")
    # default incluye en_tramite => resta
    con_tramite = _franco(cur, AOI)[0]
    # si solo consideramos vigente, el trámite NO resta => AOI completo mayor
    solo_vigente = _franco(cur, AOI, estados=["vigente"])[0]
    assert con_tramite < solo_vigente


def test_archived_no_ocupa(cur):
    _seed(cur, OCUPA, status="vigente", ext="1")
    cur.execute("UPDATE public.cadastre_national SET archived_at = now()")
    # archivada => no vigente en el catastro => no ocupa
    areas = _franco(cur, AOI)
    assert len(areas) == 1
