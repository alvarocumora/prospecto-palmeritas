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
    # Proxy para REE en arcillas de adsorción iónica (IAD): la kaolinita es el
    # portador de REE en el regolito (Cordillera Costera de Chile, ScienceDirect
    # 2023). KI realza la caolinita sobre otras arcillas Al-OH; BSI aísla el
    # regolito EXPUESTO (sin dosel), condición sin la cual el índice espectral no
    # es interpretable en zonas boscosas como Nahuelbuta.
    "kaolinite": {"formula": "(B11+B08)/(B12+B04)", "sensor": "Sentinel-2 L2A",
                  "claim": "realce relativo compatible con kaolinita (proxy REE-IAD). "
                           "NO identifica mineral ni mide ley REE; requiere hiperespectral "
                           "(EMIT/EnMAP) + geoquímica para confirmar."},
    "bare_soil": {"formula": "((B11+B04)-(B08+B02))/((B11+B04)+(B08+B02))", "sensor": "Sentinel-2 L2A",
                  "claim": "índice de suelo desnudo (BSI): regolito/roca expuesta vs. dosel. "
                           "Alto = observable ópticamente; bajo = cubierto, no interpretable."},
}


def _norm_diff(a, b):
    a = np.asarray(a, dtype="float64"); b = np.asarray(b, dtype="float64")
    with np.errstate(divide="ignore", invalid="ignore"):
        s = a + b
        return np.where((s != 0) & np.isfinite(s), (a - b) / s, np.nan)


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
        "kaolinite": _ratio(
            np.asarray(refl["B11"], "float64") + np.asarray(refl["B08"], "float64"),
            np.asarray(refl["B12"], "float64") + np.asarray(refl["B04"], "float64"),
        ),
        "bare_soil": _norm_diff(
            np.asarray(refl["B11"], "float64") + np.asarray(refl["B04"], "float64"),
            np.asarray(refl["B08"], "float64") + np.asarray(refl["B02"], "float64"),
        ),
    }
