"""Máscaras y coverage multiclase.

El número titular NO es "roca expuesta por NDVI". Es la fracción de área **sin
cubierta vegetal y observable** (ni nube, ni sombra, ni agua, ni nieve, ni no-data).
Y se declara explícitamente que esos píxeles "interpretables" incluyen **suelo seco**:
Sentinel-2 no separa roca de suelo de forma robusta (bandas anchas). Esa honestidad va
en la salida, no en un comentario.

Clasificación de escena Sentinel-2 (SCL) usada:
 0 no-data · 1 saturado/defectuoso · 2 sombra topográfica · 3 sombra de nube ·
 4 vegetación · 5 suelo desnudo · 6 agua · 7 sin clasificar · 8/9 nube · 10 cirrus ·
 11 nieve/hielo.
"""
from __future__ import annotations

import numpy as np

CLASSES = {
    0: "nodata",
    1: "cloud",
    2: "shadow",
    3: "snow",
    4: "water",
    5: "vegetation",
    6: "interpretable",   # sin cubierta vegetal y observable (incluye suelo seco)
}


def _arr(x) -> np.ndarray:
    return np.asarray(getattr(x, "values", x), dtype="float64")


def ndvi(nir, red) -> np.ndarray:
    nir, red = _arr(nir), _arr(red)
    den = nir + red
    with np.errstate(divide="ignore", invalid="ignore"):
        out = np.where(den != 0, (nir - red) / den, np.nan)
    return out


def nbr2(swir1, swir2) -> np.ndarray:
    """Normalized Burn Ratio 2 — diagnóstico de material seco/leñoso, NO separa roca."""
    swir1, swir2 = _arr(swir1), _arr(swir2)
    den = swir1 + swir2
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(den != 0, (swir1 - swir2) / den, np.nan)


def classify_ndvi(nd, scl, ndvi_threshold: float = 0.25) -> np.ndarray:
    """Como classify() pero recibe el NDVI ya calculado (útil para composiciones
    multitemporales: NDVI del observación más seca)."""
    nd = _arr(nd)
    scl = _arr(scl)
    out = np.full(scl.shape, 6, dtype="int8")  # por defecto interpretable
    veg = np.isfinite(nd) & (nd > ndvi_threshold)
    out[veg | (scl == 4)] = 5
    out[scl == 6] = 4
    out[scl == 11] = 3
    out[np.isin(scl, [2, 3])] = 2
    out[np.isin(scl, [8, 9, 10])] = 1
    out[np.isin(scl, [0, 1]) | ~np.isfinite(scl)] = 0
    return out


def classify(nir, red, scl, ndvi_threshold: float = 0.25) -> np.ndarray:
    """Clasificación de coverage por prioridad (nodata > nube > sombra > nieve > agua >
    vegetación > interpretable)."""
    scl = _arr(scl)
    nd = ndvi(nir, red)
    out = np.full(scl.shape, 6, dtype="int8")  # por defecto interpretable

    veg = np.isfinite(nd) & (nd > ndvi_threshold)
    out[veg | (scl == 4)] = 5          # vegetación (NDVI o clase SCL vegetación)
    out[scl == 6] = 4                  # agua
    out[scl == 11] = 3                 # nieve
    out[np.isin(scl, [2, 3])] = 2      # sombra (topográfica o de nube)
    out[np.isin(scl, [8, 9, 10])] = 1  # nube
    out[np.isin(scl, [0, 1]) | ~np.isfinite(scl)] = 0  # no-data
    return out


