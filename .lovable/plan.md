
# GeoCapitals 3D Engine — Refactor a arquitectura modular

Reemplazo del visor monolítico actual (`LosVerdesScene3D.tsx`, Three.js plano sobre MapLibre) por un engine geocientífico modular inspirado en Leapfrog/Datamine, con render GPU correcto y pipeline de voxel→isosurface real.

## Alcance de este sprint

**SÍ se construye ahora:**
- Nueva arquitectura `/engine /geology /render /streaming /workers` con R3F.
- Pipeline voxel → marching cubes para anomalías magnéticas/satelitales (prioridad #1).
- Sondajes (`drill_holes`, 24 reales) e IDs/targets como capas secundarias usando `InstancedMesh`.
- Workers para interpolación IDW y extracción de isosurfaces (no bloquear el main thread).
- Sustitución del viewer en `MissionControl` / ruta `/live/losverdes`.

**NO se incluye (queda para Sprint 2+):**
- CesiumJS, vtk.js, Potree (bundle pesado, requiere tile server propio).
- WebAssembly / Rust geometry engine.
- Kriging real (solo IDW + placeholder para kriging).
- Block model viewer, mine planning, digital twin.

## Datos reales disponibles (verificado en DB)

| Tabla | Filas | Uso |
|---|---|---|
| `geophysics_anomalies` | 34 | puntos lat/lng/depth/peak → voxel IDW |
| `satellite_anomalies` | 104 | polígonos GeoJSON + score → extrusión + voxel superficial |
| `magnetic_grids` | 1 (sin raster) | metadato, raster cuando llegue |
| `drill_holes` | 24 | sondajes 3D con `drill_hole_trajectories` |
| `veins` | 6 | polígonos extruidos |
| `geophysics_stations` | 0 | (vacío — no se usa hasta poblar) |

No hay assays con leyes XYZ todavía (`geochem_analyses` por confirmar contenido). El pipeline voxel se alimenta de los 34+104 puntos/polígonos de anomalías; cuando llegue el raster del magnetic_grid se enchufa directo.

## Arquitectura

```text
src/engine3d/
├── core/
│   ├── R3FCanvas.tsx           # <Canvas> con WebGL2, frameloop="demand"
│   ├── CameraRig.tsx           # MapControls + fly-to + presets
│   └── SceneProviders.tsx      # context: bbox, CRS, time, filters
├── render/
│   ├── postprocess.ts          # SSAO + bloom + depth fog (lazy)
│   ├── shaders/
│   │   ├── voxelHeat.glsl
│   │   └── drillholeAssay.glsl
│   └── lod.ts                  # frustum + distance LOD policy
├── geology/
│   ├── interpolation/
│   │   ├── idw.ts              # IDW 3D, runs en worker
│   │   └── kriging.ts          # placeholder API-compat
│   ├── voxels/
│   │   ├── VoxelGrid.ts        # estructura Float32Array + bbox + spacing
│   │   └── buildFromPoints.ts  # puntos XYZV → grid
│   ├── isosurface/
│   │   └── marchingCubes.ts    # three-stdlib MarchingCubes wrapper
│   └── chunking/
│       └── octree.ts           # subdivisión espacial
├── geospatial/
│   ├── crs.ts                  # lng/lat ↔ ENU local meters
│   └── terrain.ts              # DEM Copernicus (reusa scene3d.server)
├── layers/
│   ├── TerrainLayer.tsx        # malla DEM + drape Sentinel
│   ├── AnomalyVoxelLayer.tsx   # voxel + isosurface IA (prio #1)
│   ├── DrillholeLayer.tsx      # InstancedMesh cilindros con assays
│   ├── VeinLayer.tsx           # polígonos extruidos shader
│   └── TargetLayer.tsx         # esferas IA + heatmap
├── workers/
│   ├── interpolation.worker.ts # IDW en background
│   └── isosurface.worker.ts    # marching cubes en background
├── hooks/
│   ├── useTerrain.ts
│   ├── useDrillholes.ts
│   ├── useVoxelModel.ts        # ← key: orquesta worker IDW + MC
│   ├── useIsosurface.ts
│   └── useSectionTool.ts
└── data/
    ├── anomalies.functions.ts  # createServerFn → puntos XYZV
    ├── drillholes.functions.ts
    └── veins.functions.ts
```

## Pipeline voxel → isosurface (núcleo del sprint)

```text
geophysics_anomalies (lat,lng,depth,peak,confidence)
        +
satellite_anomalies (polygon,score → centroide + score como "peak")
        ↓
serverFn getAnomalyPoints({projectId,bbox}) → [{x,y,z,v}]
        ↓
[worker] buildVoxelGrid → Float32Array(NxNxN) por IDW (power=2, radius=auto)
        ↓
[worker] marchingCubes(grid, isovalue=p75) → BufferGeometry
        ↓
postMessage → AnomalyVoxelLayer monta <mesh> con voxelHeat shader
        ↓
slider de isovalue + transparencia + clipping plane → re-extrae sin recomputar grid
```

Optimizaciones obligatorias:
- Grid base 64³ (LOD lejos) → 128³ (cámara cerca), no más.
- `Float32Array` transferible al worker (`postMessage([buf], [buf])`).
- `useMemo` + dependencias estables; jamás `useState` de geometría.
- `frameloop="demand"`: solo renderiza en interacción/cambio.
- `InstancedMesh` para sondajes y targets.

## Migración del viewer

1. `Geology3DViewer` y `LosVerdesScene3D` quedan deprecados pero NO se borran este sprint (se mantienen como fallback bajo flag `?engine=legacy`).
2. Nueva ruta interna `/live/losverdes` monta `<R3FCanvas>` + capas. Mismo URL público, mismo título.
3. Mobile (440px viewport actual del usuario): pixel ratio cap a 1.5, voxel a 32³, sin SSAO/bloom.

## Server functions nuevas

```ts
// src/engine3d/data/anomalies.functions.ts
getAnomalyPoints({projectId, bbox}) → {points: [{x,y,z,v,kind}], bbox, stats}
getVoxelGrid({projectId, bbox, resolution})  // opcional cache server-side
```

Reusa `scene3d.server.ts` para DEM/Sentinel (ya existe y funciona).

## Dependencias a instalar

```bash
bun add @react-three/fiber @react-three/drei three-stdlib
```

`three` ya está. No se añade Cesium/Potree/vtk/deck.gl en este sprint.

## Entregables verificables

1. `/live/losverdes` muestra terreno + isosurface naranja/roja de anomalías mag+sat, > 30fps en mobile real.
2. Slider de isovalue mueve la malla sin congelar UI (worker funcionando).
3. Sondajes reales (24) visibles como cilindros instanciados con color por trayectoria.
4. Botón "Engine legacy" para volver al viewer viejo en caso de regresión.
5. Sin warnings de `Invalid LngLat`, sin re-render global en cambio de filtro.

## Riesgos

- **Datos pobres para voxel real**: solo 34+104 puntos. La isosurface será suave/poco "geológica". Mitigación: añadir jitter sintético controlado SOLO si el usuario lo activa; documentar como "preview" hasta cargar magnetic_grid raster.
- **Bundle size**: R3F+drei+three-stdlib ≈ +180KB gzip. Aceptable; Cesium/vtk hubieran sido +2MB.
- **WebGL2 en iOS viejos**: fallback a WebGL1 con voxel 32³ y sin postprocess.

## Fuera de alcance (explícito)

CesiumJS, Potree, vtk.js, deck.gl, WebGPU, Rust/WASM, kriging real, block models, mine planning, digital twin, IoT. Todo eso son Sprints 2-4 según `mem://plan/3d-ia-disruptivo`.
