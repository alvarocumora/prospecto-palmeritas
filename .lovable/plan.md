# Plan — Visor 3D Los Verdes nivel Leapfrog / Datamine

## Diagnóstico actual

Aunque el botón "Generar modelo conceptual" persiste correctamente (28 sondajes, 3 566 assays, 203 bloques, 4 pit shells), el `<Canvas>` se ve **completamente negro** en `/live/losverdes`.

Causas reales identificadas en `src/engine3d/LosVerdesEngine3D.tsx` (1 889 líneas):

1. **Sistema de coordenadas inconsistente.** Los `holes`, `synthHoles`, `blocks`, `pitShells`, `iso` y `demMesh` vienen en sistemas distintos (UTM crudo en metros, ENU local del DEM, world-space del isosurface). Cada capa hace su propia conversión (`x, z*VE, -y`), y el resultado es que los objetos quedan dispersos a decenas de km del origen → fuera del frustum aun con `AutoFitCamera`.
2. **`AutoFitCamera` + `ForceCameraFit` se pisan entre sí** (3 controladores de cámara activos a la vez sobre `renderBounds` que cambian de identidad cada frame por `useMemo` mal memoizado).
3. **`debugRenderMode = true` por defecto** apaga DEM, surface, blocks, targets, basemap, fog y postprocess → en modo debug solo deberían verse `axesHelper`, `gridHelper` y la esfera roja, pero el `renderBounds` que recibe la cámara es el `debugSceneBounds` (±4000 m) sobre un escenario donde los assets reales viven a +6 000 km del origen UTM → cámara enfocada al origen, geometría fuera de cuadro.
4. **Engine monolítico ingobernable.** 1 889 líneas, ~40 `useState`, 12 capas, 8 paneles, mezcla data fetching + UI + 3D + AI + reportes. Es la razón estructural por la que cada fix introduce el siguiente bug.

## Objetivo

Reescribir `LosVerdesEngine3D` como **visor profesional minero** con la sensación visual de Leapfrog Geo / Datamine Studio (referencia: imagen adjunta del usuario — terreno satelital drapeado, sólidos geológicos translúcidos coloreados, trazas de sondajes coloreadas por ley, ejes Z + grilla métrica, brújula y barra de escala).

## Arquitectura objetivo

```text
src/engine3d/
├── core/
│   ├── SceneRoot.tsx          ← Canvas + lights + tone mapping + clipping
│   ├── CameraRig.tsx          ← MapControls + fit-to-bounds único + presets (plan, N, E, iso)
│   ├── CoordinateFrame.tsx    ← Provider: origen UTM del proyecto, ENU → world
│   └── useSceneBounds.ts      ← Bounds agregado, debounced, una sola fuente
├── layers/                    ← Capas puras, todas en world-space ENU
│   ├── TerrainLayer.tsx       ← DEM Martini + drape Esri/Sentinel (existente, limpiado)
│   ├── DrillholesLayer.tsx    ← Sondajes reales + sintéticos unificados
│   ├── BlockModelLayer.tsx    ← Bloques instanciados con cut-off
│   ├── PitShellLayer.tsx      ← Pit shells con leyenda RF
│   ├── AnomalyVolumeLayer.tsx ← Isosurface MC (existente)
│   └── AnnotationsLayer.tsx   ← Vetas, targets, labels
├── hud/                       ← UI 2D superpuesta
│   ├── LayerPanel.tsx         ← Toggle de capas + opacidad + cut-off
│   ├── ToolPanel.tsx          ← Sección, medir, exportar
│   ├── CameraPresets.tsx      ← Vista plano, N, E, iso, fit
│   ├── Compass.tsx + ScaleBar.tsx + MiniMap.tsx
│   └── HoverTooltip.tsx
└── LosVerdesEngine3D.tsx      ← ~200 líneas: compose hooks + layers + hud
```

Reglas de oro de la reescritura:

- **Un único sistema de coordenadas**: ENU local centrado en el proyecto. Todo dato (real o sintético) se transforma a ENU en su `*.functions.ts` server-side, no en cada layer.
- **Un único controlador de cámara**: `CameraRig` recibe `bounds` y `preset`. Elimina `AutoFitCamera`, `ForceCameraFit×2`, `InvalidateOnChange` superpuestos.
- **Sin `debugRenderMode`**: la escena por defecto debe verse bien. Reemplazado por `?debug=1` query param que añade ejes + bounds box, sin apagar nada.
- **Capa de bounds memoizada por referencia estable** (key derivada de longitudes + hash, no por identidad de array).

## Sprints

