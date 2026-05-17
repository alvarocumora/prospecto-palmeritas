## Objetivo

Reemplazar los polígonos/cuadrados semi-transparentes actuales de las anomalías satelitales en `/dashboard/targets` por un **mapa de calor (heatmap) continuo tipo Sentinel/ASTER** —similar a las figuras del Pre-NI 43-101— sobreimpreso al basemap Esri World Imagery.

## Diagnóstico del estado actual

- En `src/components/targets/TargetsMap.tsx` (líneas 558-607) cada anomalía se pinta como **GeoJSON polígono** (o punto) con `fillOpacity ~0.15-0.55`. Resultado en mobile: cuadrados translúcidos amontonados sin gradiente, ilegibles cuando hay 40+ features.
- El screenshot del usuario (`IMG_0999.png`) confirma el ruido visual: óxidos, arcillas, hidrotermal y lineamientos compiten encima del satelital.
- El target visual deseado (`IMG_0689-2.png`) es un **kernel suave con colormap por índice** (rojo Fe, naranja arcilla, magenta hidrotermal, cian estructural), con barra de escala 0-1.

## Plan (Sprint 1 — visual, sin tocar backend)

### 1. Dependencia
- `bun add leaflet.heat` + `bun add -d @types/leaflet.heat` (o tipos locales). Es el plugin estándar Leaflet para heatmaps gaussianos, ~3 KB, sin SSR (cargar dentro del `ClientOnly`/lazy ya existente).

### 2. Nuevo componente `SatelliteHeatLayer.tsx`
- Recibe `anomaliesByIndex` + `indexCode` + `visible`.
- Convierte cada `AnomalyRow` a puntos pesados:
  - Si `geometry.type === 'Point'` → 1 punto con peso = `score`.
  - Si polígono → calcula centroide (turf ya está disponible o usamos una util mínima) + ~6-10 puntos jittered dentro del bbox proporcional al `area_ha` y al `score`, para que el kernel rellene el halo.
- Crea `L.heatLayer(points, { radius, blur, maxZoom, max: 1, gradient })` con **gradiente por índice**:
  - IRON_OXIDE: `{0.2:'#fde68a', 0.5:'#f59e0b', 0.8:'#dc2626', 1:'#7f1d1d'}`
  - CLAY_MINERALS: amarillo→naranja→marrón
  - HYDROTHERMAL_ALTERATION: lavanda→magenta→violeta oscuro
  - STRUCTURAL_LINEAMENTS: se mantiene como líneas (no heatmap), ya que es lineal.
- Escala dinámica: `radius = 18 + zoomDelta * 4`, `blur = 22`. Se reescala en evento `zoomend`.

### 3. Integración en `TargetsMap.tsx`
- Reemplazar el bloque `anomaliesByIndex && (Object.keys(INDEX_META)...)` de líneas 558-607.
- Para los 3 índices raster (Fe, arcillas, hidrotermal): renderizar `<SatelliteHeatLayer />` dentro de `LayersControl.Overlay checked`.
- Para `STRUCTURAL_LINEAMENTS`: mantener `GeoJSON` actual pero con `weight: 2.4` y `dashArray: '4 3'` para que se lean encima del calor.
- Añadir un toggle global "Mostrar como capas" (debug) que vuelva al render polígonos antiguo —retención para QA, oculto por default detrás de un `?debug=heat` query param. (opcional, podemos saltarlo).

### 4. Leyenda y escala
- Actualizar `TargetsMapLegend.tsx`: además del conteo, dibujar una mini-barra de gradiente (4 stops) por índice usando un `<div style="background:linear-gradient(...)">` que coincida con el gradient del heat. Texto: "score 0 → 1".
- Mostrar nota: "Kernel gaussiano 20 m · datos Sentinel-2 / ASTER".

### 5. Performance
- Memoizar la lista de puntos por índice con `useMemo([anomaliesByIndex, indexCode])`.
- Usar `whenReady` para añadir/quitar la capa imperativa en vez de re-render React por zoom.
- Cap a 5000 puntos por índice (más que suficiente: hoy hay ~11 por índice).

### 6. Persistencia mobile
- En viewport <640px: reducir `radius` a 14 y `blur` a 18 para que cada cluster se distinga (el screenshot del user es 440 px).
- El control de capas Leaflet ya permite togglear cada índice individualmente.

## Fuera de alcance (Sprint 2, futuro)

- Generar **rasters reales** desde el server (COG con `gdal_rasterize` del polígono pesado) para drape sobre el DEM en `Geology3DViewer`. Hoy solo mejoramos la 2D.
- Pintar el heatmap también en `share.targets.$projectId.tsx` (público) — fácil después, mismo componente.
- Slider de threshold "mostrar solo score ≥ X".

## Detalles técnicos

```text
TargetsMap
 ├─ MapContainer (Esri WorldImagery)
 │   ├─ LayersControl
 │   │   ├─ Overlay "Sat · Óxido de Fe"        → SatelliteHeatLayer(IRON_OXIDE)
 │   │   ├─ Overlay "Sat · Arcillas"           → SatelliteHeatLayer(CLAY_MINERALS)
 │   │   ├─ Overlay "Sat · Alt. hidrotermal"   → SatelliteHeatLayer(HYDROTHERMAL_ALTERATION)
 │   │   └─ Overlay "Sat · Lineamientos"       → GeoJSON líneas (sin heat)
 │   └─ CircleMarkers de targets (sin cambios)
 └─ TargetsMapLegend (con barras de gradiente)
```

Archivos a tocar:
- `src/components/targets/SatelliteHeatLayer.tsx` *(nuevo)*
- `src/components/targets/TargetsMap.tsx` *(reemplazar bloque anomalías)*
- `src/components/targets/TargetsMapLegend.tsx` *(añadir mini-barras gradiente)*
- `package.json` *(añadir leaflet.heat)*

Sin migraciones, sin tocar server functions. Una vez aprobado, lo implemento y verificás en preview.
