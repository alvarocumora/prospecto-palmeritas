#!/usr/bin/env python3
"""Screening Sentinel-2 del distrito Tilama para encontrar más zonas libres "como estas".

1. Mosaico de mediana Sentinel-2 L2A (feb-abr 2019-2026, nubes < 10 %) sobre el
   mismo recuadro del catastro (scripts/tilama_catastro_kmz.py).
2. Índices de razón de bandas (gc_remote.indices): Al-OH (B11/B12), óxidos de
   Fe (B04/B02), gossan y hierro ferroso, en z-score sobre la superficie
   interpretable (NDVI <= 0,25).
3. Calibración contra la mineralización conocida (Tabla 1 de Esterio): se mide
   qué percentil alcanza el índice en cada muestra con ley. Si las muestras no
   resaltan, el informe lo dice: el método no confirmaría nada en este distrito.
4. Anomalías = píxeles sobre el percentil 95 del puntaje combinado, agrupadas
   en manchas; se cruzan con el catastro SERNAGEOMIN vigente y con los
   pedimentos VALESC propuestos.
5. Para cada mancha en terreno libre se propone un rectángulo de pedimento
   legal (lados de 1.000 m o múltiplos, N-S/E-O) sin solapar concesiones
   vigentes ni los VALESC.

Todo es DERIVADO / INTERPRETADO: Sentinel-2 no identifica minerales ni mide
ley. Sirve para priorizar visitas y muestreo, no para estimar recursos.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "geocapitals-remote" / "src"))
sys.path.insert(0, str(ROOT / "scripts"))

OUT = ROOT / "out" / "tilama_satelite"
VALESC = ROOT / "docs" / "tilama" / "pedimentos" / "pedimentos_valesc.json"
ZONAS = ROOT / "docs" / "tilama" / "pedimentos" / "zonas_marcadas_visor.json"
CRS = "EPSG:32719"

# Muestras con ley de la Tabla 1 (WGS84 UTM 19S) para calibrar.
CONOCIDAS = {
    "M1/M2 desmontes (7,7-10,65 % CuT)": (302067, 6452926),
    "TOO-220 (3,88 %)": (302051, 6453722),
    "TOO-255 (1,99 %)": (302806, 6453671),
    "TOO-183 (3,24 %)": (301052, 6454846),
    "TOO-185 (3,30 %)": (301027, 6454818),
    "TOO-186 (3,27 %)": (301172, 6454736),
    "TOO-262 (2,48 %)": (300897, 6455049),
    "TOO-212 (1,62 %)": (301407, 6454255),
    "42516 (3,33 % Cu, 4,9 g/t Au)": (300385, 6455154),
}
# Muestras estériles de la misma tabla, como control negativo.
ESTERILES = {
    "TOO-112 (0,00 %)": (301352, 6453696),
    "TOO-182 (0,01 %)": (300332, 6455396),
    "TOO-184 (0,03 %)": (301007, 6454946),
    "TOO-187 (0,03 %)": (301140, 6454920),
}


def composite():
    import planetary_computer as pc
    from pystac_client import Client
    from gc_remote.catalog import PC_STAC
    from gc_remote.ingest import load_composite
    from tilama_catastro_kmz import BBOX

    client = Client.open(PC_STAC, modifier=pc.sign_inplace)
    items = [it for it in client.search(
        collections=["sentinel-2-l2a"], bbox=list(BBOX),
        query={"eo:cloud_cover": {"lt": 10}},
        datetime=["2019-01-01T00:00:00Z", "2026-12-31T23:59:59Z"]).items()
        if it.datetime.month in (2, 3, 4)]
    items.sort(key=lambda it: it.datetime)
    use = items if len(items) <= 16 else items[:: max(1, len(items) // 16)][:16]
    print(f"{len(items)} escenas disponibles, {len(use)} usadas: "
          f"{use[0].datetime:%Y-%m-%d} a {use[-1].datetime:%Y-%m-%d}", flush=True)
    comp = load_composite(use, list(BBOX), crs=CRS, ndvi_threshold=0.25)
    comp["scenes"] = [it.id for it in use]
    return comp


def zs(a, mask):
    v = a[mask & np.isfinite(a)]
    mu, sd = float(np.nanmedian(v)), float(np.nanstd(v)) or 1.0
    z = (a - mu) / sd
    z[~mask] = np.nan
    return z


def sample(arr, x, y, e, n, r=2):
    j = int(np.argmin(np.abs(y - n))); i = int(np.argmin(np.abs(x - e)))
    win = arr[max(0, j - r): j + r + 1, max(0, i - r): i + r + 1]
    return float(np.nanmax(win)) if np.isfinite(win).any() else float("nan")


def catastro_vigente():
    from shapely.geometry import shape
    from shapely.ops import unary_union
    from tilama_catastro_kmz import fetch_live
    feats = [f for f in fetch_live() if f.get("geometry")
             and str(f["properties"].get("SITUACION_CONCESION") or "").upper() != "ELIMINADA"]
    from pyproj import Transformer
    from shapely.ops import transform
    t = Transformer.from_crs("EPSG:4326", CRS, always_xy=True).transform
    geoms = [(f["properties"], transform(t, shape(f["geometry"]).buffer(0))) for f in feats]
    return geoms, unary_union([g for _, g in geoms])


def mejor_rectangulo(mancha, libre, bloqueado, x0s, y0s):
    """Rectángulo legal (lados 1-4 km) que cubre la mayor parte de la mancha en
    terreno libre sin tocar lo bloqueado (catastro + VALESC + otros propuestos)."""
    import shapely
    best = None
    cx, cy = mancha.centroid.x, mancha.centroid.y
    x0s = [v for v in x0s if cx - 4100 <= v <= cx + 100]
    y0s = [v for v in y0s if cy - 4100 <= v <= cy + 100]
    for w in (1, 2, 3, 4):
        for h in (1, 2, 3, 4):
            for x in x0s:
                if not (x - 100 <= cx <= x + w * 1000 + 100):
                    continue
                for y in y0s:
                    if not (y - 100 <= cy <= y + h * 1000 + 100):
                        continue
                    b = shapely.box(x, y, x + w * 1000, y + h * 1000)
                    if b.intersection(bloqueado).area > 0.5e4:
                        continue
                    g = b.intersection(mancha).intersection(libre).area
                    if g <= 0:
                        continue
                    s = g / 1e4 - 0.01 * (b.area / 1e4)
                    if best is None or s > best[0]:
                        best = (s, (x, y, x + w * 1000, y + h * 1000), g / 1e4)
    return best


def main():
    import shapely
    from shapely.geometry import box, Point, shape, mapping
    from shapely.ops import unary_union, transform as optrans
    from scipy import ndimage
    from pyproj import Transformer
    from gc_remote.indices import s2_indices, INDEX_META

    OUT.mkdir(parents=True, exist_ok=True)
    comp = composite()
    x, y, mask = comp["x"], comp["y"], comp["interpretable"]
    idx = s2_indices(comp["refl"])
    Z = {k: zs(idx[k], mask) for k in ("aloh", "fe_oxides", "gossan", "ferrous")}
    score = np.nanmean(np.stack([Z["aloh"], Z["fe_oxides"], Z["gossan"]]), axis=0)
    score[~mask] = np.nan
    fondo = score[np.isfinite(score)]
    pct = lambda v: round(float((fondo < v).mean() * 100), 1) if np.isfinite(v) else None
    print(f"superficie interpretable {mask.mean()*100:.1f} %", flush=True)

    calib = {"conocidas": {}, "esteriles": {}}
    for grupo, pts in (("conocidas", CONOCIDAS), ("esteriles", ESTERILES)):
        for k, (e, n) in pts.items():
            calib[grupo][k] = {"percentil_puntaje": pct(sample(score, x, y, e, n)),
                              **{f"z_{i}": (round(sample(Z[i], x, y, e, n), 2) if np.isfinite(sample(Z[i], x, y, e, n)) else None) for i in Z}}
    pk = [v["percentil_puntaje"] for v in calib["conocidas"].values() if v["percentil_puntaje"] is not None]
    pe = [v["percentil_puntaje"] for v in calib["esteriles"].values() if v["percentil_puntaje"] is not None]
    calib["mediana_percentil_conocidas"] = float(np.median(pk)) if pk else None
    calib["mediana_percentil_esteriles"] = float(np.median(pe)) if pe else None
    calib["discrimina"] = bool(pk and pe and np.median(pk) >= 85 and np.median(pk) - np.median(pe) >= 15)
    print(json.dumps(calib, ensure_ascii=False, indent=1), flush=True)

    thr = float(np.nanpercentile(fondo, 95))
    anom = np.isfinite(score) & (score >= thr)
    anom = ndimage.binary_closing(anom, iterations=2) & np.isfinite(score)
    lab, nlab = ndimage.label(anom)
    res = abs(float(x[1] - x[0]))
    manchas = []
    for k in range(1, nlab + 1):
        jj, ii = np.nonzero(lab == k)
        if len(jj) * res * res < 2e4:  # < 2 ha
            continue
        pts = [Point(float(x[i]), float(y[j])).buffer(res * 0.75, cap_style=3) for j, i in zip(jj, ii)]
        g = unary_union(pts).buffer(0)
        manchas.append({"geom": g, "ha": round(g.area / 1e4, 1),
                        "puntaje_medio": round(float(np.nanmean(score[jj, ii])), 2),
                        "puntaje_max": round(float(np.nanmax(score[jj, ii])), 2)})
    manchas.sort(key=lambda m: -m["puntaje_medio"] * m["ha"])
    print(f"umbral p95 = {thr:.2f}; {len(manchas)} manchas de 2 ha o más", flush=True)

    geoms, U = catastro_vigente()
    dist = box(*shapely.bounds(unary_union([g for _, g in geoms])))
    libre = dist.difference(U)
    valesc = json.loads(VALESC.read_text())
    from shapely.geometry import Polygon
    zonas = {k: Polygon(v).buffer(0) for k, v in json.loads(ZONAS.read_text()).items()} if ZONAS.exists() else {}
    VB = [box(v["E0"], v["N0"], v["E1"], v["N1"]) for v in valesc]
    bloqueado = unary_union([U] + VB)

    edges_x = sorted({round(c + k * 1000) for _, g in geoms for c in (g.bounds[0], g.bounds[2]) for k in range(-4, 5)})
    edges_y = sorted({round(c + k * 1000) for _, g in geoms for c in (g.bounds[1], g.bounds[3]) for k in range(-4, 5)})

    to_wgs = Transformer.from_crs(CRS, "EPSG:4326", always_xy=True).transform
    feats_out, propuestas = [], []
    for n_, m in enumerate(manchas, 1):
        g = m["geom"]
        en_libre = g.intersection(libre).area / g.area
        en_valesc = [v["nombre"] for v, b in zip(valesc, VB) if g.intersects(b)]
        titulares = sorted({str(p.get("TITULAR_NOMBRE") or p.get("TITULAR_DIVISION")) for p, cg in geoms if cg.intersects(g)})
        en_zona = [k for k, zg in zonas.items() if g.intersects(zg)]
        m.update(id=f"S2-{n_:02d}", libre_pct=round(en_libre * 100), en_valesc=en_valesc, en_zona=en_zona, titulares=titulares[:6])
        if en_libre >= 0.5 and not en_valesc and not en_zona:
            r = mejor_rectangulo(g, libre, bloqueado, edges_x, edges_y)
            if r:
                b = box(*r[1]); bloqueado = unary_union([bloqueado, b])
                propuestas.append({"mancha": m["id"], "E0": r[1][0], "N0": r[1][1], "E1": r[1][2], "N1": r[1][3],
                                   "ha": round(b.area / 1e4), "cubre_mancha_ha": round(r[2], 1),
                                   "punto_medio_E": round(b.centroid.x), "punto_medio_N": round(b.centroid.y)})
        feats_out.append({"type": "Feature", "geometry": mapping(optrans(to_wgs, g.simplify(10))),
                          "properties": {k: v for k, v in m.items() if k != "geom"}})

    gj = {"type": "FeatureCollection", "name": "tilama_s2_manchas",
          "metadata": {"procedencia": "DERIVADO / INTERPRETADO — Sentinel-2 L2A, no verificado en terreno",
                       "indices": {k: INDEX_META[k] for k in ("aloh", "fe_oxides", "gossan", "ferrous")},
                       "umbral_p95": thr, "escenas": comp["scenes"], "calibracion": calib},
          "features": feats_out}
    (OUT / "tilama_s2_manchas.geojson").write_text(json.dumps(gj, ensure_ascii=False, indent=1))
    (OUT / "tilama_s2_pedimentos_candidatos.json").write_text(json.dumps(propuestas, ensure_ascii=False, indent=1))

    # Mapa
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(12, 13), dpi=130)
    ext = [x.min(), x.max(), y.min(), y.max()]
    ax.imshow(np.clip(score, -1, 4), extent=ext, origin="upper" if y[0] > y[-1] else "lower", cmap="magma", alpha=.85)
    for p, cg in geoms:
        for gg in getattr(cg, "geoms", [cg]):
            xs, ys = gg.exterior.xy; ax.plot(xs, ys, color="#9fb3c8", lw=.5)
    for v, b in zip(valesc, VB):
        xs, ys = b.exterior.xy; ax.plot(xs, ys, color="#2ecc71", lw=2); ax.text(b.centroid.x, b.centroid.y, v["nombre"], color="#2ecc71", fontsize=7, ha="center")
    for m in manchas:
        for gg in getattr(m["geom"], "geoms", [m["geom"]]):
            xs, ys = gg.exterior.xy; ax.plot(xs, ys, color="#00e5ff", lw=.8)
        ax.text(m["geom"].centroid.x, m["geom"].centroid.y, m["id"], color="#00e5ff", fontsize=6)
    for p in propuestas:
        ax.add_patch(plt.Rectangle((p["E0"], p["N0"]), p["E1"] - p["E0"], p["N1"] - p["N0"], fill=False, ec="#ffd400", lw=2, ls="--"))
    for k, zg in zonas.items():
        xs, ys = zg.exterior.xy; ax.plot(xs, ys, color="#ff9f1c", lw=1.2, ls="--")
    for k, (e, n) in CONOCIDAS.items():
        ax.scatter(e, n, s=25, c="#ffffff", ec="k", zorder=5)
    ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[2], ext[3]); ax.ticklabel_format(useOffset=False, style="plain")
    ax.set_title("Tilama — puntaje Sentinel-2 (Al-OH + óxidos Fe + gossan), manchas p95 y pedimentos candidatos", loc="left", fontsize=10)
    fig.text(.01, .005, "DERIVADO / INTERPRETADO. Verde: VALESC propuestos. Celeste: manchas p95. Amarillo: pedimentos candidatos en terreno libre. Blanco: muestras con ley (Esterio).", fontsize=7)
    plt.tight_layout(); plt.savefig(OUT / "tilama_s2_mapa.png")

    lines = ["# Tilama — screening Sentinel-2 de zonas libres", "",
             f"Escenas: {len(comp['scenes'])}. Superficie interpretable: {mask.mean()*100:.1f} %. Umbral p95 del puntaje: {thr:.2f}.", "",
             "## Calibración contra la mineralización conocida", "",
             f"Mediana del percentil en muestras con ley: {calib['mediana_percentil_conocidas']}; en estériles: {calib['mediana_percentil_esteriles']}. "
             f"¿Discrimina? {'sí' if calib['discrimina'] else 'NO — el índice no separa lo mineralizado de lo estéril en este distrito'}.", ""]
    for g_, d in (("Con ley", calib["conocidas"]), ("Estériles", calib["esteriles"])):
        lines.append(f"**{g_}:** " + "; ".join(f"{k} p{v['percentil_puntaje']}" for k, v in d.items()))
        lines.append("")
    lines += ["## Manchas (p95, 2 ha o más)", ""]
    for m in manchas:
        lines.append(f"- {m['id']}: {m['ha']} ha, puntaje medio {m['puntaje_medio']}, {m['libre_pct']} % libre"
                     + (f", dentro de {', '.join(m['en_valesc'])}" if m['en_valesc'] else "")
                     + (f", en zona marcada {', '.join(m['en_zona'])}" if m['en_zona'] else "")
                     + (f"; titulares: {', '.join(m['titulares'])}" if m['titulares'] else ""))
    lines += ["", "## Pedimentos candidatos en terreno libre", ""]
    for p in propuestas:
        lines.append(f"- {p['mancha']}: E {p['E0']}-{p['E1']} / N {p['N0']}-{p['N1']} ({p['ha']} ha), cubre {p['cubre_mancha_ha']} ha de la mancha; punto medio N {p['punto_medio_N']} / E {p['punto_medio_E']}")
    (OUT / "tilama_s2_resumen.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
