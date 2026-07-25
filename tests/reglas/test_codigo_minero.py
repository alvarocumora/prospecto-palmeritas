"""B5 · Tests del motor de reglas del Código de Minería.

Prueba la LÓGICA del motor (cómputo geométrico + citación de artículo + marcado
de no-verificado) con polígonos sintéticos. La correctitud LEGAL de los valores
es pendiente de abogado (fecha_verificacion NULL). No depende de la red; la parte
de carga desde tabla usa DATABASE_URL (se salta si no está).
"""
import importlib.util
import os
import sys
from pathlib import Path

import pytest
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location(
    "codigo_minero", ROOT / "packages" / "reglas" / "codigo_minero.py"
)
cm = importlib.util.module_from_spec(_spec)
sys.modules["codigo_minero"] = cm  # requerido por @dataclass al cargar por ruta
_spec.loader.exec_module(cm)

# Reglas equivalentes a la semilla (sin verificar → fecha_verificacion=None).
def _reglas():
    A = "Art. 28 Código; Art. 8 Reglamento"
    data = [
        ("exploracion", "orientacion_caras", "orientacion_utm", None, None),
        ("exploracion", "lado_mas_largo", "<=", 15000, "m"),
        ("exploracion", "relacion_largo_ancho", "<=", 15, "ratio"),
        ("exploracion", "cara_superior", ">=", 100, "ha"),
        ("exploracion", "cara_superior", "<=", 5000, "ha"),
        ("exploracion", "lado_multiplo", "==", 1000, "m"),
        ("explotacion", "lado_mas_largo", "<=", 1000, "m"),
        ("explotacion", "relacion_largo_ancho", "<=", 10, "ratio"),
        ("explotacion", "cara_superior", ">=", 1, "ha"),
        ("explotacion", "cara_superior", "<=", 10, "ha"),
        ("explotacion", "orientacion_caras", "orientacion_utm", None, None),
        ("explotacion", "lado_multiplo", "==", 100, "m"),
    ]
    return [
        cm.Regla(id=f"{t}.{r}.{i}", tipo_solicitud=t, regla=r, operador=op, valor=v,
                 unidad=u, articulo_citado=A, fecha_verificacion=None)
        for i, (t, r, op, v, u) in enumerate(data)
    ]


# Rectángulo en UTM 19S (WGS84) → GeoJSON WGS84 (para alimentar al motor).
_INV = Transformer.from_crs("EPSG:32719", "EPSG:4326", always_xy=True)


def _rect_wgs(e0, n0, ancho_m, alto_m, rot=False):
    if rot:
        # Rotar 30° para simular caras oblicuas.
        import math
        cx, cy = e0 + ancho_m / 2, n0 + alto_m / 2
        pts_utm = [(e0, n0), (e0 + ancho_m, n0), (e0 + ancho_m, n0 + alto_m), (e0, n0 + alto_m)]
        a = math.radians(30)
        pts_utm = [((x - cx) * math.cos(a) - (y - cy) * math.sin(a) + cx,
                    (x - cx) * math.sin(a) + (y - cy) * math.cos(a) + cy) for x, y in pts_utm]
    else:
        pts_utm = [(e0, n0), (e0 + ancho_m, n0), (e0 + ancho_m, n0 + alto_m), (e0, n0 + alto_m)]
    ring = [list(_INV.transform(x, y)) for x, y in pts_utm]
    ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def test_exploracion_conforme_pero_no_verificada():
    # 2000 x 1000 m = 200 ha, ratio 2:1, orientada, lados múltiplos de 1000.
    geom = _rect_wgs(340000, 6300000, 2000, 1000)
    r = cm.validar_solicitud(geom, "exploracion", _reglas())
    assert r.conforme is True
    assert r.metricas["cara_ha"] == pytest.approx(200, rel=0.02)
    # Aunque cumple, las reglas no están verificadas legalmente.
    assert len(r.parametros_no_verificados) > 0


def test_exploracion_cara_excede_maximo():
    # 10000 x 6000 m = 6000 ha (> 5000).
    geom = _rect_wgs(340000, 6300000, 10000, 6000)
    r = cm.validar_solicitud(geom, "exploracion", _reglas())
    assert r.conforme is False
    assert any(i.regla == "cara_superior" for i in r.infracciones)
    assert all(i.no_verificado for i in r.infracciones)  # marcadas no verificadas


def test_explotacion_multiples_infracciones():
    # 2000 x 100 m = 20 ha: lado 2000 (>1000), ratio 20 (>10), cara 20 (>10).
    geom = _rect_wgs(340000, 6300000, 2000, 100)
    r = cm.validar_solicitud(geom, "explotacion", _reglas())
    reglas_violadas = {i.regla for i in r.infracciones}
    assert {"lado_mas_largo", "relacion_largo_ancho", "cara_superior"} <= reglas_violadas


def test_orientacion_oblicua_es_infraccion():
    geom = _rect_wgs(340000, 6300000, 500, 300, rot=True)
    r = cm.validar_solicitud(geom, "explotacion", _reglas())
    assert any(i.regla == "orientacion_caras" for i in r.infracciones)


def test_carga_reglas_desde_tabla():
    db = os.environ.get("DATABASE_URL")
    if not db:
        pytest.skip("sin DATABASE_URL — se corre en CI con el service container")
    psycopg = pytest.importorskip("psycopg")
    mig = ROOT / "supabase/migrations/20260724080000_b5_reglas_codigo_minero.sql"
    with psycopg.connect(db, autocommit=True) as conn, conn.cursor() as cur:
        for role in ("authenticated", "service_role"):
            cur.execute("DO $$ BEGIN CREATE ROLE %s; EXCEPTION WHEN duplicate_object THEN NULL; END $$" % role)
        cur.execute("DROP TABLE IF EXISTS public.reglas_codigo_minero CASCADE")
        cur.execute(mig.read_text())
        reglas = cm.cargar_reglas(cur)
    assert len(reglas) >= 12
    # Todas las cargadas están SIN verificar (semilla).
    assert all(not r.verificada for r in reglas)
    geom = _rect_wgs(340000, 6300000, 2000, 1000)
    res = cm.validar_solicitud(geom, "exploracion", reglas)
    assert res.metricas["cara_ha"] == pytest.approx(200, rel=0.02)
