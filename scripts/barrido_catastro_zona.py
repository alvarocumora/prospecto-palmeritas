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


def catastro():
    OUT.mkdir(parents=True, exist_ok=True)
    for z, bb in ZONAS.items():
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
    z, cache = 17, {}
    for c in lista:
        e, n, h = c["E"], c["N"], 300
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
        img.crop(tuple(int(v) for v in box)).resize((480, 480)).save(OUT / f"chip_{c['id']}.jpg", quality=80)
        if len(cache) > 3000:
            cache.clear()
    print("chips:", len(lista))


if __name__ == "__main__":
    chips() if os.environ.get("BARRIDO_ETAPA") == "chips" else catastro()
