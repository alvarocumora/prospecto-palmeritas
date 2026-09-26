#!/usr/bin/env python3
"""Generador de pedimentos (concesiones de exploración) sobre terreno vacante.

Un pedimento chileno es un RECTÁNGULO con lados orientados N-S / E-W (ejes UTM),
superficie <= 5.000 ha. Este módulo:
  1. detecta terreno vacante = AOI menos la unión del catastro SERNAGEOMIN,
  2. inscribe el mayor rectángulo N-S/E-W posible dentro del vacante que contiene
     una anomalía objetivo (crecimiento voraz en UTM, sin solapar concesiones),
  3. entrega los 4 vértices (UTM19S + WGS84), la "cara norte", superficie y la
     verificación de no-solape.

GUARDAS: es una PROPUESTA técnica / borrador, NO la solicitud oficial. La vacancia
es indicativa (puede haber pedimentos en trámite, servidumbres, áreas protegidas):
requiere verificación legal / estudio de títulos antes de constituir. Datum
WGS84/UTM huso 19S (SIRGAS), vigente para pedir.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import pyproj
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import transform as shp_transform, unary_union

WGS84 = "EPSG:4326"


def _utm_for_lon(lon: float) -> str:
    zone = int((lon + 180) // 6) + 1
    return f"EPSG:327{zone:02d}"  # WGS84 / UTM sur


def load_catastro(path: str):
    d = json.loads(Path(path).read_text())
    return [shape(f["geometry"]) for f in d["features"] if f.get("geometry")]


def max_rectangle(anomaly_lonlat, concessions_wgs, aoi_wgs, utm,
                  step_m: float = 50.0, max_ha: float = 5000.0, margin_m: float = 30.0):
    """Mayor rectángulo N-S/E-W (en UTM) que contiene la anomalía, dentro del AOI y
    sin solapar concesiones (con un margen de seguridad al lindero)."""
    fwd = pyproj.Transformer.from_crs(WGS84, utm, always_xy=True).transform
    obstacles = unary_union([shp_transform(fwd, g) for g in concessions_wgs]).buffer(margin_m)
    aoi = shp_transform(fwd, aoi_wgs)
    ax, ay = fwd(*anomaly_lonlat)

    def ok(w, e, s, n):
        r = box(w, s, e, n)
        if not aoi.contains(r):
            return False
        if r.intersects(obstacles):
            return False
        if (e - w) * (n - s) / 10000.0 > max_ha:
            return False
        return True

    # semilla mínima (10 m) en la anomalía; el crecimiento es asimétrico, así que
    # el rectángulo se aleja del lindero cercano en vez de exigir estar centrado.
    seed = 10.0
    w, e, s, n = ax - seed, ax + seed, ay - seed, ay + seed
    if not ok(w, e, s, n):
        return None  # ni un cuadrado mínimo libre (anomalía sobre el lindero)

    # crecer voraz cada lado hasta topar
    grew = True
    while grew:
        grew = False
        for side in ("e", "w", "n", "s"):
            nw, ne, ns, nn = w, e, s, n
            if side == "e":
                ne = e + step_m
            elif side == "w":
                nw = w - step_m
            elif side == "n":
                nn = n + step_m
            else:
                ns = s - step_m
            if ok(nw, ne, ns, nn):
                w, e, s, n = nw, ne, ns, nn
                grew = True

    # redondear a 100 m (convención de coordenadas de pedimento)
    w = math.floor(w / 100) * 100; s = math.floor(s / 100) * 100
    e = math.ceil(e / 100) * 100; n = math.ceil(n / 100) * 100
    # el redondeo puede reintroducir solape: encoger si hace falta
    while box(w, s, e, n).intersects(obstacles) and (e - w) > 200 and (n - s) > 200:
        w += 100; s += 100; e -= 100; n -= 100

    inv = pyproj.Transformer.from_crs(utm, WGS84, always_xy=True).transform
    rect_utm = box(w, s, e, n)
    rect_wgs = shp_transform(inv, rect_utm)
    area_ha = (e - w) * (n - s) / 10000.0
    corners_utm = {"NW": (w, n), "NE": (e, n), "SE": (e, s), "SW": (w, s)}
    corners_wgs = {k: inv(x, y) for k, (x, y) in corners_utm.items()}
    return {
        "utm": utm,
        "corners_utm": corners_utm,
        "corners_wgs": corners_wgs,
        "cara_norte_utm": {"E_centro": round((w + e) / 2, 0), "N": n},
        "lados_m": {"E-W": round(e - w), "N-S": round(n - s)},
        "area_ha": round(area_ha, 1),
        "overlaps": rect_utm.intersects(obstacles.buffer(-margin_m)),
        "geom_wgs": mapping(rect_wgs),
    }


def propose(catastro_path: str, anomalies_path: str, out_dir: str,
            only_vacant: bool = True, max_ha: float = 5000.0):
    conc = load_catastro(catastro_path)
    union = unary_union(conc)
    xs = [x for g in conc for x, y in g.exterior.coords]
    ys = [y for g in conc for x, y in g.exterior.coords]
    aoi = box(min(xs), min(ys), max(xs), max(ys))
    utm = _utm_for_lon((min(xs) + max(xs)) / 2)

    an = json.loads(Path(anomalies_path).read_text())
    feats = []
    for f in an["features"]:
        g = f["geometry"]
        ring = g["coordinates"][0] if g["type"] == "Polygon" else None
        if ring:
            lon = sum(x for x, y in ring) / len(ring); lat = sum(y for x, y in ring) / len(ring)
        else:
            lon, lat = g["coordinates"]
        p = f["properties"]
        pt = Point(lon, lat)
        vacant = not (union.contains(pt) or union.distance(pt) < 0.0004)
        feats.append({"lon": lon, "lat": lat, "z": p.get("z_score"), "vacant": vacant})

    # anomalías objetivo: en vacante, ordenadas por z
    targets = sorted([a for a in feats if (a["vacant"] or not only_vacant)],
                     key=lambda a: -(a["z"] or 0))
    pedimentos = []
    used = None
    for t in targets:
        rect = max_rectangle((t["lon"], t["lat"]), conc, aoi, utm, max_ha=max_ha)
        if not rect or rect["area_ha"] < 50:
            continue
        rg = shape(rect["geom_wgs"])
        if used is not None and used.intersects(rg):
            continue  # no proponer pedimentos solapados entre sí
        used = rg if used is None else unary_union([used, rg])
        pedimentos.append((t, rect))
        if len(pedimentos) >= 5:
            break

    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    fc = {"type": "FeatureCollection", "name": "pedimentos_propuestos",
          "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
          "metadata": {"tipo": "PROPUESTA / BORRADOR — no es solicitud oficial",
                       "datum": "WGS84 / UTM huso 19S (SIRGAS)", "fuente_catastro": "SERNAGEOMIN",
                       "n": len(pedimentos),
                       "disclaimer": ("Vacancia indicativa. Requiere verificación legal / estudio de "
                                      "títulos (pedimentos en trámite, servidumbres, áreas protegidas) "
                                      "antes de constituir.")},
          "features": []}
    for i, (t, r) in enumerate(pedimentos, 1):
        fc["features"].append({"type": "Feature", "geometry": r["geom_wgs"],
                               "properties": {"code": f"PED-CQ-{i:02d}", "target_z": t["z"],
                                              "area_ha": r["area_ha"], "lados_m": r["lados_m"],
                                              "corners_utm": {k: [round(x), round(y)] for k, (x, y) in r["corners_utm"].items()},
                                              "cara_norte_utm": r["cara_norte_utm"], "datum": r["utm"],
                                              "procedencia": "PROPUESTA / BORRADOR"}})
    (out / "pedimentos_propuestos.geojson").write_text(json.dumps(fc, ensure_ascii=False, indent=2))
    return fc


if __name__ == "__main__":
    import sys
    fc = propose(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "out/pedimentos")
    for f in fc["features"]:
        p = f["properties"]
        print(f"{p['code']}: {p['area_ha']} ha  lados {p['lados_m']}  cara norte {p['cara_norte_utm']}  (target z{p['target_z']})")
        for k, v in p["corners_utm"].items():
            print(f"    {k}: E {v[0]}  N {v[1]}")
