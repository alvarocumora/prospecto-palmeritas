#!/usr/bin/env python3
"""Análisis Sentinel-2 por pieza (pedimentos presentados y por presentar).

Para cada zona de docs/barrido_faenas/piezas_satelite.json:
1. Mosaico de mediana Sentinel-2 L2A de verano reciente (dic-abr 2024-2026) y uno
   antiguo (dic-abr 2018-2020), nubes < 10 %.
2. Índices de razón (gc_remote.indices) en z-score contra el fondo interpretable de
   la zona: Al-OH (B11/B12, arcillas/sericita), óxidos de Fe (B04/B02), gossan
   y hierro ferroso.
3. Por pieza: % interpretable, z medio y p90 de cada índice, ha sobre el p95
   de la zona en el puntaje combinado, y ha de suelo removido reciente
   (aumento fuerte del índice de suelo desnudo entre el mosaico antiguo y el nuevo),
   que marca faenas, caminos o movimientos de tierra nuevos.
4. En Tilama repite la calibración contra las muestras con ley conocidas.

DERIVADO / INTERPRETADO: Sentinel-2 no identifica minerales ni mide ley.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "geocapitals-remote" / "src"))
sys.path.insert(0, str(ROOT / "scripts"))
OUT = ROOT / "out" / "satelite_piezas"
CRS = "EPSG:32719"
CONOCIDAS = [(302067, 6452926), (302051, 6453722), (302806, 6453671), (301052, 6454846), (301027, 6454818),
             (301172, 6454736), (300897, 6455049), (301407, 6454255), (300385, 6455154)]
ESTERILES = [(301352, 6453696), (300332, 6455396), (301007, 6454946), (301140, 6454920)]


def composite(bbox, years, max_items=12):
    import planetary_computer as pc
    from pystac_client import Client
    from gc_remote.catalog import PC_STAC
    from gc_remote.ingest import load_composite
    client = Client.open(PC_STAC, modifier=pc.sign_inplace)
    items = [it for it in client.search(collections=["sentinel-2-l2a"], bbox=list(bbox),
                                        query={"eo:cloud_cover": {"lt": 10}},
                                        datetime=[f"{years[0]}-01-01T00:00:00Z", f"{years[1]}-12-31T23:59:59Z"]).items()
             if it.datetime.month in (12, 1, 2, 3, 4)]
    items.sort(key=lambda it: it.datetime)
    use = items if len(items) <= max_items else items[:: max(1, len(items) // max_items)][:max_items]
    print(f"  {years}: {len(items)} escenas, {len(use)} usadas", flush=True)
    c = load_composite(use, list(bbox), crs=CRS, ndvi_threshold=0.25)
    c["scenes"] = [it.id for it in use]
    return c


def zs(a, m):
    v = a[m & np.isfinite(a)]
    mu, sd = float(np.nanmedian(v)), float(np.nanstd(v)) or 1.0
    z = (a - mu) / sd
    z[~m] = np.nan
    return z


def main():
    from gc_remote.indices import s2_indices
    from scipy import ndimage
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    cfg = json.loads((ROOT / "docs/barrido_faenas/piezas_satelite.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    rows, calib = [], {}
    for zona, bbox in cfg["zonas"].items():
        print("zona", zona, bbox, flush=True)
        new = composite(bbox, (2024, 2026))
        old = composite(bbox, (2018, 2020))
        x, y, m = new["x"], new["y"], new["interpretable"]
        idx = s2_indices(new["refl"])
        Z = {k: zs(idx[k], m) for k in ("aloh", "fe_oxides", "gossan", "ferrous")}
        score = np.nanmean(np.stack([Z["aloh"], Z["fe_oxides"], Z["gossan"]]), axis=0)
        score[~m] = np.nan
        thr = float(np.nanpercentile(score, 95))
        bs_new = s2_indices(new["refl"])["bare_soil"]
        bs_old = s2_indices(old["refl"])["bare_soil"]
        if bs_old.shape != bs_new.shape:
            bs_old = np.full_like(bs_new, np.nan)
        d = bs_new - bs_old
        dv = d[np.isfinite(d)]
        dthr = float(np.nanmedian(dv) + 3 * np.nanstd(dv)) if dv.size else np.inf
        nuevo = np.isfinite(d) & (d > dthr) & (bs_new > np.nanpercentile(bs_new, 75))
        nuevo = ndimage.binary_opening(nuevo)
        res = abs(float(x[1] - x[0]))
        XX, YY = np.meshgrid(x, y)

        if zona == "tilama_petorca":
            def samp(e, n):
                j = int(np.argmin(np.abs(y - n))); i = int(np.argmin(np.abs(x - e)))
                w = score[max(0, j - 2): j + 3, max(0, i - 2): i + 3]
                v = float(np.nanmax(w)) if np.isfinite(w).any() else np.nan
                return round(float((score[np.isfinite(score)] < v).mean() * 100), 1) if np.isfinite(v) else None
            pk = [samp(*p) for p in CONOCIDAS]; pe = [samp(*p) for p in ESTERILES]
            pk = [v for v in pk if v is not None]; pe = [v for v in pe if v is not None]
            calib = {"percentil_mediano_con_ley": float(np.median(pk)) if pk else None,
                     "percentil_mediano_esteriles": float(np.median(pe)) if pe else None}
            calib["discrimina"] = bool(pk and pe and np.median(pk) >= 85 and np.median(pk) - np.median(pe) >= 15)
            print("calibración", calib, flush=True)

        piezas = [p for p in cfg["piezas"] if p["zona"] == zona]
        for p in piezas:
            sel = (XX >= p["E0"]) & (XX <= p["E1"]) & (YY >= p["N0"]) & (YY <= p["N1"])
            n = int(sel.sum()) or 1
            r = {"nombre": p["nombre"], "zona": zona, "hoy": p.get("hoy", False), "presentada": p.get("presentada", ""),
                 "ha": round((p["E1"] - p["E0"]) * (p["N1"] - p["N0"]) / 1e4),
                 "pct_interpretable": round(100 * float((sel & m).sum()) / n, 1),
                 "ha_sobre_p95": round(float((sel & (score >= thr)).sum()) * res * res / 1e4, 1),
                 "ha_removido_reciente": round(float((sel & nuevo).sum()) * res * res / 1e4, 1)}
            for k, a in Z.items():
                v = a[sel & np.isfinite(a)]
                r[f"z_{k}_medio"] = round(float(np.mean(v)), 2) if v.size else None
                r[f"z_{k}_p90"] = round(float(np.percentile(v, 90)), 2) if v.size else None
            v = score[sel & np.isfinite(score)]
            r["puntaje_p90"] = round(float(np.percentile(v, 90)), 2) if v.size else None
            rows.append(r)

        for nm, arr, cm, lim, ttl in (("puntaje", score, "magma", (-1, 3), "puntaje Al-OH + Fe + gossan (z)"),
                                      ("removido", np.where(nuevo, 1.0, np.nan), "autumn", (0, 1), "suelo removido 2018-20 → 2024-26")):
            fig, ax = plt.subplots(figsize=(11, 11), dpi=120)
            rgb = np.dstack([new["refl"][b] for b in ("B04", "B08", "B02")]).astype("float32")
            rgb = np.clip(rgb / np.nanpercentile(rgb, 98), 0, 1)
            ext = [x.min(), x.max(), y.min(), y.max()]
            org = "upper" if y[0] > y[-1] else "lower"
            ax.imshow(np.nanmean(rgb, axis=2), extent=ext, origin=org, cmap="gray", alpha=.9)
            a2 = np.where(arr >= (thr if nm == "puntaje" else 0.5), arr, np.nan) if nm == "puntaje" else arr
            ax.imshow(a2, extent=ext, origin=org, cmap=cm, vmin=lim[0], vmax=lim[1], alpha=.85)
            for p in piezas:
                c = "#00ff66" if p.get("hoy") else ("#3fa9ff" if p.get("presentada") else "#ffffff")
                ax.add_patch(plt.Rectangle((p["E0"], p["N0"]), p["E1"] - p["E0"], p["N1"] - p["N0"], fill=False, ec=c, lw=1.4))
                ax.text((p["E0"] + p["E1"]) / 2, (p["N0"] + p["N1"]) / 2, p["nombre"].replace("LEONOR CERRO ALTO", "CA"), color=c, fontsize=6, ha="center")
            ax.set_xlim(ext[0], ext[1]); ax.set_ylim(ext[2], ext[3]); ax.ticklabel_format(useOffset=False, style="plain")
            ax.set_title(f"{zona}: {ttl}. Verde: subir hoy · Azul: presentadas · Blanco: después", fontsize=9, loc="left")
            plt.tight_layout(); plt.savefig(OUT / f"{zona}_{nm}.png"); plt.close(fig)

    with open(OUT / "piezas_satelite.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    (OUT / "calibracion.json").write_text(json.dumps(calib, ensure_ascii=False, indent=1))
    print("listo", len(rows))


if __name__ == "__main__":
    main()
