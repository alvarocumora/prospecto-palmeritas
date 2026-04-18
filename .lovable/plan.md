

## Validación de cambios y plan de compilación

### Estado actual de los módulos

**Implementados correctamente:**
- `src/components/Geophysics.tsx` — tab nuevo con plan de adquisición, firmas esperadas, estaciones simuladas, bibliografía.
- `src/hooks/useGeophysicsData.ts` — fetch de `geophysics_surveys/lines/stations` desde Supabase.
- `src/components/map/geophysicsOverlays.ts` — WMS EMAG2 + WGM2012 + Hillshade Esri.
- `src/components/map/geophysicsLayers.ts` — render de líneas (polylines dasheadas) y estaciones (circleMarkers escalados por nT).
- `src/components/map/aoiPolygon.ts` — carga del polígono AOI cacheado.
- `src/data/geo/aoi.geojson` — ahora contiene Polygon ~1.5×1.2 km además del centroide.
- `supabase/migrations/2026...geophysics_tables.sql` — 3 tablas + RLS + seed sintético.
- `src/components/map/exportCatastroPdf.ts` — usa `@turf/turf` para `booleanIntersects` + `distance` al centroide AOI; agrega columna **Dist (km)** y sección destacada de intersecciones.
- `src/components/ProjectMap.tsx` — integra `aoiRef`, `geophysicsLayerRef`, overlays geofísicos en el control de capas.
- `src/routes/index.tsx` — tab `geophysics` registrado en `TopNav`.

**Dependencias instaladas y verificadas:**
- `@turf/turf ^7.3.4`, `jspdf ^4.2.1`, `jspdf-autotable ^5.0.7`, `leaflet ^1.9.4`, `react-leaflet ^5.0.0`.

### Problema detectado

Hay un error de runtime activo: **"Importing a module script failed"** (UNHANDLED_PROMISE_REJECTION).

Causa más probable: `import * as turf from "@turf/turf"` en `exportCatastroPdf.ts` arrastra el barrel completo de Turf (~150KB+ con muchos sub-paquetes ESM) y, al importarse a nivel top de un módulo que se carga junto al resto del bundle del mapa, dispara un fallo de carga del chunk en el preview SSR/edge. El módulo PDF solo se necesita cuando el usuario hace clic en "⇩ PDF pertenencias", no en el render inicial.

### Plan de compilación / fixes

**1. Lazy-load del módulo PDF (fix runtime error)**

En `src/components/ProjectMap.tsx`, reemplazar:
```ts
import { exportCatastroPdf } from "./map/exportCatastroPdf";
```
por un dynamic import dentro del handler del botón:
```ts
const { exportCatastroPdf } = await import("./map/exportCatastroPdf");
```
Esto saca `jspdf` + `jspdf-autotable` + `@turf/turf` del bundle inicial → arregla el "module script failed" y mejora TTI.

**2. Imports finos de Turf (reducir peso ~80%)**

En `exportCatastroPdf.ts`, cambiar barrel por sub-paquetes:
```ts
import booleanIntersects from "@turf/boolean-intersects";
import distance from "@turf/distance";
import centroid from "@turf/centroid";
```
Los sub-paquetes ya vienen como deps transitivas de `@turf/turf`, no requiere instalación adicional.

**3. Verificación post-fix**

- Recargar preview → confirmar que no aparece el error de runtime.
- Abrir tab **Geophysics** → tabla de campañas carga (3 filas), bibliografía visible.
- En el mapa → toggle de capas muestra "Magnetometría EMAG2", "Gravimetría Bouguer WGM2012", "Hillshade SRTM"; activar al menos uno y confirmar tiles.
- Click en "⇩ PDF pertenencias" → descarga PDF con sección "Pertenencias que intersectan AOI" + columna Dist (km).
- Verificar que las estaciones magnéticas aparecen como círculos rojos/azules sobre el mapa (overlay activo por defecto).

**4. Validación Supabase (read-only check)**

Correr `SELECT count(*) FROM geophysics_surveys/lines/stations` para confirmar seed (3 / 2+ / ~40 filas) y `supabase--linter` para detectar policies faltantes en las nuevas tablas.

### Alcance

Solo dos archivos editados (`ProjectMap.tsx`, `exportCatastroPdf.ts`). Sin cambios de schema ni de UI. Riesgo bajo; el cambio es puramente de bundling.

