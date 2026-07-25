"""B4 · Tests del diseñador de bloques.

Verifica que la cuadrícula propuesta CUMPLE las reglas del motor B5.1: cada
bloque no excede la cara máxima, el lado es múltiplo legal y ≤ máximo, todos
caen dentro del AOI, y las métricas del validador confirman los límites.
"""
import importlib.util
import math
import sys
from pathlib import Path

import pytest
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


cm = _load("codigo_minero", "packages/reglas/codigo_minero.py")
db = _load("disenador_bloques", "packages/reglas/disenador_bloques.py")


def _reglas():
    A = "Art. 28 Código; Art. 8 Reglamento"
    data = [
        ("exploracion", "lado_mas_largo", "<=", 15000, "m"),
        ("exploracion", "relacion_largo_ancho", "<=", 15, "ratio"),
        ("exploracion", "cara_superior", ">=", 100, "ha"),
        ("exploracion", "cara_superior", "<=", 5000, "ha"),
        ("exploracion", "lado_multiplo", "==", 1000, "m"),
        ("exploracion", "orientacion_caras", "orientacion_utm", None, None),
        ("explotacion", "lado_mas_largo", "<=", 1000, "m"),
        ("explotacion", "relacion_largo_ancho", "<=", 10, "ratio"),
        ("explotacion", "cara_superior", ">=", 1, "ha"),
        ("explotacion", "cara_superior", "<=", 10, "ha"),
        ("explotacion", "lado_multiplo", "==", 100, "m"),
        ("explotacion", "orientacion_caras", "orientacion_utm", None, None),
    ]
    return [
        cm.Regla(id=f"{t}.{r}.{i}", tipo_solicitud=t, regla=r, operador=op, valor=v,
                 unidad=u, articulo_citado=A, fecha_verificacion=None)
        for i, (t, r, op, v, u) in enumerate(data)
    ]


def _aoi_wgs(lado_m, huso=19):
    """AOI cuadrado de `lado_m` en PSAD56 UTM, devuelto como GeoJSON WGS84."""
    inv = Transformer.from_crs(db._psad56_utm(huso), "EPSG:4326", always_xy=True)
    e0, n0 = 340000.0, 6300000.0  # esquina arbitraria dentro de Chile huso 19
    corners = [(e0, n0), (e0 + lado_m, n0), (e0 + lado_m, n0 + lado_m), (e0, n0 + lado_m)]
    ring = [list(inv.transform(x, y)) for x, y in corners]
    ring.append(ring[0])
    return {"type": "Polygon", "coordinates": [ring]}


def test_exploracion_cell_derivado_de_reglas():
    r = db.disenar_bloques(_aoi_wgs(30000), "exploracion", _reglas())
    # cell = mayor múltiplo de 1000 con cara ≤ 5000 ha y lado ≤ 15000 → 7000 m.
    assert r.cell_m == 7000
    assert len(r.bloques) >= 1
    for b in r.bloques:
        assert b.area_ha <= 5000  # cara máxima
        assert b.area_ha == pytest.approx(4900, rel=0.001)  # 7000² / 1e4
    assert r.parametros_no_verificados  # reglas sin verificar


def test_explotacion_cell_derivado_de_reglas():
    r = db.disenar_bloques(_aoi_wgs(2000), "explotacion", _reglas())
    assert r.cell_m == 300  # múltiplo de 100, cara ≤ 10 ha
    for b in r.bloques:
        assert b.area_ha == pytest.approx(9, rel=0.001)  # 300² / 1e4


def test_bloques_cumplen_el_validador():
    r = db.disenar_bloques(_aoi_wgs(30000), "exploracion", _reglas())
    assert r.bloques
    reglas = _reglas()
    for b in r.bloques:
        res = cm.validar_solicitud(b.geom_geojson, "exploracion", reglas)
        m = res.metricas
        assert m["cara_ha"] <= 5000 + 1
        assert m["lado_mas_largo_m"] <= 15000 + 1
        assert m["ratio_largo_ancho"] == pytest.approx(1.0, abs=0.01)
        assert res.conforme is True  # sin infracciones (cumple todas las reglas)


def test_cell_es_multiplo_y_no_excede_maximo():
    r = db.disenar_bloques(_aoi_wgs(30000), "exploracion", _reglas())
    assert r.cell_m % 1000 == 0
    assert r.cell_m <= 15000
    # total = suma de las caras
    assert r.total_ha == pytest.approx(len(r.bloques) * 4900, rel=0.001)
