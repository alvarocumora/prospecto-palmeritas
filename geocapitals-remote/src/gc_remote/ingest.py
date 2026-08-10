"""Ingesta Sentinel-2 por ventana del AOI y composición multitemporal.

Lectura por ventana (odc-stac), nunca escenas completas. Para coverage se usa la
observación MÁS SECA por píxel (mínimo NDVI entre observaciones limpias) — es la que
maximiza la exposición de suelo a fin de verano, no una sola escena.
"""
from __future__ import annotations

import numpy as np


def load_stack(items, bbox_wgs84, bands, resolution=20, crs="EPSG:32719"):
    """Carga un stack (time,y,x) por ventana. items: lista de pystac Items firmados."""
    import odc.stac

    ds = odc.stac.load(items, bands=bands, bbox=bbox_wgs84, resolution=resolution,
                       crs=crs, chunks={"x": 1024, "y": 1024})
    return ds


def dry_season_ndvi(ds):
    """Devuelve (driest_ndvi, rep_scl, n_clear) a partir de un stack con B04,B08,SCL."""
    red = ds["B04"].astype("float32")
    nir = ds["B08"].astype("float32")
    scl = ds["SCL"]
    den = nir + red
    ndvi = ((nir - red) / den).where(den != 0)

    # Observación "limpia": excluye no-data(0,1), sombra(2,3), nube(8,9,10).
    dirty = scl.isin([0, 1, 2, 3, 8, 9, 10])
    ndvi_clear = ndvi.where(~dirty)

    driest = ndvi_clear.min(dim="time", skipna=True)          # NDVI más seco (mejor caso)
    typical = ndvi_clear.median(dim="time", skipna=True)      # NDVI típico (persistente)
    n_clear = (~dirty).sum(dim="time")
    water_frac = (scl == 6).mean(dim="time")

    driest = driest.compute().values
    typical = typical.compute().values
    n_clear = n_clear.compute().values
    water_frac = water_frac.compute().values

    # SCL representativo para la clasificación de coverage.
    rep_scl = np.full(driest.shape, 5, dtype="float32")       # por defecto suelo
    rep_scl[water_frac > 0.5] = 6                             # agua persistente
    rep_scl[n_clear == 0] = 0                                 # nunca observado limpio
    return driest, typical, rep_scl, n_clear
