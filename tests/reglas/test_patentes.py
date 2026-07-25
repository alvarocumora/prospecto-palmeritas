"""B5.2 · Tests del motor de patentes y carry."""
import importlib.util
import os
import sys
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("patentes", ROOT / "packages" / "reglas" / "patentes.py")
pt = importlib.util.module_from_spec(_spec)
sys.modules["patentes"] = pt
_spec.loader.exec_module(pt)


def _escala():
    A = "Ley 21.420"
    rows = [
        ("explotacion.sinlab.1_5", "explotacion", False, 1, 5, 0.4),
        ("explotacion.sinlab.6_10", "explotacion", False, 6, 10, 0.8),
        ("explotacion.sinlab.11_15", "explotacion", False, 11, 15, 0.9),
        ("explotacion.sinlab.16_20", "explotacion", False, 16, 20, 1.2),
        ("explotacion.sinlab.21_25", "explotacion", False, 21, 25, 3.0),
        ("explotacion.sinlab.26_30", "explotacion", False, 26, 30, 6.0),
        ("explotacion.sinlab.31", "explotacion", False, 31, None, 12.0),
        ("explotacion.conlab", "explotacion", True, 1, None, 0.1),
        ("exploracion.base", "exploracion", False, 1, None, 0.06),
    ]
    return [pt.TramoEscala(id=i, tipo_solicitud=t, con_labores=cl, ano_desde=d,
                           ano_hasta=h, valor_utm_por_ha=v, articulo_citado=A,
                           fecha_verificacion=None) for i, t, cl, d, h, v in rows]


UTM = [pt.ValorUTM(fecha=date(2026, 7, 1), valor_clp=71649, fuente="SII")]


def test_utm_vigente_y_desactualizada():
    v = pt.utm_vigente(UTM, date(2026, 7, 20))
    assert v.valor_clp == 71649 and not v.desactualizada
    v2 = pt.utm_vigente(UTM, date(2026, 9, 15))  # > 35 días
    assert v2.desactualizada


def test_patente_anual_explotacion_sin_labores():
    # 100 ha, año 1 (0,4 UTM/ha), UTM 71.649 → 100*0.4*71649 = 2.865.960 CLP.
    clp = pt.patente_anual_clp(100, 0.4, 71649)
    assert clp == pytest.approx(2_865_960, rel=1e-6)


def test_proporcionalidad_primer_ano():
    full = pt.patente_anual_clp(100, 0.4, 71649, prop_meses=12)
    medio = pt.patente_anual_clp(100, 0.4, 71649, prop_meses=6)
    assert medio == pytest.approx(full / 2, rel=1e-6)


def test_proyeccion_10a_y_ano_prohibitivo():
    r = pt.proyeccion_carry(100, "explotacion", False, _escala(), UTM, date(2026, 7, 10),
                            ano_inicio=1, horizonte=25)
    # La tarifa escala: año 1 = 0,4 ; año 21 = 3 (prohibitivo por defecto).
    assert r.proyeccion[0].utm_por_ha == 0.4
    assert r.ano_prohibitivo == 21
    assert r.total_10a_clp > 0
    assert r.parametros_no_verificados  # escala sin verificar


def test_con_labores_es_mas_barato():
    sin = pt.proyeccion_carry(100, "explotacion", False, _escala(), UTM, date(2026, 7, 10), horizonte=1)
    con = pt.proyeccion_carry(100, "explotacion", True, _escala(), UTM, date(2026, 7, 10), horizonte=1)
    assert con.proyeccion[0].patente_clp < sin.proyeccion[0].patente_clp
    assert con.ano_prohibitivo is None  # con labores nunca prohibitivo por tarifa


def test_costo_cartera():
    cart = [
        {"area_ha": 100, "tipo": "explotacion", "con_labores": False, "ano_vigencia": 1},
        {"area_ha": 500, "tipo": "exploracion", "con_labores": False, "ano_vigencia": 1},
    ]
    r = pt.costo_cartera_clp(cart, _escala(), UTM, date(2026, 7, 10))
    esperado = pt.patente_anual_clp(100, 0.4, 71649) + pt.patente_anual_clp(500, 0.06, 71649)
    assert r["total_clp"] == pytest.approx(esperado, rel=1e-6)


def test_utm_ausente_marca_desactualizada():
    r = pt.proyeccion_carry(100, "explotacion", False, _escala(), [], date(2026, 7, 10), horizonte=1)
    assert r.utm is None
    assert r.proyeccion[0].patente_clp == 0  # sin UTM no hay CLP


def test_carga_desde_tabla():
    db = os.environ.get("DATABASE_URL")
    if not db:
        pytest.skip("sin DATABASE_URL — se corre en CI con el service container")
    psycopg = pytest.importorskip("psycopg")
    mig = ROOT / "supabase/migrations/20260724090000_b5_patentes.sql"
    with psycopg.connect(db, autocommit=True) as conn, conn.cursor() as cur:
        for role in ("authenticated", "service_role"):
            cur.execute("DO $$ BEGIN CREATE ROLE %s; EXCEPTION WHEN duplicate_object THEN NULL; END $$" % role)
        cur.execute("DROP TABLE IF EXISTS public.patentes_escala, public.valores_utm CASCADE")
        cur.execute(mig.read_text())
        escala = pt.cargar_escala(cur)
        valores = pt.cargar_valores_utm(cur)
    assert len(escala) >= 9 and all(not t.verificado for t in escala)
    assert valores and valores[0].valor_clp == 71649
