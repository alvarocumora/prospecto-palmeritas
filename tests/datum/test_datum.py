"""B1 · Tests de datum (bloqueante).

Compara, para los puntos de control reales de SERNAGEOMIN, la transformación
PSAD56→WGS84 en tres motores: pyproj, proj4js (camino cliente) y PostGIS
ST_Transform. El criterio de verdad es SERNAGEOMIN (EPSG:1204, [-288,175,-376]),
porque el módulo debe calzar con el catastro oficial.

Corre en CI y falla el build si un punto se sale de tolerancia.
"""
import json
import math
import os
import subprocess
from pathlib import Path

import pytest
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parents[2]
CONTROL = json.loads((ROOT / "src/lib/tenencia/control-points.json").read_text())
DATUM_PTS = CONTROL["datum"]

# EPSG:1204 — el juego que usa SERNAGEOMIN, verificado a 0.000 m contra su
# FeatureServer. Ver docs/datums.md.
SNGM_TOWGS84 = "-288,175,-376"
WGS84 = CRS.from_epsg(4326)


def sngm_crs(huso: int) -> CRS:
    return CRS.from_proj4(
        f"+proj=utm +zone={huso} +south +ellps=intl "
        f"+towgs84={SNGM_TOWGS84} +units=m +no_defs"
    )


def meters_between(a, b) -> float:
    """Distancia aproximada (equirectangular) en metros entre dos (lon,lat)."""
    R = 6378137.0
    lat_m = math.radians((a[1] + b[1]) / 2)
    dx = math.radians(b[0] - a[0]) * R * math.cos(lat_m)
    dy = math.radians(b[1] - a[1]) * R
    return math.hypot(dx, dy)


def pyproj_sngm(e, n, huso):
    t = Transformer.from_crs(sngm_crs(huso), WGS84, always_xy=True)
    lon, lat = t.transform(e, n)
    return (lon, lat)


# ---------------------------------------------------------------------------
# Punto de control: ≥10 pares, fuente citable (§B1.2)
# ---------------------------------------------------------------------------
def test_hay_al_menos_10_puntos_de_control():
    assert len(DATUM_PTS) >= 10
    for cp in DATUM_PTS:
        assert cp.get("fuente"), "cada punto declara su fuente"


# ---------------------------------------------------------------------------
# 1) pyproj (EPSG:1204) vs puntos de control — tolerancia 1 m
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("cp", DATUM_PTS, ids=[p["id"] for p in DATUM_PTS])
def test_pyproj_calza_con_control(cp):
    u = cp["psad56_utm"]
    got = pyproj_sngm(u["e"], u["n"], u["huso"])
    exp = (cp["wgs84_geo"]["lon"], cp["wgs84_geo"]["lat"])
    err = meters_between(got, exp)
    assert err < cp["tol_m"], f"{cp['id']}: pyproj err={err:.3f} m"