### Sprint A — Desbloqueo visual (1 sesión)
Objetivo: la primera carga muestra terreno, sondajes, vetas, pit shell sin tocar nada.

1. Añadir `CoordinateFrame` y centrar TODOS los assets sobre el centroide del proyecto antes de mandarlos al cliente (mover la transformación a `conceptualModel.functions.ts`, `drillholes.functions.ts`, `anomalies.functions.ts`).
2. Reemplazar los 3 controladores de cámara por `CameraRig` único con `fitToBounds` ejecutado **una sola vez** cuando bounds pasa de `null` a definido (y al click explícito de "Fit").
3. Quitar `debugRenderMode = true` por defecto; encender DEM + sondajes sintéticos + pit shells + grid de fábrica.
4. Verificar en preview: terreno visible, sondajes visibles, pit shells visibles. Captura antes/después.

### Sprint B — Look Leapfrog (1 sesión)
Objetivo: estética igual a la imagen de referencia.

1. **Terreno**: drape Esri World Imagery sobre DEM Martini (ya existe `BasemapLayer`), exageración Z = 1.5×, sombras ACES suaves del directional light.
2. **Sondajes**: cilindros instanciados coloreados por **Cu eq del intervalo** (gradiente azul→verde→amarillo→rojo) en vez de por estado. Halo emisivo en collares.
3. **Pit shells**: mallas semi-transparentes (op 0.25-0.4) con outline por revenue factor, leyenda lateral con tonnage / strip ratio (datos ya existen en `pit_shells`).
4. **Block model**: bloques instanciados con material PBR, color por Cu eq, cut-off slider repinta sin re-fetch.
5. **HUD**: brújula 3D reactiva (existe `CompassRose`), barra de escala métrica, mini-mapa 2D con FOV cone (existe `MiniMap`), ejes Z laterales con elevaciones cada 100 m (existe `DepthAxis` — engancharlo).
6. **Cámara presets** en HUD: Plano, N, E, Iso, Fit (un botón cada uno).

### Sprint C — Interacción profesional (1 sesión)
Objetivo: usable como Datamine ligero.

1. **Cross-section interactiva**: arrastrar el plano de corte con el mouse (ya existe `ClippingPlaneController`, exponerlo en HUD).
2. **Hover unificado**: tooltip único que muestra el contenido relevante (collar/assay/bloque/pit) en lugar de 3 tooltips dispersos.
3. **Click en sondaje** → vuela la cámara y abre tarjeta con los assays (ya hay `followHoleId`, conectarlo a `CameraRig`).
4. **Export**: PNG hi-res de la vista actual + OBJ del pit shell visible.
5. **Onboarding**: overlay de 3 pasos la primera visita (highlight: Capas, Sección, Presets).

### Sprint D — Limpieza y QA (0.5 sesión)
1. Eliminar paneles no usados del Engine: `AIGeologistPanel`, `TargetPlanningPanel`, `ReportsPanel`, `QAQCPanel`, `EstimationSettingsPanel`, `AuditTrailPanel`, `NI43101Panel` se mueven a una **ruta hermana** `/live/losverdes/workspace` (que no es lo que muestra el live público).
2. La página `/live/losverdes` queda con **un solo HUD ligero**: capas, presets, sección, export.
3. Test E2E manual: cargar la ruta, verificar que en <2 s se ve terreno+sondajes, click en Fit, click en Sección, toggle Block Model. Captura final adjunta al chat.

## Entregables verificables

- `/live/losverdes` muestra al cargar: terreno satelital drapeado, ≥15 sondajes coloreados, ≥1 pit shell semi-transparente, ejes + brújula + escala.
- `LosVerdesEngine3D.tsx` reducido a ≤ 250 líneas.
- 45+ fps en laptop integrada (modo medio), 60+ fps en GPU dedicada.
- Cero `debugRenderMode`, cero controladores de cámara duplicados.
- Captura de pantalla adjunta al cierre del Sprint B mostrando paridad visual con la referencia Leapfrog.

## Fuera de alcance (no se toca esta iteración)

- Kriging ordinario real (sigue IDW).
- Importadores `.dm` / `.str`.
- Scheduling temporal y NPV por fase.
- Edición de polígonos de litología sobre sección.

## Riesgos

- Si el DEM Martini sigue cayendo a procedural (no hay GeoTIFF real para Los Verdes), el terreno se verá menos realista que la referencia. Mitigación: usar drape Esri sobre el DEM procedural — visualmente convincente.
- Cambiar el sistema de coordenadas a ENU puede romper los `clippingPlanes` existentes. Mitigación: convertir `useClippingPlanes` para que reciba bounds en world-space ya transformado.
