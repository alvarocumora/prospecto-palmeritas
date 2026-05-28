
# Plan — Validación + Visor Geológico Profesional (GeoCapitals)

Estado actual ya cubierto: Debug Render Mode ON, helpers (axes 5000 + grid 8000 + esfera roja + cubo wireframe), Force Fit Camera, frameloop="always", borde cyan, unlit para puntos/sondajes, Layer Recovery Checklist con botones Test, fallback blob para Marching Cubes, Basemap ESRI/OSM/Topo, DEM Martini, Anomaly Isosurface (MeshPhysicalMaterial), Drillholes instanciados, Block Model, Drill Targets IA.

Lo que falta es **(1) cerrar diagnóstico** para confirmar que la cámara mira la anomalía, y **(2) progresar al visor profesional**. Plan en 6 fases atómicas, cada una verificable en HUD.

---

## Fase 1 — Diagnóstico de cámara y bounding box (1 fase)

Objetivo: descartar definitivamente "la anomalía está fuera del frustum o tiene escala absurda".

- Añadir **`<Stats />`** (drei) toggleable desde HUD Layer Recovery.
- Asegurar que `axesHelper(1000)` y `gridHelper(5000, 50)` queden visibles **incluso en modo Cinematic** (hoy solo en Debug).
- Nuevo panel **"Scene BBox"** en HUD que muestre, por capa:
  - `anomalyIso`: `box.min / box.max / center / size` (Box3.setFromObject)
  - `drillholes`: idem
  - `dem`: idem
  - `blockModel`: idem
  - `pointCloud`: idem
- Resaltar en rojo si `|min|>1e6`, `size<1`, o el centro queda fuera del frustum actual de la cámara.
- Botón **"Frame this layer"** por fila → llama `fitCameraToBounds(layerBounds)`.

Verificación: con datos reales de Los Verdes, la fila `anomalyIso` debe mostrar coordenadas razonables (UTM zona 19S) y un `size` coherente con el área del proyecto.

---

## Fase 2 — Layer Control unificado estilo Leapfrog

Objetivo: reemplazar los toggles dispersos por un único panel jerárquico.

Estructura del panel `LayerControlPanel.tsx`:

```text
☑ Base / GIS
   ☑ Topografía (DEM)
   ☑ Textura satelital (ESRI / OSM / Topo)
   ☑ Grid + ejes
☑ Geología
   ☐ Litología
   ☐ Fallas
   ☐ Alteración
☑ Exploración
   ☑ Sondajes (DDH)
   ☑ Anomalías SAT
   ☑ Isosuperficies
☑ Recursos
   ☑ Block Model
   ☑ Cut-off slider
☑ IA
   ☑ Targets ranking
   ☐ AI Geologist overlay
```

- Cada nodo: checkbox + opacidad + botón "solo" + botón "frame".
- Estado persistido en `useLayerState` (ya existe el hook).
- Reemplaza los bloques de toggles actuales (Anomalías, DEM, Clipping…) — esos pasan a colapsables hijos dentro de cada grupo.

---

## Fase 3 — Sondajes profesionales (color por commodity)

Hoy los sondajes son cilindros instanciados con color por anomalía. Mejorar:

- Color por **commodity activo** (Au/Cu/Ag/Mo/REE/Li) usando `commodityColors.ts` + escala lineal sobre assays.
- Si el bundle CSV importado trae assays reales, usarlos; si no, usar el grade interpolado del block model.
- **Etiquetas flotantes** (drei `Html sprite`) con `DDH-ID · azimut/dip · profundidad` al hover.
- Toggle "Mostrar collares" / "Mostrar trayectorias" / "Mostrar assays >cutoff" por separado.
- Leyenda de gradiente fija abajo-derecha del Canvas.

---

## Fase 4 — Contexto geográfico real (DEM + ESRI drape)

Hoy ya hay `TerrainMartiniLayer` + `BasemapLayer`. Falta integrarlos visualmente como un único terreno texturizado (no dos planos separados):

