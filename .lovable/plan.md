

## Módulo de Geofísica + Mejora AOI

Implementación en 4 frentes — todos los seleccionados.

### 1. Overlays geofísicos reales en el mapa

Agregar al control de capas existente (junto a Macrostrat y Catastro):

- **Anomalía magnética total (EMAG2 v3)** — NOAA NCEI WMS público. Capa `EMAG2_V3_SeaLevel` desde `gs.ngdc.noaa.gov/geoserver/web-mercator/wms`. Resolución 2-arcmin (~3.7 km), apropiada para contexto regional/distrital.
- **Gravimetría Bouguer (WGM2012)** — BGI WMS `bgi.obs-mip.fr/.../wgm2012`. Anomalía Bouguer terrestre.
- **Hillshade SRTM** — opcional bonus, tile layer ya disponible vía `services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade`.

Ambos overlays con opacidad 50–60% y nota de escala en la leyenda ("contexto regional, no escala prospecto"). El usuario los activa desde el toggle de capas.

### 2. Tab "Geofísica" nuevo

Nueva pestaña en `TopNav` (ícono Radio o Waves). Componente `Geophysics()` con:

- **Plan de adquisición** — tabla de 3 campañas planificadas para epitermal Au-Cu de baja sulfuración:
  - Magnetometría terrestre: 12 km lineales, 25 m espaciado, costo ~USD 8k
  - IP-Resistividad dipolo-dipolo: 6 km líneas, a=50m n=1–6, costo ~USD 45k
  - CSAMT: 2 km líneas, 10 estaciones, profundidad 800m, costo ~USD 30k
- **Tabla método → firma esperada** sobre vetas N20°W subverticales (alteración argílica → bajo magnético; sulfuros → alta cargabilidad; sílice → alta resistividad).
- **Mapa de líneas planificadas** — render de las polylines IP/Mag/CSAMT sobre el mapa principal (mismo Leaflet).
- **Bibliografía**: Hedenquist et al. 2000, Sillitoe 2010, Corbett & Leach 1998, Irvine & Smith 1990 (geofísica epitermal).

### 3. Tablas Supabase (nuevas)

```text
geophysics_surveys    — campaña: id, name, method, status, planned_km, cost_usd
geophysics_lines      — id, survey_id, line_id, geometry_geojson, length_m
geophysics_stations   — id, survey_id, lat, lng, station_id,
                        mag_nt, ip_chargeability_mvv, ip_resistivity_ohmm,
                        is_synthetic (bool), notes
```

RLS: `Public can view`, `Authenticated owner can CRUD` (igual patrón que `lithology_units`). Seed con ~40 estaciones magnéticas sintéticas pero coherentes (anomalía baja sobre traza de vetas argílicas, alta en bordes con magnetita preservada) y 2 líneas IP cruzando vetas.

Hook `useGeophysicsData()` análogo a `useGeologyData()`.

### 4. Mejora: filtro AOI con turf.js

- Agregar `@turf/turf` (ESM, ~150KB, edge-compat).
- Reemplazar `aoi.geojson` Point por un Polygon AOI real (~1.5 km × 1.2 km centrado en el centroide actual).
- En `exportCatastroPdf`: para cada feature calcular `turf.booleanIntersects(feature, aoiPolygon)` y `turf.distance(centroid(feature), aoiCentroid)`.
- Nueva columna **"Dist (km)"** + nueva sección al inicio del PDF: **"Pertenencias que intersectan AOI"** (subset destacado).
- En el mapa: pertenencias intersectantes con borde más grueso (weight 4).

### Arquitectura

```text
src/components/map/
  geophysicsOverlays.ts     ← EMAG2 + WGM2012 + Hillshade WMS
  geophysicsLayers.ts        ← render líneas/estaciones desde Supabase
  exportCatastroPdf.ts       ← +turf intersection + distancia
src/data/geo/
  aoi.geojson                ← Point → Polygon
src/hooks/
  useGeophysicsData.ts       ← surveys/lines/stations
src/routes/index.tsx
  + tab "geophysics"
  + Geophysics() module
supabase/migrations/
  geophysics_tables.sql      ← 3 tablas + RLS + seed sintético
```

### Notas técnicas

- WMS de NOAA/BGI funcionan vía Leaflet `L.tileLayer.wms()`, sin API key.
- Datos sintéticos llevan flag `is_synthetic=true` y badge visible "SIMULADO" en UI — nunca se confunden con datos reales medidos.
- turf.js es pure-JS, compatible Worker SSR.
- El tab se renderiza solo client-side (mapa Leaflet ya lo es).

