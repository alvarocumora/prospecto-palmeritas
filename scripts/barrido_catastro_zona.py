"""Barrido de concesiones eliminadas en zonas nuevas (costa IV Región y norte de la V Región).

Etapa `catastro` (por defecto): baja del FeatureServer del visor SERNAGEOMIN todas las
concesiones de cada recuadro (vigentes, en trámite y eliminadas), en WGS84 UTM 19S
(EPSG:32719), y las guarda en out/barrido/catastro_<zona>.json.

Etapa `chips` (BARRIDO_ETAPA=chips): descarga recortes z17 de 600 m centrados en cada
punto de docs/barrido_faenas/chips_<lote>.json (lista que se arma localmente).
"""
from __future__ import annotations

import io
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from tilama_catastro_kmz import HEADERS  # noqa: E402

BASE = "https://arcgisawa.sernageomin.cl/server/rest/services/VIEW_WGS84/FeatureServer"
OUT = ROOT / "out/barrido"
TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

# lon0, lat0, lon1, lat1 (WGS84)
ZONAS = {
    # Franja costera de Los Vilos y Canela, al oeste de lo ya barrido (Tilama e Illapel)
    "costa_iv": (-71.72, -32.27, -71.25, -31.35),
    # Norte de la V Región: Papudo, Zapallar, La Ligua, Cabildo, Petorca, Putaendo, Catemu, Nogales
    "v_norte": (-71.60, -32.95, -70.45, -32.20),
}
# Lote "choapa": interior de Choapa (Illapel, Salamanca, Canela alta, Combarbalá sur)
ZONAS_CHOAPA = {"choapa": (-71.55, -32.22, -70.40, -30.95)}
# Lote "validar": catastro del día sobre todas las piezas por presentar
ZONAS_VALIDAR = {"tilama_petorca": (-71.32, -32.25, -70.97, -31.96), "cerro_alto": (-71.25, -31.68, -70.85, -31.38)}

GEOCODE = [
    "Planta Portezuelo ENAMI Illapel", "Portezuelo, Illapel", "Minera Las Cenizas Cabildo",
    "Planta Cabildo Las Cenizas", "Planta Delta ENAMI Ovalle", "Minera Barba Combarbalá",
    "Planta Catemu CEMIN", "Fundición Ventanas", "Minera Tres Valles Salamanca",
]


