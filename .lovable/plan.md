
# Plan: Suite de planificación minera 3D estilo Datamine/Leapfrog

Roadmap híbrido de 6-8 semanas, organizado en 4 sprints paralelizables. Cálculos pesados en `mining-engine` (Railway/Python con scipy, networkx, PuLP, trimesh), interacciones ligeras y UI en server functions de TanStack.

## Estado base (ya en producción)

- `GeoScene3D` (MapLibre + deck.gl) con terreno DEM real, sondajes desurveyados, anomalías extruidas
- `BlockModel3DViewer` con InstancedMesh + cutoff dinámico
- `mining-engine` con `/desurvey` y `/composite` operativos
- Tabla `resource_blocks` + edge function `estimate-resources`

## Sprint 1 — Cross-section + Geomodelado implícito (semanas 1-2)

**Backend (mining-engine):**
- `/section` — corta sondajes/bloques con un plano (origen + azimut + dip), devuelve polilíneas 2D + intercepts proyectados
- `/wireframe-rbf` — interpolación implícita por Radial Basis Function (scipy) sobre compositos + indicador binario (ore/waste), devuelve mesh trimesh (vértices + caras + isovalor)
- `/swath-plot` — comparación compositos vs bloques estimados por bandas X/Y/Z

**Frontend:**
- `SectionViewer` (nueva ruta `/dashboard/section`): canvas SVG/Konva con plano editable (azimut/dip sliders), sondajes proyectados con leyes, contactos litológicos, bloques cortados
- `WireframeLayer` en GeoScene3D: capa `SimpleMeshLayer` de deck.gl renderizando el sólido RBF semi-transparente sobre el terreno
- `SwathPlotPanel` en estimación: tres gráficos Recharts (X/Y/Z) compositos vs estimado

## Sprint 2 — Pit optimization + Diseño (semanas 3-4)

**Backend (mining-engine):**
- `/pit-optim` — Lerchs-Grossmann via pseudoflow (networkx) sobre `resource_blocks`: inputs (precio, recuperación, costo mina/proceso, ángulo de talud), outputs (pit shell por precio, NPV, stripping ratio, tonelaje ore/waste)
- `/pit-design` — genera bancos + bermas + rampa helicoidal con pendiente máx desde el pit shell óptimo
- Migración: tablas `pit_shells` y `pit_designs` (geometría JSONB + métricas)

**Frontend:**
- `PitOptimDialog` con sliders de precio (Au $/oz, Cu $/lb), grid de resultados (shell, NPV, t ore, strip ratio)
- `PitShellsLayer` en GeoScene3D modo `resource`: capa `PolygonLayer` extruida coloreada por precio incremental (nested shells)
- `BenchDesignPanel` con perfil del pit en sección y tabla de bancos

## Sprint 3 — Scheduling + Drillhole planning (semanas 5-6)

**Backend (mining-engine):**
- `/schedule` — secuenciación de bloques por períodos (PuLP MILP simplificado o heurística por benches), respeta precedencias del pit shell y capacidad anual de mina/planta
- `/drillhole-design` — toma targets + restricciones (azimut/dip preferidos, distancia mínima entre collares, longitud máx, costo $/m), devuelve collares óptimos + trayectorias

**Frontend:**
- `ScheduleTimeline` (D3/Recharts): bloques coloreados por período, curvas acumuladas de tonelaje, ley media, NPV, stripping
- `ScheduleAnimationLayer` en GeoScene3D: animación de bloques apareciendo/desapareciendo por período
- `DrillhPlanWizard` (ruta `/dashboard/drilling/plan`): selecciona targets → genera campaña → preview 3D + tabla costos
- Persistencia: `drill_campaigns` + `planned_holes`

## Sprint 4 — Interop industria (semanas 7-8)

