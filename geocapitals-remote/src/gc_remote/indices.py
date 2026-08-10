"""Índices de alteración por razón de bandas (Sentinel-2).

HONESTIDAD ESPECTRAL (va en los metadatos de cada capa, no en un comentario): con
Sentinel-2 NO se identifica un mineral. B11 y B12 son bandas anchas. Lo único
defendible es "anomalía en la razón de absorción SWIR compatible con minerales de
Al-OH". La identificación mineral (SAM/librería) SOLO es válida con EMIT/PRISMA/EnMAP.
"""
from __future__ import annotations

import numpy as np

# Cada índice declara el sensor que lo sustenta y qué se puede / no se puede afirmar.
INDEX_META = {
    "fe_oxides": {"formula": "B04/B02", "sensor": "Sentinel-2 L2A",
                  "claim": "realce relativo de óxidos de hierro (razón VIS)"},
    "ferrous": {"formula": "B11/B8A", "sensor": "Sentinel-2 L2A",
                "claim": "realce relativo de hierro ferroso (razón NIR/SWIR)"},
    "aloh": {"formula": "B11/B12", "sensor": "Sentinel-2 L2A",
             "claim": "anomalía de absorción SWIR compatible con minerales de Al-OH "
                      "(arcillas/sericita). NO identifica mineral."},
    "gossan": {"formula": "(B04/B02)*(B11/B12)", "sensor": "Sentinel-2 L2A",
               "claim": "realce tipo gossan (hierro + Al-OH). Indicio, no diagnóstico."},
}


def _ratio(a, b):
    a = np.asarray(a, dtype="float64"); b = np.asarray(b, dtype="float64")
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where((b != 0) & np.isfinite(b), a / b, np.nan)


def s2_indices(refl: dict) -> dict:
    """refl: dict con B02,B04,B08,B8A,B11,B12 (reflectancia de mediana). Devuelve
    {nombre: array}. Cada array debe reportarse con INDEX_META[nombre]."""
    return {
        "fe_oxides": _ratio(refl["B04"], refl["B02"]),
        "ferrous": _ratio(refl["B11"], refl["B8A"]),
        "aloh": _ratio(refl["B11"], refl["B12"]),
        "gossan": _ratio(refl["B04"], refl["B02"]) * _ratio(refl["B11"], refl["B12"]),
    }
