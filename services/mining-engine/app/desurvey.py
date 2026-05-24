"""Minimum curvature desurvey.

Pure numpy implementation — no pygslib dependency. Devuelve coordenadas
(x, y, z) interpoladas a lo largo del sondaje a partir de los survey
shots (depth, azimuth, dip).
"""
from __future__ import annotations

import math
from typing import List, Tuple

import numpy as np


def _radians(deg: float) -> float:
    return deg * math.pi / 180.0


def min_curvature_segment(
    md1: float, az1: float, dip1: float,
    md2: float, az2: float, dip2: float,
) -> Tuple[float, float, float]:
    """Devuelve (dN, dE, dZ) entre dos estaciones consecutivas.

    Convención: dip positivo = hacia abajo. Z se decrementa con la
    profundidad (Z = -depth_below_collar acumulada).
    """
    i1 = _radians(90.0 - dip1)  # inclinación desde la vertical
    i2 = _radians(90.0 - dip2)
    a1 = _radians(az1)
    a2 = _radians(az2)

    md = md2 - md1
    cos_dl = (
        math.cos(i2 - i1)
        - math.sin(i1) * math.sin(i2) * (1.0 - math.cos(a2 - a1))
    )
    cos_dl = max(-1.0, min(1.0, cos_dl))
    dl = math.acos(cos_dl)
    rf = 1.0 if dl < 1e-9 else (2.0 / dl) * math.tan(dl / 2.0)

    dN = (md / 2.0) * (math.sin(i1) * math.cos(a1) + math.sin(i2) * math.cos(a2)) * rf
    dE = (md / 2.0) * (math.sin(i1) * math.sin(a1) + math.sin(i2) * math.sin(a2)) * rf
    dZ = -(md / 2.0) * (math.cos(i1) + math.cos(i2)) * rf
    return dN, dE, dZ


def desurvey(
    collar_x: float, collar_y: float, collar_z: float,
    shots: List[Tuple[float, float, float]],
    step: float = 1.0,
) -> List[dict]:
    """Genera la trayectoria 3D punto a punto.

    `shots`: lista de (depth_m, azimuth_deg, dip_deg) ordenada por depth.
    `step`: resolución en metros para densificar entre estaciones.
    """
    if not shots:
        return []
    shots = sorted(shots, key=lambda s: s[0])
    pts: List[dict] = []
    x, y, z = collar_x, collar_y, collar_z
    pts.append({"md": shots[0][0], "x": x, "y": y, "z": z})

    for (md1, az1, dip1), (md2, az2, dip2) in zip(shots, shots[1:]):
        seg = md2 - md1
        if seg <= 0:
            continue
        n_sub = max(1, int(math.ceil(seg / step)))
        sub = seg / n_sub
        for k in range(1, n_sub + 1):
            t = k / n_sub
            md_k = md1 + sub * k
            az_k = az1 + (az2 - az1) * t
            dip_k = dip1 + (dip2 - dip1) * t
            dN, dE, dZ = min_curvature_segment(
                md_k - sub, az1 + (az2 - az1) * ((k - 1) / n_sub),
                dip1 + (dip2 - dip1) * ((k - 1) / n_sub),
                md_k, az_k, dip_k,
            )
            x += dN  # Northing
            y += dE  # Easting (mantén consistencia con tus collares)
            z += dZ
            pts.append({"md": md_k, "x": x, "y": y, "z": z})
    return pts
