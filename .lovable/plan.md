# Plan — Visor 3D satelital, herramientas de terreno y Live Map Tilama

Alcance grande. Lo divido en 3 sprints entregables por separado para que valides cada uno antes de seguir.

---

## Sprint 1 — Visor 3D "Satélite → Subsuelo" (genérico, todos los proyectos)

**Componente nuevo**: `src/components/geology3d/SatToSubsurface3DViewer.tsx`

Cubo geo-referenciado tipo OKM Rover / Map Your Mining:
- **Cara superior** = textura Sentinel-2 (Esri World Imagery fallback) sobre DEM Copernicus (relieve real).
- **Caras laterales y base** = corte vertical sintético. Cada anomalía satelital (`satellite_anomalies`) se proyecta hacia abajo como columna 3D con:
  - profundidad ∝ `score` (0–100 → 0–500 m)
  - color por `index_code` (Fe oxides, arcillas, hidrotermal, lineamientos)
  - opacidad por `severity`
- Targets (`exploration_targets`) como esferas en superficie con halo.
- Sondajes existentes (si hay) trazados reales hacia abajo (ya existe `Geology3DViewer` — reutilizo el patrón maplibre + deck.gl `ColumnLayer` + `TerrainLayer`).

**Reutiliza** lo que ya hay (`src/lib/geology3d/`, `scene3d.server`, `Map3DView.tsx`). No reescribe.

**Server fn**: `getSatToSubsurfaceScene({ projectId })` en `src/lib/satToSubsurface.functions.ts` — agrupa anomalías + DEM bbox + sample Sentinel-2 tile URL. RLS por proyecto vía `requireSupabaseAuth`.

**Ruta**: `/dashboard/sat3d` (`_authenticated.dashboard.sat3d.tsx`) — selector de proyecto + visor full-screen.

**También integrado en**: MissionControl de cada proyecto (Tilama / Palmeras / Franco) como nueva pestaña "Subsuelo 3D".

---

## Sprint 2 — Herramientas de terreno (módulo `/dashboard/field`)

Se construye sobre el `FieldMap.tsx` existente.

1. **GPS + captura POI** — ya existe (`useFieldPois`, `POISheet`). Verifico y pulo UX.
2. **Overlay anomalías satelitales** — nueva capa Leaflet en `FieldMap`: lee `satellite_anomalies` del proyecto activo, dibuja polígonos coloreados por índice con toggle on/off (panel lateral). Reutiliza `anomalyHeatLayer.ts`.
3. **Brújula AR / rumbo** — usa `ArRadarOverlay` ya presente. Botón "Modo AR" en FieldMap → abre overlay full-screen con `DeviceOrientation` API + targets cercanos en radar polar (rumbo + distancia).
4. **Export GPX/KML** — botón "Exportar" en FieldMap:
   - GPX: POIs + targets + tracks (servidor: `exportFieldGpx.functions.ts`, devuelve string XML).
   - KML: igual + halos de anomalías como polígonos coloreados (abre en Google Earth con relieve real).
   - Descarga directa via Blob.

---

## Sprint 3 — Nuevo `/live/tilama` público

Clon estructural de `/live/losverdes`:
- Password gate (env `LIVE_MAP_TILAMA_PASSWORD`, server route `api/public/live-map/tilama/verify`).
- Vista pública con Esri World Imagery + 45 anomalías + 108 targets + 15 concesiones de Tilama.
- Botón "Ver subsuelo 3D" → embed del nuevo `SatToSubsurface3DViewer` en modo read-only.
- Sin login. RLS bypass solo para los IDs whitelisteados de Tilama (server fn pública).

Requiere secret nuevo: **`LIVE_MAP_TILAMA_PASSWORD`** (te lo pido al iniciar Sprint 3).

---

## Sprint 4 (opcional, después de validar) — Regenerar PDF Tilama

Añadir al PDF actual una sección nueva "Vista 3D satélite→subsuelo" con 3 renders (NE/SW/Top) del cubo del Sprint 1 (matplotlib 3D, no captura del navegador). Una sola pasada de script Python.

---

## Detalles técnicos

```text
src/
├── components/geology3d/
│   └── SatToSubsurface3DViewer.tsx        [NEW] — maplibre + deck.gl
├── lib/
│   └── satToSubsurface.functions.ts       [NEW] — server fn agregadora
├── components/field/
│   ├── FieldMap.tsx                       [EDIT] — toggle anomalías + AR + export
│   └── satAnomalyLayer.ts                 [NEW] — capa Leaflet
├── lib/
│   └── fieldExport.functions.ts           [NEW] — GPX/KML server fn
├── routes/
│   ├── _authenticated.dashboard.sat3d.tsx [NEW]
│   ├── live.tilama.tsx                    [NEW]
│   └── api.public.live-map.tilama.verify.ts [NEW]
```

Stack: maplibre-gl + @deck.gl/layers (TerrainLayer, ColumnLayer, ScatterplotLayer, BitmapLayer para textura sat) ya instalados. Sin nuevas deps pesadas.

---

## Pregunta antes de empezar

Sprint 1 es el corazón (visor 3D real reusable). Sprints 2 y 3 dependen poco entre sí.

**¿Lo hago todo seguido o entrego Sprint 1 primero para que lo valides en pantalla y después sigo?** Te recomiendo entregar Sprint 1 primero — son ~6 archivos y vale más verlo funcionando que esperar el combo completo.