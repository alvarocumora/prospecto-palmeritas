
User reports that the geology overlays on the map don't show real information about the project. They want real data layers and ask for free Chilean geophysics or satellite APIs/repositories.

Let me investigate what's currently rendered and what's available.

Currently in the map:
- **Macrostrat** (`overlays.ts`): Global geology tiles. Works but very coarse for Chile — Macrostrat has limited Chilean coverage at prospect scale. The popup uses Macrostrat REST API which returns mostly NULL for most of Chile outside major mapped zones.
- **EMAG2 v3** (NOAA): Magnetic anomaly at ~3.7 km resolution → useless at prospect scale.
- **WGM2012** (BGI): Bouguer gravity, regional only.
- **Hillshade** (Esri SRTM): Works.
- **Catastro Minero SERNAGEOMIN**: Works (real, ArcGIS REST).

The user is right: at the Palmeras prospect scale (~1.5×1.2 km AOI in Alhué), Macrostrat returns nothing meaningful and EMAG2/WGM2012 are regional grids that look like flat color over the AOI.

## Free / public Chilean & global sources that DO work at prospect scale

**Chilean official:**
1. **SERNAGEOMIN — Mapas Geológicos** (already partially used for catastro). They publish:
   - **Carta Geológica de Chile 1:1.000.000** as WMS via their public IDE: `https://catastro.sernageomin.cl/arcgis/services/...` — has real lithology polygons for ALL Chile.
   - **GEOQUIMICA** — geochemical sampling layer.
   - **Yacimientos y Faenas Mineras** — known deposits/mines (point layer).
2. **IDE Chile (Infraestructura de Datos Geoespaciales)** — `https://www.ide.cl` — central hub of WMS/WFS endpoints from Chilean ministries.
3. **CONAF / MMA** — protected areas, environmental sensitivity (relevant for HSE module).
4. **Dirección General de Aguas (DGA)** — water rights, hydrology.

**Global, high-resolution, free, no API key:**
5. **USGS Earth Explorer / Sentinel Hub WMS** — Sentinel-2 multispectral (10 m), useful for alteration mapping (band ratios for clay/iron oxides — classic for porphyry/epithermal targets in Chile).
6. **Copernicus DEM (GLO-30)** — 30 m elevation, much better than SRTM in Andes; available as WMS via Sentinel Hub or AWS Open Data.
7. **NASA SRTM 30m** + **ASTER GDEM** — already partially used.
8. **OpenTopography** — free DEMs and slope/aspect derivatives.
9. **EarthData NASA — ASTER mineral indices** — global aluminum-OH, iron oxide, ferric iron indices (perfect for hydrothermal alteration zones).