# ---------------------------------------------------------------------------
# 2) proj4js (camino cliente) vs pyproj — cuantifica el error del navegador
# ---------------------------------------------------------------------------
def _proj4js_all():
    pts = [
        {"e": cp["psad56_utm"]["e"], "n": cp["psad56_utm"]["n"], "huso": cp["psad56_utm"]["huso"]}
        for cp in DATUM_PTS
    ]
    res = subprocess.run(
        ["node", "tests/datum/node_proj4.mjs"],
        input=json.dumps(pts),
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    assert res.returncode == 0, f"node proj4 falló: {res.stderr}"
    return json.loads(res.stdout)


def test_proj4js_vs_pyproj_error_cliente(capsys):
    proj4 = _proj4js_all()
    max_err = 0.0
    for cp, ll in zip(DATUM_PTS, proj4):
        u = cp["psad56_utm"]
        py = pyproj_sngm(u["e"], u["n"], u["huso"])
        max_err = max(max_err, meters_between(ll, py))
    # Se documenta el número; proj4js y pyproj deben coincidir muy fino (<0.5 m).
    with capsys.disabled():
        print(f"\n[B1] error camino cliente proj4js↔pyproj: max {max_err*100:.2f} cm")
    assert max_err < 0.5


# ---------------------------------------------------------------------------
# 3) PostGIS ST_Transform (SRID custom EPSG:1204) vs pyproj — sanity (ambos PROJ)
#    Requiere DATABASE_URL con PostGIS; se salta si no está.
# ---------------------------------------------------------------------------
def test_postgis_st_transform_vs_pyproj():
    db = os.environ.get("DATABASE_URL")
    if not db:
        pytest.skip("sin DATABASE_URL (PostGIS) — se corre en CI con el service container")
    psycopg = pytest.importorskip("psycopg")
    with psycopg.connect(db) as conn, conn.cursor() as cur:
        cur.execute("SELECT extname FROM pg_extension WHERE extname='postgis'")
        if cur.fetchone() is None:
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        # SRID custom alineado a SERNAGEOMIN por huso.
        for huso, srid in ((18, 990018), (19, 990019)):
            proj4text = (
                f"+proj=utm +zone={huso} +south +ellps=intl "
                f"+towgs84={SNGM_TOWGS84} +units=m +no_defs"
            )
            cur.execute("DELETE FROM spatial_ref_sys WHERE srid=%s", (srid,))
            cur.execute(
                "INSERT INTO spatial_ref_sys(srid, auth_name, auth_srid, proj4text) "
                "VALUES (%s,'GEOCAP',%s,%s)",
                (srid, srid, proj4text),
            )
        max_err = 0.0
        for cp in DATUM_PTS:
            u = cp["psad56_utm"]
            srid = 990000 + u["huso"]
            cur.execute(
                "SELECT ST_X(g), ST_Y(g) FROM ("
                "  SELECT ST_Transform(ST_SetSRID(ST_MakePoint(%s,%s),%s),4326) g"
                ") s",
                (u["e"], u["n"], srid),
            )
            gx, gy = cur.fetchone()
            py = pyproj_sngm(u["e"], u["n"], u["huso"])
            max_err = max(max_err, meters_between((gx, gy), py))
        assert max_err < 0.5, f"PostGIS↔pyproj max {max_err:.3f} m"


# ---------------------------------------------------------------------------
# 4) Gap por franja: los parámetros EPSG por franja (6971/6972/6973) difieren de
#    SERNAGEOMIN (EPSG:1204). Se calcula con parámetros EXPLÍCITOS (determinista,
#    sin depender de qué operación elige PROJ). Documenta por qué hay que calibrar.
# ---------------------------------------------------------------------------
def _band_towgs84(lat: float) -> str:
    if lat > -26:
        return "-302,272,-360"  # EPSG:6971  (N de 26°S)
    if lat >= -36:
        return "-328,340,-329"  # EPSG:6972  (26–36°S)
    return "-352,403,-287"  # EPSG:6973  (36–43°30'S)


def _band_crs(huso: int, lat: float) -> CRS:
    return CRS.from_proj4(
        f"+proj=utm +zone={huso} +south +ellps=intl "
        f"+towgs84={_band_towgs84(lat)} +units=m +no_defs"
    )


def test_gap_por_franja_documentado(capsys):
    errs = []
    for cp in DATUM_PTS:
        u = cp["psad56_utm"]
        lat = cp["wgs84_geo"]["lat"]
        t = Transformer.from_crs(_band_crs(u["huso"], lat), WGS84, always_xy=True)
        lon, lat_out = t.transform(u["e"], u["n"])
        errs.append(meters_between((lon, lat_out), (cp["wgs84_geo"]["lon"], cp["wgs84_geo"]["lat"])))
    avg = sum(errs) / len(errs)
    with capsys.disabled():
        print(
            f"[B1] gap franjas (6971/6972/6973) vs SERNAGEOMIN: "
            f"prom {avg:.0f} m, min {min(errs):.0f} m, max {max(errs):.0f} m"
        )
    # Usar las franjas en vez de SERNAGEOMIN desviaría los polígonos decenas a
    # cientos de metros del catastro — por eso se calibra a EPSG:1204.
    assert 20 < avg < 400, f"gap por franja fuera de rango esperado: {avg:.0f} m"


# ---------------------------------------------------------------------------
# 5) Detección de huso por longitud + frontera 18S/19S
# ---------------------------------------------------------------------------
def huso_from_lon(lon: float) -> int:
    return 18 if lon < -72 else 19


@pytest.mark.parametrize(
    "lon,expected",
    [(-73.0, 18), (-72.5, 18), (-72.0001, 18), (-72.0, 19), (-71.9999, 19), (-70.0, 19)],
)
def test_deteccion_de_huso(lon, expected):
    assert huso_from_lon(lon) == expected
