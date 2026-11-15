"""Descarga de OpenStreetMap los límites comunales (admin_level 8) alrededor de Tilama.

Sirve para saber en qué comuna cae el punto medio de cada pedimento (art. 231: el juez
competente es el del punto medio). Corre en GitHub Actions; escribe out/tilama_comunas/comunas.geojson.
"""
import json, time, urllib.parse, urllib.request
from pathlib import Path
OUT = Path(__file__).resolve().parents[1] / "out" / "tilama_comunas"
Q = """[out:json][timeout:180];
rel["boundary"="administrative"]["admin_level"="8"](-32.15,-71.30,-31.85,-70.95);
out geom;"""
def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for host in ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"):
        for i in range(3):
            try:
                req = urllib.request.Request(host + "?data=" + urllib.parse.quote(Q), headers={"User-Agent": "prospecto-palmeritas/tilama"})
                d = json.load(urllib.request.urlopen(req, timeout=200))
                feats = []
                for el in d.get("elements", []):
                    ways = [[[p["lon"], p["lat"]] for p in m["geometry"]] for m in el.get("members", []) if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
                    feats.append({"type": "Feature", "properties": {"name": el.get("tags", {}).get("name"), "id": el["id"]},
                                  "geometry": {"type": "MultiLineString", "coordinates": ways}})
                (OUT / "comunas.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False))
                print("comunas:", [f["properties"]["name"] for f in feats]); return
            except Exception as e:  # noqa: BLE001
                print("falló", host, e); time.sleep(10)
    raise SystemExit("sin datos de Overpass")
if __name__ == "__main__":
    main()
