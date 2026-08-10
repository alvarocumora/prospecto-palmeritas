"""Coverage multiclase sobre arrays sintéticos de valor conocido."""
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from gc_remote.masks import classify, coverage_fractions, coverage_verdict, ndvi  # noqa: E402


def test_ndvi_conocido():
    nd = ndvi(np.array([0.4]), np.array([0.1]))   # (0.4-0.1)/(0.5)=0.6
    assert nd[0] == pytest.approx(0.6)


def _scene():
    # 10 px: 4 vegetación (SCL 4), 2 nube (8), 1 sombra (3), 1 agua (6), 2 suelo (5).
    scl = np.array([4, 4, 4, 4, 8, 8, 3, 6, 5, 5], dtype=float)
    # NDVI: alto en veg, bajo en el resto.
    nd = np.array([0.6, 0.6, 0.6, 0.6, 0.1, 0.1, 0.1, 0.0, 0.1, 0.1])
    red = np.full(10, 0.1); nir = red * (1 + nd) / (1 - nd)   # invertir para dar ese NDVI
    return nir, red, scl


def test_clasificacion_por_prioridad():
    nir, red, scl = _scene()
    cls = classify(nir, red, scl, 0.25)
    # 4 veg(5), 2 nube(1), 1 sombra(2), 1 agua(4), 2 interpretable(6)
    assert np.count_nonzero(cls == 5) == 4
    assert np.count_nonzero(cls == 1) == 2
    assert np.count_nonzero(cls == 2) == 1
    assert np.count_nonzero(cls == 4) == 1
    assert np.count_nonzero(cls == 6) == 2


def test_fracciones_e_interpretable():
    nir, red, scl = _scene()
    r = coverage_fractions(nir, red, scl, 0.25, sensitivity=[0.20, 0.25, 0.30])
    assert r["pixels_total"] == 10 and r["pixels_valid"] == 10
    assert r["interpretable_fraction_of_area"] == pytest.approx(0.2)   # 2/10
    # suma de fracciones = 1
    assert sum(r["fraction_of_area"].values()) == pytest.approx(1.0)
    assert set(r["ndvi_sensitivity"]) == {"ndvi>0.2", "ndvi>0.25", "ndvi>0.3"}


def test_veredicto_bajo_piso_avisa():
    v = coverage_verdict(0.08, floor=0.15)
    assert v["spectral_conclusive"] is False
    assert "no es concluyente" in v["headline"].lower() or "ESTRUCTURAL" in v["headline"]


def test_veredicto_sobre_piso():
    v = coverage_verdict(0.42, floor=0.15)
    assert v["spectral_conclusive"] is True


def test_coverage_ndvi_directo():
    import numpy as np
    from gc_remote.masks import coverage_fractions_ndvi
    nd = np.array([0.1, 0.1, 0.6, 0.6])          # 2 secos, 2 veg
    scl = np.array([5, 5, 5, 5], dtype=float)
    r = coverage_fractions_ndvi(nd, scl, 0.25)
    assert r["interpretable_fraction_of_area"] == 0.5
