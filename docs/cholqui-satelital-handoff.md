# Handoff — capa satelital de Cholqui (real, DERIVADO)

Producido por el motor Nivel 0 (`geocapitals-remote`) con **lecturas reales de
Sentinel-2 L2A** (Planetary Computer STAC) sobre el AOI real de Cholqui. Reproducible:
`geocapitals-remote/configs/cholqui_aoi.yaml` + `scenes_manifest.json` + `config_sha256`.

## Archivo a consumir
`src/data/geo/cholqui_satellite_candidates.geojson` — FeatureCollection en **EPSG:4326
(CRS84, lon/lat)**, lista para Leaflet/MapLibre sin reproyectar.

- 15 anomalías Al-OH (razón SWIR B11/B12), rankeadas por z-score sobre fondo del AOI.
- `metadata.coverage`: **interpretable típico 40,4% / mejor caso 79,3%**, `spectral_conclusive: true`.

### Propiedades por feature
`rank, tipo, alteracion, index_code(aloh), z_score, percentil, gossan, fe_oxides, ferrous,
severidad(alta/media/baja), dentro_concesion(bool), procedencia("DERIVADO / INTERPRETADO — no
verificado en terreno"), sensor, disclaimer`.

## Render en `/live/cholqui` (CholquiGeologicalEvidenceMap)
- Capa conmutable "Anomalías satelitales" — **siempre bajo la etiqueta DERIVADO/CONTEXTO**, nunca VERIFICADO.
- Color por `severidad`: alta `#d1462f`, media `#e0a020`.
- Popup: rank, alteración, z-score, percentil, gossan, procedencia + disclaimer completo.
- Filtro sugerido: resaltar `dentro_concesion=true` (accionables) vs contexto regional.

## Guardas (obligatorias)
1. **CRS 4326** ya viene resuelto — no reproyectar a 32719 para el mapa.
2. **Procedencia DERIVADO** — estas anomalías NO son evidencia certificada, NO identifican
   mineral ni mineralización económica, y NO sustituyen mapeo de campo. El `disclaimer` va visible.

## Nota espacial (honestidad)
`dentro/fuera` se calculó contra las pertenencias de `franco_pertenencias.geojson`
(TOKI/PALLOCABE/DOS MARIAS): **3/15 dentro**. Si el proyecto incluye ESPERANZA/EUROPA u otras
concesiones que no están en ese archivo, **recalcular** contra el set completo. Las de fuera son
contexto regional (no se perfora fuera de la tenencia).

## Malla de sondajes propuesta (Fase 1 de Lovable)
Legítima **como propuesta interpretada**, nunca como dato:
- Derivarla de las anomalías `dentro_concesion=true` + estructura (rumbos N20E/N350E del config).
- Rotular cada collar "PROPUESTO" (no perforado), con la advertencia NI 43-101.
- Coordenadas = objetivos de diseño, no recurso. Provenance: INTERPRETADO.

## PDF / Technical Brief
En `buildCholquiDoc`: sección "Screening satelital Nivel 0" con el verdict de cobertura
(40,4/79,3%), tabla de anomalías (con procedencia por fila) y el disclaimer global. Reusar el
motor `geocapitals-docs` para el PDF con marca. La malla propuesta va en su propia sección
rotulada "Propuesta de campaña (interpretado)".

## Artefactos reproducibles (mi territorio)
`geocapitals-remote/out/cholqui/`: `coverage.json`, `sampling_candidates.geojson` (crudo),
`cholqui_satellite_candidates.geojson` (map-ready), `scenes_manifest.json` (escenas congeladas).
Config: `geocapitals-remote/configs/cholqui_aoi.yaml`. Regenerar:
`python -m gc_remote ... coverage/candidates configs/cholqui_aoi.yaml`.

## ACTUALIZACIÓN — datos regenerados en formato consumible + malla real

Tras ver que `getCholquiSatelliteTargets` lee de la tabla `satellite_anomalies` (origen no
verificado) y no de la capa real, regeneré ambas capas **en el esquema que ya consume Lovable**:

- `src/data/geo/cholqui_satellite_candidates.geojson` — 15 anomalías reales, ahora con
  `index_code` (CLAY_MINERALS / HYDROTHERMAL_ALTERATION), `score` 0-1, geometría **Polygon**
  (compatible con `polygonCentroid`), `severity`, `z_score`, `dentro_concesion`, procedencia.
- `src/data/geo/cholqui_drill_grid.geojson` — malla PROPUESTA (3 collares) derivada **solo de
  anomalías dentro de la tenencia conocida**, azimut 290° (perp. a N20E hacia el eje), dip -60°,
  con `este/norte` UTM19S, prioridad, objetivo y disclaimer NI 43-101.

### Cambio requerido en `/src` (Lovable)
1. En `satelliteTargets.functions.ts`: **cambiar la fuente** de la tabla `satellite_anomalies`
   al geojson real `src/data/geo/cholqui_satellite_candidates.geojson` (import estático). Así el
   panel, el `drillGrid` y el PDF ya construidos muestran **dato real**, sin cambiar su lógica.
2. **Borrar/marcar** las anomalías de `satellite_anomalies` para Cholqui (`project_id
   e5360f13...`) que no provengan de este pipeline: eran de origen no verificado.
3. En `drillGrid.ts`: **filtrar collares a los que caen dentro de las concesiones** (no proponer
   perforación fuera de la tenencia). Hoy propone hasta 8 sin ese filtro → con dato real y filtro,
   son 3 (o más si se cargan las concesiones ESPERANZA/EUROPA que faltan en el geojson).
