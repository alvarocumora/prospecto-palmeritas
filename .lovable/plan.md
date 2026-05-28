# Live Los Verdes nivel Datamine + IA

Objetivo: que `/live/losverdes` se vea y opere como Datamine Discover3D — capas geocientíficas reales en 3D, herramientas analíticas y un copiloto IA conectado a Lovable AI Gateway (Gemini 2.5 Pro).

## Fase 1 — Datos reales y server fns

1. **Auditar tablas existentes** para Los Verdes: `drillholes`, `drillhole_assays`, `vein_geometries`/`vein_polygons`, `mag_anomalies`/`anomalies`, `targets`, `fusion_scores`. Identificar qué hay y qué falta.
2. Si falta, crear migración con tablas mínimas y RLS por proyecto (`is_project_member`):
   - `drillholes` (id, project_id, collar lng/lat/elev, azimuth, dip, depth)
   - `drillhole_assays` (hole_id, from_m, to_m, cu_pct, au_gpt, ag_gpt)
   - `vein_solids` (id, project_id, geom GeoJSON, dip, strike, top_elev, bottom_elev, mineral)
   - `anomaly_voxels` (id, project_id, lng, lat, depth_m, size_m, intensity, source: mag|grav|sat)
   - `ai_targets` (id, project_id, lng, lat, depth_m, score, explanation, generated_by, created_at)
3. Sembrar dataset coherente para Los Verdes (coords del proyecto) si está vacío — marcado `source='seed'` para reemplazo posterior.
4. Crear `src/lib/losverdes3d.functions.ts` con server fns:
   - `getLosVerdesScene3DData({ projectId, filters })` → drillholes, vetas, voxels, targets en una llamada.
   - `getCrossSection({ projectId, p1, p2, buffer_m })` → sondajes y vetas intersectando el corte.

## Fase 2 — Visor 3D nivel Datamine

Refactor `src/components/live/LosVerdesScene3D.tsx` (mantener MapLibre + DEM + drape Sentinel existente) y añadir capas vía deck.gl ya presente:

- **Drillholes**: `PathLayer` 3D con color por ley máxima del tramo (Cu/Au); tooltip con assays.
- **Vetas/mantos**: `SolidPolygonLayer` extruido entre `top_elev` y `bottom_elev`, color por mineral, semi-transparente.
- **Voxel anomalías**: `ColumnLayer`/`PointCloudLayer` con altura/opacidad por intensidad, paleta turbo.
- **Targets IA**: `ScatterplotLayer` 3D con halo proporcional al `fusion_score`, click abre Target Explainer.
- **Leyenda + toggles** por capa, sliders de profundidad/ley/fecha en panel flotante.

## Fase 3 — Herramientas interactivas

Panel lateral `LosVerdesToolbar`:

- **Cross-section dinámica**: dibujar línea en mapa → modal con SVG del corte (sondajes + vetas + voxels intersectados) calculado server-side.
- **Medición 3D**: distancia/área/volumen con deck.gl `EditableGeoJsonLayer`.
- **Fly-through**: presets de cámara (norte→sur, plan→sección, órbita target) animados con `flyTo`/`easeTo`.
- **Filtros vivos**: ley mín Cu/Au, profundidad máx, rango fechas → re-query server fn con filtros.

## Fase 4 — Copiloto IA (Lovable AI Gateway)

Crear `src/lib/ai-gateway.server.ts` con el helper estándar (`createOpenAICompatible` + header `Lovable-API-Key`). Modelo por defecto `google/gemini-2.5-pro`.

Server fns IA en `src/lib/losverdes-ai.functions.ts`:

- `explainTarget({ targetId })` → genera explicación estructurada (geología, satélite, estructural, riesgo) con `Output.object`.
- `geoCopilotChat` → streaming via `/api/chat/losverdes` (server route) con tools:
  - `highlightLayer(layer)` — emite evento al cliente para resaltar.
  - `runCrossSection(p1,p2)` — llama server fn.
  - `queryAssays(holeId)` — consulta DB.
- `generateAITargets({ projectId })` → analiza fusión de capas y inserta nuevos `ai_targets` con `generated_by='gemini-2.5-pro'`.
- `generateNI43101Summary({ projectId })` → bullets ejecutivos.

UI en panel lateral con AI Elements (`Conversation`, `Message`, `PromptInput`, `Tool`).

## Fase 5 — QA

- Render del visor con datos reales/seed.
- Smoke test de cada server fn vía `invoke-server-function`.
- Verificar RLS (`is_project_member`) y que `LOVABLE_API_KEY` está presente.
- Probar copiloto con 3 prompts típicos ("¿por qué T-03 tiene score alto?", "muéstrame el corte N-S", "resume el yacimiento").

## Detalles técnicos

- Stack: TanStack Start + React 19, MapLibre v5 + deck.gl, AI SDK + `@ai-sdk/openai-compatible`.
- Sin Edge Functions nuevas: todo en `createServerFn` y un único server route `/api/chat/losverdes` para streaming.
- Tokens semánticos de `src/styles.css` para toda UI nueva.
- Memoria del proyecto actualizada al cerrar cada sprint.

## Entrega por sprints

- **Sprint 1 (este)**: Fase 1 + Fase 2 (capas reales en visor) + Target Explainer básico.
- **Sprint 2**: Cross-section + medición + filtros.
- **Sprint 3**: Geo Copilot conversacional con tools.
- **Sprint 4**: Auto-generación de targets + resumen NI 43-101 + fly-through.

¿Apruebo y arranco Sprint 1?