"""Descarga imagen satelital de alta resolución y caminos/labores de OSM para Tilama.

Sirve para fotointerpretar faenas y accesos antiguos alrededor de los LEONOR/ELARA.
Corre en GitHub Actions (la sandbox de desarrollo no tiene salida a estos servicios).

Salidas en out/tilama_imagenes/:
  - mosaico_z16.jpg  (~2,4 m/px) de toda el área, con su georreferencia en mosaicos.json
  - mosaico_<nombre>_z18.jpg / _z17.jpg para zonas de detalle
  - osm.geojson      (caminos, huellas, minas, piques, canteras de OpenStreetMap)
"""
from __future__ import annotations

import io
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out" / "tilama_imagenes"
TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
UA = {"User-Agent": "prospecto-palmeritas/tilama (exploracion interna)"}
OX, OY = 200, 325  # PSAD56 nativo SERNAGEOMIN -> marco WGS84 del visor
psad_to_ll = lambda e, n: Transformer.from_crs(32719, 4326, always_xy=True).transform(e - OX, n - OY)


def deg2tile(lon, lat, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def tile2deg(x, y, z):
    n = 2 ** z
    lon = x / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon, lat


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            time.sleep(2 + 2 * i)


def mosaic(name, lon0, lat0, lon1, lat1, z, quality=82):
    x0, y1 = deg2tile(lon0, lat0, z)
    x1, y0 = deg2tile(lon1, lat1, z)
    tx0, tx1, ty0, ty1 = int(x0), int(x1), int(y0), int(y1)
    W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
    img = Image.new("RGB", (W, H))
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            b = get(TILE.format(z=z, x=tx, y=ty))
            img.paste(Image.open(io.BytesIO(b)).convert("RGB"), ((tx - tx0) * 256, (ty - ty0) * 256))
    f = OUT / f"mosaico_{name}_z{z}.jpg"
    img.save(f, quality=quality)
    nw = tile2deg(tx0, ty0, z)
    se = tile2deg(tx1 + 1, ty1 + 1, z)
    print(f"{f.name}: {W}x{H}px z{z} NW {nw} SE {se}")
    return {"archivo": f.name, "z": z, "ancho": W, "alto": H, "tile_x0": tx0, "tile_y0": ty0,
            "lon_oeste": nw[0], "lat_norte": nw[1], "lon_este": se[0], "lat_sur": se[1]}


def osm(lon0, lat0, lon1, lat1):
    q = f"""[out:json][timeout:120];
(
  way["highway"]({lat0},{lon0},{lat1},{lon1});
  nwr["historic"="mine"]({lat0},{lon0},{lat1},{lon1});
  nwr["historic"="mine_shaft"]({lat0},{lon0},{lat1},{lon1});
  nwr["man_made"~"adit|mineshaft|tailings"]({lat0},{lon0},{lat1},{lon1});
  nwr["landuse"="quarry"]({lat0},{lon0},{lat1},{lon1});
  nwr["mineshaft_type"]({lat0},{lon0},{lat1},{lon1});
  node["place"]({lat0},{lon0},{lat1},{lon1});
);
out geom;"""
    for host in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"):
        try:
            d = json.loads(get(host + "?data=" + urllib.parse.quote(q)))
            break
        except Exception as e:  # noqa: BLE001
            print("overpass falló", host, e)
    else:
        return {"type": "FeatureCollection", "features": []}
    feats = []
    for el in d.get("elements", []):
        tags = el.get("tags", {})
        if el["type"] == "node":
            g = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}
        elif "geometry" in el:
            g = {"type": "LineString", "coordinates": [[p["lon"], p["lat"]] for p in el["geometry"]]}
        else:
            continue
        feats.append({"type": "Feature", "geometry": g, "properties": {"osm_id": el["id"], **tags}})
    print("OSM:", len(feats), "elementos")
    return {"type": "FeatureCollection", "features": feats}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    base = ROOT / "docs/tilama/pedimentos/presentacion"
    P = json.loads((base / "pedimentos_exploracion.json").read_text())
    M = json.loads((base / "leonor1_explotacion.json").read_text())[0]
    es = [p["E0"] for p in P] + [p["E1"] for p in P] + [M["rect"]["E0"], M["rect"]["E1"]]
    ns = [p["N0"] for p in P] + [p["N1"] for p in P] + [M["rect"]["N0"], M["rect"]["N1"]]
    lon0, lat0 = psad_to_ll(min(es) - 600, min(ns) - 600)
    lon1, lat1 = psad_to_ll(max(es) + 600, max(ns) + 600)
    meta = {"nota": "Esri World Imagery; georreferencia en WGS84 (EPSG:4326) por esquinas de tesela Web Mercator",
            "mosaicos": []}
    meta["mosaicos"].append(mosaic("general", lon0, lat0, lon1, lat1, 16))
    # detalle: LEONOR 1 y su entorno (faena M1/M2, TOO-255, bloque Fernández)
    a = psad_to_ll(300800, 6449800); b = psad_to_ll(304300, 6454600)
    meta["mosaicos"].append(mosaic("leonor1", a[0], a[1], b[0], b[1], 17))
    a = psad_to_ll(301700, 6452300); b = psad_to_ll(303600, 6454300)
    meta["mosaicos"].append(mosaic("faena_m1m2", a[0], a[1], b[0], b[1], 18))
    # detalle nivel B (anomalías) a z17
    for p in P:
        if p.get("nivel") == "B":
            a = psad_to_ll(p["E0"] - 300, p["N0"] - 300); b = psad_to_ll(p["E1"] + 300, p["N1"] + 300)
            meta["mosaicos"].append(mosaic(p["nombre"].replace(" ", "_").lower(), a[0], a[1], b[0], b[1], 17))
    (OUT / "mosaicos.json").write_text(json.dumps(meta, indent=1))
    g = osm(lon0, lat0, lon1, lat1)
    (OUT / "osm.geojson").write_text(json.dumps(g, ensure_ascii=False))


if __name__ == "__main__":
    main()
