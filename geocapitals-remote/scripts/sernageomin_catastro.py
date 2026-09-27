#!/usr/bin/env python3
"""Conector al Catastro Minero de SERNAGEOMIN vía ArcGIS Online (alcanzable).

Los servidores propios de SERNAGEOMIN (catastromineronline / geoservicios)
bloquean este entorno, pero SERNAGEOMIN publica una copia HOSTED del catastro en
ArcGIS Online ('Propiedad Minera (SIGEX)' -> FeatureServer 'Marcelo_Layer',
capa 2 = WGS84_Concesion), que sí es accesible. Trae rol, titular, situación,
tipo, hectáreas, vencimiento y comuna.

Uso: python sernageomin_catastro.py <name> <xmin> <ymin> <xmax> <ymax>
Escribe src/data/geo/<name>_catastro_sngm.geojson (polígonos WGS84).

GUARDA: copia oficial SIGEX (campo FECHA_ACTUALIZACION indica la vigencia; a la
fecha de este conector, ~jul-2026). Puede ir por detrás del visor en vivo; para
constituir, confirmar contra la Oficina Judicial Virtual / visor oficial.
"""
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LAYER = ("https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services/"
         "Marcelo_Layer/FeatureServer/2/query")


def _get(params):
    url = LAYER + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def _date(ms):
    if not isinstance(ms, (int, float)):
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).date().isoformat()


def fetch(xmin, ymin, xmax, ymax):
    common = {
        "geometry": f"{xmin},{ymin},{xmax},{ymax}", "geometryType": "esriGeometryEnvelope",
        "inSR": "4326", "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
        "outSR": "4326", "returnGeometry": "true", "f": "geojson",
    }
    # paginación por si supera maxRecordCount
    feats, offset = [], 0
    while True:
        d = _get({**common, "resultOffset": offset, "resultRecordCount": 2000})
        fs = d.get("features", [])
        feats.extend(fs)
        if len(fs) < 2000:
            break
        offset += 2000
    return feats


def main():
    name, xmin, ymin, xmax, ymax = sys.argv[1], *map(float, sys.argv[2:6])
    raw = fetch(xmin, ymin, xmax, ymax)
    feats, updated = [], set()
    for f in raw:
        a = f.get("properties", {})
        rol = f"{a.get('NUMERO_ROL')}-{a.get('DV_ROL')}"
        tit = " ".join(str(x) for x in [a.get("TITULAR_NOMBRE"), a.get("TITULAR_DIVISION")] if x)
        upd = _date(a.get("FECHA_ACTUALIZACION"))
        if upd:
            updated.add(upd)
        feats.append({
            "type": "Feature", "geometry": f.get("geometry"),
            "properties": {
                "rol": rol, "nombre": a.get("NOMBRE"), "titular": tit or None,
                "titular_rut": (f"{a.get('TITULAR_RUT')}-{a.get('TITULAR_DV')}"
                                if a.get("TITULAR_RUT") else None),
                "situacion": a.get("SITUACION_CONCESION"), "tipo": a.get("TIPO_CONCESION"),
                "hectareas": a.get("HECTAREAS"), "vencimiento": _date(a.get("FECHA_VENCIMIENTO")),
                "comuna": a.get("COMUNA"), "datum": a.get("DATUM"), "huso": a.get("HUSO"),
            },
        })
    fc = {
        "type": "FeatureCollection", "name": f"{name}_catastro_sngm",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "metadata": {
            "fuente": "SERNAGEOMIN — Propiedad Minera (SIGEX), copia hosted en ArcGIS Online (Marcelo_Layer capa WGS84_Concesion)",
            "n": len(feats), "fecha_actualizacion_datos": sorted(updated),
            "guarda": ("Copia oficial SIGEX; puede ir por detrás del visor en vivo. "
                       "Confirmar vigencia/prioridad en Oficina Judicial Virtual antes de constituir."),
        },
        "features": feats,
    }
    out = Path(f"/home/user/prospecto-palmeritas/src/data/geo/{name}_catastro_sngm.geojson")
    out.write_text(json.dumps(fc, ensure_ascii=False, indent=2))
    n_const = sum(1 for f in feats if f["properties"]["situacion"] == "CONSTITUIDA")
    n_tram = sum(1 for f in feats if "TRAMITE" in (f["properties"]["situacion"] or ""))
    print(f"{name}: {len(feats)} concesiones -> {out.name} | CONSTITUIDA {n_const} · EN TRAMITE {n_tram} | datos act {sorted(updated)}")


if __name__ == "__main__":
    main()