**Backend (mining-engine):**
- `/export/dxf` — sondajes, wireframes, pit designs, secciones (ezdxf)
- `/export/omf` — Open Mining Format (omf python lib): block model, drillholes, surfaces
- `/export/csv-plan` — plan minero por período (formato compatible Datamine NPV Scheduler)
- `/import/dxf` — leer wireframes/surfaces externos de Leapfrog/Vulcan

**Frontend:**
- `ExportHub` (ruta `/dashboard/exports`): selector de objetos + formato + descarga directa
- Botones de import en geología y resource modeling

## Detalle técnico

### Arquitectura de cálculo
```text
TanStack server fn          mining-engine (Railway)
─────────────────           ─────────────────────────
section.functions.ts   ───▶ POST /section          (numpy)
wireframe.functions.ts ───▶ POST /wireframe-rbf    (scipy RBF + trimesh)
pitOptim.functions.ts  ───▶ POST /pit-optim        (networkx pseudoflow)
schedule.functions.ts  ───▶ POST /schedule         (PuLP MILP)
drillPlan.functions.ts ───▶ POST /drillhole-design (scipy.optimize)
export.functions.ts    ───▶ POST /export/{format}  (ezdxf, omf)
```

### Dependencias nuevas
- **Python**: `scipy`, `networkx`, `pulp`, `trimesh`, `ezdxf`, `omf`, `pyproj`
- **TS**: `@deck.gl/mesh-layers` (SimpleMeshLayer para wireframes), `konva` (cross-section 2D)

### Tablas nuevas (migraciones)
- `pit_shells` — geometría JSONB, precio, NPV, métricas
- `pit_designs` — bancos, rampas, ángulo de talud
- `mine_schedules` — períodos, bloque_id, secuencia, NPV período
- `drill_campaigns` + `planned_holes` — diseños de campaña con costos
- `geology_wireframes` — sólidos RBF (mesh JSONB, isovalor, commodity)

### Capas nuevas en GeoScene3D
- `WireframeLayer` (SimpleMeshLayer) — sólidos RBF
- `PitShellsLayer` (PolygonLayer extruido) — nested shells por precio
- `ScheduleLayer` (InstancedMesh animado) — bloques por período
- `PlannedHolesLayer` (PathLayer + ColumnLayer) — campañas propuestas vs ejecutadas

### Validación visual
- Swath plots (sprint 1) — calidad de estimación
- Reconciliation panel — compositos vs bloques en cada wireframe
- Pit walkthrough — animación de cámara siguiendo rampa

## Entregables por sprint

| Sprint | Ruta nueva | Métricas de éxito |
|---|---|---|
| 1 | `/dashboard/section` | Corte arbitrario < 500ms, wireframe RBF de un cuerpo en < 5s |
| 2 | `/dashboard/pit-optim` | Pit shell para 50k bloques < 30s, NPV calculado |
| 3 | `/dashboard/drilling/plan` | Schedule 5 años < 60s, plan de 20 collares generado |
| 4 | `/dashboard/exports` | DXF leído en AutoCAD, OMF abierto en Leapfrog Viewer |

## Riesgos y mitigaciones

- **Pseudoflow en Python puro es lento**: si > 60s para 100k bloques, portar el core a Cython o usar `mining-pit-optim` (paquete C++ con bindings)
- **RBF no escala >10k compositos**: implementar octree + partition of unity como fallback
- **Workers de Cloudflare no pueden hacer cómputo pesado**: por eso todo lo intensivo va a Railway, los server functions solo orquestan
- **OMF v2 todavía es beta**: empezar con OMF v1 (estable) y agregar v2 cuando se libere

## Lo que NO está en este plan (fase 2)

- Stope optimization subterránea (MSO) — solo si confirmamos clientes con minería subterránea
- Geostatística avanzada (kriging con variogramas direccionales, simulación condicional) — el IDW/RBF actual cubre el 80%
- Realidad aumentada en terreno — ya existe `ArRadarOverlay`, se integraría al plan de campaña en fase 2
- Integración directa con Datamine Studio RM via API propietaria — costoso y poco demanda
