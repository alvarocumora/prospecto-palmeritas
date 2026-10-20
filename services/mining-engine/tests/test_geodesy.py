"""EPSG transformations must never guess UTM zone or axis order."""
import math

import pytest

from app.geodesy import transform_xy


def test_wgs84_santiago_to_utm19s_and_back():
    lon, lat = -70.66, -33.45
    easting, northing = transform_xy(lon, lat, 4326, 32719)
    assert 300000 < easting < 450000
    assert 6200000 < northing < 6400000
    out_lon, out_lat = transform_xy(easting, northing, 32719, 4326)
    assert math.isclose(out_lon, lon, abs_tol=1e-6)
    assert math.isclose(out_lat, lat, abs_tol=1e-6)


def test_wgs84_region_biobio_to_utm18s_and_back():
    lon, lat = -73.05, -36.83
    x, y = transform_xy(lon, lat, 4326, 32718)
    lo, la = transform_xy(x, y, 32718, 4326)
    assert lo == pytest.approx(lon, abs=1e-6)
    assert la == pytest.approx(lat, abs=1e-6)


@pytest.mark.parametrize("epsg", [0, 1, 999999])
def test_reject_invalid_epsg(epsg):
    with pytest.raises(ValueError):
        transform_xy(-70.66, -33.45, 4326, epsg)


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_reject_nonfinite_coordinates(value):
    with pytest.raises(ValueError):
        transform_xy(value, -33.45, 4326, 32719)