def coverage_fractions(nir, red, scl, ndvi_threshold: float = 0.25,
                       sensitivity: list[float] | None = None) -> dict:
    """Fracciones por clase + fracción interpretable, con sensibilidad al umbral NDVI."""
    cls = classify(nir, red, scl, ndvi_threshold)
    total = cls.size
    counts = {name: int(np.count_nonzero(cls == code)) for code, name in CLASSES.items()}
    frac_total = {k: (v / total if total else 0.0) for k, v in counts.items()}

    valid = total - counts["nodata"]
    interp = counts["interpretable"]
    # "de lo observable, cuánto es sin cubierta vegetal"
    interp_over_valid = (interp / valid) if valid else 0.0
    interp_over_total = (interp / total) if total else 0.0

    # Sensibilidad: la fracción interpretable a distintos umbrales NDVI.
    sens = {}
    for thr in (sensitivity or [ndvi_threshold]):
        c = classify(nir, red, scl, thr)
        v = c.size - int(np.count_nonzero(c == 0))
        i = int(np.count_nonzero(c == 6))
        sens[f"ndvi>{thr:g}"] = {
            "interpretable_frac_total": (i / c.size if c.size else 0.0),
            "interpretable_frac_valid": (i / v if v else 0.0),
        }

    return {
        "ndvi_threshold": ndvi_threshold,
        "pixels_total": total,
        "pixels_valid": valid,
        "counts": counts,
        "fraction_of_area": frac_total,
        "interpretable_fraction_of_area": interp_over_total,
        "interpretable_fraction_of_observable": interp_over_valid,
        "ndvi_sensitivity": sens,
        "note": (
            "Los píxeles 'interpretable' son suelo/roca SIN cubierta vegetal y observables; "
            "Sentinel-2 NO separa roca de suelo seco de forma robusta (bandas anchas). "
            "Interpretar como 'superficie sin vegetación', no como 'roca expuesta'."
        ),
    }


def coverage_fractions_ndvi(nd, scl, ndvi_threshold: float = 0.25,
                            sensitivity: list[float] | None = None,
                            area_mask: np.ndarray | None = None) -> dict:
    """coverage_fractions pero sobre un NDVI ya calculado (composición multitemporal)."""
    if area_mask is not None:
        area_mask = np.asarray(area_mask, dtype=bool)
        if area_mask.shape != np.asarray(nd).shape:
            raise ValueError("máscara AOI incompatible con la grilla NDVI")
        if not np.any(area_mask):
            raise ValueError("AOI sin píxeles interiores: revisar CRS/resolución")

    def _frac(thr):
        c = classify_ndvi(nd, scl, thr)
        if area_mask is not None:
            c = np.where(area_mask, c, -1)  # exterior excluido del numerador/denominador
        total = int(np.count_nonzero(area_mask)) if area_mask is not None else c.size
        valid = total - int(np.count_nonzero(c == 0))
        i = int(np.count_nonzero(c == 6))
        return c, total, valid, i

    cls, total, valid, interp = _frac(ndvi_threshold)
    counts = {name: int(np.count_nonzero(cls == code)) for code, name in CLASSES.items()}
    sens = {}
    for thr in (sensitivity or [ndvi_threshold]):
        _, tt, vv, ii = _frac(thr)
        sens[f"ndvi>{thr:g}"] = {
            "interpretable_frac_total": (ii / tt if tt else 0.0),
            "interpretable_frac_valid": (ii / vv if vv else 0.0),
        }
    return {
        "ndvi_threshold": ndvi_threshold,
        "pixels_total": total,
        "pixels_valid": valid,
        "counts": counts,
        "fraction_of_area": {k: (v / total if total else 0.0) for k, v in counts.items()},
        "interpretable_fraction_of_area": (interp / total if total else 0.0),
        "interpretable_fraction_of_observable": (interp / valid if valid else 0.0),
        "ndvi_sensitivity": sens,
        "note": (
            "Composición multitemporal (NDVI de la observación más seca por píxel). "
            "'interpretable' = superficie sin cubierta vegetal y observable; incluye suelo "
            "seco (Sentinel-2 no separa roca de suelo de forma robusta)."
        ),
    }


def coverage_verdict(interpretable_fraction_of_area: float, floor: float = 0.15) -> dict:
    """Veredicto para la primera línea del reporte."""
    ok = interpretable_fraction_of_area >= floor
    return {
        "interpretable_fraction_of_area": interpretable_fraction_of_area,
        "floor": floor,
        "spectral_conclusive": ok,
        "headline": (
            f"Superficie sin cubierta vegetal interpretable: "
            f"{interpretable_fraction_of_area*100:.1f}% del área."
            + ("" if ok else
               " Por debajo del piso: el análisis ESPECTRAL no es concluyente en esta "
               "concesión; el valor está en el análisis ESTRUCTURAL del DEM y en el SAR.")
        ),
    }
