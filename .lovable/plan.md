
# Plan: Visor 3D Minero Disruptivo (Geocapitals v5)

Objetivo: reemplazar el visor Plotly actual por una experiencia 3D minera de nivel "Awwwards + industria", combinando datasets gratuitos globales con modelado geológico implícito y capas satelitales con anomalías magnéticas marcadas como targets.

## 1. Stack base (frontend 3D)

Reemplazo del visor Plotly por **CesiumJS + Resium** (React bindings) como motor principal:

- Globo 3D real con terreno (Cesium World Terrain o **Copernicus GLO-30 DEM** vía Cesium Ion gratis con cuenta).
- Imagery satelital: **ESRI World Imagery**, **Sentinel-2 L2A** (Microsoft Planetary Computer STAC, gratis) y **MapTiler/MapLibre** como fallback.
- Overlays vectoriales (vetas, fallas, targets) en **GeoJSON 3D** con extrusión por profundidad.
- Capa subterránea: `Cesium.Primitive` + `GeometryInstance` para sólidos 3D (vetas, intrusivos, anomalías magnéticas a profundidad).
- Repos de referencia que copiaremos patrones:
  - `Gaia3D/MineMonitor3D` (monitoreo de mina abierta sobre Cesium).
  - `kurtlawrence/dirtvz` (renderizado web 3D para minería, Rust+WASM).
  - `reearth/reearth-visualizer` (plataforma WebGIS Cesium completa, Apache-2.0).
  - `NOC-OI/zarr-cesium` (Zarr/COG sobre Cesium — ideal para grids magnéticos).
  - `darkmine-oss/baselode` (toolkit exploración minera, GPL).

## 2. Datasets libres a integrar

| Capa | Fuente | Acceso |
|---|---|---|
| Terreno DEM 30 m | Copernicus GLO-30 (Planetary Computer / OpenTopography) | STAC + COG |
| Satelital RGB / NDVI / ratios alteración | Sentinel-2 L2A (PC STAC) | STAC firmado |
| Anomalía magnética global | **EMAG2 v3** NOAA NCEI (2 arc-min) | GeoTIFF + WMS ArcGIS REST |
| Gravedad | WGM2012 BGI | GeoTIFF |
| Geología regional Chile | SERNAGEOMIN WMS Hoja Illapel | WMS |
| Catastro minero | SERNAGEOMIN catastro WFS | WFS GeoJSON |
| Sísmica histórica | USGS Earthquake API | REST JSON |

EMAG2 v3 nos permite mostrar la anomalía magnética real del sector Tilama (no sintética) y marcar máximos locales como targets.

## 3. Modelado geológico 3D real

Sustituir las vetas dibujadas a mano por un modelo implícito:

- **GemPy 2025** o **LoopStructural** (Python, MIT) en un job server-side para generar el modelo 3D desde puntos de superficie + orientaciones.
- Salida en **`.glb` / `.gltf`** (vía `pyvista` → `trimesh`) que Cesium carga como `Cesium3DTileset` o `Model`.
- Anomalías magnéticas convertidas a **isosuperficies 3D** (scikit-image marching cubes) y exportadas a glTF para superponerlas a profundidad.

## 4. Pipeline de datos (backend Lovable Cloud)

Server functions TanStack (`createServerFn`) nuevas:

1. `fetchMagAnomaly(bbox)` → descarga subset EMAG2 desde el ImageServer NOAA, recorta y devuelve COG + estadísticos (max, σ, percentiles).
2. `detectMagTargets(bbox, threshold)` → corre detección de máximos locales (scipy `peak_local_max`) y devuelve puntos GeoJSON con rank + magnitud.
3. `fetchSentinelTile(bbox, date)` → STAC search en Planetary Computer, firma asset y devuelve URL COG.
4. `buildGeologyModel(projectId)` → GemPy/LoopStructural genera glTF y lo sube a Storage.
5. `getSernageominLayers(bbox)` → WMS/WFS proxy con cache en `geo_cache` table.

Tablas nuevas: `mag_targets`, `geology_models`, `satellite_scenes`, `geo_cache`.

