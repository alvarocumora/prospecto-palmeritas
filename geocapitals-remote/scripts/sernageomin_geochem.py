#!/usr/bin/env python3
"""Conector a la Compilación de Geoquímica de Sedimentos de SERNAGEOMIN.

Fuente REAL (ArcGIS Online, pública): FeatureServer de la 'Compilación de
Geoquímica de sedimentos de Chile' (capa 1 = Muestras publicadas). Geoquímica
de sedimento fluvial MEDIDA, multi-elemento (mayores + trazas + REE completos).
Descarga por bbox, normaliza el formato chileno (coma decimal, límites de
detección '<x') y escribe un geojson consumible.

Uso: python sernageomin_geochem.py <name> <xmin> <ymin> <xmax> <ymax>
Cobertura: norte/centro de Chile (lat ~-17.6 a -31.0). No cubre el centro-sur.
GUARDA: dato oficial SERNAGEOMIN; geoquímica de sedimento es dispersión regional,
no ley in situ. Un valor anómalo orienta, no prueba mineralización.
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

FS = ("https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services/"
      "Compilaci%C3%B3n_de_Geoqu%C3%ADmica_de_sedimentos_de_Chile_WFL1/FeatureServer/1/query")
# elementos de interés (limpios) + Au/Ag (formato especial)
ELEMENTS = ["Cu", "Au", "Ag", "As_", "Mo", "Pb", "Zn", "Ni", "Sb", "Bi", "Hg", "W",
            "La", "Ce", "Nd", "Sm", "Y", "Th", "U"]


def num(v):
    """(valor, below_detection). Maneja coma decimal chilena y '<x'."""
    if v is None:
        return None, False
    if isinstance(v, (int, float)):
        return float(v), False
    s = str(v).strip().replace(" ", "")
    if not s or s.lower() in ("nd", "n/a", "-"):
        return None, False
    bdl = s.startswith("<")
    s = s.lstrip("<")
    if "," in s and "." in s:            # ej '4,0.0' -> '4.0'
        s = s.split(".")[0].replace(",", ".")
    else:
        s = s.replace(",", ".")
    try:
        return float(s), bdl
    except ValueError:
        return None, False


def fetch(xmin, ymin, xmax, ymax):
    params = {
        "geometry": f"{xmin},{ymin},{xmax},{ymax}", "geometryType": "esriGeometryEnvelope",
        "inSR": "4326", "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
        "outSR": "4326", "returnGeometry": "true", "f": "json",
    }
    url = FS + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def main():
    name, xmin, ymin, xmax, ymax = sys.argv[1], *map(float, sys.argv[2:6])
    d = fetch(xmin, ymin, xmax, ymax)
    feats = []
    for f in d.get("features", []):
        a = f["attributes"]; g = f["geometry"]
        chem = {}
        for e in ELEMENTS:
            val, bdl = num(a.get(e))
            key = e.rstrip("_")
            if val is not None:
                chem[key] = val
                if bdl:
                    chem[key + "_bdl"] = True
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(g["x"], 6), round(g["y"], 6)]},
            "properties": {"muestra": a.get("F17") or a.get("OBJECTID"), **chem},
        })
    fc = {
        "type": "FeatureCollection", "name": f"{name}_geoquimica_sedimentos_sngm",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "metadata": {
            "fuente": "SERNAGEOMIN — Compilación de Geoquímica de Sedimentos de Chile (ArcGIS Online, capa Muestras publicadas)",
            "tipo": "Geoquímica de sedimento fluvial MEDIDA (multi-elemento). Dato OFICIAL.",
            "n": len(feats), "unidades": "ppm salvo Au/Ag (ver fuente); '<' = bajo límite de detección",
            "guarda": "Dispersión geoquímica regional, NO ley in situ. Orienta, no prueba mineralización.",
        },
        "features": feats,
    }
    out = Path(f"/home/user/prospecto-palmeritas/src/data/geo/{name}_geoquimica_sedimentos.geojson")
    out.write_text(json.dumps(fc, ensure_ascii=False, indent=2))
    # resumen
    def stat(el):
        xs = [f["properties"][el] for f in feats if el in f["properties"]]
        return (len(xs), round(min(xs), 1), round(max(xs), 1)) if xs else (0, None, None)
    print(f"{name}: {len(feats)} muestras -> {out.name}")
    for el in ["Cu", "Au", "Ag", "As", "Mo", "La", "Ce", "Nd"]:
        n, lo, hi = stat(el)
        if n:
            print(f"  {el}: n={n} rango {lo}–{hi}")


if __name__ == "__main__":
    main()
