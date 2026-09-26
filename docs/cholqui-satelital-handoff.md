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