## 5. Módulos UI

- `/dashboard/3d-pro` — visor Cesium full-screen con panel de capas:
  - Toggle: Satélite, NDVI, Alteración (SWIR ratios), DEM hillshade, Magnetismo, Gravedad, Geología SERNAGEOMIN, Catastro, Vetas, Targets, Modelo geológico 3D, Cross-section.
  - Slider de profundidad (drape de magnetismo a 0/500/1000/2000 m).
  - Time slider para Sentinel-2.
  - Click en anomalía → popup con valor nT, rank, recomendación IA.
- `/dashboard/3d-pro/cross-section` — corte vertical interactivo a lo largo de polilínea dibujada.
- `/dashboard/3d-pro/ai-copilot` — chat Lovable AI (gemini-2.5-pro) con contexto del modelo 3D + anomalías visibles.

## 6. Fases de entrega

```text
Fase 1 (Sprint 1, ~2 días)
  - Instalar cesium + resium, montar /dashboard/3d-pro vacío con terreno + ESRI.
  - Server fn fetchMagAnomaly (EMAG2) + capa raster sobre Cesium.
  - Detección targets + marcadores 3D.

Fase 2 (Sprint 2)
  - Sentinel-2 STAC + ratios alteración (Kaufmann, Sabins).
  - SERNAGEOMIN WMS + catastro WFS como overlays.
  - Panel de capas con opacidad y slider de profundidad.

Fase 3 (Sprint 3)
  - Pipeline GemPy/LoopStructural → glTF en Storage.
  - Carga del modelo subterráneo + cross-section dibujable.
  - Export del visor a PDF NI 43-101 (snapshot + link QR).

Fase 4 (Sprint 4)
  - AI copilot geológico con contexto espacial.
  - Fusion score (mag + alteración + estructura) → ranking automático de targets.
  - Compartir vista vía URL firmada (token) para inversores.
```

## 7. Detalles técnicos clave

- Cesium Ion token como secret `CESIUM_ION_TOKEN` (free tier: 5 GB + terreno mundial).
- Planetary Computer no requiere API key para search; el `sign()` se hace server-side con `planetary-computer` (Python) o llamada REST a `/sas/sign`.
- EMAG2 vía `https://gis.ngdc.noaa.gov/arcgis/rest/services/EMAG2v3/ImageServer/exportImage` (parámetros bbox + bboxSR=4326 + format=tiff) — sin auth.
- GemPy se ejecuta en un job Python externo (Lovable Cloud workers no soportan binarios pesados); usar **Modal.com** o **Fly Machines** como runner gratuito y guardar el glTF en Storage. Alternativa puramente JS: `geomodel-js` o resampling propio.
- Todos los rasters servidos como **COG** y leídos en Cesium con `zarr-cesium` o `CesiumGS/3d-tiles` pipeline.

## 8. Riesgos y mitigación

- **GemPy requiere Python pesado**: usar runner externo, no Worker. Si bloquea, MVP con isosuperficies de EMAG2 + vetas vectoriales (sin GemPy) ya entrega 80 % del valor.
- **Cesium bundle grande (~3 MB gz)**: code-split en ruta `/dashboard/3d-pro` con `lazy()`.
- **CORS de NOAA/SERNAGEOMIN**: proxy server-side obligatorio.
- **Cesium Ion free tier**: si se supera, fallback a Cesium Terrain Provider de OpenTopography.

## 9. Entregables verificables

- Ruta `/dashboard/3d-pro` funcional con al menos: terreno + satélite + EMAG2 + targets magnéticos del distrito Los Verdes-Tilama.
- Tabla `mag_targets` con ≥ 5 anomalías reales detectadas vía EMAG2.
- PDF NI 43-101 v5 con snapshot del visor y QR al enlace 3D público.

---

Confírmame si avanzo con la **Fase 1** (Cesium + Resium + EMAG2 + targets reales) ya en el siguiente turno, o si prefieres que empiece por otra fase / ajuste el alcance (p. ej. saltarme GemPy y quedarme con isosuperficies puras).
