"""Rasterización determinista del AOI: bbox para descarga, polígonos para métricas.

Geometrías de entrada: GeoJSON WGS84; grilla de salida en CRS proyectado.
No se presume que el rectángulo envolvente equivalga al territorio prospectado.
"""
from __future__ import annotations

import numpy as np


def polygon_mask(polygons_wgs84: list[dict], x, y, target_crs: str) -> np.ndarray:
    """True únicamente en centros de píxel dentro de los polígonos del AOI."""
    from affine import Affine
    from pyproj import Transformer
    from rasterio.features import geometry_mask
    from shapely.geometry import shape, mapping
    from shapely.ops import transform

    x, y = np.asarray(x), np.asarray(y)
    if x.ndim != 1 or y.ndim != 1 or x.size < 2 or y.size < 2:
        raise ValueError("Grilla de AOI requiere ejes x/y unidimensionales con >=2 píxeles")
    if not polygons_wgs84:
        raise ValueError("Faltan polígonos AOI; no usar bbox como sustituto silencioso")
    tx = Transformer.from_crs("EPSG:4326", target_crs, always_xy=True).transform
    geometries = [mapping(transform(tx, shape(g))) for g in polygons_wgs84]
    dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
    affine = Affine.translation(float(x[0]) - dx / 2, float(y[0]) - dy / 2) * Affine.scale(dx, dy)
    result = geometry_mask(
        geometries, out_shape=(len(y), len(x)), transform=affine,
        all_touched=False, invert=True,
    )
    if not result.any():
        raise ValueError("Sin píxeles dentro del AOI; revisar EPSG/geometría/resolución")
    return result