def geocode():
    res = {}
    for q in GEOCODE:
        u = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({"q": q, "format": "json", "limit": 5, "countrycodes": "cl"})
        try:
            res[q] = _get_json(u)
        except Exception as e:  # noqa: BLE001
            res[q] = str(e)
        time.sleep(1.2)
    # Overpass: instalaciones mineras/industriales con nombres útiles en el corredor
    oq = """[out:json][timeout:120];
(
  nwr["name"~"Portezuelo|Cenizas|Delta|Barba|Catemu|Enami|ENAMI|Poder de compra|Planta",i](-33.0,-71.6,-30.4,-70.3)["landuse"~"industrial|quarry"];
  nwr["name"~"Enami|ENAMI|Poder de compra|Las Cenizas|Planta Delta|Portezuelo|Minera Barba|Catemu",i](-33.0,-71.6,-30.4,-70.3)["industrial"];
  nwr["name"~"Enami|ENAMI|Poder [Cc]omprador|Poder de [Cc]ompra",i](-33.0,-71.6,-30.4,-70.3);
);
out center tags;"""
    try:
        req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": oq}).encode(), headers=HEADERS)
        with urllib.request.urlopen(req, timeout=180) as r:
            res["overpass"] = json.load(r)
    except Exception as e:  # noqa: BLE001
        res["overpass"] = str(e)
    (OUT / "poderes_geocode.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))


def rutas():
    """Distancias por camino (OSRM público) desde focos a compradores. Entrada: docs/barrido_faenas/rutas_in.json
    {"origenes": [[lon,lat],...], "destinos": [[lon,lat],...]}"""
    d = json.loads((ROOT / "docs/barrido_faenas/rutas_in.json").read_text())
    O, D = d["origenes"], d["destinos"]
    dist = []
    for i in range(0, len(O), 80):
        blk = O[i:i + 80]
        coords = ";".join(f"{x:.5f},{y:.5f}" for x, y in blk + D)
        src = ";".join(str(k) for k in range(len(blk)))
        dst = ";".join(str(len(blk) + k) for k in range(len(D)))
        u = f"https://router.project-osrm.org/table/v1/driving/{coords}?sources={src}&destinations={dst}&annotations=distance,duration"
        r = _get_json(u)
        dist += [{"distance": a, "duration": b} for a, b in zip(r.get("distances", []), r.get("durations", []))]
        print("bloque", i, r.get("code"))
        time.sleep(1.5)
    (OUT / "rutas_out.json").write_text(json.dumps(dist))
    # Ubicación de Portezuelo (Illapel) y del poder de compra de Combarbalá
    oq = """[out:json][timeout:90];
nwr["name"~"Portezuelo|Barba|Enami|ENAMI",i](-31.9,-71.5,-30.9,-70.6);
out center tags;"""
    try:
        req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": oq}).encode(), headers=HEADERS)
        with urllib.request.urlopen(req, timeout=120) as r:
            (OUT / "portezuelo_osm.json").write_text(r.read().decode())
    except Exception as e:  # noqa: BLE001
        print("overpass", e)


def _get_json(url: str, tries: int = 5) -> dict:
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as r:
                return json.load(r)
        except (TimeoutError, OSError, ValueError) as e:
            if i == tries - 1:
                raise
            print(f"reintento {i + 1}: {e}")
            time.sleep(5 * (i + 1))
    return {}


def bajar(bbox: tuple) -> list:
    """Todas las concesiones (capa 2) que tocan el recuadro, paginando de a 500."""
    out, off = [], 0
    while True:
        p = {"geometry": ",".join(map(str, bbox)), "geometryType": "esriGeometryEnvelope", "inSR": 4326,
             "outSR": 32719, "spatialRel": "esriSpatialRelIntersects", "where": "1=1",
             "outFields": "NOMBRE,NUMERO_ROL,DV_ROL,SITUACION_CONCESION,TIPO_CONCESION,TITULAR_NOMBRE,COMUNA,HECTAREAS,FECHA_VENCIMIENTO",
             "returnGeometry": "true", "f": "json", "resultRecordCount": 500, "resultOffset": off,
             "orderByFields": "OBJECTID"}
        d = _get_json(f"{BASE}/2/query?" + urllib.parse.urlencode(p))
        if "error" in d:
            print("ERROR", d["error"]); break
        fs = d.get("features", [])
        for f in fs:
            a = f["attributes"]
            rings = (f.get("geometry") or {}).get("rings") or []
            out.append({"n": a.get("NOMBRE"), "rol": f"{a.get('NUMERO_ROL')}-{a.get('DV_ROL')}",
                        "sit": a.get("SITUACION_CONCESION"), "tipo": a.get("TIPO_CONCESION"),
                        "tit": a.get("TITULAR_NOMBRE"), "com": a.get("COMUNA"), "ha": a.get("HECTAREAS"),
                        "venc": a.get("FECHA_VENCIMIENTO"),
                        "rings": [[[round(x), round(y)] for x, y in r] for r in rings]})
        print(f"  offset {off}: {len(fs)}")
        if not fs or (len(fs) < 500 and not d.get("exceededTransferLimit")):
            break
        off += len(fs)  # el servidor entrega como máximo 500 por página
    return out


def catastro(zonas=None):
    OUT.mkdir(parents=True, exist_ok=True)
    for z, bb in (zonas or ZONAS).items():
        print("zona", z, bb)
        fs = bajar(bb)
        (OUT / f"catastro_{z}.json").write_text(json.dumps(fs, ensure_ascii=False))
        sit = {}
        for f in fs:
            sit[(f["sit"], f["tipo"])] = sit.get((f["sit"], f["tipo"]), 0) + 1
        print(z, len(fs), sit)


def deg2tile(lon, lat, z):
    n = 2 ** z
    return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n


def chips():
    from PIL import Image
    from pyproj import Transformer
    OUT.mkdir(parents=True, exist_ok=True)
    to_ll = Transformer.from_crs(32719, 4326, always_xy=True).transform
    lote = os.environ.get("BARRIDO_LOTE", "costa_v")
    lista = json.loads((ROOT / f"docs/barrido_faenas/chips_{lote}.json").read_text())
    cache = {}
    for c in lista:
        e, n, h = c["E"], c["N"], c.get("h", 300)
        z = 17 if h <= 300 or c.get("px", 480) >= 1000 else 16
        lon0, lat0 = to_ll(e - h, n - h)
        lon1, lat1 = to_ll(e + h, n + h)
        x0, y1 = deg2tile(lon0, lat0, z)
        x1, y0 = deg2tile(lon1, lat1, z)
        img = Image.new("RGB", ((int(x1) - int(x0) + 1) * 256, (int(y1) - int(y0) + 1) * 256))
        for tx in range(int(x0), int(x1) + 1):
            for ty in range(int(y0), int(y1) + 1):
                if (tx, ty) not in cache:
                    try:
                        req = urllib.request.Request(TILE.format(z=z, x=tx, y=ty), headers=HEADERS)
                        cache[(tx, ty)] = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert("RGB")
                    except Exception as ex:  # noqa: BLE001
                        print("tesela falló", tx, ty, ex)
                        cache[(tx, ty)] = Image.new("RGB", (256, 256))
                img.paste(cache[(tx, ty)], ((tx - int(x0)) * 256, (ty - int(y0)) * 256))
        box = ((x0 - int(x0)) * 256, (y0 - int(y0)) * 256, (x1 - int(x0)) * 256, (y1 - int(y0)) * 256)
        img.crop(tuple(int(v) for v in box)).resize((c.get("px", 480), c.get("px", 480))).save(OUT / f"chip_{c['id']}.jpg", quality=80)
        if len(cache) > 1500:
            cache.clear()
    print("chips:", len(lista))


def auditoria():
    """Cómo y cuándo se actualiza el catastro: metadatos de la capa y fechas de creación/actualización."""
    res = {}
    for lyr in ("", "/0", "/1", "/2"):
        try:
            res["meta" + lyr] = _get_json(f"{BASE}{lyr}?f=json")
        except Exception as e:  # noqa: BLE001
            res["meta" + lyr] = str(e)
    F = "NOMBRE,NUMERO_ROL,DV_ROL,SITUACION_CONCESION,TIPO_CONCESION,TITULAR_NOMBRE,COMUNA,HECTAREAS,FECHA_VENCIMIENTO,ORIGEN,FECHA_CREACION,FECHA_ACTUALIZACION,DATUM"
    def q(where, n=200, order="FECHA_CREACION DESC", geom=False, extra=None):
        p = {"where": where, "outFields": F, "returnGeometry": "false", "f": "json",
             "resultRecordCount": n, "orderByFields": order}
        p.update(extra or {})
        try:
            return _get_json(f"{BASE}/2/query?" + urllib.parse.urlencode(p))
        except Exception as e:  # noqa: BLE001
            return {"error": str(e)}
    res["ultimas_creadas_pais"] = q("1=1", 300)
    res["ultimas_actualizadas_pais"] = q("1=1", 300, "FECHA_ACTUALIZACION DESC")
    bb = {"geometry": "-71.8,-33.5,-70.3,-30.9", "geometryType": "esriGeometryEnvelope", "inSR": 4326, "spatialRel": "esriSpatialRelIntersects"}
    res["tramite_zona_recientes"] = q("SITUACION_CONCESION = 'EN TRAMITE'", 500, "FECHA_CREACION DESC", extra=bb)
    res["valle_escondido"] = q("UPPER(TITULAR_NOMBRE) LIKE '%VALLE ESCONDIDO%'", 500)
    res["nombres_nuestros"] = q("(UPPER(NOMBRE) LIKE 'MARTINA %' OR UPPER(NOMBRE) LIKE 'LEONOR %' OR UPPER(NOMBRE) LIKE 'ELARA %')", 500, extra=bb)
    for k in ("ORIGEN", "SITUACION_CONCESION"):
        p = {"where": "1=1", "outStatistics": json.dumps([{"statisticType": "count", "onStatisticField": "OBJECTID", "outStatisticFieldName": "n"},
             {"statisticType": "max", "onStatisticField": "FECHA_CREACION", "outStatisticFieldName": "max_creacion"},
             {"statisticType": "max", "onStatisticField": "FECHA_ACTUALIZACION", "outStatisticFieldName": "max_actualizacion"}]),
             "groupByFieldsForStatistics": k, "f": "json"}
        try:
            res["stats_" + k] = _get_json(f"{BASE}/2/query?" + urllib.parse.urlencode(p))
        except Exception as e:  # noqa: BLE001
            res["stats_" + k] = str(e)
    (OUT / "auditoria_catastro.json").write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str))
    print("auditoria lista")


