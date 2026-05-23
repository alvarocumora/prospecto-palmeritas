
# Plan — Plano Georref v1.3 con imagen satelital real + 3D fotorrealista

## Objetivo

Reemplazar los thumbnails sintéticos del PDF actual (`Plano_Georref_Modelo3D_LosVerdes_v1.2.pdf`) por **imágenes satelitales reales georreferenciadas** del distrito Los Verdes-Tilama y montar el plano del modelo 3D sobre esa base, con coherencia de coordenadas (UTM 19S), escala y grilla. Mejorar también el informe (capas, leyenda, metodología, fuentes).

## 1. Fuentes satelitales abiertas (sin API key obligatoria)

| Capa | Fuente | Acceso |
|---|---|---|
| RGB color real 10 m | **Sentinel-2 L2A** vía Microsoft Planetary Computer STAC (firma SAS pública) | STAC search + asset COG |
| RGB color real 10 m (fallback) | **Sentinel-2 L2A** vía AWS Open Data `s3://sentinel-cogs` | HTTPS COG público |
| Mosaico anual <1 m | **ESRI World Imagery** WMTS (tile service público) | XYZ tiles |
| Topo / hillshade | **Copernicus GLO-30 DEM** vía Planetary Computer | COG |
| SRTM 30 m (fallback DEM) | **OpenTopography** público | GeoTIFF |
| Geología regional | SERNAGEOMIN WMS Hoja Illapel | WMS |

## 2. Repos de referencia (open source) para pipeline imagen + 3D

- `microsoft/PlanetaryComputerExamples` — patrones STAC + signing + COG.
- `cogeotiff/rio-tiler` y `developmentseed/titiler` — recorte/render de COG a PNG georreferenciado.
- `mapbox/rasterio` + `pyproj` — reproyección WGS84 ↔ UTM 19S.
- `OpenDroneMap/ODM` — flujos foto→ortomosaico→DEM 3D.
- `CesiumGS/cesium` + `NASA-AMMOS/3DTilesRendererJS` — visualización 3D.
- `giswqs/leafmap` / `geemap` — ejemplos de mosaicos Sentinel.
- `nasa/pyGMT` y `pyvista/pyvista` — render 3D drape (raster sobre DEM) a PNG.

Estos repos sirven como guía para el script Python local; no se instalan como dependencias del proyecto Lovable.

## 3. Pipeline de generación (script Python en `/tmp`)

```text
1. AOI = bbox Los Verdes-Tilama (UTM 19S, ~10 x 8 km)
2. STAC search Sentinel-2 L2A (cloud_cover < 10 %, último año) → asset visual COG
3. rio-tiler.crop(bbox) → RGB PNG + sidecar PGW/.aux (georef)
4. Reproyección a EPSG:32719 (UTM 19S)
5. Composite por capa:
   - Página 1: RGB Sentinel + grilla UTM + escala + targets + collares DDH
   - Galería p.2: thumbnails RGB-real, DEM hillshade real, anomalía MAG sobre RGB,
                  targets sobre RGB, modelo 3D drape (PyVista render)
   - Mapa drill p.3: RGB Sentinel como basemap real + trazas DDH + secciones
6. Render 3D fotorrealista (PyVista): DEM Copernicus + drape RGB Sentinel + 
   targets extruidos + trazas DDH 3D → PNG (vista oblicua NW→SE)
7. Ensamble PDF A3 con ReportLab (4-5 páginas) + QR al visor 3D
```

## 4. Cambios en el PDF (v1.3)

- **Página 1 — Plano Georref:** basemap Sentinel-2 RGB real bajo grilla UTM, norte, escala gráfica, cartela con fuente/fecha de escena, datum WGS84/UTM 19S, leyenda con simbología real.
- **Página 2 — Galería de capas:** miniaturas con **imagen real**:
  1. Sentinel-2 RGB true color
  2. Sentinel-2 SWIR ratio (alteración hidrotermal)
  3. DEM Copernicus + hillshade
  4. Anomalía magnética EMAG2 drapeada sobre RGB
  5. Targets ranked sobre RGB
  6. Vista 3D fotorrealista (drape RGB sobre DEM)
  Cada una con QR al visor `/dashboard/3d-pro?layer=...`.
- **Página 3 — Plan de perforación:** mismo mapa pero con basemap Sentinel real en vez de fondo neutro.
- **Página 4 — Tabla DDH** (sin cambios estructurales).
- **Página 5 nueva — Metodología y fuentes:** STAC IDs de las escenas Sentinel usadas, fecha de adquisición, cloud cover, resolución, datum, software, hashes SHA-256, referencia a EMAG2v3 y Copernicus.

## 5. Mejoras de informe

- Cartela ISO 5457 (título, escala, datum, autor, fecha, versión, hoja n/N).
- Leyenda unificada con simbología consistente entre páginas.
- Texto resumen ejecutivo de 1 párrafo en página 1.
- Nota de licencia: Sentinel-2 (Copernicus, libre), EMAG2v3 (NOAA, libre), DEM Copernicus (ESA, libre).
- QR maestro al PDF actualizado + link corto.

## 6. Entregables

- `Plano_Georref_Modelo3D_LosVerdes_v1.3.pdf` (5 páginas, A3 landscape) en `/mnt/documents/`.
- Anexo: `scenes_metadata.json` con IDs STAC y checksums.
- QA visual obligatorio: render de cada página como JPG y revisión antes de entregar.

## 7. Riesgos y mitigación

- **STAC sin red en sandbox** → fallback a mosaico ESRI World Imagery XYZ (también público) o a una escena Sentinel cacheada vía AWS S3 público.
- **PyVista headless** → usar `pyvista.start_xvfb()` o renderer `osmesa`; si falla, fallback a drape 2.5D con matplotlib + hillshade.
- **Nubes en escena Sentinel** → seleccionar mejor escena del año (mínimo cloud_cover sobre AOI).

## 8. Notas técnicas

- Todo el trabajo es generación de artefacto en `/tmp` + salida a `/mnt/documents/`. No toca código de la app Lovable.
- Coordenadas de referencia: AOI ~ `lon [-71.30, -71.18]`, `lat [-32.13, -32.03]` (Los Verdes-Tilama).
- Proyección de salida: EPSG:32719 (WGS84 / UTM 19S).
- Datums declarados explícitamente en cartela y metadatos.

Confirma para pasar a build y generar `v1.3` con basemap satelital real y 3D fotorrealista.
