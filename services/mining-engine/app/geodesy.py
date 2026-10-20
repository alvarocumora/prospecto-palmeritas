"""Explicit geodetic coordinate transformation for mining project data."""
from __future__ import annotations

from functools import lru_cache
from math import isfinite

from pyproj import CRS, Transformer
from pyproj.exceptions import CRSError, ProjError


@lru_cache(maxsize=128)
def _transformer(source_epsg: int, target_epsg: int) -> Transformer:
    if not (1000 <= source_epsg <= 999999 and 1000 <= target_epsg <= 999999):
        raise ValueError("invalid_epsg_code")
    try:
        return Transformer.from_crs(
            CRS.from_epsg(source_epsg),
            CRS.from_epsg(target_epsg),
            always_xy=True,
        )
    except (CRSError, ProjError) as exc:
        raise ValueError("unknown_or_unsupported_crs") from exc


def transform_xy(
    x: float, y: float, source_epsg: int, target_epsg: int
) -> tuple[float, float]:
    """Transform east/longitude and north/latitude with explicit EPSG.

    KML is EPSG:4326 (longitude, latitude); input DXF/CSV/UTM data must supply
    its CRS. A CRS cannot be inferred reliably from coordinate magnitudes.
    """
    if not all(isfinite(value) for value in (x, y)):
        raise ValueError("non_finite_coordinates")

    transformer = _transformer(source_epsg, target_epsg)
    try:
        tx, ty = transformer.transform(x, y, errcheck=True)
    except ProjError as exc:
        raise ValueError("coordinate_transformation_failed") from exc
    if not all(isfinite(value) for value in (tx, ty)):
        raise ValueError("non_finite_output")
    return float(tx), float(ty)