if __name__ == "__main__":
    lote = os.environ.get("BARRIDO_LOTE", "")
    if lote == "auditoria":
        OUT.mkdir(parents=True, exist_ok=True)
        auditoria()
        sys.exit(0)
    OUT.mkdir(parents=True, exist_ok=True)
    if lote == "otras":
        cfg = json.loads((ROOT / "docs/barrido_faenas/otras_causas.json").read_text())
        catastro({k: tuple(v) for k, v in cfg["zonas"].items()})
        chips()
    elif lote == "limache":
        catastro({"limache": (-71.16, -33.13, -71.02, -33.03)})
        chips()
        oq = """[out:json][timeout:60];
is_in(-33.0791,-71.0913)->.a;
area.a["admin_level"~"6|8"];
out tags;"""
        req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=urllib.parse.urlencode({"data": oq}).encode(), headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                (OUT / "comuna_limache.json").write_text(r.read().decode())
        except Exception as e:  # noqa: BLE001
            print("overpass", e)
    elif lote == "validar":
        catastro(ZONAS_VALIDAR)
        chips()
    elif lote == "choapa":
        geocode()
        catastro(ZONAS_CHOAPA)
    elif lote == "rutas":
        rutas()
    elif os.environ.get("BARRIDO_ETAPA") == "chips":
        chips()
    else:
        catastro()
