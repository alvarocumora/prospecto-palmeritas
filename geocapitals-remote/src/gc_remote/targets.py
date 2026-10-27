"""Candidatos de muestreo — NO validación, NO depósito.

Un candidato es un píxel donde el índice de alteración (razón SWIR Al-OH) está
anómalamente alto RESPECTO AL FONDO del AOI y cae sobre superficie interpretable
(sin cubierta vegetal). Cada candidato sale con su nivel de anomalía y la leyenda
explícita de que es "anomalía espectral compatible con Al-OH (Sentinel-2), no
identificación mineral; requiere verificación de terreno". El cruce con estructura
(intersecciones DEM/SAR) es un realce posterior, no está incluido aquí.
"""
from __future__ import annotations

import numpy as np
import pyproj

CANDIDATE_LEGEND = (
    "Candidato de muestreo. Anomalía en la razón de absorción SWIR compatible con "
    "minerales de Al-OH (Sentinel-2, bandas anchas). NO es identificación mineral, NO "
    "es recurso ni depósito. Requiere verificación de terreno. Cruce estructural pendiente."
)


def zscore(index: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """z-score del índice usando SOLO los píxeles interpretables como fondo."""
    vals = index[mask & np.isfinite(index)]
    if vals.size < 30:
        raise ValueError(f"muy pocos píxeles interpretables para estadística de fondo (n={vals.size}).")
    mu, sd = float(np.mean(vals)), float(np.std(vals))
    if sd == 0:
        raise ValueError("desviación estándar cero en el fondo interpretable.")
    z = (index - mu) / sd
    z[~mask] = np.nan
    return z


def extract_candidates(comp: dict, indices: dict, primary: str = "aloh",
                       percentile: float = 97.0, min_dist_m: float = 200.0,
                       max_n: int = 20) -> dict:
    """Devuelve un FeatureCollection GeoJSON (WGS84) de candidatos rankeados."""
    from skimage.feature import peak_local_max

    mask = comp["interpretable"]
    x, y, crs = comp["x"], comp["y"], comp["crs"]
    res = abs(float(x[1] - x[0]))
    z = zscore(indices[primary], mask)

    fondo = z[mask & np.isfinite(z)]
    thr = float(np.percentile(fondo, percentile))
    img = np.where(np.isfinite(z), z, -np.inf)
    coords = peak_local_max(img, min_distance=max(1, int(min_dist_m / res)),
                            threshold_abs=thr, exclude_border=False)

    # Rankear por z desc y cortar a max_n.
    ranked = sorted(coords.tolist(), key=lambda rc: img[rc[0], rc[1]], reverse=True)[:max_n]
    to_wgs84 = pyproj.Transformer.from_crs(crs, "EPSG:4326", always_xy=True)

    feats = []
    for rank, (r, c) in enumerate(ranked, start=1):
        e, n = float(x[c]), float(y[r])
        lon, lat = to_wgs84.transform(e, n)
        props = {
            "rank": rank,
            "aloh_zscore": round(float(z[r, c]), 2),
            "aloh_percentile": round(float((fondo < z[r, c]).mean() * 100), 1),
            "easting": round(e, 1), "northing": round(n, 1), "crs": crs,
            "legend": CANDIDATE_LEGEND,
            "kind": "sampling_candidate",
        }
        for name, arr in indices.items():
            v = arr[r, c]
            props[name] = round(float(v), 4) if np.isfinite(v) else None
        feats.append({"type": "Feature",
                      "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                      "properties": props})

    return {
        "type": "FeatureCollection",
        "name": "sampling_candidates",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "metadata": {
            "primary_index": primary,
            "percentile": percentile,
            "background": "solo píxeles interpretables (sin cubierta vegetal)",
            "sensor": "Sentinel-2 L2A",
            "disclaimer": CANDIDATE_LEGEND,
            "n_candidates": len(feats),
        },
        "features": feats,
    }


def run_candidates(cfg, out_dir, max_scenes: int = 18, percentile: float = 97.0,
                   min_dist_m: float | None = None, max_n: int = 20,
                   polygons_wgs84: list[dict] | None = None) -> dict:
    """Orquesta: busca escenas -> mosaico -> índices -> candidatos -> GeoJSON."""
    import json
    from pathlib import Path

    import planetary_computer as pc
    from pystac_client import Client

    from .catalog import PC_STAC
    from .indices import INDEX_META, s2_indices
    from .ingest import load_composite
    from .aoi_mask import polygon_mask

    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    bbox = cfg.aoi.bbox_wgs84()
    client = Client.open(PC_STAC, modifier=pc.sign_inplace)
    items = [it for it in client.search(
                collections=["sentinel-2-l2a"], bbox=bbox,
                query={"eo:cloud_cover": {"lt": cfg.seasons.max_cloud_pct}},
                datetime=[f"{min(cfg.seasons.years)}-01-01T00:00:00Z",
                          f"{max(cfg.seasons.years)}-12-31T23:59:59Z"]).items()
             if it.datetime.month in cfg.seasons.months and it.datetime.year in cfg.seasons.years]
    items.sort(key=lambda it: it.datetime)
    use = items if len(items) <= max_scenes else items[:: max(1, len(items) // max_scenes)][:max_scenes]

    comp = load_composite(use, bbox, crs=cfg.output_crs, ndvi_threshold=cfg.masks.ndvi_threshold)
    if polygons_wgs84 is not None:
        comp["interpretable"] &= polygon_mask(
            polygons_wgs84, comp["x"], comp["y"], comp["crs"]
        )
    idx = s2_indices(comp["refl"])
    fc = extract_candidates(comp, idx, primary="aloh", percentile=percentile,
                            min_dist_m=min_dist_m or cfg.structure.min_lineament_length_m,
                            max_n=max_n)
    fc["metadata"]["index_meta"] = INDEX_META
    fc["metadata"]["scenes_used"] = len(use)
    fc["metadata"]["config_sha256"] = cfg.config_sha256
    (out / "sampling_candidates.geojson").write_text(json.dumps(fc, ensure_ascii=False, indent=2))
    return fc
