#!/usr/bin/env python3
"""Runner genérico de targets satelitales por proyecto.

Toma un GeoJSON de concesiones/AOI de CUALQUIER proyecto y produce, con dato real
de Sentinel-2 (STAC), las mismas capas que Cholqui:
  - coverage (observabilidad),
  - anomalías Al-OH/gossan en formato consumible por la UI (index_code/score/Polygon),
  - malla de sondajes PROPUESTA (solo dentro de la tenencia).

NO inventa AOI: el bounding box se deriva de los polígonos reales del proyecto.
Uso:
  python scripts/run_project_targets.py --aoi src/.../concesiones.geojson \
      --name losverdes --strike 20 --out out/losverdes
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import pyproj
import yaml


def aoi_bbox_wgs84(geojson_path: str, buffer_m: float = 500.0):
    d = json.loads(Path(geojson_path).read_text())
    feats = d["features"] if isinstance(d, dict) and "features" in d else d
    xs, ys = [], []

    def walk(c):
        if isinstance(c, (list, tuple)):
            if len(c) == 2 and all(isinstance(v, (int, float)) for v in c):
                xs.append(c[0]); ys.append(c[1])
            else:
                for x in c:
                    walk(x)
    polys = []
    for f in feats:
        g = (f.get("geometry") or {}) if isinstance(f, dict) else {}
        walk(g.get("coordinates", []))
        if g.get("type") in ("Polygon", "MultiPolygon"):
            polys.append(g)
    if not xs:
        raise SystemExit("AOI sin coordenadas: no se puede derivar bbox")
    lat0 = (min(ys) + max(ys)) / 2
    dlat = buffer_m / 111000.0
    dlon = buffer_m / (111000.0 * math.cos(math.radians(lat0)))
    return [min(xs) - dlon, min(ys) - dlat, max(xs) + dlon, max(ys) + dlat], polys


def build_config(name, bbox_wgs84, output_crs, out_dir):
    cfg = {
        "name": name,
        "aoi": {"crs": "EPSG:4326", "bbox": [round(v, 6) for v in bbox_wgs84]},
        "output_crs": output_crs,
        "seasons": {"months": [2, 3, 4],
                    "years": [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
                    "max_cloud_pct": 10},
        "masks": {"ndvi_threshold": 0.25, "ndvi_sensitivity": [0.20, 0.25, 0.30]},
        "structure": {"known_strikes_deg": [], "min_lineament_length_m": 150},
        "cadastre": {"source": "sernageomin_wfs", "buffer_m": 60},
    }
    p = Path(out_dir) / f"{name}_aoi.generated.yaml"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(yaml.safe_dump(cfg, sort_keys=False, allow_unicode=True))
    return str(p)


def _point_in_any(lon, lat, polys, tol_deg=0.0005):
    from shapely.geometry import Point, shape
    pt = Point(lon, lat)
    for g in polys:
        try:
            s = shape(g)
            if s.contains(pt) or s.distance(pt) < tol_deg:
                return True
        except Exception:
            continue
    return False


def to_lovable_layers(raw_fc, polys, name, dominant_strike, output_crs):
    if not raw_fc.get("features"):
        return [], []
    center = {"lat": sum(p[1] for f in raw_fc["features"] for p in [f["geometry"]["coordinates"]]) / len(raw_fc["features"]),
              "lng": sum(p[0] for f in raw_fc["features"] for p in [f["geometry"]["coordinates"]]) / len(raw_fc["features"])}
    to_utm = pyproj.Transformer.from_crs("EPSG:4326", output_crs, always_xy=True)
    perp = (dominant_strike + 90) % 360

    def sq(lon, lat, half=60):
        dlat = half / 111000.0; dlon = half / (111000.0 * math.cos(math.radians(lat)))
        return [[[lon - dlon, lat - dlat], [lon + dlon, lat - dlat], [lon + dlon, lat + dlat],
                 [lon - dlon, lat + dlat], [lon - dlon, lat - dlat]]]

    def bearing(aLat, aLng, bLat, bLng):
        dx = (bLng - aLng) * math.cos(math.radians((aLat + bLat) / 2)); dy = bLat - aLat
        return (math.degrees(math.atan2(dx, dy)) + 360) % 360

    def gap(a, b):
        return abs(((a - b + 540) % 360) - 180)

    anoms, collars, ci = [], [], 0
    for f in sorted(raw_fc["features"], key=lambda f: -f["properties"]["aloh_zscore"]):
        p = f["properties"]; lon, lat = f["geometry"]["coordinates"]
        z = p["aloh_zscore"]; gos = p.get("gossan") or 0
        idx = "HYDROTHERMAL_ALTERATION" if gos >= 3 else "CLAY_MINERALS"
        score = round(min(0.98, z / 9.0), 3)
        inside = _point_in_any(lon, lat, polys)
        anoms.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": sq(lon, lat)},
                      "properties": {"index_code": idx, "severity": ("alta" if z >= 6 else "media" if z >= 4 else "baja"),
                                     "score": score, "z_score": z, "dentro_concesion": inside,
                                     "procedencia": "DERIVADO / INTERPRETADO — no verificado en terreno",
                                     "notes": f"Anomalia Al-OH z={z} (gossan {round(gos,2)}). DERIVADO Sentinel-2."}})
        if inside and len(collars) < 8:
            ci += 1
            tc = bearing(lat, lon, center["lat"], center["lng"])
            az = round(min([perp, (perp + 180) % 360], key=lambda a: gap(a, tc)))
            e, n = to_utm.transform(lon, lat)
            prio = "Alta" if score >= 0.85 else "Media" if score >= 0.7 else "Baja"
            collars.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                            "properties": {"code": f"{name.upper()[:3]}-DDH-{ci:02d}", "index_code": idx,
                                           "lat": round(lat, 6), "lng": round(lon, 6),
                                           "este_utm": round(e, 1), "norte_utm": round(n, 1),
                                           "azimuth_deg": az, "dip_deg": -60,
                                           "depth_m": 170 if z >= 6 else 130, "priority": prio, "score": score,
                                           "procedencia": "PROPUESTO / CONCEPTUAL — no perforado, no estima recursos ni reservas"}})
    return anoms, collars


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--aoi", required=True, help="GeoJSON de concesiones/AOI del proyecto")
    ap.add_argument("--name", required=True)
    ap.add_argument("--strike", type=float, default=20.0, help="rumbo estructural dominante (deg)")
    ap.add_argument("--output-crs", default="EPSG:32719")
    ap.add_argument("--out", default=None)
    ap.add_argument("--max-scenes", type=int, default=14)
    args = ap.parse_args()
    out_dir = args.out or f"out/{args.name}"

    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
    from gc_remote.config import Config
    from gc_remote import coverage as cov, targets

    bbox, polys = aoi_bbox_wgs84(args.aoi)
    cfg_path = build_config(args.name, bbox, args.output_crs, out_dir)
    cfg = Config.from_yaml(cfg_path)

    r = cov.run_coverage(cfg, out_dir, max_scenes=18, polygons_wgs84=polys)
    # Por debajo del piso de 15% no ejecutar ni publicar anomalías espectrales.
    if r["verdict"]["spectral_conclusive"]:
        fc = targets.run_candidates(
            cfg, out_dir, max_scenes=args.max_scenes, percentile=97.0, max_n=15,
            polygons_wgs84=polys
        )
        anoms, collars = to_lovable_layers(
            fc, polys, args.name, args.strike, args.output_crs
        )
    else:
        anoms, collars = [], []

    Path(out_dir).mkdir(parents=True, exist_ok=True)
    out_a = {"type": "FeatureCollection", "name": f"{args.name}_satellite_anomalies",
             "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
             "metadata": {"project": args.name, "sensor": "Sentinel-2 L2A", "provenance": "DERIVADO / INTERPRETADO",
                          "coverage": {"typical_pct": round(r["interpretable_typical_frac"] * 100, 1),
                                       "bestcase_pct": round(r["interpretable_bestcase_frac"] * 100, 1),
                                       "spectral_conclusive": r["verdict"]["spectral_conclusive"]},
                          "config_sha256": cfg.config_sha256,
                          "area_basis": r["area_basis"],
                          "pixels_inside_aoi": r["pixels_inside_aoi"],
                          "scenes_used_ids": r["scenes_used_ids"],
                          "n": len(anoms)},
             "features": anoms}
    out_c = {"type": "FeatureCollection", "name": f"{args.name}_drill_grid_propuesta",
             "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
             "metadata": {"tipo": "PROPUESTA CONCEPTUAL", "rumbo_dominante_deg": args.strike,
                          "n_collares": len(collars), "total_m": sum(c["properties"]["depth_m"] for c in collars),
                          "disclaimer": "Propuesta de exploracion. No constituye recurso ni reserva (NI 43-101)."},
             "features": collars}
    (Path(out_dir) / f"{args.name}_satellite_anomalies.geojson").write_text(json.dumps(out_a, ensure_ascii=False, indent=2))
    (Path(out_dir) / f"{args.name}_drill_grid.geojson").write_text(json.dumps(out_c, ensure_ascii=False, indent=2))
    print(f"[{args.name}] cobertura {out_a['metadata']['coverage']['typical_pct']}/{out_a['metadata']['coverage']['bestcase_pct']}% "
          f"| anomalias {len(anoms)} | collares dentro tenencia {len(collars)} ({out_c['metadata']['total_m']} m)")


if __name__ == "__main__":
    main()
