"""Candidatos de muestreo sobre composición sintética con anomalía conocida."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from gc_remote.targets import extract_candidates, zscore  # noqa: E402


def _synthetic(hotspot=(25, 30)):
    x = 300000 + np.arange(50) * 20.0
    y = 6260000 - np.arange(50) * 20.0
    aloh = np.ones((50, 50), dtype="float64")
    aloh[hotspot] = 5.0                          # anomalía fuerte
    ones = np.ones((50, 50))
    idx = {"aloh": aloh, "fe_oxides": ones.copy(), "ferrous": ones.copy(), "gossan": ones.copy()}
    comp = {"interpretable": np.ones((50, 50), dtype=bool), "x": x, "y": y, "crs": "EPSG:32719"}
    return comp, idx, x, y


def test_candidato_cae_en_la_anomalia():
    comp, idx, x, y = _synthetic((25, 30))
    fc = extract_candidates(comp, idx, primary="aloh", percentile=97, min_dist_m=100, max_n=5)
    assert fc["metadata"]["n_candidates"] >= 1
    top = fc["features"][0]["properties"]
    assert top["easting"] == pytest.approx(x[30], abs=1) and top["northing"] == pytest.approx(y[25], abs=1)
    assert top["aloh_zscore"] > 3
    assert "no identificación mineral" in top["legend"].lower() or "NO es" in top["legend"]


def test_zscore_falla_con_pocos_pixeles():
    idx = np.ones((3, 3))
    mask = np.zeros((3, 3), dtype=bool); mask[0, 0] = True   # n=1
    with pytest.raises(ValueError):
        zscore(idx, mask)
