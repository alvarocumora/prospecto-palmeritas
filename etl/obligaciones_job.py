"""B6 · Job de obligaciones y alertas.

1) Generador: por cada concesión del catastro deriva su obligación de patente del
   periodo en curso (vencimiento 31-mar), con el monto desde el motor B5.2.
2) Evaluador: para cada obligación pendiente dispara las alertas escalonadas
   (90/30/7 días + vencido) de forma idempotente (no reenvía la misma alerta).

Las notificaciones por correo las envía la app (Lovable) leyendo las alertas
pendientes (notificada_at IS NULL); este job deja el REGISTRO idempotente.
"""
from __future__ import annotations

import importlib.util
import os
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


ob = _load("obligaciones", "packages/reglas/obligaciones.py")
pt = _load("patentes", "packages/reglas/patentes.py")

FUENTE_ID = "sernageomin_concesiones"


def generar_obligaciones_patente(conn, hoy: date) -> int:
    """Crea/asegura la obligación de patente del periodo en curso por concesión."""
    periodo, vence = ob.periodo_patente(hoy)
    with conn.cursor() as cur:
        escala = pt.cargar_escala(cur)
        valores = pt.cargar_valores_utm(cur)
        utm = pt.utm_vigente(valores, hoy)
        utm_clp = utm.valor_clp if utm else 0.0
        cur.execute(
            "SELECT external_id, tipo, estado, hectareas FROM public.catastro_concesiones "
            "WHERE valid_to IS NULL AND estado <> 'ELIMINADA'"
        )
        filas = cur.fetchall()
        creadas = 0
        for ext, tipo_conc, estado, hect in filas:
            tipo = "explotacion" if (tipo_conc or "").upper().startswith("EXPLOT") else "exploracion"
            area = float(hect) if hect is not None else 0.0
            tramo = pt._tramo(escala, tipo, False, 1)  # año 1 por defecto (sin dato de vigencia)
            monto = pt.patente_anual_clp(area, tramo.valor_utm_por_ha, utm_clp) if tramo else None
            cur.execute(
                """
                INSERT INTO public.obligaciones
                  (fuente_id, concesion_external_id, tipo, descripcion, monto_clp, periodo, vence_at)
                VALUES (%s,%s,'patente',%s,%s,%s,%s)
                ON CONFLICT (fuente_id, concesion_external_id, tipo, periodo)
                  WHERE concesion_external_id IS NOT NULL AND periodo IS NOT NULL
                DO NOTHING
                """,
                (FUENTE_ID, ext, f"Pago de patente minera {periodo}", monto, periodo, vence),
            )
            creadas += cur.rowcount
        conn.commit()
        return creadas


def evaluar_alertas(conn, hoy: date) -> int:
    """Dispara las alertas escalonadas de las obligaciones pendientes (idempotente)."""
    disparadas = 0
    with conn.cursor() as cur:
        cur.execute("SELECT id, vence_at FROM public.obligaciones WHERE estado = 'pendiente'")
        pendientes = cur.fetchall()
        for obl_id, vence in pendientes:
            dias = ob.dias_restantes(vence, hoy)
            cur.execute("SELECT umbral FROM public.obligacion_alertas WHERE obligacion_id = %s", (obl_id,))
            ya = {r[0] for r in cur.fetchall()}
            for umbral in ob.alertas_a_disparar(dias, ya):
                cur.execute(
                    "INSERT INTO public.obligacion_alertas (obligacion_id, umbral, dias_restantes) "
                    "VALUES (%s,%s,%s) ON CONFLICT (obligacion_id, umbral) DO NOTHING",
                    (obl_id, umbral, dias),
                )
                disparadas += cur.rowcount
            # Marcar vencida (sin borrar) cuando pasó la fecha.
            if dias < 0:
                cur.execute("UPDATE public.obligaciones SET estado='vencida', updated_at=now() WHERE id=%s", (obl_id,))
        conn.commit()
    return disparadas


def run(database_url: str, hoy: date | None = None) -> dict:
    import psycopg

    hoy = hoy or date.today()
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SET search_path TO public, extensions")
        creadas = generar_obligaciones_patente(conn, hoy)
        alertas = evaluar_alertas(conn, hoy)
    return {"obligaciones_creadas": creadas, "alertas_disparadas": alertas}


if __name__ == "__main__":
    db = os.environ.get("DATABASE_URL")
    if not db:
        raise SystemExit("falta DATABASE_URL")
    import json

    print(json.dumps(run(db)))
