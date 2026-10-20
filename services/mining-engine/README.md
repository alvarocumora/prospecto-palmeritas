# GeoCapitals mining-engine

Servicio interno Python / FastAPI para análisis minero (desurvey, compositing,
secciones, RBF y swath). Los cálculos siguen sus módulos originales; PR A agrega
**autenticación fail-closed** y contratos de trabajo geoespacial.

## Seguridad (PR A)

- Configure `MINING_ENGINE_TOKEN` mediante un secret del servicio **antes** de
  atender cualquier llamada de cálculo. Sin token, los endpoints protegidos
  devuelven HTTP **503**, sin ejecutar trabajo. No hay bypass de desarrollo.
- Petición interna: `Authorization: Bearer <MINING_ENGINE_TOKEN>`.
  Token ausente/incorrecto → **401**. No escribir tokens en logs ni en frontend.
- `/health` es público para liveness y NO incluye detalles privados.
- La credencial interna **no** sustituye los permisos RLS / roles de GeoCapitals.
  El gateway TanStack debe autenticar al usuario, verificar acceso al proyecto
  y al asset registrado, aplicar cuotas y usar el token únicamente desde servidor.
- Publicar el servicio en una red interna o protegida. Limitar ingress a la API
  autorizada y emplear TLS; el bearer interno no provee protección de archivos.
- Rotar el secreto de manera coordinada en el gateway y el servicio.

## Contrato preparado para trabajos

`POST /jobs/validate` toma un `GeoJobSpec` de `app/job_contracts.py`:

- `project_id` UUID y `input_asset_id` UUID (referencia a un asset registrado,
  nunca URL arbitraria).
- `job_type`: `vector_ingest`, `dem_contours`, `anomaly_grid`, `export`.
- `source_crs_epsg` es obligatorio: no inferir CRS minero UTM/local.
- `target_crs_epsg` es explícito o 4326 por defecto.
- `parameters`: máximo 24 entradas y cadenas acotadas.
- Respuesta `state=validated_not_submitted`, `can_execute=false`.
  **No crea trabajos, no envía a Celery y no escribe en la base de datos.**

`GeoJobRecord` enumera estados para una implementación posterior. No cambiar
`geoscience_compute_jobs` hasta comprobar contratos y permisos de la tabla real.

## Entorno y pruebas

```bash
cd services/mining-engine
python3.11 -m venv .venv
. .venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest -q tests

# En otra shell local con secreto de ejemplo NO reutilizable:
MINING_ENGINE_TOKEN="replace-with-secret-from-manager" \
  uvicorn app.main:app --host 127.0.0.1 --port 8088
```

`Dockerfile` mantiene dependencias productivas; `requirements-dev.txt` añade
solamente pytest/httpx. `.github/workflows/mining-engine-ci.yml` ejecuta la
suite Python 3.11 cuando cambian archivos del servicio.

## Próxima fase PR B

Implementar KML/KMZ seguro y geodesia Pyproj bajo módulos
`app/ingest/` y `app/geodesy.py` con límites de bytes y features, rechazo
de archivos maliciosos y CRS explícito. Al principio solo preview/validación,
sin grabar concesiones ni publicar capas automáticamente.

## Alcances todavía pendientes

Celery + Redis, PostGIS persistence, S3, auditoría de acceso, límites de tasa,
contadores, reintentos, ingestión real y exportación. La API de este PR NO
afirma esas capacidades.

## PR B — Geodesia y previsualización segura de KML/KMZ

Rutas agregadas (todas requieren `MINING_ENGINE_TOKEN`):
- `POST /geodesy/transform`: recibe `x`, `y`, `source_epsg`,
  `target_epsg`; usa `pyproj.Transformer(always_xy=True)`. No infiere
  husos UTM ni CRS desde rangos numéricos. EPSG:32718 / 32719 verificables
  con coordenadas de prueba.
- `POST /ingest/preview-kml`: `multipart/form-data` con campo `file`;
  admite `.kml` y `.kmz`, máximo **8 MiB**, XML descomprimido hasta
  **32 MiB**, 64 entradas ZIP, 5000 features y 250000 coordenadas.
  Rechaza ZIP path traversal, symlinks, DTD/entidades XML y geometría inválida.
  No sigue NetworkLinks ni descarga URLs externas.

**Importante:** KML siempre utiliza longitud/latitud WGS84 (EPSG:4326);
GeoJSON de salida permanece 4326. Alturas Z se omiten hasta identificar
`altitudeMode` y datum vertical; una geometría es solo
`preview_unverified`. No se guarda en PostGIS ni se publica en GeoScene3D.

**No incluye aún:** DXF/SHP/LAS, CSV de sondajes, Celery/Redis, almacenamiento
S3, control de cuotas, virus scan, topología detallada o persistencia.
La importación definitiva exige un flujo adicional de revisión y autorización
por proyecto desde el gateway de GeoCapitals.
