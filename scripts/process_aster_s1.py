"""Índice de cuarzo ASTER TIR + lineamientos candidatos Sentinel-1 RTC para un AOI.

Uso: EARTHDATA_TOKEN=... python3 scripts/process_aster_s1.py <proyecto> <w> <s> <e> <n> <aster_granule> <s1_id> [<s1_id> ...]

- ASTER L1T v004 (NASA LP DAAC), bandas TIR 10-12 a 90 m. DN -> radiancia con coeficientes UCC
  oficiales; Quartz Index de Ninomiya QI = B11^2 / (B10*B12). Se conservan los píxeles sobre el
  percentil 90 del AOI. MODELADO: sensible a emisividad, humedad y vegetación; no es ensaye.
- Sentinel-1 RTC (Microsoft Planetary Computer), VV a 10 m, órbitas ascendente y descendente.
  Bordes Canny sobre dB suavizado + Hough probabilístico; segmentos >= 300 m. INTERPRETADO:
  candidatos a estructuras que también pueden ser quebradas, caminos o cambios de pendiente.
"""
import hashlib, json, math, os, sys, urllib.request
import numpy as np
import rasterio
from rasterio.warp import transform_bounds, transform as warp_xy
from rasterio.windows import from_bounds
from scipy.ndimage import gaussian_filter
from skimage.feature import canny
from skimage.transform import probabilistic_hough_line

proj, w, s, e, n = sys.argv[1], *map(float, sys.argv[2:6])
aster_id, s1_ids = sys.argv[6], sys.argv[7:]
UCC = {10: 6.822e-3, 11: 6.780e-3, 12: 6.590e-3}
TMP = "/tmp/aster_s1"; os.makedirs(TMP, exist_ok=True)


def download(url, path, token=None):
    if os.path.exists(path):
        return path
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"} if token else {})
    with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
        f.write(r.read())
    return path


def window_read(path):
    src = rasterio.open(path)
    b = transform_bounds("EPSG:4326", src.crs, w, s, e, n)
    win = from_bounds(*b, src.transform).round_offsets().round_lengths()
    return src, src.read(1, window=win, boundless=True, fill_value=0).astype("float64"), src.window_transform(win)


def to_lonlat(src, tr, rows, cols):
    xs, ys = rasterio.transform.xy(tr, rows, cols)
    lon, lat = warp_xy(src.crs, "EPSG:4326", np.atleast_1d(xs), np.atleast_1d(ys))
    return lon, lat


# ---------- ASTER ----------
tok = os.environ["EARTHDATA_TOKEN"]
base = f"https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/AST_L1T.004/{aster_id}/{aster_id}_TIR_B"
rad, hashes = {}, {}
for b in (10, 11, 12):
    p = download(f"{base}{b}.tif", f"{TMP}/{aster_id}_B{b}.tif", tok)
    hashes[b] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    src, dn, tr = window_read(p)
    rad[b] = np.where(dn > 0, (dn - 1) * UCC[b], np.nan)
qi = rad[11] ** 2 / (rad[10] * rad[12])
valid = np.isfinite(qi)
p90 = float(np.nanpercentile(qi, 90))
rows, cols = np.where(valid & (qi >= p90))
lon, lat = to_lonlat(src, tr, rows, cols)
aster_feats = [
    {"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(x, 6), round(y, 6)]},
     "properties": {"familia": "silice", "qi": round(float(qi[r, c]), 4)}}
    for x, y, r, c in zip(lon, lat, rows, cols)
]
aster_out = {
    "type": "FeatureCollection",
    "metadata": {
        "fuente": "NASA ASTER L1T v004 (LP DAAC)", "granulo": aster_id, "adquisicion": aster_id[11:19],
        "metodo": "Quartz Index Ninomiya QI=B11^2/(B10*B12) sobre radiancia (UCC oficiales); percentil 90 del AOI",
        "umbral_p90": round(p90, 4), "pixeles_validos": int(valid.sum()), "pixel_m": 90,
        "sha256_bandas": hashes, "evidencia": "MODELADO", "aoi": [w, s, e, n],
    },
    "features": aster_feats,
}

# ---------- Sentinel-1 ----------
STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-1-rtc/items/"
SIGN = "https://planetarycomputer.microsoft.com/api/sas/v1/sign?href="
lines, scenes = [], []
for sid in s1_ids:
    item = json.load(urllib.request.urlopen(STAC + sid, timeout=60))
    href = json.load(urllib.request.urlopen(SIGN + item["assets"]["vv"]["href"], timeout=60))["href"]
    src, vv, tr = window_read(href)
    db = 10 * np.log10(np.where(vv > 0, vv, np.nan))
    db = np.nan_to_num(db, nan=float(np.nanmedian(db)))
    sm = gaussian_filter(db, 3)
    edges = canny(sm, sigma=1.5, low_threshold=np.percentile(sm, 50) * 0 + 0.6, high_threshold=1.4)
    segs = probabilistic_hough_line(edges, threshold=12, line_length=30, line_gap=4, rng=7)
    scenes.append({"id": sid, "orbita": item["properties"].get("sat:orbit_state"),
                   "fecha": item["properties"]["datetime"][:10]})
    for (c0, r0), (c1, r1) in segs:
        lo, la = to_lonlat(src, tr, [r0, r1], [c0, c1])
        dx = (lo[1] - lo[0]) * 111320 * math.cos(math.radians(la[0]))
        dy = (la[1] - la[0]) * 110540
        length = math.hypot(dx, dy)
        if length < 300:
            continue
        az = (math.degrees(math.atan2(dx, dy)) + 360) % 180
        lines.append({"type": "Feature",
                      "geometry": {"type": "LineString", "coordinates": [[round(lo[0], 6), round(la[0], 6)], [round(lo[1], 6), round(la[1], 6)]]},
                      "properties": {"familia": "lineamiento", "longitud_m": round(length), "azimut_deg": round(az),
                                     "orbita": scenes[-1]["orbita"], "fecha": scenes[-1]["fecha"]}})
s1_out = {
    "type": "FeatureCollection",
    "metadata": {
        "fuente": "Copernicus Sentinel-1 RTC (Microsoft Planetary Computer)", "escenas": scenes,
        "metodo": "VV dB, suavizado gaussiano sigma=3, bordes Canny, Hough probabilístico; segmentos >= 300 m",
        "evidencia": "INTERPRETADO", "aoi": [w, s, e, n],
    },
    "features": lines,
}
for name, data in (("aster_silice", aster_out), ("s1_lineamientos", s1_out)):
    with open(f"src/data/geo/{proj}_{name}.json", "w") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)
print("aster", len(aster_feats), "p90", p90, "| s1", len(lines))
