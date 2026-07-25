"""B6 · Lógica pura de obligaciones y alertas escalonadas.

Sin dependencias de red: testeable en CI. El job (etl/obligaciones_job.py) usa
estas funciones contra la base.
"""
from __future__ import annotations

from datetime import date

# Umbrales de alerta anticipada (días antes del vencimiento), del más lejano al
# más cercano. Además del umbral "vencido" (después de la fecha).
UMBRALES = [("d90", 90), ("d30", 30), ("d7", 7)]


def dias_restantes(vence_at: date, hoy: date) -> int:
    return (vence_at - hoy).days


def alertas_a_disparar(dias: int, ya_disparadas: set[str]) -> list[str]:
    """Umbrales que deben dispararse hoy y aún no se han disparado.

    Escalonado: en cualquier corrida se disparan todos los umbrales cuya condición
    ya se cumple y no se enviaron antes (idempotencia por umbral). Así, si el job
    corre por primera vez a 5 días, envía d90/d30/d7 de una (catch-up).
    """
    out: list[str] = []
    for umbral, limite in UMBRALES:
        if dias <= limite and umbral not in ya_disparadas:
            out.append(umbral)
    if dias < 0 and "vencido" not in ya_disparadas:
        out.append("vencido")
    return out


def marzo_31(anio: int) -> date:
    """Vencimiento anual de la patente minera: se paga en marzo."""
    return date(anio, 3, 31)


def periodo_patente(hoy: date) -> tuple[str, date]:
    """Periodo y fecha de vencimiento de la patente del año en curso.

    Si ya pasó el 31 de marzo, la próxima obligación es la del año siguiente.
    """
    venc = marzo_31(hoy.year)
    if hoy > venc:
        return (str(hoy.year + 1), marzo_31(hoy.year + 1))
    return (str(hoy.year), venc)
