"""Orquestador de `coverage`: lo primero y más barato. Si el AOI no es observable,
no se gasta el resto del módulo."""
from __future__ import annotations

import json
from pathlib import Path

from .catalog import PC_STAC, build_manifest, write_manifest
from .config import Config
from .ingest import dry_season_ndvi, load_stack
from .masks import coverage_fractions_ndvi, coverage_verdict
from .aoi_mask import polygon_mask


def run_coverage(cfg: Config, out_dir: str | Path, max_scenes: int = 24,
                 floor: float = 0.15, polygons_wgs84: list[dict] | None = None) -> dict:
    import planetary_computer as pc
    from pystac_client import Client

    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    bbox = cfg.aoi.bbox_wgs84()

    client = Client.open(PC_STAC, modifier=pc.sign_inplace)
    items = list(client.search(
        collections=["sentinel-2-l2a"], bbox=bbox,
        query={"eo:cloud_cover": {"lt": cfg.seasons.max_cloud_pct}},
        datetime=[f"{min(cfg.seasons.years)}-01-01T00:00:00Z",
                  f"{max(cfg.seasons.years)}-12-31T23:59:59Z"],
    ).items())
    items = [it for it in items
             if it.datetime.month in cfg.seasons.months and it.datetime.year in cfg.seasons.years]
    items.sort(key=lambda it: it.datetime)
    if not items:
        raise RuntimeError("sin escenas Sentinel-2 para el AOI/estacionalidad declarados")

    # Manifest congelado (reproducibilidad) sobre TODAS las escenas candidatas.
    manifest = build_manifest([it.to_dict() for it in items], cfg.config_sha256, cfg.name)
    write_manifest(manifest, out)

    # Submuestreo uniforme para coverage (barato).
    use = items if len(items) <= max_scenes else items[:: max(1, len(items) // max_scenes)][:max_scenes]

    ds = load_stack(use, bbox, bands=["B04", "B08", "SCL"], resolution=20, crs=cfg.output_crs)
    driest, typical, rep_scl, n_clear = dry_season_ndvi(ds)
    area_mask = (
        polygon_mask(polygons_wgs84, ds["x"].values, ds["y"].values, cfg.output_crs)
        if polygons_wgs84 is not None else None
    )

    # Dos números, honestos:
    #  - típico (NDVI mediana): exposición de suelo PERSISTENTE -> gate del reporte.
    #  - mejor caso (NDVI mínimo): exposición MÁXIMA de fin de verano -> upside para targeting.
    cov_typical = coverage_fractions_ndvi(typical, rep_scl, cfg.masks.ndvi_threshold,
                                          sensitivity=cfg.masks.ndvi_sensitivity,
                                          area_mask=area_mask)
    cov_best = coverage_fractions_ndvi(driest, rep_scl, cfg.masks.ndvi_threshold,
                                       sensitivity=cfg.masks.ndvi_sensitivity,
                                       area_mask=area_mask)
    verdict = coverage_verdict(cov_typical["interpretable_fraction_of_area"], floor=floor)

    result = {
        "config": cfg.name,
        "config_sha256": cfg.config_sha256,
        "aoi_center_lonlat": list(cfg.aoi.lonlat_center()),
        "output_crs": cfg.output_crs,
        "scenes_candidate": len(items),
        "scenes_used_for_coverage": len(use),
        "area_basis": "AOI_POLYGONS" if polygons_wgs84 is not None else "BBOX_ONLY",
        "pixels_inside_aoi": int(area_mask.sum()) if area_mask is not None else int(typical.size),
        "scenes_used_ids": [item.id for item in use],
        "verdict": verdict,
        "interpretable_typical_frac": cov_typical["interpretable_fraction_of_area"],
        "interpretable_bestcase_frac": cov_best["interpretable_fraction_of_area"],
        "coverage_typical": cov_typical,
        "coverage_bestcase": cov_best,
    }
    (out / "coverage.json").write_text(json.dumps(result, indent=2, ensure_ascii=False))
    return result
