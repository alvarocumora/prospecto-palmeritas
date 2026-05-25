"""Wireframe implícito por RBF (Radial Basis Function).

Toma compositos con indicador (1=ore, 0=waste) y devuelve un campo escalar
muestreado en una grilla regular, junto con un mesh de iso-superficie en 0.5
via marching cubes (skimage). Si skimage no está disponible, devuelve solo
la grilla escalar para que el cliente la renderice como nube.

NOTA: RBF puro O(N^3) — limitamos a 1500 muestras. Para más, usar el
sub-muestreo estratificado integrado.
"""
from __future__ import annotations

from typing import List, Tuple

import numpy as np


def _subsample(points: np.ndarray, values: np.ndarray, max_n: int) -> Tuple[np.ndarray, np.ndarray]:
    if len(points) <= max_n:
        return points, values
    idx = np.random.default_rng(42).choice(len(points), size=max_n, replace=False)
    return points[idx], values[idx]


def rbf_wireframe(
    samples: List[dict],
    iso: float = 0.5,
    grid_n: int = 32,
    pad: float = 50.0,
    smooth: float = 5.0,
    max_samples: int = 1500,
) -> dict:
    """samples: [{x,y,z,indicator}] con indicator in [0,1]."""
    if not samples:
        return {"status": "empty", "vertices": [], "faces": [], "grid": None}

    pts = np.array([[s["x"], s["y"], s["z"]] for s in samples], dtype=float)
    vals = np.array([float(s["indicator"]) for s in samples], dtype=float)

    pts, vals = _subsample(pts, vals, max_samples)

    try:
        from scipy.interpolate import RBFInterpolator
    except Exception as e:  # pragma: no cover
        return {"status": "scipy_missing", "error": str(e)}

    rbf = RBFInterpolator(pts, vals, kernel="thin_plate_spline", smoothing=smooth)

    mn = pts.min(axis=0) - pad
    mx = pts.max(axis=0) + pad
    xs = np.linspace(mn[0], mx[0], grid_n)
    ys = np.linspace(mn[1], mx[1], grid_n)
    zs = np.linspace(mn[2], mx[2], grid_n)
    gx, gy, gz = np.meshgrid(xs, ys, zs, indexing="ij")
    grid_pts = np.stack([gx.ravel(), gy.ravel(), gz.ravel()], axis=-1)
    field = rbf(grid_pts).reshape(grid_n, grid_n, grid_n)

    result: dict = {
        "status": "ok",
        "bbox": {"min": mn.tolist(), "max": mx.tolist()},
        "grid_n": grid_n,
        "iso": iso,
        "samples_used": int(len(pts)),
    }

    try:
        from skimage import measure
        verts, faces, _, _ = measure.marching_cubes(field, level=iso)
        # remapear índices a coords reales
        spacing = (mx - mn) / (grid_n - 1)
        verts_world = mn + verts * spacing
        result["vertices"] = verts_world.tolist()
        result["faces"] = faces.tolist()
        result["volume_m3"] = float(np.sum(field >= iso) * np.prod(spacing))
    except Exception as e:
        # sin skimage: devolver isocoords aproximadas (puntos donde field≈iso)
        mask = np.abs(field - iso) < 0.1
        idx = np.argwhere(mask)
        spacing = (mx - mn) / (grid_n - 1)
        pts_iso = mn + idx * spacing
        result["vertices"] = pts_iso.tolist()
        result["faces"] = []
        result["fallback"] = f"marching_cubes_unavailable: {e}"
        result["volume_m3"] = float(np.sum(field >= iso) * np.prod(spacing))

    return result
