"""Mide qué coordenadas PSAD56 usa SERNAGEOMIN para las concesiones vecinas de LEONOR.

Pide al FeatureServer del visor las mismas concesiones dos veces: en WGS84 UTM 19S
(EPSG:32719) y en PSAD56 UTM 19S (EPSG:24879). Si el dato nativo está en PSAD56, las
esquinas en 24879 salen redondas. Imprime el desfase por vértice y la capa de vértices
(capa 0) para ver qué campos de coordenadas trae. También sirve para revisar el catastro el día de la presentación.
"""
from __future__ import annotations

import json
import statistics
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tilama_catastro_kmz import HEADERS  # noqa: E402

BASE = "https://arcgisawa.sernageomin.cl/server/rest/services/VIEW_WGS84/FeatureServer"
WHERE = "SITUACION_CONCESION <> 'ELIMINADA'"
# Recuadro ampliado hasta el límite regional Coquimbo/Valparaíso (sur y este de Tilama).
BBOX = (-71.30, -32.22, -70.95, -31.93)


def _get_json(url: str, tries: int = 4) -> dict:
    """GET con reintentos: el FeatureServer de SERNAGEOMIN corta lecturas largas al azar."""
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as r:
                return json.load(r)
        except (TimeoutError, OSError, ValueError) as e:
            if i == tries - 1:
                raise
            print(f"reintento {i + 1} tras error: {e}")
            time.sleep(5 * (i + 1))
    return {}


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
        d = _get_json(url)
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
                      "tipo": a.get("TIPO_CONCESION"), "titular": a.get("TITULAR") or a.get("NOMBRE_TITULAR"),
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

    # Concesiones eliminadas del sector: faenas históricas cuyo terreno puede estar libre hoy
    el = q(2, 24879, {"where": "SITUACION_CONCESION = 'ELIMINADA'"})
    if el.get("fields"):
        print("CAMPOS capa 2:", [f["name"] for f in el["fields"]])
    for f in el["features"]:
        a = f["attributes"]; ring = (f.get("geometry") or {}).get("rings", [[]])[0]
        print("E|" + json.dumps({"n": a.get("NOMBRE"), "rol": f"{a.get('NUMERO_ROL')}-{a.get('DV_ROL')}",
                                 "tipo": a.get("TIPO_CONCESION"),
                                 "attrs": {k: v for k, v in a.items() if v not in (None, "") and k not in ("NOMBRE", "OBJECTID")},
                                 "psad": [[round(x), round(y)] for x, y in ring]}, ensure_ascii=False, default=str))
    print("ELIMINADAS fin", len(el["features"]))

    # Revisión puntual de otro sector (Cerro Alto, Illapel), en WGS84 UTM 19S
    bb = (-71.11, -31.58, -70.99, -31.47)
    for sit in ("SITUACION_CONCESION <> 'ELIMINADA'", "SITUACION_CONCESION = 'ELIMINADA'"):
        for f in q(2, 32719, {"geometry": ",".join(map(str, bb)), "where": sit})["features"]:
            a = f["attributes"]; ring = (f.get("geometry") or {}).get("rings", [[]])[0]
            print("K|" + json.dumps({"n": a.get("NOMBRE"), "rol": f"{a.get('NUMERO_ROL')}-{a.get('DV_ROL')}",
                                     "sit": a.get("SITUACION_CONCESION"), "tipo": a.get("TIPO_CONCESION"),
                                     "titular": a.get("TITULAR_NOMBRE"), "comuna": a.get("COMUNA"),
                                     "wgs": [[round(x), round(y)] for x, y in ring]}, ensure_ascii=False))

    # Búsqueda por rol o nombre en todo Chile, incluidas las eliminadas (minas históricas con certificados ENAMI)
    for where in ("NUMERO_ROL LIKE '%032663%'", "UPPER(NOMBRE) LIKE '%TILAMA NORTE%'", "UPPER(NOMBRE) LIKE '%ZORRO%' AND NUMERO_ROL LIKE '04303%'"):
        url = f"{BASE}/2/query?" + urllib.parse.urlencode({"where": where, "outFields": "*", "returnGeometry": "true", "outSR": 24879, "f": "json"})
        try:
            d = _get_json(url)
        except Exception as e:  # noqa: BLE001
            print("BUSCA error", where, e); continue
        if "error" in d:
            print("BUSCA error", where, d["error"]); continue
        for f in d.get("features", []):
            a = f["attributes"]; ring = (f.get("geometry") or {}).get("rings", [[]])[0]
            print("BUSCA|" + json.dumps({"where": where, "n": a.get("NOMBRE"), "rol": f"{a.get('NUMERO_ROL')}-{a.get('DV_ROL')}",
                                         "sit": a.get("SITUACION_CONCESION"), "tipo": a.get("TIPO_CONCESION"),
                                         "titular": a.get("TITULAR") or a.get("NOMBRE_TITULAR"),
                                         "psad": [[round(x), round(y)] for x, y in ring]}, ensure_ascii=False))
        print("BUSCA fin", where, len(d.get("features", [])))

    v = q(0, 32719, {"resultRecordCount": 50})
    print("VERTICES capa0 muestra:")
    for f in v["features"][:40]:
        print("V|", json.dumps(f["attributes"], ensure_ascii=False), f.get("geometry"))


if __name__ == "__main__":
    main()