- En `TerrainMartiniLayer`, samplear el tile ESRI activo y aplicarlo como **textura difusa** sobre el mesh Martini (drape verdadero, no cuadrado plano debajo).
- Exageración vertical compartida con el resto de la escena.
- Cuando falla ESRI → fallback OSM → fallback grid (ya implementado, mantener).
- Quitar el `BasemapLayer` plano cuando hay DEM (evita z-fighting); usarlo solo si DEM está OFF.

Resultado esperado: las anomalías y sondajes "se apoyan" sobre la topografía real de Tilama.

---

## Fase 5 — AI Target Engine (panel lateral derecho)

Ya existe `useDrillTargets` + `AIGeologistPanel` + `TargetPlanningPanel`. Falta consolidarlos en una **tabla compacta** estilo Mission Control:

```text
AI TARGET ENGINE                          [export CSV]
─────────────────────────────────────────────────────
#  Target    Score  Conf%  Depth   Commodity  AI why
1  TGT-01     94     91    620 m   Cu-Au      [open]
2  TGT-02     88     84    410 m   Cu         [open]
…
```

- Click fila → cámara vuela al target + abre `TargetExplainerDialog` (ya existe).
- Score se calcula con `aiGeologist.ts` (ya existe) combinando magnetometría / IP / geoquímica / sondajes históricos / penalización QAQC (ya ponderado por `qaqcPenalty`).
- Botón "Generar campaña" → exporta plan de sondajes al panel `TargetPlanningPanel`.

---

## Fase 6 — Layout Command Center

Reorganizar `/live/losverdes` y `/dashboard/geology3d` en grid de mando:

```text
┌────────────────────────────────────────────────────┐
│ Header (KPIs + Sync catastro + PDF)               │
├────────────┬───────────────────────────┬───────────┤
│ Layer      │                           │ AI        │
│ Control    │   3D Geological Scene     │ Targets   │
│ Drillholes │   (LosVerdesEngine3D)     │ Ranking   │
│ Filters    │                           │           │
├────────────┴───────────────────────────┴───────────┤
│ Geophysics │ Resource Model │ ESG │ Drill Plan    │
└────────────────────────────────────────────────────┘
```

- Sidebar izquierdo: `LayerControlPanel` (Fase 2) en columna fija 280px, colapsable.
- Sidebar derecho: `AITargetTable` (Fase 5) en columna fija 320px, colapsable.
- Banda inferior: tabs (Geophysics / Resources / ESG / Drill Plan) usando los paneles existentes (`ResourceModelPanel`, `NI43101Panel`, etc.).
- Canvas central ocupa todo el espacio restante (mínimo 720px alto en desktop).
- En mobile/tablet: sidebars colapsan a iconos (shadcn `Sidebar` con `collapsible="icon"`).

---

## Notas de implementación

- Todo el trabajo de Fases 1-5 se hace dentro de `src/engine3d/`. La Fase 6 toca `src/routes/live.losverdes.tsx` y `src/routes/_authenticated.dashboard.geology3d.tsx`.
- No se introducen dependencias nuevas: ya están `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `martini`, `proj4`.
- Cada fase es un commit independiente; tras cada una el HUD Layer Recovery debe mostrar todos los ✓ verdes antes de pasar a la siguiente.

---

## Orden sugerido de ejecución

1. **Fase 1** (diagnóstico bbox) — desbloquea confianza en que el render funciona.
2. **Fase 4** (DEM + ESRI drape) — máximo impacto visual, "deja de flotar en negro".
3. **Fase 3** (sondajes pro) — clave para diferenciarse de un dashboard 3D genérico.
4. **Fase 2** (Layer Control unificado) — limpieza UX previa a salir del modo beta.
5. **Fase 5** (AI Target Engine) — narrativa para inversores.
6. **Fase 6** (Command Center) — empaque final estilo Foundry/Leapfrog.
