# Heatmap de anomalías + Proyección 3D en Live Field PWA

Añadir al `/live/losverdes` dos capacidades visuales tipo "GS Detectors / Map Your Mining":

1. **Heatmap de anomalías + lineamientos estructurales** sobre el satélite (look amarillo/rojo, estilo "vetas de oro").
2. **Modal de proyección 3D** de estructuras + targets extruidos en profundidad (estilo cubo geológico).

Datos ya existentes en el proyecto Los Verdes — sin nuevas migraciones.

## 1. Server fns públicas nuevas

`src/lib/livemap-public.functions.ts` (extender):

- `getLosVerdesAnomalies()` → con `supabaseAdmin`:
  - `magTargets`: de `mag_targets` (10 puntos) → `{lat, lng, mag_nt, score, rank}`.
  - `satAnomalies`: de `satellite_anomalies` (45) → `{centroid_lat, centroid_lng, score, severity, index_code, area_ha}` (extraer centroid del GeoJSON).
  - `lineaments`: filtro `index_code='STRUCTURAL_LINEAMENTS'` → polígonos completos para dibujar como líneas tipo "veta".
- `getLosVerdes3DScene()` → retorna escena simplificada:
  - `dem`: grilla 32×32 de elevaciones (puede ser plana o derivada de bbox).
  - `targets`: lat/lng/elev/score/priority.
  - `magAnomalies`: lat/lng/intensity para extrusión.
  - `lineaments`: lista de polylines con `strike` (azimuth) y `dip` por defecto 70° (vertical default).

## 2. Heatmap en Leaflet

Nuevo helper `src/components/field/anomalyHeatLayer.ts`:
- `bun add leaflet.heat` + tipo manual `@types/leaflet.heat` o declaración local.
- Función `buildAnomalyHeatLayer(L, points, opts)`:
  - Combina `magTargets` (peso = score normalizado) + centroides de `satAnomalies`.
  - Gradiente magnético: `{0.0:'#1e3a8a', 0.3:'#0ea5e9', 0.5:'#facc15', 0.7:'#fb923c', 1.0:'#dc2626'}`.
  - `radius: 35, blur: 25, maxZoom: 17`.
- Función `buildLineamentsLayer(L, lineaments)`:
  - Polylines amarillas `{color:'#facc15', weight:3, opacity:0.9}` + halo `{color:'#fb923c', weight:6, opacity:0.4}` para efecto glow "veta".

## 3. UI en `FieldMapPublic.tsx`

Top-bar de chips compactos (reemplaza/extiende los toggles actuales):

```text
[● ONLINE] [🎯 Targets] [🔥 Heatmap] [⚡ Vetas] [📦 3D] [⬇ Exportar]
```

- Estados nuevos: `showHeatmap`, `showLineaments`, `show3D`.
- Lazy-fetch de `getLosVerdesAnomalies` solo al activar Heatmap/Vetas la primera vez.
- Leyenda inferior izquierda compacta cuando heatmap está ON.
- Botón "3D" abre modal full-screen `<Structures3DViewer />`.

## 4. Visor 3D — `src/components/field/Structures3DViewer.tsx`

Three.js puro (mismo patrón que `Geology3DViewer`):

- **Caja base**: plano horizontal con grilla + textura satellite del bbox proyectada (o un color sólido si no se descarga tile).
- **Targets**: cilindros verticales en (x,y) escalados por `score`, color por priority (rojo/dorado/azul).
- **Anomalías magnéticas**: columnas semitransparentes (rojo→amarillo) en posición de cada `mag_target`, altura = `mag_nt` normalizado.
- **Lineamientos como planos verticales (estructuras)**: para cada polyline, generar un plano `PlaneGeometry` extruido hacia abajo (profundidad estimada por largo del lineamiento × 0.3), inclinado según `dip`. Color amarillo translúcido.
- `OrbitControls` (rotar / zoom táctil). Reset view, toggle de cada capa, ejes XYZ con escala (metros).
- Modal con `position:fixed inset-0 z-[3000]`, header con "Proyección 3D · Los Verdes" + cerrar.

## 5. Performance + bundle

- `leaflet.heat`: ~4 KB gzipped, import dinámico al activar el toggle.
- `Structures3DViewer`: lazy via `React.lazy()` para no cargar Three.js hasta que el usuario presione "3D".
- Server fns cachean en memoria del cliente vía `useState` (no se re-piden al togglear OFF/ON).

## 6. Files

```text
src/lib/livemap-public.functions.ts            (+ 2 fns nuevas)
src/components/field/FieldMapPublic.tsx        (toggles + integración)
src/components/field/anomalyHeatLayer.ts       (nuevo)
src/components/field/Structures3DViewer.tsx    (nuevo, lazy)
package.json: + leaflet.heat
```

## 7. Notas

- Sin migraciones, sin cambios en RLS.
- Las server fns públicas exponen solo campos no sensibles (score, posición, intensidad).
- Mobile-first: chips 36–44 px, modal 3D respeta `safe-area-inset`, gestos touch nativos de OrbitControls.
- Inspiración visual (referencias del usuario): vetas amarillas brillantes sobre satellite (TikTok kurdistán) + cubo 3D con drape geofísico (GS Detectors).
