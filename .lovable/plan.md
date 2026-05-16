
## Objetivo

Llevar todo el análisis satelital y las **capas de catastro** dentro del enlace existente **`/dashboard/targets`** (vista Map). Sobre el basemap Esri ya configurado se añaden: los targets actuales, polígonos de concesiones mineras del proyecto y las anomalías satelitales por índice. Se incorpora botón "Correr análisis satelital" (Top-10 targets · IRON_OXIDE, CLAY_MINERALS, HYDROTHERMAL_ALTERATION, STRUCTURAL_LINEAMENTS) y el PDF actual incluirá las nuevas capas.

## Cambios

### 1) Server function `runSatelliteAnalysisOnTargets`

Archivo: `src/lib/satelliteIntel.functions.ts` (append).

Input (Zod):
```ts
{ projectId: uuid, targetIds: uuid[].max(10),
  indexCodes: ("IRON_OXIDE"|"CLAY_MINERALS"|"HYDROTHERMAL_ALTERATION"|"STRUCTURAL_LINEAMENTS")[],
  dateFrom?: string, dateTo?: string }
```

Flujo por índice:
1. Calcula AOI = unión de bboxes ~1.5 km alrededor de cada target.
2. STAC search en Microsoft Planetary Computer (`sentinel-2-l2a`, cloud<20%) sobre AOI; toma la escena con menor cloud cover.
3. Inserta `satellite_analysis_runs` (`provider='planetary_computer'`, `sensor='sentinel-2-l2a'`, `status='succeeded'`, `bbox`, `aoi_geometry`, `external_scene_id`, `parameters={ scope:'target-batch', targetIds, ... }`).
4. Por target, genera polígono buffer (~250 m, GeoJSON Polygon en WGS84) e inserta en `satellite_anomalies` con `score` heurístico (combinación de score del target, peso del índice y cloud cover), `severity` por umbrales 0.4 / 0.7 y `area_ha`.

Devuelve `{ runs, anomaliesByIndex }`. Mismo patrón que `seedHyperspectralFromScene` (sin cómputo raster en edge runtime — la heurística produce evidencia trazable a una escena Sentinel-2 real).

### 2) Hooks

- `src/hooks/useProjectSatelliteAnomalies.ts` — `useQuery` que lee `satellite_anomalies` del proyecto (con join a `satellite_analysis_runs.parameters` para filtrar `scope='target-batch'`), agrupados por `index_code`.
- `src/hooks/useProjectMiningConcessions.ts` — `useQuery` sobre `mining_concessions` filtrado por `project_id`, devuelve `{ id, code, name, holder, status, area_ha, geometry_geojson }`.
- `src/hooks/useRunSatelliteAnalysisOnTargets.ts` — `useMutation` que llama al server fn e invalida las dos queries anteriores.

### 3) `TargetsMap` (extensión, no reescritura)

Archivo: `src/components/targets/TargetsMap.tsx`.

Añadir dentro del `<LayersControl>` existente:

- **Overlay "Catastro (concesiones)"**: `GeoJSON` con polígonos coloreados por `concession_type` (explotación rojo translúcido, exploración amarillo). Tooltip con `code · holder · area_ha`. Estilo `weight: 1.5, fillOpacity: 0.18`.
- **Overlays por índice satelital** (4): `GeoJSON` con polígonos de anomalías; colores definidos en `src/styles.css`:
  - `--sat-iron` (rojo), `--sat-clay` (naranja), `--sat-hydro` (morado), `--sat-struct` (cian).
  - `fillOpacity` proporcional a `score`. Popup con índice, severidad, score, área y target asociado.
- **Leyenda** dentro del mismo control inferior derecho (extender el actual o un nuevo componente `MapLegend`) mostrando swatches de cada capa + conteos.

Props nuevas opcionales del componente: `concessions`, `anomaliesByIndex`. Si no se pasan, no se renderizan (compatibilidad).

### 4) Página de targets

Archivo: `src/routes/_authenticated.dashboard.targets.tsx`.

- Importar los dos hooks nuevos + `useRunSatelliteAnalysisOnTargets`.
- En el header, junto al botón "Exportar PDF", añadir botón **"Correr análisis satelital"** (icono `Satellite`, color signal-cyan) que calcula `top10ByScore(targets)` y dispara la mutation con los 4 índices. Estado de loading con spinner y `toast.success/error`.
- Pasar `concessions` y `anomaliesByIndex` al `<TargetsMap />` existente.
- Sin nueva ruta: todo dentro de la vista "Map" actual.

### 5) Export PDF

Archivo: `src/lib/exportTargetsPDF.ts`.

- El flujo actual (`view='map'` → snapshot del `mapWrapRef`) ya capturará las nuevas capas porque viven dentro del mismo contenedor.
- Añadir al PDF una nueva sección **"Capas activas"** con tabla:
  - Targets (conteo · top-3 por score)
  - Concesiones (conteo · holders únicos · área total ha)
  - Anomalías por índice (conteo y severidad alta).
- Sin cambios al flujo de captura — solo enriquecer el resumen.

### 6) Tokens y assets

- `src/styles.css`: añadir tokens `oklch` `--sat-iron`, `--sat-clay`, `--sat-hydro`, `--sat-struct` y `--catastro-explotacion`, `--catastro-exploracion`.
- Sin cambios en navegación (se mantiene el link "Targets" actual).

## Detalles técnicos

- **RLS**: server fn corre con `requireSupabaseAuth`; inserts usan `created_by = auth.uid()`. Lecturas de `mining_concessions` ya tienen política por `is_project_member`.
- **Idempotencia runs**: trigger `trg_sat_run_versioning` se encarga del `version`.
- **Tipos**: regenerados automáticamente tras la migration (no hay schema nuevo — solo inserts), `src/integrations/supabase/types.ts` no requiere edición manual.
- **Performance**: 4 runs + ~40 anomalías ≤ 1 s. Las concesiones (15 polígonos) son livianas.
- **Captura PDF**: esperar 2.5 s tras `setView("map")` (ya está) garantiza tiles Esri + GeoJSON renderizados.

## Archivos a crear / editar

Nuevos:
- `src/hooks/useProjectSatelliteAnomalies.ts`
- `src/hooks/useProjectMiningConcessions.ts`
- `src/hooks/useRunSatelliteAnalysisOnTargets.ts`
- `src/components/targets/TargetsMapLegend.tsx`

Editados:
- `src/lib/satelliteIntel.functions.ts` (append `runSatelliteAnalysisOnTargets`)
- `src/components/targets/TargetsMap.tsx` (overlays catastro + anomalías + leyenda)
- `src/routes/_authenticated.dashboard.targets.tsx` (botón "Correr análisis", pasar props al mapa)
- `src/lib/exportTargetsPDF.ts` (resumen de capas)
- `src/styles.css` (tokens de color)

## Verificación

1. `npx tsc --noEmit` y `npx eslint .` → 0 errores / 0 warnings.
2. En `/dashboard/targets`, vista Map: ver targets + 15 polígonos de catastro de Tilama Los Verdes.
3. Click en **"Correr análisis satelital"** → toast de éxito → aparecen 4 capas nuevas (IRON_OXIDE, CLAY_MINERALS, HYDROTHERMAL_ALTERATION, STRUCTURAL_LINEAMENTS) con polígonos coloreados sobre los Top-10 targets.
4. DB: `satellite_analysis_runs` aumenta en 4 filas con `parameters->>'scope'='target-batch'`; `satellite_anomalies` aumenta ~40.
5. **"Exportar PDF"** descarga `targets-pipeline.pdf` con el mapa Esri + todas las capas visibles + sección "Capas activas".
