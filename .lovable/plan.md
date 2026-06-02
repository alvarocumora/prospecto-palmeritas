## KMZ profesional · Prospecto Tilama / Distrito Cuprífero Los Verdes

Entregable: un único archivo `.kmz` listo para Google Earth Pro / QGIS / ArcGIS, con leyenda, estilos por atributo, popups HTML completos y carpetas organizadas por capa temática.

### 1. Sincronización previa de catastro (SERNAGEOMIN)

Antes de generar el KMZ, lanzar la edge function `match-project-catastro` (radio 15 km) contra el proyecto Tilama (`7a499b02-...`). La función:
- consulta el FeatureServer de SERNAGEOMIN en el bbox del proyecto,
- hace upsert de polígonos vigentes a `cadastre_national`,
- intenta matchear cada `mining_concession` local (por ROL o nombre fuzzy) y guarda `metadata.matched_rol` + `geometry_geojson` en `mining_concessions`.

Si la edge function falla por timeout/red, se reintenta con radio 25 km. Las concesiones que no matcheen quedan como placemark en su centroide aproximado dentro del AOI, claramente etiquetadas "sin polígono oficial".

### 2. Contenido del KMZ

Estructura de carpetas dentro del KMZ:

```text
Distrito Cuprífero Los Verdes — Tilama
├── 00 · Resumen ejecutivo (overlay con leyenda + metadatos)
├── 01 · Concesiones mineras (15)
│   ├── Grupo Los Verdes (6: Alto LV 1/2/4/5 + LV 4-1-10 + LV 5-1-12)
│   ├── Norte (Chele Norte, Naranjo N/S, Cumbre Nevado)
│   └── Sur / Periféricas (Las Palmas, Las Trancas, Los Peumos, Lucas, Mandela)
├── 02 · Targets de exploración (108)
│   ├── Critical · High · Medium · Low (por priority)
├── 03 · Anomalías satelitales (45)
│   ├── Severidad high / medium / low (color por severity, tamaño por score)
├── 04 · Muestras rock (190)
│   ├── Cu alto (>1.5 %) · Cu medio (0.5–1.5 %) · Cu bajo (<0.5 %)
└── 05 · AOI y referencia (bbox del proyecto, escala, norte)
```

### 3. Estilos y simbología

- **Concesiones**: polígono relleno semi-transparente, color por `concession_type` (explotación = ámbar, exploración = celeste), borde 2 px. Etiqueta con nombre + ROL. Popup HTML con titular, hectáreas, estado, fecha constitución, link al expediente SERNAGEOMIN cuando esté en `metadata`.
- **Targets**: pin estilo "target" con color por prioridad (rojo / dorado / azul / gris). Popup con código, tipo, commodity, etapa, score, rationale y enlace al proyecto en la app.
- **Anomalías satelitales**: pin tipo donut, color por severidad (rojo / naranjo / verde), opacidad ∝ score. Popup con índice (NDVI/clay/iron), área, fecha de detección.
- **Muestras rock**: pin circular, color por ley de Cu (rojo >1.5 %, naranjo 0.5–1.5 %, amarillo <0.5 %). Popup con assay completo (Au, Ag, Cu, Mo, Pb, Zn, As, Sb, Hg) + zona + laboratorio.
- **Leyenda**: `ScreenOverlay` PNG anclado abajo-izquierda con todas las categorías.

### 4. Reproyección y datos crudos

- Muestras rock están en UTM 19S (EPSG:32719) → reproyectar a WGS84 (EPSG:4326) con `pyproj` antes de escribir el KML.
- Todas las geometrías del catastro vienen en WGS84 de SERNAGEOMIN, se usan tal cual.
- Targets y anomalías ya están en lat/lng WGS84.

### 5. Entregable

- Archivo `/mnt/documents/Tilama_LosVerdes_PROSPECTO_COMPLETO.kmz` mostrado al usuario vía `<presentation-artifact>`.
- Resumen de qué quedó dentro: cuántos polígonos reales del catastro se obtuvieron, cuántas concesiones quedaron como placemark, totales por capa.

### 6. Detalles técnicos

- Generación con `simplekml` + `pyproj` en `python` del sandbox.
- Datos extraídos con `psql` (lectura directa autorizada) sin pasar por la app.
- Edge function `match-project-catastro` ejecutada con `supabase--curl_edge_functions` (POST, body con `projectId`, `radiusKm: 15`, `dryRun: false`); si timeout, fallback a `dryRun: true` para no romper datos y se documenta en el resumen.
- No se cambia código de la app, no se modifican tablas (solo upsert que ya hace la edge function existente). Sin migraciones.