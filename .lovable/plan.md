# Sprint 2 — GeoScene3D: visor 3D canónico unificado

Consolidamos los 4 visores 3D actuales en **un solo componente `GeoScene3D`** con 3 modos conmutables. Este es el corazón visual de Mission Control y elimina ~3000 líneas de duplicación.

## Estado actual (fragmentado)

| Visor | Ubicación | Rol |
|---|---|---|
| `Geology3DViewer` | `src/components/Geology3DViewer.tsx` | DEM + Sentinel + anomalías superficie |
| `SatToSubsurface3DViewer` | `src/components/geology3d/` | Vetas, pórfidos, drill holes, pits |
| `MagAnomaly3DPro` | `src/features/mag3d/` | Anomalías magnéticas extruidas |
| `BlockModel3DViewer` | `src/components/estimation/` | Bloques, leyes, NPV |
| `Map3DView` | `src/components/map/` | MapLibre + deck.gl 2.5D con drill columns |

Cinco entry points, tres motores diferentes (deck.gl, three.js puro, MapLibre+deck), capas duplicadas, controles inconsistentes.

## Objetivo

```text
┌──────────────────────────────────────────────────────────┐
│  GeoScene3D  · proyecto activo                           │
│  ┌─[ Surface ]─[ Subsurface ]─[ Resource ]──────────┐    │
│  │                                                  │    │
│  │   deck.gl + MapLibre (base común)               │    │
│  │   DEM Copernicus + Sentinel drape                │    │
│  │   capas conmutables según modo                   │    │
│  │                                                  │    │
│  └──────────────────────────────────────────────────┘    │
│  Toggles: catastro · targets · anomalías sat · mag ·     │
│           vetas · pórfidos · sondajes · bloques · pit    │
└──────────────────────────────────────────────────────────┘
```

## Arquitectura técnica

**Motor único: MapLibre + deck.gl MapboxOverlay** (ya probado en `Map3DView`).
- Razón: DEM real + Sentinel basemap + georreferenciación WGS84 + interacción nativa de mapa. Three.js puro pierde el contexto geográfico.
- `MagAnomaly3DPro` (three.js local) se reescribe como capa deck.gl `ColumnLayer` sobre el mismo canvas.

**Estructura de archivos nueva:**
```
src/components/geoscene/
  GeoScene3D.tsx              ← componente público único
  modes/
    SurfaceMode.tsx           ← DEM + Sentinel + catastro + targets + anom sat
    SubsurfaceMode.tsx        ← vetas + pórfidos + sondajes + mag 3D
    ResourceMode.tsx          ← bloques + pit shells + NPV overlay
  layers/
    useDemTerrainLayer.ts     ← Copernicus DEM
    useSentinelRasterLayer.ts ← Sentinel MPC drape
    useDrillHoleLayer.ts      ← columns + intercepts (reusa lib/3d/holeGeometry)
    useAnomalyColumnLayer.ts  ← anomalías sat/mag extruidas
    useVeinPolylineLayer.ts   ← vetas 3D
    usePorphyryLayer.ts       ← elipsoides pórfidos
    useBlockModelLayer.ts     ← bloques (port desde BlockModel3DViewer)
    usePitShellLayer.ts       ← pit shells
  controls/
    LayerTogglePanel.tsx      ← panel único de capas
    ModeTabs.tsx              ← Surface/Subsurface/Resource
    SceneLegend.tsx           ← leyenda contextual al modo
  types.ts                    ← GeoSceneMode, LayerToggleState, etc.
  index.ts
```

**API pública:**
```tsx
<GeoScene3D
  projectId={projectId}
  mode="surface"               // o "subsurface" | "resource"
  initialLayers={{ targets: true, sentinel: true, ... }}
  onTargetClick={(t) => ...}
  onHoleClick={(h) => ...}
/>
```

## Plan de migración (sin romper lo que existe)

1. **Crear `GeoScene3D`** con los 3 modos vacíos + tabs + panel de capas.
2. **Portar capas una por una** desde cada visor legacy a hooks `useXxxLayer.ts` (cada hook devuelve un `Layer` deck.gl). Tests existentes (`Geology3DSceneSummary.test.tsx`) siguen pasando.
3. **Mission Control** apunta al nuevo `<GeoScene3D>` en su zona central (reemplaza el placeholder actual del dashboard).
4. **Rutas legacy se vuelven thin wrappers** que renderizan `<GeoScene3D mode="..." />`:
   - `/dashboard/geology3d` → mode="surface"
   - `/dashboard/sat3d` → mode="subsurface"
   - `/dashboard/3d-pro` → mode="subsurface" con preset mag
   - `/dashboard/estimation` (sección 3D) → mode="resource"
5. **Deprecación suave**: los componentes viejos quedan marcados `@deprecated` en JSDoc 1 sprint, luego se borran.

## Detalles de UX

- **Tabs de modo** arriba (Surface · Subsurface · Resource), no en sidebar. Cambiar modo no remonta el mapa, solo conmuta capas (transición suave).
- **Panel de capas** lateral derecho, agrupado por modo, con contador (ej. "Sondajes (47)").
- **Leyenda contextual** abajo-izquierda, cambia según capas visibles.
- **Sincronización camera**: al cambiar de modo, mantener bearing/pitch/center.
- **Header compartido**: Fusion Score + QPS visibles también en este visor (consistencia con Mission Control).

## Tokens de diseño

Reusa la paleta Midnight Indigo + Emerald Prestige ya definida. Sin colores hardcoded — toggles usan `--primary`, `--accent`, `--muted-foreground`. Las rampas de Au g/t y anomalías quedan como constantes tipadas en `src/components/geoscene/layers/colorRamps.ts` (única fuente).

## Lo que NO hace este sprint

- No toca backend ni edge functions.
- No agrega capas nuevas que no existan hoy en algún visor.
- No implementa el Geo Copilot (Sprint 3).
- No toca NI 43-101 vivo (Sprint 4).

## Entregable verificable

- Mission Control muestra el visor real (no placeholder) con DEM + Sentinel + targets activos.
- Las 4 rutas legacy renderizan vía `GeoScene3D` y se ven idénticas o mejores que hoy.
- Cambiar modo no recarga el mapa.
- Tests existentes verdes; añadimos test de smoke para `GeoScene3D` que monta los 3 modos.

## Pregunta antes de arrancar

¿Migramos las 4 rutas legacy a wrappers en este mismo sprint, o solo dejamos el componente nuevo + Mission Control y las rutas viejas se migran en un sprint de limpieza posterior? Lo recomendado es **migrar todo en este sprint** para no quedar con dos visores en paralelo, pero suma ~2 días.
