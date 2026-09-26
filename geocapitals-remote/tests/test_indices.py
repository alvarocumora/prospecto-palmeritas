"""Índices de banda contra arrays sintéticos de valor conocido."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from gc_remote.indices import INDEX_META, s2_indices  # noqa: E402


def test_ratios_conocidos():
    refl = {"B02": np.array([[0.1]]), "B04": np.array([[0.2]]), "B08": np.array([[0.3]]),
            "B8A": np.array([[0.25]]), "B11": np.array([[0.4]]), "B12": np.array([[0.2]])}
    idx = s2_indices(refl)
    assert idx["fe_oxides"][0, 0] == 2.0        # 0.2/0.1
    assert idx["aloh"][0, 0] == 2.0             # 0.4/0.2
    assert idx["gossan"][0, 0] == 4.0           # 2*2
    # kaolinita (proxy REE-IAD): (B11+B08)/(B12+B04) = (0.4+0.3)/(0.2+0.2) = 1.75
    assert abs(idx["kaolinite"][0, 0] - 1.75) < 1e-9
    # suelo desnudo BSI: ((0.4+0.2)-(0.3+0.1))/((0.4+0.2)+(0.3+0.1)) = 0.2/1.0 = 0.2
    assert abs(idx["bare_soil"][0, 0] - 0.2) < 1e-9


def test_meta_declara_sensor_y_limite():
    # la honestidad espectral vive en los metadatos, no en un comentario
    assert "Al-OH" in INDEX_META["aloh"]["claim"] and "NO identifica" in INDEX_META["aloh"]["claim"]
    assert all("Sentinel-2" in m["sensor"] for m in INDEX_META.values())
    # el proxy REE no puede prometer ley ni identificación mineral
    assert "NO identifica" in INDEX_META["kaolinite"]["claim"]
    assert "no interpretable" in INDEX_META["bare_soil"]["claim"]
