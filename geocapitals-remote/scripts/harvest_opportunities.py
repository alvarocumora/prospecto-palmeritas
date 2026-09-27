#!/usr/bin/env python3
"""Harvester unificado de oportunidades — data REAL de SERNAGEOMIN (ArcGIS Online).

Dado un bbox de proyecto, descarga y cruza las capas oficiales alcanzables:
  - Catastro minero (Marcelo_Layer / Propiedad Minera SIGEX): concesiones + titular.
  - Geoquímica de sedimentos (multi-elemento + REE) — solo norte/centro (lat -17.6..-31).
  - Franjas metalogénicas (contexto de sistema mineral).
  - Yacimientos / minerales críticos (Merge_RR): depósitos conocidos cercanos.
Opcionalmente cruza con un geojson de anomalías Sentinel-2 para marcar cuáles caen
en suelo vacante (= oportunidad de pedimento real).

Uso: python harvest_opportunities.py <name> <xmin> <ymin> <xmax> <ymax> [anomalies.geojson]
Guarda src/data/geo/<name>_{catastro_sngm,geoquimica_sedimentos,franjas,yacimientos}.geojson
GUARDA: fuentes oficiales SERNAGEOMIN (copias SIGEX/ArcGIS Online). Geoquímica de
sedimento = dispersión regional; yacimientos = contexto; vacancia indicativa
(confirmar en Oficina Judicial Virtual). Nada de esto es ley in situ.
"""
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from shapely.geometry import shape, Point
from shapely.ops import unary_union

ORG = "https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services"
GEO = "/home/user/prospecto-palmeritas/src/data/geo"


def q(service, layer, params):
    base = f"{ORG}/{service}/FeatureServer/{layer}/query"
    url = base + "?" + urllib.parse.urlencode({"outSR": "4326", "f": "geojson", **params})
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return json.load(urllib.request.urlopen(req, timeout=60)).get("features", [])


def envelope(xmin, ymin, xmax, ymax):
    return {"geometry": f"{xmin},{ymin},{xmax},{ymax}", "geometryType": "esriGeometryEnvelope",
            "inSR": "4326", "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
            "returnGeometry": "true"}


def catastro(bb):
    feats = []
    for f in q("Marcelo_Layer", 2, envelope(*bb)):
        a = f["properties"]
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "rol": f"{a.get('NUMERO_ROL')}-{a.get('DV_ROL')}", "nombre": a.get("NOMBRE"),
            "titular": a.get("TITULAR_NOMBRE"), "situacion": a.get("SITUACION_CONCESION"),
            "tipo": a.get("TIPO_CONCESION"), "hectareas": a.get("HECTAREAS"), "comuna": a.get("COMUNA")}})
    return feats


def _num(v):
    """Normaliza formato chileno (coma decimal, límite de detección '<x')."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace(" ", "").lstrip("<")
    if not s:
        return None
    s = s.split(".")[0].replace(",", ".") if ("," in s and "." in s) else s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def geochem(bb):
    els = ["Cu", "Au", "Ag", "As_", "Mo", "Pb", "Zn", "Ni", "Sb", "Bi", "La", "Ce", "Nd", "Y", "Th", "U"]
    try:
        out = []
        for f in q("Compilaci%C3%B3n_de_Geoqu%C3%ADmica_de_sedimentos_de_Chile_WFL1", 1, envelope(*bb)):
            a = f["properties"]
            chem = {e.rstrip("_"): _num(a.get(e)) for e in els if _num(a.get(e)) is not None}
            out.append({"type": "Feature", "geometry": f["geometry"],
                        "properties": {"muestra": a.get("F17"), **chem}})
        return out
    except Exception:
        return []


def franjas(bb):
    return [{"type": "Feature", "geometry": f["geometry"], "properties": {"franja": f["properties"].get("Franja")}}
            for f in q("Franjas_Metalog%C3%A9nicas", 0, envelope(*bb))]


def yacimientos(bb):
    # expandir ~0.3° para capturar depósitos vecinos (contexto de distrito)
    e = [bb[0] - 0.3, bb[1] - 0.3, bb[2] + 0.3, bb[3] + 0.3]
    out = []
    for f in q("Merge_RR", 0, envelope(*e)):
        a = f["properties"]
        out.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "nombre": a.get("NOMBRE_DEPOSITO"), "sistema": a.get("SISTEMA_MINERAL"),
            "modelo": a.get("MODELO_DEPOSITO"), "franja": a.get("FRANJA_METALOGENICA"),
            "estado": a.get("ESTADO_DEPOSITO"), "tipo": a.get("TIPO_DEPOSITO"),
            "criticos": ", ".join(str(x) for x in [a.get("CRITICO_1"), a.get("CRITICO_2"),
                        a.get("CRITICO_3"), a.get("CRITICO_4")] if x)}})
    return out


def save(name, kind, feats, meta):
    fc = {"type": "FeatureCollection", "name": f"{name}_{kind}",
          "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
          "metadata": meta, "features": feats}
    Path(f"{GEO}/{name}_{kind}.geojson").write_text(json.dumps(fc, ensure_ascii=False, indent=2))


def main():
    name, bb = sys.argv[1], list(map(float, sys.argv[2:6]))
    anoms_path = sys.argv[6] if len(sys.argv) > 6 else None
    src = "SERNAGEOMIN (copias oficiales SIGEX/ArcGIS Online)"

    cat = catastro(bb); gq = geochem(bb); fr = franjas(bb); ya = yacimientos(bb)
    save(name, "catastro_sngm", cat, {"fuente": src, "n": len(cat)})
    if gq:
        save(name, "geoquimica_sedimentos", gq, {"fuente": src, "n": len(gq),
             "guarda": "Dispersión de sedimento, no ley in situ."})
    save(name, "franjas", fr, {"fuente": src, "n": len(fr)})
    save(name, "yacimientos", ya, {"fuente": src, "n": len(ya), "nota": "Depósitos en ~0.3° alrededor (contexto de distrito)."})

    print(f"=== OPORTUNIDAD · {name} ===")
    print(f"Franja(s) metalogénica(s): {sorted({f['properties']['franja'] for f in fr if f['properties']['franja']}) or '—'}")
    nc = sum(1 for f in cat if f['properties']['situacion'] == 'CONSTITUIDA')
    nt = sum(1 for f in cat if 'TRAMITE' in (f['properties']['situacion'] or ''))
    print(f"Catastro: {len(cat)} concesiones (CONSTITUIDA {nc} · EN TRÁMITE {nt})")
    print(f"Yacimientos cercanos (~30 km): {len(ya)}")
    for d in ya[:8]:
        p = d['properties']
        print(f"  · {p['nombre']} [{p.get('sistema')}/{p.get('modelo')}] críticos: {p.get('criticos') or '—'}")
    print(f"Geoquímica de sedimentos: {len(gq)} muestras" + ("" if gq else " (fuera de cobertura norte/centro)"))

    # cruce con anomalías -> vacantes
    if anoms_path and Path(anoms_path).exists() and cat:
        u = unary_union([shape(f["geometry"]) for f in cat if f.get("geometry")])
        an = json.loads(Path(anoms_path).read_text())
        vac = [f for f in an["features"]
               if f["properties"].get("z_score", 0) >= 4.5
               and not (u.contains(shape(f["geometry"]).centroid)
                        or u.distance(shape(f["geometry"]).centroid) < 0.0003)]
        print(f"Anomalías Sentinel-2 z>=4.5 en suelo VACANTE: {len(vac)} (oportunidad de pedimento)")


if __name__ == "__main__":
    main()
