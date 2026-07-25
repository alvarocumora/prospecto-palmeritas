"""B3 · Job del Boletín Oficial de Minería.

Flujo:
1) EXTRAER texto del PDF de la edición (con OCR de respaldo si el PDF es imagen).
2) PARSEAR con el motor puro (packages/reglas/boletin_parser.py): registros +
   confianza + geolocalización PSAD56→WGS84.
3) INGERIR de forma idempotente (hash por edición y por registro).
4) CRUZAR cada registro geolocalizado contra el catastro (+buffer) → alertas
   'dentro_de_concesion' / 'proximidad'.
5) Los registros de baja confianza quedan en la cola de revisión (vista
   boletin_cola_revision); no generan alerta firme.

GATE declarado: el ENDPOINT del Boletín (URL, login, periodicidad) NO está
verificado — no se inventa aquí. `run()` recibe el texto ya obtenido; la descarga
real es una sub-tarea con el endpoint que confirme el equipo. `extraer_texto()`
queda lista para el PDF, pero requiere dependencias (pypdf / pytesseract) que no
son parte de la suite de CI.
"""
from __future__ import annotations

import hashlib
import importlib.util
import os
import sys
from datetime import date
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]

FUENTE_ID = "boletin_minero"
BUFFER_M_DEFAULT = 500.0


