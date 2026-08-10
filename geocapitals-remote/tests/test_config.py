"""Config: CRS estricto y sanity del bbox (falla ruidoso si el CRS no corresponde)."""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
from gc_remote.config import AOI, Config, validate_crs  # noqa: E402


def test_crs_valido_normaliza():
    assert validate_crs("EPSG:24879") == "EPSG:24879"
    assert validate_crs("epsg:32719") == "EPSG:32719"


def test_crs_ausente_falla():
    with pytest.raises(ValueError):
        validate_crs("")


def test_crs_invalido_falla():
    with pytest.raises(ValueError):
        validate_crs("EPSG:99999999")


def test_aoi_psad56_cae_en_chile():
    aoi = AOI(crs="EPSG:24879", bbox=[304000, 6249000, 316000, 6260000])
    lon, lat = aoi.lonlat_center()
    assert -72.5 < lon < -70.5 and -34.5 < lat < -33.0    # Melipilla, RM


def test_bbox_con_crs_equivocado_falla():
    # Mismos números pero declarados en un CRS geográfico -> el centro cae absurdo -> falla.
    with pytest.raises(ValueError):
        AOI(crs="EPSG:4326", bbox=[304000, 6249000, 316000, 6260000])


def test_carga_yaml_completo_con_hash():
    cfg = Config.from_yaml(ROOT / "configs" / "cholqui.yaml")
    assert cfg.name == "cholqui"
    assert cfg.output_crs == "EPSG:32719"
    assert cfg.masks.ndvi_threshold == 0.25
    assert cfg.validation_points.positive_control_ids == ["P-17", "P-18", "P-19"]
    assert cfg.config_sha256 and len(cfg.config_sha256) == 64   # provenance


def test_bbox_wgs84_para_stac():
    cfg = Config.from_yaml(ROOT / "configs" / "cholqui.yaml")
    b = cfg.aoi.bbox_wgs84()
    assert len(b) == 4 and b[0] < b[2] and b[1] < b[3]
    assert -72.5 < b[0] < -70.5 and -34.5 < b[1] < -33.0
