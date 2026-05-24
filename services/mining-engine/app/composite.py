"""Length-weighted compositing de intervalos de assays.

Dado un set de intervalos `(from, to, value)` para un sondaje, genera
intervalos compuestos de longitud fija `length` (típicamente 1-2 m),
manteniendo el promedio ponderado por longitud de cada variable.

- Soporta múltiples variables numéricas por intervalo (dict).
- Maneja gaps (sin assay) ignorándolos en el promedio y reportando
  `recovery` = fracción del compuesto con dato real.
- Si `min_recovery` se especifica y un compuesto cae por debajo, su valor
  es None.
"""
from __future__ import annotations

from typing import Dict, List, Optional


def composite_intervals(
    intervals: List[Dict],
    length: float,
    start: Optional[float] = None,
    end: Optional[float] = None,
    min_recovery: float = 0.5,
) -> List[Dict]:
    """Compone intervalos por longitud fija.

    intervals: [{from, to, values: {var: number|None, ...}}, ...]
    length: longitud del compuesto (m)
    start/end: rango opcional; por defecto min(from) - max(to)
    min_recovery: fracción mínima de cobertura para que el compuesto sea válido
    """
    if not intervals or length <= 0:
        return []

    # Normaliza y ordena
    norm = []
    for it in intervals:
        f = float(it["from"])
        t = float(it["to"])
        if t <= f:
            continue
        vals = it.get("values") or {}
        norm.append((f, t, {k: (None if v is None else float(v)) for k, v in vals.items()}))
    if not norm:
        return []
    norm.sort(key=lambda x: x[0])

    if start is None:
        start = norm[0][0]
    if end is None:
        end = max(t for _, t, _ in norm)

    # Variables a componer
    var_names = sorted({k for _, _, v in norm for k in v.keys()})

    out: List[Dict] = []
    cur = start
    while cur < end - 1e-9:
        c_from = cur
        c_to = min(cur + length, end)
        c_len = c_to - c_from

        sums: Dict[str, float] = {v: 0.0 for v in var_names}
        weights: Dict[str, float] = {v: 0.0 for v in var_names}
        covered = 0.0

        for f, t, vals in norm:
            if t <= c_from:
                continue
            if f >= c_to:
                break
            overlap = min(t, c_to) - max(f, c_from)
            if overlap <= 0:
                continue
            covered += overlap
            for v in var_names:
                x = vals.get(v)
                if x is None:
                    continue
                sums[v] += x * overlap
                weights[v] += overlap

        recovery = covered / c_len if c_len > 0 else 0.0
        composite_vals: Dict[str, Optional[float]] = {}
        for v in var_names:
            if weights[v] > 0 and recovery >= min_recovery:
                composite_vals[v] = sums[v] / weights[v]
            else:
                composite_vals[v] = None

        out.append({
            "from": c_from,
            "to": c_to,
            "length": c_len,
            "recovery": recovery,
            "values": composite_vals,
        })
        cur = c_to

    return out
