# Fuentes de datos del ETL (B2)

> Registro vivo en la tabla `fuentes_datos` (la puebla el ETL). Este doc es la
> referencia humana. Regla dura: si una capa no está disponible, se declara
> ausente; nunca se rellena con estimaciones.

## Concesiones vigentes/en trámite — SERNAGEOMIN

| Campo               | Valor                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id` (fuente_datos) | `sernageomin_concesiones`                                                                                                                                                |
| Organismo           | Servicio Nacional de Geología y Minería — Depto. de Propiedad Minera                                                                                                     |
| Servicio            | ArcGIS FeatureServer (ArcGIS Online)                                                                                                                                     |
| Base                | `https://services1.arcgis.com/OyjvVdFTl5hfSdX3/arcgis/rest/services/Marcelo_Layer/FeatureServer`                                                                         |
| Capa concesiones    | `/2` — `WGS84_Concesion` (polígonos, ~102.875)                                                                                                                           |
| Capa vértices       | `/0` — `WGS84_Vertice` (NORTE/ESTE en PSAD56 + geometría WGS84)                                                                                                          |
| Formato de descarga | GeoJSON (`f=geojson`), paginado (`maxRecordCount=2000`)                                                                                                                  |
| SRID de salida      | **EPSG:4326** (`outSR=4326`). SERNAGEOMIN reproyecta desde PSAD56 con **EPSG:1204** (ver `docs/datums.md`)                                                               |
| Campos usados       | `ID_CONCESION`, `NUMERO_ROL`, `NOMBRE`, `TIPO_CONCESION`, `SITUACION_CONCESION`, `TITULAR_NOMBRE`, `HECTAREAS`, `COMUNA`, `DATUM` (+ todo el resto en `atributos` jsonb) |
| Frecuencia          | Diaria (el catastro se actualiza a diario)                                                                                                                               |
| Licencia            | Datos públicos SERNAGEOMIN, uso referencial; la BD oficial del Depto. de Propiedad Minera prevalece                                                                      |
| Alcance del entorno | Alcanzable desde CI/servidores (Esri global). Los servidores `*.sernageomin.cl` (gob) pueden estar geobloqueados a IPs de datacenter                                     |

### Pipeline

`etl/sernageomin_concesiones.py` — idempotente y reejecutable:

- Registra/actualiza la fuente en `fuentes_datos`; abre y cierra `etl_corridas` (log).
- **Idempotencia:** hash del dataset (corrida `--all`) → si no cambió, `estado='sin_cambios'`.
  A nivel de registro, hash por concesión evita versiones espurias.
- **Versionado temporal:** al cambiar una concesión, cierra el registro anterior con
  `valid_to` e inserta uno nuevo (`valid_from`). Nunca UPDATE destructivo → historial
  auditable en `catastro_concesiones`.

Uso: `DATABASE_URL=… python etl/sernageomin_concesiones.py --all` (o `--bbox xmin ymin xmax ymax`).

## Pendientes (próximos pipelines de B2)

- **Concesiones históricas/extinguidas** (restricción de re-solicitud sobre superficie de
  exploración extinguida). Verificar si el FeatureServer expone estado histórico o requiere otra fuente.
- **Capas de restricción:** áreas protegidas (SNASPE/MMA), sitios prioritarios, derechos de
  agua (DGA), predios (SII/IDE) — una por pipeline, declarando ausencia si no se cargan.
