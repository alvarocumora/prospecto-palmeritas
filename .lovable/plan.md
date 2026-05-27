
# Visor 3D Los Verdes — Coherencia + herramientas reales

## Diagnóstico del visor actual

`src/components/live/LosVerdesScene3D.tsx` usa MapLibre + DEM Terrarium + Esri Imagery con seis capas (SAT extruidas, lineamientos, mag, targets, vetas, fases del plan), toggles, filtro por commodity, popups y bus `losverdes:focus`. Sin embargo la **proyección 3D no es geológicamente coherente** y **no hay herramientas reales** (medición, perfil, dibujo, coordenadas).

### Problemas de proyección 3D
1. **Anomalías SAT**: `fill-extrusion-base = 0`. Con terreno exagerado 1.6×, los prismas atraviesan/quedan flotando sobre el DEM en vez de "salir" de la superficie.
2. **Fases del plan minero**: se extruyen *hacia arriba* `avg_thickness_m * 3` desde base 0 → aparecen como montañas, no como pit ni cuerpo subterráneo.
3. **Vetas**: sólo son `LineString` drapeadas. Faltan los planos inclinados reales (strike + dip + profundidad top/bottom + potencia) que ya están en la tabla `veins`.
4. **Lineamientos y mag**: OK como están (drape + halo 2.5D).

### Herramientas que faltan vs estándar industria
Medición (distancia/área), perfil de elevación, dibujo de AOI/vetas ad-hoc, lectura de coordenadas + cota bajo cursor, fullscreen, reset de bearing/pitch, bookmarks de cámara, búsqueda por código y sección transversal.

## Fase 1 — Coherencia 3D (sin nuevas deps)

Archivo: `src/components/live/LosVerdesScene3D.tsx` + nuevo helper `src/lib/losverdes-geometry.ts`.

1. **Anomalías SAT pegadas al terreno**: tras `map.on("load")`, para cada feature calcular `baseElev = map.queryTerrainElevation(centroid)`; escribir esa cota en la propiedad `base` y usar `"fill-extrusion-base": ["get", "base"]`, `"fill-extrusion-height": ["+", ["get","base"], ["get","height"]]`. Re-query cuando termine de cargar DEM (`"sourcedata"` para `terrain`).
2. **Fases del plan**:
   - `open_pit` → extruir *hacia abajo*: base = terrain elev, top = terrain elev − `avg_thickness_m` (usando expresión `+ base, height` con `height` negativo no es soportado; en su lugar pintamos polígono semi-transparente al nivel del pit y un anillo `line` rojo de borde + cuerpo subterráneo como `phases-body` con base/height bajo terreno).
   - `underground` → caja `fill-extrusion` con base = terrain − `depth_top_m`, height = espesor.
   - `heap_leach` → prisma sobre terreno (extrude arriba con base anclada).
3. **Vetas como planos 3D**: `losverdes-geometry.ts` genera, por cada veta, un polígono cuadrilátero proyectando la traza superficial hacia profundidad según `strike_deg`, `dip_deg`, `dip_dir_deg`, `depth_top_m`, `depth_bottom_m`, `thickness_m`. Capa nueva `veins-plane` (`fill-extrusion` o `fill` con altura desde DEM) coloreada por commodity. Mantener la línea superficial actual.
4. **Exageración configurable**: slider `1×/1.5×/2×` que llama `map.setTerrain({ source, exaggeration })`. Coherente con la escala vertical real.

## Fase 2 — Herramientas reales

### 2.1 Medición, perfil y dibujo (dep nueva)
`bun add @watergis/maplibre-gl-terradraw` — añade `MaplibreMeasureControl` (distancia + área con unidades, lee elevación del `raster-dem` que ya tenemos) y `MaplibreTerradrawControl` (dibujo de point/line/polygon/rectangle/circle/freehand). Botones tipo "Medir" y "Dibujar AOI" en el panel del visor.

### 2.2 Controles nativos MapLibre (sin dep)
- `FullscreenControl`, `GeolocateControl` (campo).
- Botón "Reset cámara" → `easeTo({ bearing:-25, pitch:62, zoom:12.5 })`.
- Readout flotante con `lat/lng/cota` actualizando en `mousemove` (usa `queryTerrainElevation`).
- Bookmarks: guardar `{center, zoom, bearing, pitch}` en `localStorage` por proyecto.
- Búsqueda local: input que filtra vetas/targets por `code/name` y hace `flyTo` + emite `losverdes:focus`.

### 2.3 Sección transversal (sin dep)
Botón "Sección": el usuario dibuja una línea con Terra Draw. Abre panel inferior con SVG que muestra: perfil topográfico (muestreo de `queryTerrainElevation` cada N metros), intersecciones con vetas (planos calculados en 2.3 proyectados al plano vertical), y rectángulos del plan minero atravesados. Inspirado conceptualmente en `equinor/esv-intersection` pero reimplementado a medida porque ESV es para wells.

## Fase 3 — Repos GitHub de referencia

| Repo | Uso |
|---|---|
| `@watergis/maplibre-gl-terradraw` | **Dependencia**: measure + draw con DEM elevation. |
| `opengeos/maplibre-gl-components` | **Referencia**: patrones para minimap, basemap switcher, swipe, terrain toggle, bookmark, print. Cherry-pick sin instalar. |
| `geoman-io/maplibre-geoman` | Alternativa más potente a Terra Draw si en el futuro queremos editor pro (snap, split, rotate). No instalar ahora. |
| `darkmine-oss/baselode` | **Referencia minera**: desurvey, viewer 3D de sondajes, cubicación. Para integrar en `useDrillTrajectoriesLayer` y validar `mining-calc.ts`. |
| `equinor/esv-intersection` | **Referencia visual** de cross-section bien hecha (TS, MIT). No depender. |
| `Trapar-waves/react-visgl-maplibre` | **Referencia** de cómo sincronizar `react-three-map`/Three.js con MapLibre + DEM si queremos modelos 3D realistas de pits o headframes. |
| `opengeos/maplibre-gl-lidar` | Futuro: drape de nubes de puntos LiDAR/Drone. Fuera de scope ahora. |

## Detalles técnicos

- **Pin de fill-extrusion al terreno**: MapLibre no expone `*-from-terrain` estable; usamos `queryTerrainElevation` por feature y guardamos `base` en `properties`, refrescando al evento `idle` del source `terrain`.
- **Veta como plano inclinado**: dado A=(lng,lat) y B=(lng,lat) de la traza superficial, el plano se obtiene desplazando A y B en dirección `dip_dir_deg` (perpendicular a `strike`) una distancia horizontal `h = depth/tan(dip)`, con `base = terrain(A,B) − depth_top`, `top = terrain(A,B) − depth_bottom`. Polígono final con cuatro vértices y altura por vértice.
- **Sección transversal**: muestreo cada `max(20m, length/300)` puntos, SVG `viewBox` proporcional a longitud × (cota_max − cota_min + buffer 200m bajo el target más profundo). Ejes con cotas mAS y abscisa en metros.
- **PDF**: las nuevas capas/medidas no entran al PDF en esta fase; sólo el visor interactivo.

## Pendientes que no toca este plan

Globe view, LiDAR, swipe, Three.js avanzado, edición persistente de vetas en DB. Quedan para iteración posterior.
