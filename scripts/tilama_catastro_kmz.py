#!/usr/bin/env python3
"""Refresca el catastro del KMZ de Tilama con el catastro SERNAGEOMIN vigente.

Consulta VIEW_WGS84/FeatureServer/2 de arcgisawa.sernageomin.cl (el servicio
que usa el visor oficial appsngmaz) dentro del recuadro de Tilama, pagina de a
500 registros (maxRecordCount de la capa) y reemplaza la carpeta "Catastro minero del sector" del
KMZ. Luego cruza las zonas de interes y las muestras de la Tabla 1 de Esterio
contra esas concesiones y anota el resultado en cada placemark y en
docs/tilama/catastro_vivo_resumen.md.

Uso:
  python scripts/tilama_catastro_kmz.py                 # consulta en vivo
  python scripts/tilama_catastro_kmz.py --source f.geojson   # sin red (pruebas)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from shapely.geometry import Point, shape

# Capa de concesiones que consume hoy el visor oficial
# (appsngmaz.sernageomin.cl/catastro_SNGM/js/map.js, nov-2026). La capa /0 son
# los vertices. Marcelo_Layer en ArcGIS Online ya no existe.
LAYER = "https://arcgisawa.sernageomin.cl/server/rest/services/VIEW_WGS84/FeatureServer/2"
# maxRecordCount de la capa del visor es 500
PAGINA = 500
ROOT_AGOL = "https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services"
# Recuadro del sector Tilama / Los Verdes (lon/lat WGS84)
BBOX = (-71.21, -32.12, -71.02, -31.93)
KMZ = Path("docs/tilama/tilama_prioridades_estructuras.kmz")
RESUMEN = Path("docs/tilama/catastro_vivo_resumen.md")
CATASTRO_FOLDER = "Catastro minero del sector"
# Roles que el proyecto marca como propios (mismos que el KMZ original)
ROLES_PROPIOS = {"043031060-7", "043031059-3", "043031291-K", "043031292-8"}
TITULARES_PROYECTO = ("FERNANDEZ VASQUEZ", "FERNANDEZ CHACANA")

K = "http://www.opengis.net/kml/2.2"
ET.register_namespace("", K)


def q(tag: str) -> str:
    return f"{{{K}}}{tag}"


# El servicio de ArcGIS Online del visor oficial puede filtrar por origen; se
# envian los mismos encabezados que manda el navegador desde el visor.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
    "Referer": "https://appsngmaz.sernageomin.cl/catastro_SNGM/home/index",
    "Origin": "https://appsngmaz.sernageomin.cl",
    "Accept": "application/json, text/plain, */*",
}


ROOT = ROOT_AGOL


def _json(url: str) -> dict:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
        return json.load(r)


def descubrir_capa() -> str | None:
    """Busca en la organizacion SNGM la capa de concesiones vigente.

    SERNAGEOMIN renombra servicios (Marcelo_Layer dejo de responder en
    nov-2026): se elige la capa de poligonos que tenga NUMERO_ROL y NOMBRE.
    """
    try:
        servicios = _json(f"{ROOT}?f=json").get("services", [])
    except Exception as e:  # noqa: BLE001
        print(f"No se pudo listar {ROOT}: {e}")
        return None
    candidatos = [s for s in servicios if s.get("type") == "FeatureServer"
                  and any(k in s["name"].lower() for k in ("conces", "marcelo", "catastro", "pertenen", "minera"))]
    print(f"{len(servicios)} servicios en la organizacion: {sorted(s['name'] for s in servicios)}")
    print(f"candidatos: {[s['name'] for s in candidatos]}")
    elegida = None
    for s in candidatos:
        base = f"{ROOT}/{s['name']}/FeatureServer"
        try:
            info = _json(f"{base}?f=json")
        except Exception as e:  # noqa: BLE001
            print(f"  {s['name']}: error {e}")
            continue
        capas = info.get("layers", [])
        if not capas:
            print(f"  {s['name']}: sin capas {str(info)[:200]}")
        for c in capas:
            try:
                meta = _json(f"{base}/{c['id']}?f=json")
            except Exception:  # noqa: BLE001
                continue
            campos = {f["name"].upper() for f in meta.get("fields") or []}
            ok = meta.get("geometryType") == "esriGeometryPolygon" and {"NUMERO_ROL", "NOMBRE"} <= campos
            print(f"  {s['name']}/{c['id']} {c.get('name')} {meta.get('geometryType')} n_campos={len(campos)} {sorted(campos)[:25]} {'<- concesiones' if ok else ''}")
            if ok and elegida is None:
                elegida = f"{base}/{c['id']}"
    return elegida


def diagnostico() -> None:
    url = f"{LAYER}?f=json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
            meta = json.load(r)
        if meta.get("error"):
            print("Metadatos de la capa con error:", meta["error"])
        else:
            campos = [f["name"] for f in meta.get("fields", [])]
            print(f"Capa: {meta.get('name')} | formatos: {meta.get('supportedQueryFormats')} | max {meta.get('maxRecordCount')} | campos: {campos}")
    except urllib.error.HTTPError as e:
        print(f"Metadatos HTTP {e.code}: {e.read()[:400]!r} | encabezados: {dict(e.headers)}")


def _get(params: dict) -> dict:
    url = f"{LAYER}/query?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        cuerpo = e.read()[:400].decode("utf-8", "replace")
        print(f"HTTP {e.code} en {url}\ncuerpo: {cuerpo!r}\nencabezados: {dict(e.headers)}")
        return {"error": {"code": e.code, "message": cuerpo}}


def fetch_live() -> list[dict]:
    global LAYER
    diagnostico()
    try:
        vivo = not _json(f"{LAYER}?f=json").get("error")
    except Exception:  # noqa: BLE001
        vivo = False
    if not vivo:
        nueva = descubrir_capa()
        if not nueva:
            raise SystemExit("No se encontro la capa de concesiones en la organizacion SNGM")
        print(f"Usando capa descubierta: {nueva}")
        LAYER = nueva
    base = {
        "geometry": ",".join(map(str, BBOX)),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "outSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "returnGeometry": "true",
        "f": "geojson",
    }
    # Variantes de mas completa a mas simple; la ultima es la que usa
    # src/components/map/overlays.ts en la plataforma.
    variantes = [
        {"where": "1=1", "outFields": "*"},
        {"where": "1=1", "outFields": "*", "paginar": False},
        {"where": "ID_SITUACION_CONCESION in (1,3,9)", "outFields": "*", "paginar": False},
        {"where": "ID_SITUACION_CONCESION in (1,3)", "paginar": False,
         "outFields": "ORIGEN,NUMERO_ROL,DV_ROL,NOMBRE,HECTAREAS,FECHA_VENCIMIENTO,SITUACION_CONCESION,TITULAR_DIVISION,COMUNA"},
    ]
    for v in variantes:
        paginar = v.pop("paginar", True)
        feats: list[dict] = []
        offset = 0
        while True:
            params = {**base, **v}
            if paginar:
                params.update(resultRecordCount=str(PAGINA), resultOffset=str(offset))
            fc = _get(params)
            if fc.get("error"):
                feats = None
                break
            page = fc.get("features", [])
            feats += page
            mas = fc.get("exceededTransferLimit") or (fc.get("properties") or {}).get("exceededTransferLimit")
            if not paginar or (len(page) < PAGINA and not mas):
                break
            offset += len(page)
        if feats is not None:
            print(f"Consulta OK con where={v['where']!r}, paginada={paginar}")
            return feats
    raise SystemExit("El FeatureServer rechazo todas las variantes de consulta")


def titular(p: dict) -> str:
    return str(p.get("TITULAR_NOMBRE") or p.get("TITULAR_DIVISION") or "s/i")


def rol_de(p: dict) -> str:
    rol = str(p.get("NUMERO_ROL") or "").strip()
    dv = str(p.get("DV_ROL") or "").strip()
    return f"{rol}-{dv}" if dv else rol


def es_propia(p: dict) -> bool:
    return rol_de(p) in ROLES_PROPIOS


def es_proyecto(p: dict) -> bool:
    t = titular(p).upper()
    return es_propia(p) or any(x in t for x in TITULARES_PROYECTO)


def fecha_txt(v) -> str:
    if isinstance(v, (int, float)):
        return dt.datetime.fromtimestamp(v / 1000, dt.timezone.utc).strftime("%d-%m-%Y")
    return str(v or "—")


def rings(geom: dict):
    if geom["type"] == "Polygon":
        yield from geom["coordinates"][:1]
    elif geom["type"] == "MultiPolygon":
        for poly in geom["coordinates"]:
            yield poly[0]


def placemark(f: dict, hoy: str) -> ET.Element:
    p = f["properties"]
    own, proj = es_propia(p), es_proyecto(p)
    pm = ET.Element(q("Placemark"))
    nombre = str(p.get("NOMBRE") or "s/n").strip()
    ET.SubElement(pm, q("name")).text = ("[PROPIA] " if own else "") + nombre
    ET.SubElement(pm, q("description")).text = (
        f"Rol: {rol_de(p)}\nTitular: {titular(p)}\n"
        f"Situacion: {p.get('SITUACION_CONCESION')} | Tipo: {p.get('TIPO_CONCESION')}\n"
        f"Hectareas: {p.get('HECTAREAS')} | Comuna: {p.get('COMUNA')}\n"
        f"Vencimiento: {fecha_txt(p.get('FECHA_VENCIMIENTO'))} | Datum origen: {p.get('DATUM')} {p.get('HUSO') or ''}\n"
        f"Fuente: SERNAGEOMIN VIEW_WGS84/FeatureServer/2 (visor oficial), consultado {hoy}"
    )
    st = ET.SubElement(pm, q("Style"))
    ls = ET.SubElement(st, q("LineStyle"))
    ET.SubElement(ls, q("color")).text = "ff00c000" if own else ("ff00a0ff" if proj else "ffb0b0b0")
    ET.SubElement(ls, q("width")).text = "3" if own else ("2" if proj else "1")
    ps = ET.SubElement(st, q("PolyStyle"))
    ET.SubElement(ps, q("color")).text = "3300c000" if own else ("2200a0ff" if proj else "11b0b0b0")
    mg = ET.SubElement(pm, q("MultiGeometry"))
    for ring in rings(f["geometry"]):
        pol = ET.SubElement(mg, q("Polygon"))
        lr = ET.SubElement(ET.SubElement(pol, q("outerBoundaryIs")), q("LinearRing"))
        ET.SubElement(lr, q("coordinates")).text = " ".join(f"{x:.7f},{y:.7f},0" for x, y, *_ in ring)
    return pm


def area_ha(g) -> float:
    # Area aproximada en ha (equirectangular local, suficiente para porcentajes)
    lat = g.centroid.y
    return g.area * (111_320 ** 2) * math.cos(math.radians(lat)) / 1e4


def kml_geom(pm: ET.Element):
    from shapely.geometry import LineString, Polygon

    c = next(pm.iter(q("coordinates")), None)
    if c is None:
        return None
    pts = [tuple(map(float, v.split(",")[:2])) for v in c.text.split()]
    if pm.find(f".//{q('Point')}") is not None:
        return Point(pts[0])
    if pm.find(f".//{q('LineString')}") is not None:
        return LineString(pts)
    return Polygon(pts)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", help="GeoJSON local en lugar de la consulta en vivo")
    args = ap.parse_args()
    hoy = dt.date.today().strftime("%d-%m-%Y")
    if args.source:
        feats = json.loads(Path(args.source).read_text())["features"]
        hoy += " (archivo local)"
    else:
        feats = fetch_live()
    feats = [f for f in feats if f.get("geometry")]
    print(f"{len(feats)} concesiones en el recuadro")

    root = ET.fromstring(zipfile.ZipFile(KMZ).read("doc.kml"))
    doc = root.find(q("Document"))
    folder = next(f for f in doc.findall(q("Folder")) if f.findtext(q("name")).startswith(CATASTRO_FOLDER))
    for child in list(folder):
        if child.tag == q("Placemark"):
            folder.remove(child)
    folder.find(q("name")).text = f"{CATASTRO_FOLDER} (SERNAGEOMIN, consultado {hoy})"
    desc = folder.find(q("description"))
    if desc is None:
        desc = ET.SubElement(folder, q("description"))
    desc.text = (
        f"Catastro SERNAGEOMIN vigente (VIEW_WGS84/FeatureServer/2, el que usa el visor oficial) dentro de {BBOX}, consultado {hoy}. "
        "Verde: roles propios del proyecto. Naranjo: titulares Fernandez Vasquez / Fernandez Chacana. Gris: terceros. "
        "Referencial: la tenencia se acredita con certificado del Conservador de Minas."
    )
    for f in sorted(feats, key=lambda f: (not es_proyecto(f["properties"]), str(f["properties"].get("NOMBRE")))):
        folder.append(placemark(f, hoy))

    concesiones = [(f["properties"], shape(f["geometry"]).buffer(0)) for f in feats]

    def tenencia(g) -> str:
        if g.geom_type == "Point":
            hits = [p for p, c in concesiones if c.contains(g)]
            if not hits:
                return "fuera de toda concesion vigente del catastro (terreno posiblemente libre: verificar)"
            return "; ".join(f"{p.get('NOMBRE')} ({rol_de(p)}, {titular(p)}, {p.get('SITUACION_CONCESION')})" for p in hits)
        if g.geom_type == "LineString":
            hits = [p for p, c in concesiones if c.intersects(g)]
            return "cruza " + ("; ".join(f"{p.get('NOMBRE')} ({titular(p)})" for p in hits) or "terreno sin concesion vigente")
        tot = area_ha(g)
        partes = []
        for p, c in concesiones:
            if c.intersects(g):
                pct = area_ha(c.intersection(g)) / tot * 100
                if pct >= 0.5:
                    partes.append(f"{pct:.0f} % {p.get('NOMBRE')} ({rol_de(p)}, {titular(p)})")
        libre = 100 - sum(area_ha(c.intersection(g)) for _, c in concesiones if c.intersects(g)) / tot * 100
        if libre >= 0.5:
            partes.append(f"{libre:.0f} % sin concesion vigente")
        return "; ".join(partes) or "sin concesion vigente"

    lineas = [f"# Tenencia de Tilama según el catastro SERNAGEOMIN ({hoy})", "",
              f"Fuente: `arcgisawa.sernageomin.cl/server/rest/services/VIEW_WGS84/FeatureServer/2`, recuadro {BBOX}, {len(feats)} concesiones. "
              "Generado por `scripts/tilama_catastro_kmz.py`. Referencial: no reemplaza el certificado del Conservador de Minas.", ""]
    for fo in doc.findall(q("Folder")):
        nombre = fo.findtext(q("name"))
        if not (nombre.startswith("Zonas de interes") or nombre.startswith("Muestreo historico") or nombre.startswith("Referencias del informe")):
            continue
        lineas += [f"## {nombre}", ""]
        for pm in fo.findall(q("Placemark")):
            g = kml_geom(pm)
            if g is None:
                continue
            t = tenencia(g)
            d = pm.find(q("description"))
            if d is None:
                d = ET.SubElement(pm, q("description"))
            base = (d.text or "").split("\n\nTENENCIA (catastro SERNAGEOMIN")[0]
            d.text = f"{base}\n\nTENENCIA (catastro SERNAGEOMIN {hoy}): {t}"
            lineas.append(f"- **{pm.findtext(q('name'))}**: {t}")
        lineas.append("")

    data = b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="utf-8")
    with zipfile.ZipFile(KMZ, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("doc.kml", data)
    RESUMEN.write_text("\n".join(lineas), encoding="utf-8")
    print(f"KMZ y {RESUMEN} actualizados")


if __name__ == "__main__":
    main()