**Geophysics specifically for Chile:**
10. **IRIS / GFZ Potsdam** — global gravity & magnetic grids (similar to EMAG/WGM, regional only).
11. **WGM2012** — already used.
12. For prospect scale, real geophysics requires *local surveys* (already covered by the project's own `geophysics_surveys` table). No free public source has prospect-scale geophysics for private exploration ground in Chile.

## Proposed approach (Fase 7 — Capas Geocientíficas Reales)

### Sprint A: Capas oficiales de Chile (reemplazar Macrostrat con datos chilenos reales)
1. **SERNAGEOMIN Geología 1:1M (WMS)** — replaces Macrostrat as primary geology layer. Real lithology with Chilean stratigraphy.
2. **SERNAGEOMIN Yacimientos & Faenas** — point layer of known deposits near AOI (powerful context: "your prospect is X km from El Teniente").
3. **IDE Chile — Áreas protegidas (CONAF/SNASPE)** — environmental constraint layer (ties to HSE).
4. **DGA — Derechos de agua** (optional, often heavy WMS).

### Sprint B: Capas satelitales / DEM modernas (reemplazar EMAG2/WGM2012 a escala prospecto)
5. **Copernicus Sentinel-2 (true color + alteración)** via free Sentinel Hub WMS — visual + band ratios B11/B12 (clay) y B4/B2 (iron oxide).
6. **Copernicus DEM GLO-30** — better hillshade & contour lines for Andes.
7. **ASTER mineral indices** (NASA EarthData WMS if available) — global hydrothermal alteration map.

### Sprint C: Inspector enriquecido
8. **Click anywhere → multi-source popup** showing:
   - Lithology from SERNAGEOMIN WMS GetFeatureInfo
   - Elevation from Copernicus DEM
   - Distance to nearest known mine (from SERNAGEOMIN Yacimientos)
   - Sentinel-2 NDVI/alteration value
9. Replace current `wireMacrostratClickPopup` with a unified `wireGeoIntelClickPopup`.

### Sprint D: Capa de targets propios sobre las capas reales
10. Render `exploration_targets` (Fase 2) as a layer on the map with priority color-coding, so users see their prospects ON TOP of real geological context.

## Files to touch

- `src/components/map/overlays.ts` — replace Macrostrat with SERNAGEOMIN WMS (keep Macrostrat as fallback toggle).
- `src/components/map/geophysicsOverlays.ts` — keep EMAG2/WGM2012 but rename "regional", add Sentinel-2 + Copernicus DEM layers.
- **NEW** `src/components/map/sernageominLayers.ts` — WMS configs for Geología 1:1M, Yacimientos, Faenas.
- **NEW** `src/components/map/satelliteLayers.ts` — Sentinel-2 true color, alteration ratios, Copernicus DEM hillshade.
- **NEW** `src/components/map/targetsLayer.ts` — render exploration_targets as map layer.
- `src/components/ProjectMap.tsx` — wire new layers into `LayerOpacityPanel`, group as "Geología Chile", "Satelital", "Targets".
- `src/components/map/overlays.ts` (`wireMacrostratClickPopup` → `wireGeoIntelClickPopup`) — multi-source feature info on click.

## Sources / endpoints I'll wire (all free, no API key required)

```text
SERNAGEOMIN WMS (público):
  https://catastro.sernageomin.cl/arcgis/services/Geologia/Geologia_Base_1M/MapServer/WMSServer

SERNAGEOMIN Yacimientos:
  https://catastro.sernageomin.cl/arcgis/services/Mineria/Yacimientos/MapServer/WMSServer

CONAF / SNASPE (Áreas protegidas):
  https://ide.mma.gob.cl/geoserver/wms

Sentinel-2 (true color, sin API key, vía EOX):
  https://tiles.maps.eox.at/wms?service=wms&request=GetMap&layers=s2cloudless-2024_3857

Copernicus DEM hillshade (vía AWS Open Data tile pyramid de Mapbox-Terrain o ESRI World Elevation):
  https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer (already used)
  + nuevo overlay de elevación coloreada
```

> Caveat: some Chilean WMS endpoints occasionally require CORS workarounds. Sprint A will validate each endpoint live; if any returns CORS errors, I'll proxy through a TanStack server route.

## Sprint sequence proposed

I propose doing **Sprint A + Sprint B in this turn** (high impact, real Chilean data + satellite alteration), then Sprint C + D in the next turn.

### Out of scope (this plan)
- Building our own tile server / caching (would need storage bucket).
- Paid premium layers (Sentinel Hub paid tier, Planet, Maxar).
- Editing the geology tables in the DB (those are project-internal records, separate from public reference layers).

### Diagram of new layer panel

```text
Layer Panel
├── Basemap (OSM / Satellite / Topo)
├── Geología Chile (NEW)
│   ├── SERNAGEOMIN 1:1M (WMS oficial)
│   ├── Yacimientos conocidos (puntos)
│   └── Macrostrat (global, fallback)
├── Satelital (NEW)
│   ├── Sentinel-2 true color (10m)
│   ├── Alteración arcillosa B11/B12
│   ├── Óxidos de hierro B4/B2
│   └── Copernicus DEM hillshade
├── Geofísica
│   ├── EMAG2 (regional ~3.7km) ← marcado como "regional"
│   ├── WGM2012 Bouguer (regional)
│   └── [tu survey real del proyecto]
├── Catastro SERNAGEOMIN (existing)
└── Proyecto
    ├── AOI / vetas / sondajes / muestras
    └── Targets pipeline (NEW, conectado a Fase 2)
```