def _load(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


bp = _load("boletin_parser", "packages/reglas/boletin_parser.py")


def extraer_texto(pdf_bytes: bytes) -> str:
    """Extrae texto del PDF; si viene vacío (PDF escaneado) cae a OCR.

    Dependencias declaradas (NO en la suite de CI): pypdf para texto, y
    pdf2image + pytesseract (+ binario tesseract) para el respaldo OCR. Si no
    están instaladas, se levanta un error claro en vez de inventar contenido.
    """
    texto = ""
    try:
        import pypdf  # type: ignore

        import io

        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        texto = "\n".join((p.extract_text() or "") for p in reader.pages)
    except ImportError as e:
        raise RuntimeError(
            "Falta 'pypdf' para extraer texto del boletín. Instálalo en el runner "
            "del job (no es dependencia de la suite de tests)."
        ) from e

    if texto.strip():
        return texto

    # Respaldo OCR para ediciones escaneadas.
    try:
        import pdf2image  # type: ignore
        import pytesseract  # type: ignore

        imgs = pdf2image.convert_from_bytes(pdf_bytes)
        return "\n---\n".join(pytesseract.image_to_string(im, lang="spa") for im in imgs)
    except ImportError as e:
        raise RuntimeError(
            "El PDF no trae texto (posible escaneo) y falta el respaldo OCR "
            "(pdf2image + pytesseract + binario tesseract)."
        ) from e


def _asegurar_fuente(cur) -> None:
    cur.execute(
        "INSERT INTO public.fuentes_datos (id, nombre, formato) "
        "VALUES (%s, 'Boletín Oficial de Minería', 'pdf') ON CONFLICT (id) DO NOTHING",
        (FUENTE_ID,),
    )


def _upsert_edicion(cur, texto: str, meta: dict) -> tuple[str, bool]:
    """Inserta la edición si su contenido es nuevo. Devuelve (edicion_id, es_nueva)."""
    origen_hash = hashlib.sha256(texto.encode("utf-8")).hexdigest()
    cur.execute(
        """
        INSERT INTO public.boletin_ediciones (fuente_id, numero, fecha, url, tipo, origen_hash)
        VALUES (%s,%s,%s,%s,%s,%s)
        ON CONFLICT (origen_hash) DO NOTHING
        RETURNING id
        """,
        (FUENTE_ID, meta.get("numero"), meta.get("fecha"), meta.get("url"),
         meta.get("tipo"), origen_hash),
    )
    row = cur.fetchone()
    if row:
        return str(row[0]), True
    cur.execute("SELECT id FROM public.boletin_ediciones WHERE origen_hash = %s", (origen_hash,))
    return str(cur.fetchone()[0]), False


def _insertar_registro(cur, edicion_id: str, r) -> Optional[str]:
    if r.geolocalizable:
        geom_sql = "ST_SetSRID(ST_MakePoint(%(lon)s,%(lat)s),4326)"
    else:
        geom_sql = "NULL"
    import json

    cur.execute(
        f"""
        INSERT INTO public.boletin_registros
          (edicion_id, tipo_acto, rol, nombre, titular, comuna,
           este_psad56, norte_psad56, huso, geom, confianza, estado_revision, flags, origen_hash)
        VALUES (%(edicion_id)s,%(tipo)s,%(rol)s,%(nombre)s,%(titular)s,%(comuna)s,
                %(este)s,%(norte)s,%(huso)s,{geom_sql},%(conf)s,%(estado)s,%(flags)s::jsonb,%(hash)s)
        ON CONFLICT (edicion_id, origen_hash) DO NOTHING
        RETURNING id
        """,
        {
            "edicion_id": edicion_id, "tipo": r.tipo_acto, "rol": r.rol, "nombre": r.nombre,
            "titular": r.titular, "comuna": r.comuna, "este": r.este_psad56,
            "norte": r.norte_psad56, "huso": r.huso, "lon": r.lon, "lat": r.lat,
            "conf": r.confianza, "estado": r.estado_revision,
            "flags": json.dumps(r.flags), "hash": r.origen_hash,
        },
    )
    row = cur.fetchone()
    return str(row[0]) if row else None


def _cruzar_alertas(cur, registro_id: str, lon: float, lat: float, buffer_m: float) -> int:
    """Cruza el punto contra el catastro vigente (+buffer) e inserta alertas."""
    cur.execute(
        """
        WITH pt AS (SELECT ST_SetSRID(ST_MakePoint(%s,%s),4326) AS g)
        SELECT c.external_id,
               ST_Contains(c.geom, pt.g) AS dentro,
               ST_Distance(c.geom::geography, pt.g::geography) AS dist
        FROM public.catastro_concesiones c, pt
        WHERE c.valid_to IS NULL
          AND ST_DWithin(c.geom::geography, pt.g::geography, %s)
        """,
        (lon, lat, buffer_m),
    )
    creadas = 0
    for external_id, dentro, dist in cur.fetchall():
        tipo = "dentro_de_concesion" if dentro else "proximidad"
        cur.execute(
            """
            INSERT INTO public.boletin_alertas
              (registro_id, concesion_external_id, tipo_alerta, distancia_m, buffer_m)
            VALUES (%s,%s,%s,%s,%s)
            ON CONFLICT (registro_id, concesion_external_id) DO NOTHING
            """,
            (registro_id, external_id, tipo, float(dist), buffer_m),
        )
        creadas += cur.rowcount
    return creadas


def ingerir(conn, texto: str, meta: dict, buffer_m: float = BUFFER_M_DEFAULT) -> dict:
    registros = bp.parsear_boletin(texto)
    with conn.cursor() as cur:
        _asegurar_fuente(cur)
        edicion_id, _ = _upsert_edicion(cur, texto, meta)
        cur.execute(
            "UPDATE public.boletin_ediciones SET registros_leidos = %s WHERE id = %s",
            (len(registros), edicion_id),
        )
        nuevos = 0
        alertas = 0
        en_cola = 0
        for r in registros:
            rid = _insertar_registro(cur, edicion_id, r)
            if rid is None:
                continue  # ya existía (idempotente)
            nuevos += 1
            if r.estado_revision == "pendiente_revision":
                en_cola += 1
            if r.geolocalizable:
                alertas += _cruzar_alertas(cur, rid, r.lon, r.lat, buffer_m)
        conn.commit()
    return {
        "edicion_id": edicion_id,
        "registros_leidos": len(registros),
        "registros_nuevos": nuevos,
        "en_cola_revision": en_cola,
        "alertas_creadas": alertas,
    }


def run(database_url: str, texto: str, meta: Optional[dict] = None,
        buffer_m: float = BUFFER_M_DEFAULT) -> dict:
    import psycopg

    meta = meta or {}
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SET search_path TO public, extensions")
        return ingerir(conn, texto, meta, buffer_m)


if __name__ == "__main__":
    db = os.environ.get("DATABASE_URL")
    if not db:
        raise SystemExit("falta DATABASE_URL")
    # El texto/PDF real llega por la ingesta (endpoint por confirmar). Sin argumentos
    # este job no inventa contenido.
    raise SystemExit("Este job recibe el texto del boletín por run(); no descarga (endpoint por confirmar).")
