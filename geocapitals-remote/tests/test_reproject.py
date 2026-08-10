"""Reproyección PSAD56 huso 19 (EPSG:24879) <-> WGS84 contra un par de control.

El punto es demostrar que la transformación de DATUM ocurre (no es identidad): los
mismos números en PSAD56 vs WGS84 UTM 19S difieren cientos de metros en Chile central.
"""
import pyproj
import pytest


def test_psad56_a_wgs84_cae_en_melipilla():
    t = pyproj.Transformer.from_crs("EPSG:24879", "EPSG:4326", always_xy=True)
    lon, lat = t.transform(310000, 6255000)
    assert -72.0 < lon < -70.5 and -34.0 < lat < -33.0


def test_desplazamiento_de_datum_es_significativo():
    # Mismo (E,N) interpretado en PSAD56 vs WGS84 -> distinto punto en el terreno.
    t = pyproj.Transformer.from_crs("EPSG:24879", "EPSG:32719", always_xy=True)
    e2, n2 = t.transform(310000, 6255000)
    shift = ((e2 - 310000) ** 2 + (n2 - 6255000) ** 2) ** 0.5
    assert shift > 50, f"la transformación parece identidad (shift={shift:.1f} m)"
    assert shift < 500, f"shift de datum fuera de rango esperado en Chile central: {shift:.1f} m"
