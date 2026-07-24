"""B2 · ETL de concesiones mineras SERNAGEOMIN → catastro_concesiones.

Idempotente y reejecutable. Fuente: FeatureServer oficial (ArcGIS Online,
capa WGS84_Concesion), que entrega GeoJSON en EPSG:4326 (SERNAGEOMIN reproyecta
con EPSG:1204; ver docs/datums.md). Versionado temporal: al cambiar una
concesión se cierra el registro anterior (valid_to) y se inserta uno nuevo —
nunca UPDATE destructivo, para que el estado histórico sea auditable.

Uso:
    DATABASE_URL=postgres://... python etl/sernageomin_concesiones.py \
        --bbox -71.09 -35.00 -71.05 -34.97      # área de prueba
    DATABASE_URL=postgres://... python etl/sernageomin_concesiones.py --all
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Iterable, Optional

FUENTE_ID = "sernageomin_concesiones"
BASE = (
    "https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services/"
    "Marcelo_Layer/FeatureServer"
)
LAYER = 2  # WGS84_Concesion (polígonos)
PAGE = 1000

# Mapeo campo fuente → columna canónica.
FIELD_MAP = {
    "external_id": "ID_CONCESION",
    "rol": "NUMERO_ROL",
    "nombre": "NOMBRE",
    "tipo": "TIPO_CONCESION",
    "estado": "SITUACION_CONCESION",
    "titular": "TITULAR_NOMBRE",
    "hectareas": "HECTAREAS",
    "comuna": "COMUNA",
    "datum_origen": "DATUM",
}


def _get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "GeoCapitals-ETL/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_page(offset: int, bbox: Optional[tuple]) -> tuple[list, bool]:
    params = {
        "where": "1=1",
        "outFields": "*",
        "outSR": "4326",
        "returnGeometry": "true",
        "f": "geojson",
        "resultOffset": str(offset),
        "resultRecordCount": str(PAGE),
    }
    if bbox:
        xmin, ymin, xmax, ymax = bbox
        params["geometry"] = json.dumps(
            {"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax, "spatialReference": {"wkid": 4326}}
        )
        params["geometryType"] = "esriGeometryEnvelope"
        params["inSR"] = "4326"
        params["spatialRel"] = "esriSpatialRelIntersects"
    url = f"{BASE}/{LAYER}/query?{urllib.parse.urlencode(params)}"
    fc = _get(url)
    if "error" in fc:
        raise RuntimeError(f"SERNAGEOMIN error: {fc['error']}")
    feats = fc.get("features", [])
    exceeded = bool(fc.get("properties", {}).get("exceededTransferLimit"))
    return feats, exceeded


def fetch_all(bbox: Optional[tuple], max_features: Optional[int]) -> list:
    out: list = []
    offset = 0
    while True:
        feats, exceeded = fetch_page(offset, bbox)
        out.extend(feats)
        if not feats or not exceeded:
            break
        offset += len(feats)
        if max_features and len(out) >= max_features:
            break
    return out


def _canon(v):
    return "" if v is None else str(v)


def feature_hash(props: dict, geom: dict) -> str:
    payload = json.dumps({"p": props, "g": geom}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def dataset_hash(features: Iterable[dict]) -> str:
    ids = sorted(
        f"{f['properties'].get('ID_CONCESION')}:{feature_hash(f['properties'], f['geometry'])}"
        for f in features
        if f.get("geometry") and f.get("properties")
    )
    return hashlib.sha256("\n".join(ids).encode("utf-8")).hexdigest()


def _val(props: dict, key: str):
    return props.get(FIELD_MAP[key])


def run(database_url: str, bbox: Optional[tuple], max_features: Optional[int]) -> dict:
    import psycopg  # import diferido: el módulo se puede importar sin psycopg

    features = fetch_all(bbox, max_features)
    ds_hash = dataset_hash(features)

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            # PostGIS puede vivir en public (CI) o extensions (Supabase): resolver
            # ambos por search_path para no calificar las funciones.
            cur.execute("SET search_path TO public, extensions")
            # Registrar/actualizar la fuente.
            cur.execute(
                """
                INSERT INTO public.fuentes_datos (id, nombre, url, formato, srid_nativo, licencia, frecuencia)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, url=EXCLUDED.url,
                  formato=EXCLUDED.formato, updated_at=now()
                RETURNING ultimo_hash
                """,
                (
                    FUENTE_ID,
                    "SERNAGEOMIN · Concesiones mineras (WGS84_Concesion)",
                    f"{BASE}/{LAYER}",
                    "ArcGIS FeatureServer (GeoJSON)",
                    4326,
                    "Datos públicos SERNAGEOMIN (uso referencial; la BD oficial prevalece)",
                    "diaria",
                ),
            )
            prev_hash = cur.fetchone()[0]

            # Abrir corrida.
            cur.execute(
                "INSERT INTO public.etl_corridas (fuente_id, origen_hash, registros_leidos) "
                "VALUES (%s, %s, %s) RETURNING id",
                (FUENTE_ID, ds_hash, len(features)),
            )
            corrida_id = cur.fetchone()[0]
            conn.commit()

            # Idempotencia a nivel de dataset: si el hash no cambió, no reprocesar.
            if prev_hash == ds_hash and bbox is None:
                cur.execute(
                    "UPDATE public.etl_corridas SET estado='sin_cambios', finalizada_at=now(), "
                    "registros_nuevos=0, registros_cerrados=0 WHERE id=%s",
                    (corrida_id,),
                )
                conn.commit()
                return {"estado": "sin_cambios", "leidos": len(features), "nuevos": 0, "cerrados": 0}

            nuevos = cerrados = 0
            try:
                for f in features:
                    props, geom = f.get("properties"), f.get("geometry")
                    if not props or not geom:
                        continue
                    ext = _canon(_val(props, "external_id")) or _canon(props.get("OBJECTID"))
                    fh = feature_hash(props, geom)
                    cur.execute(
                        "SELECT id, origen_hash FROM public.catastro_concesiones "
                        "WHERE fuente_id=%s AND external_id=%s AND valid_to IS NULL",
                        (FUENTE_ID, ext),
                    )
                    cur_row = cur.fetchone()
                    if cur_row and cur_row[1] == fh:
                        continue  # sin cambios
                    if cur_row:
                        cur.execute(
                            "UPDATE public.catastro_concesiones SET valid_to=now() WHERE id=%s",
                            (cur_row[0],),
                        )
                        cerrados += 1
                    hect = _val(props, "hectareas")
                    cur.execute(
                        """
                        INSERT INTO public.catastro_concesiones
                          (fuente_id, external_id, rol, nombre, tipo, estado, titular, hectareas,
                           comuna, datum_origen, geom, atributos, origen_hash, ingesta_corrida_id)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                                ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s),4326)),%s,%s,%s)
                        """,
                        (
                            FUENTE_ID, ext, _val(props, "rol"), _val(props, "nombre"),
                            _val(props, "tipo"), _val(props, "estado"), _val(props, "titular"),
                            hect if isinstance(hect, (int, float)) else None,
                            _val(props, "comuna"), _val(props, "datum_origen"),
                            json.dumps(geom), json.dumps(props), fh, corrida_id,
                        ),
                    )
                    nuevos += 1

                cur.execute(
                    "UPDATE public.etl_corridas SET estado='ok', finalizada_at=now(), "
                    "registros_nuevos=%s, registros_cerrados=%s WHERE id=%s",
                    (nuevos, cerrados, corrida_id),
                )
                if bbox is None:
                    cur.execute(
                        "UPDATE public.fuentes_datos SET ultimo_hash=%s, ultima_corrida=now() WHERE id=%s",
                        (ds_hash, FUENTE_ID),
                    )
                conn.commit()
            except Exception as e:  # noqa: BLE001
                conn.rollback()
                cur.execute(
                    "UPDATE public.etl_corridas SET estado='error', finalizada_at=now(), mensaje=%s WHERE id=%s",
                    (str(e)[:500], corrida_id),
                )
                conn.commit()
                raise
            return {"estado": "ok", "leidos": len(features), "nuevos": nuevos, "cerrados": cerrados}


def main(argv=None):
    ap = argparse.ArgumentParser(description="ETL concesiones SERNAGEOMIN")
    ap.add_argument("--bbox", nargs=4, type=float, metavar=("XMIN", "YMIN", "XMAX", "YMAX"))
    ap.add_argument("--all", action="store_true", help="país completo (paginado)")
    ap.add_argument("--max", type=int, default=None, help="límite de features (pruebas)")
    args = ap.parse_args(argv)
    db = os.environ.get("DATABASE_URL")
    if not db:
        print("ERROR: falta DATABASE_URL", file=sys.stderr)
        return 2
    bbox = tuple(args.bbox) if args.bbox else None
    if not bbox and not args.all:
        print("ERROR: indica --bbox o --all", file=sys.stderr)
        return 2
    result = run(db, bbox, args.max)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
