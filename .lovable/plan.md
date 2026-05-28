## Sprint 2 — Scientific Visualization Engine (Leapfrog-grade)

Objetivo: dejar de mostrar "cubos voxel" y pasar a **superficies geológicas implícitas** con DEM real, secciones dinámicas y streaming sparse. Mantener WebGL2, frameloop="demand" y arquitectura modular ya existente en `src/engine3d/`.

### Sprint 2A — Fundamentos visuales (salto AAA inmediato)

1. **Marching Cubes real → mesh isosurface**
   - Reemplazar `AnomalyVoxelLayer` (InstancedMesh de cubos) por `AnomalyIsosurfaceLayer` que renderiza un `THREE.Mesh` continuo.
   - Nuevo worker `isosurface.worker.ts` (separado del IDW): consume el `Float32Array` del scalar field y emite `{ positions, normals, indices }` transferibles.
   - Implementación basada en `MarchingCubes` de `three-stdlib` + decimación ligera (merge vértices, drop triángulos < ε área).
   - Material: `MeshStandardMaterial` con color ramp por intensidad + transparencia + `flatShading=false`. Soporta `clippingPlanes`.
   - Mantener `AnomalyVoxelLayer` accesible vía flag `?render=voxel` para debug.

2. **DEM real triangulado (Martini)**
   - Nuevo módulo `src/engine3d/terrain/`:
     - `dem.functions.ts`: server fn que lee tile DEM Copernicus ya disponible en `scene3d.server` y devuelve `Float32Array` heightmap + bbox.
     - `martini.worker.ts`: corre `@mapbox/martini` con error ~1.5 m, genera mesh triangulado adaptativo.
     - `TerrainMeshLayer.tsx`: reemplaza `TerrainPlane`, aplica drape Sentinel como `map` (reutilizar URL del legacy), normales calculadas, sombras.
   - Dependencias: `@mapbox/martini`, `geotiff` (si hace falta decodificar raw; si el server ya devuelve Float32 saltar geotiff).

3. **Clipping planes dinámicos (sections)**
   - Nuevo `src/engine3d/sections/`:
     - `useClippingPlanes.ts`: 1–3 planos (X/Y/Z + free) con sliders en el HUD.
     - Activar `renderer.localClippingEnabled = true` en `R3FCanvas`.
     - Aplicar a isosurface, drillholes, terrain (terrain con `clipShadows`).
   - HUD: toggle "Sección N-S", "Sección E-W", "Profundidad", con slider de offset.

4. **Drillholes instanciados reales**
   - Nuevo `DrillholesLayer.tsx`:
     - Server fn `getDrillholes()` (ya existe `drill_holes` con 24 reales) → segmentos por intervalo con assay.
     - `InstancedMesh` de cilindros (1 instancia por intervalo), color por ley (Cu/Au) con escala log.
     - Picking por `instanceId` → tooltip con BHID, from-to, ley.
   - Cuando el plano de sección corta un sondaje, render highlight.

### Sprint 2B — Escalabilidad

5. **Sparse voxel chunks (16³)**
   - Refactor `useVoxelModel`:
     - `ChunkManager`: divide el bbox en chunks 16×16×16; sólo computa chunks con ≥1 punto fuente en radio IDW.
     - Pool de `Float32Array` reusables (evita GC).
     - Worker procesa chunk por chunk, stream incremental al main thread (postMessage por chunk listo).
   - Permite subir resolución efectiva a 256³ equivalente sin OOM.

6. **BVH + octree espacial**
   - `bun add three-mesh-bvh`
   - Aplicar `computeBoundsTree()` a terrain e isosurface → raycast O(log n) para tooltips, picking, clipping preview.
   - Octree CPU (clase ligera propia o `d3-octree`) para query "qué anomalías/sondajes intersectan este plano/bbox".

7. **Frame budget manager**
   - `src/engine3d/core/PerfGovernor.ts`:
     - Mide `gl.getExtension('EXT_disjoint_timer_query_webgl2')` para GPU ms; fallback a `performance.now()` por frame.
     - Si frame > 33 ms durante 1 s → degrada: baja resolución isosurface, reduce chunks visibles, desactiva sombras.
     - Si < 12 ms estable → sube calidad.
   - HUD overlay opcional (`?perf=1`): GPU/CPU/worker ms, draw calls, triángulos.

### Sprint 2C — Pipeline híbrido

8. **Realtime preview + background hi-res**
   - Al mover slider isovalue: render inmediato con scalar field a 32³ (instantáneo).
   - Debounce 250 ms → recompute a 128³–256³ en background, swap mesh cuando listo.
   - Mismo patrón para clipping planes (preview con plano, recompute sólo si el usuario lo deja fijo > 500 ms).

### Estructura final

```text
src/engine3d/
  core/          PerfGovernor, ChunkManager, EventBus
  render/        R3FCanvas, CameraRig, materials, shaders
  workers/       voxel.worker, isosurface.worker, martini.worker
  terrain/       dem.functions, TerrainMeshLayer, useTerrain
  voxels/        useVoxelModel, sparse chunk pool
  geology/       AnomalyIsosurfaceLayer, VeinsLayer
  geophysics/    AnomalyPointsLayer
  drillholes/    DrillholesLayer, useDrillholes
  sections/      useClippingPlanes, SectionControls
  gpu/           bvh helpers, instanced helpers
  hooks/         useVoxelModel, useIsosurface, useSectionTool
```

### Dependencias nuevas

- `@mapbox/martini` (terrain TIN)
- `three-mesh-bvh` (raycast acelerado)
- `geotiff` solo si el server fn no entrega Float32 directo

(Ya instalados: `three`, `@react-three/fiber`, `@react-three/drei`, `three-stdlib`.)

### Fuera de alcance (Sprint 3+)

- WebGPU, Cesium, Potree, vtk.js, deck.gl
- Kriging real (seguimos con IDW; kriging va en pipeline servidor más adelante)
- Block models mineros, scheduling, digital twin IoT
- AI target generator y geo-copilot (ya planificados en `mem://plan/3d-ia-disruptivo` sprints 3-4)

### Orden de ejecución recomendado

1. Marching Cubes isosurface (impacto visual #1, 1 día)
2. Drillholes instanciados (impacto comercial inversores, 0.5 día)
3. DEM Martini + drape (realismo, 1 día)
4. Clipping planes + section UI (Leapfrog-feel, 0.5 día)
5. Sparse chunks + worker streaming (escalabilidad, 1 día)
6. BVH + PerfGovernor (estabilidad, 0.5 día)
7. Pipeline preview/hi-res (pulido, 0.5 día)

### Riesgos

- Martini necesita heightmap regular; si `scene3d.server` entrega malla irregular hay que añadir un paso de regrid.
- `three-mesh-bvh` añade ~60 KB gz.
- Marching Cubes en CPU puede pasar de 200 ms con 128³; mitigado por chunks + worker.
- Clipping planes + transparencia requieren `material.transparent=true` y `depthWrite=false` → puede causar artefactos; se prueba primero opaco.

Confirmar para pasar a build mode y empezar por el paso 1 (isosurface real).
