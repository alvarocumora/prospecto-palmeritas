"""Regression tests: AOI polygon clipping vs bounding rectangle."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from gc_remote.aoi_mask import polygon_mask  # noqa: E402
from gc_remote.masks import coverage_fractions_ndvi, coverage_verdict  # noqa: E402


def test_polygon_mask_not_bbox():
    polygon = {"type": "Polygon", "coordinates": [[[0, 0], [2, 0], [2, 3], [0, 3], [0, 0]]]}
    area = polygon_mask([polygon], [0.5, 1.5, 2.5], [2.5, 1.5, 0.5], "EPSG:4326")
    assert area.shape == (3, 3)
    assert int(area.sum()) == 6
    assert not area[:, 2].any()


def test_coverage_denominator_and_gate_inside_polygon_only():
    nd = np.array([[0.1, 0.6, 0.1], [0.1, 0.6, 0.1], [0.1, 0.6, 0.1]])
    scl = np.full((3, 3), 5)
    inside = np.array([[True, True, False], [True, True, False], [True, True, False]])
    report = coverage_fractions_ndvi(nd, scl, area_mask=inside)
    assert report["pixels_total"] == 6
    assert report["counts"]["interpretable"] == 3
    assert report["interpretable_fraction_of_area"] == pytest.approx(0.5)
    assert coverage_verdict(report["interpretable_fraction_of_area"])["spectral_conclusive"] is True


def test_mask_mismatch_rejected():
    with pytest.raises(ValueError, match="incompatible"):
        coverage_fractions_ndvi(np.zeros((3, 3)), np.ones((3, 3)), area_mask=np.ones((2, 2)))


def test_nan_ndvi_is_nodata_not_exposed_soil():
    nd = np.array([[float("nan"), 0.1], [0.5, 0.1]])
    scl = np.full((2, 2), 5)
    result = coverage_fractions_ndvi(nd, scl)
    assert result["counts"]["nodata"] == 1
    assert result["counts"]["interpretable"] == 2
    assert result["interpretable_fraction_of_area"] == pytest.approx(0.5)
