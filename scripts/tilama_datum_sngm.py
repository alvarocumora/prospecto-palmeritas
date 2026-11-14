"""Mide qué coordenadas PSAD56 usa SERNAGEOMIN para las concesiones vecinas de LEONOR.

Pide al FeatureServer del visor las mismas concesiones dos veces: en WGS84 UTM 19S
(EPSG:32719) y en PSAD56 UTM 19S (EPSG:24879). Si el dato nativo está en PSAD56, las
esquinas en 24879 salen redondas. Imprime el desfase por vértice y la capa de vértices
(capa 0) para ver qué campos de coordenadas trae.
"""
from __future__ import annotations

import json
import statistics
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tilama_catastro_kmz import BBOX, HEADERS  # noqa: E402

BASE = "https://arcgisawa.sernageomin.cl/server/rest/services/VIEW_WGS84/FeatureServer"
WHERE = "SITUACION_CONCESION <> 'ELIMINADA'"


def q(layer: int, out_sr: int, extra: dict | None = None) -> dict:
    p = {
        "geometry": ",".join(map(str, BBOX)), "geometryType": "esriGeometryEnvelope",
        "inSR": 4326, "outSR": out_sr, "spatialRel": "esriSpatialRelIntersects",
        "where": WHERE if layer == 2 else "1=1", "outFields": "*", "returnGeometry": "true",
        "f": "json", "resultRecordCount": 500, "orderByFields": "OBJECTID",
    }
    p.update(extra or {})
    out, off = [], 0
    while True:
        p["resultOffset"] = off
        url = f"{BASE}/{layer}/query?" + urllib.parse.urlencode(p)
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=90) as r:
            d = json.load(r)
        if "error" in d:
            print("ERROR", layer, out_sr, d["error"]); return {"features": out}
        out += d.get("features", [])
        if not d.get("exceededTransferLimit") and len(d.get("features", [])) < 500:
            break
        off += 500
    return {"features": out, "fields": d.get("fields")}


def main():
    meta0 = json.load(urllib.request.urlopen(urllib.request.Request(f"{BASE}/0?f=json", headers=HEADERS), timeout=60))
    print("CAPA0", meta0.get("name"), meta0.get("geometryType"), [f["name"] for f in meta0.get("fields", [])])
    print("SR capa 2 nativa:", json.load(urllib.request.urlopen(urllib.request.Request(f"{BASE}/2?f=json", headers=HEADERS), timeout=60)).get("extent", {}).get("spatialReference"))

    w = q(2, 32719)
    p = q(2, 24879)
    by = {f["attributes"]["OBJECTID"]: f for f in p["features"]}
    dE, dN, rondas = [], [], 0
    filas = []
    for f in w["features"]:
        a = f["attributes"]; g = f.get("geometry", {}).get("rings") or []
        h = by.get(a["OBJECTID"])
        if not g or not h:
            continue
        gp = h["geometry"]["rings"]
        ring_w, ring_p = g[0], gp[0]
        for (xw, yw), (xp, yp) in zip(ring_w, ring_p):
            dE.append(xp - xw); dN.append(yp - yw)
            if abs(xp - round(xp)) < 0.02 and abs(yp - round(yp)) < 0.02:
                rondas += 1
        filas.append({"n": a.get("NOMBRE"), "rol": f"{a.get('NUMERO_ROL')}-{a.get('DV_ROL')}",
                      "sit": a.get("SITUACION_CONCESION"), "datum": a.get("DATUM"),
                      "psad": [[round(x, 2), round(y, 2)] for x, y in ring_p],
                      "wgs": [[round(x, 2), round(y, 2)] for x, y in ring_w]})
    print(f"vertices {len(dE)} | redondos en 24879: {rondas}")
    if dE:
        print("dE med", round(statistics.median(dE), 2), "min", round(min(dE), 2), "max", round(max(dE), 2))
        print("dN med", round(statistics.median(dN), 2), "min", round(min(dN), 2), "max", round(max(dN), 2))
    print("CONCESIONES_JSON_INICIO")
    for r in filas:
        print("C|" + json.dumps(r, ensure_ascii=False))
    print("CONCESIONES_JSON_FIN")

    v = q(0, 32719, {"resultRecordCount": 50})
    print("VERTICES capa0 muestra:")
    for f in v["features"][:40]:
        print("V|", json.dumps(f["attributes"], ensure_ascii=False), f.get("geometry"))


if __name__ == "__main__":
    main()
