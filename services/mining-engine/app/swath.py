"""Swath plots: compara compositos vs bloques estimados por bandas X/Y/Z."""
from __future__ import annotations

from typing import List

import numpy as np


def swath_compare(
    composites: List[dict],
    blocks: List[dict],
    axis: str = "z",
    n_bands: int = 20,
) -> dict:
    """Cada item: {x,y,z, grade}. axis ∈ {x,y,z}."""
    if axis not in ("x", "y", "z"):
        raise ValueError("axis must be x|y|z")
    if not composites or not blocks:
        return {"bands": [], "axis": axis}

    comp = np.array([[c["x"], c["y"], c["z"], c["grade"]] for c in composites if c.get("grade") is not None], dtype=float)
    blk = np.array([[b["x"], b["y"], b["z"], b["grade"]] for b in blocks if b.get("grade") is not None], dtype=float)
    if len(comp) == 0 or len(blk) == 0:
        return {"bands": [], "axis": axis}

    col = {"x": 0, "y": 1, "z": 2}[axis]
    lo = min(comp[:, col].min(), blk[:, col].min())
    hi = max(comp[:, col].max(), blk[:, col].max())
    edges = np.linspace(lo, hi, n_bands + 1)

    bands = []
    for i in range(n_bands):
        a, b = edges[i], edges[i + 1]
        c_mask = (comp[:, col] >= a) & (comp[:, col] < b)
        b_mask = (blk[:, col] >= a) & (blk[:, col] < b)
        c_mean = float(comp[c_mask, 3].mean()) if c_mask.any() else None
        b_mean = float(blk[b_mask, 3].mean()) if b_mask.any() else None
        bands.append({
            "center": float((a + b) / 2),
            "low": float(a),
            "high": float(b),
            "n_composites": int(c_mask.sum()),
            "n_blocks": int(b_mask.sum()),
            "mean_composites": c_mean,
            "mean_blocks": b_mean,
        })
    return {"axis": axis, "bands": bands}
