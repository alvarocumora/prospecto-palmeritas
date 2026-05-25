"""Cross-section: proyecta puntos 3D sobre un plano vertical arbitrario.

Plano definido por:
- origin (x0, y0, z0): punto que define el "0" del eje horizontal
- azimuth_deg: rumbo del plano (0 = N, 90 = E)
- dip_deg: 90 = vertical (caso típico de secciones mineras).
  Permitimos < 90 para secciones inclinadas en el futuro.

Devuelve para cada punto (s, h) donde:
- s = distancia horizontal a lo largo del plano (m, desde origin)
- h = elevación (m) — para secciones verticales, h = z
- d = distancia perpendicular al plano (m, signed)
"""
from __future__ import annotations

import math
from typing import Iterable, List, Tuple


def _strike_vector(azimuth_deg: float) -> Tuple[float, float]:
    """Vector unitario en plano XY a lo largo del rumbo (azimut)."""
    az = math.radians(azimuth_deg)
    # x = easting, y = northing; azimut medido desde N hacia E
    return (math.sin(az), math.cos(az))


def project_points(
    points: Iterable[dict],
    origin_x: float,
    origin_y: float,
    origin_z: float,
    azimuth_deg: float,
    band_m: float = 50.0,
) -> List[dict]:
    """Proyecta puntos {x,y,z,...} al plano vertical.

    Filtra por banda de ancho `band_m` (mantiene puntos con |d| <= band_m/2).
    Conserva todas las claves originales y agrega s, h, d.
    """
    sx, sy = _strike_vector(azimuth_deg)
    # vector normal en XY (perpendicular al strike, horizontal)
    nx, ny = -sy, sx
    half = band_m / 2.0
    out: List[dict] = []
    for p in points:
        dx = float(p["x"]) - origin_x
        dy = float(p["y"]) - origin_y
        s = dx * sx + dy * sy
        d = dx * nx + dy * ny
        if abs(d) > half:
            continue
        h = float(p["z"]) - origin_z
        item = dict(p)
        item.update({"s": s, "h": h, "d": d})
        out.append(item)
    return out


def project_trajectory(
    trajectory: List[dict],
    origin_x: float,
    origin_y: float,
    origin_z: float,
    azimuth_deg: float,
    band_m: float = 50.0,
) -> List[dict]:
    """Como project_points pero conserva orden + flag in_band."""
    sx, sy = _strike_vector(azimuth_deg)
    nx, ny = -sy, sx
    half = band_m / 2.0
    out: List[dict] = []
    for p in trajectory:
        dx = float(p["x"]) - origin_x
        dy = float(p["y"]) - origin_y
        s = dx * sx + dy * sy
        d = dx * nx + dy * ny
        h = float(p["z"]) - origin_z
        out.append({
            "md": p.get("md", 0.0),
            "s": s,
            "h": h,
            "d": d,
            "in_band": abs(d) <= half,
        })
    return out
