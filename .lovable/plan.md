# Plan — /live/losverdes nivel Datamine

Objetivo: el visor público se vea y se opere como un Datamine/Leapfrog liviano, sin perder la trazabilidad DATO / INTERPRETACIÓN / CONCEPTUAL ya implantada.

Estado actual:
- Engine3D ya tiene DEM Martini, isosurface (marching cubes), drillholes instanciados, clipping planes, sections, AI geologist, reports.
- Data real: 0 sondajes, 0 geofísica, 1 resource model, 190 muestras, 45 anomalías SAT, 108 targets.
- `/live/losverdes` aún tiene LosVerdesScene3D (MapLibre/deck.gl) en paralelo al Engine3D.

## Fase 1 — Consolidación del visor (limpieza)
1. Retirar `LosVerdesScene3D` y `FieldMapPublic` del live; dejar Engine3D como único visor con tabs:
   `Superficie · Sondajes · Block model · Sections · Pit · Reportes`.
2. Pre-warm en SSR de bounds (centro + zoom) y un loading screen de marca antes de hidratar R3F.
3. Mantener el badge global "VERSIÓN CONCEPTUAL — sin sondajes ejecutados" + tooltip por capa con su origen.

## Fase 2 — Data sintética persistida (etiquetada conceptual)
Nuevas tablas (schema `geo_conceptual`, sin GRANT a anon excepto lectura):
- `synthetic_drillholes` (id, project_id, collar_x, collar_y, collar_z_utm, azimuth, dip, depth_m, source: 'ai_target_v1', is_conceptual=true).
- `synthetic_assays` (hole_id, from_m, to_m, cu_pct, au_gpt, mo_pct, ag_gpt, lithology, alteration, generated_from: anomaly_id|target_id).
- `synthetic_block_model` (project_id, x, y, z, size_m, cu_eq, confidence, domain).
- `pit_shells` (project_id, revenue_factor, tonnage, grade_avg, mesh_url) — Lerchs-Grossmann simplificado.

Generador server (`src/lib/conceptualModel.functions.ts`):
- Tomar las 45 anomalías + 6 vetas + 108 targets → desurvey ~15-20 sondajes virtuales (azimut perpendicular a la veta, dip 60°, profundidad 200-350 m).
- Sembrar leyes con distribución log-normal calibrada (Cu 0.3-1.2 %, Au 0.1-0.8 g/t) en intervalos mineralizados, con halo de alteración.
- Block model IDW (bloques 10×10×5 m) sobre un dominio que envuelva collares; persistir.
- Pit shell aproximado por Floating Cone (variante didáctica de Lerchs-Grossmann) por revenue factor 0.4/0.6/0.8/1.0.

## Fase 3 — Capas geocientíficas (nivel Datamine)
- `DrillholeTraceLayer`: cilindros instanciados + collares + labels HUD, color por lito o por Cu eq, hover muestra el intervalo.
- `BlockModelLayer` ya existe → conectar a `synthetic_block_model`, filtros por cut-off, dominio, confianza.
- `TonnageGradeCurve`: panel con curva tonelaje-ley interactiva (cut-off slider que repinta block model).
- `PitShellLayer`: meshes anidados por revenue factor con transparencia, leyenda tonnage/strip ratio.
- `SectionViewPanel` ya existe → re-corte: traza de sondajes proyectada ±50 m, vetas en sección, exportar PNG/SVG.
- `LithologyPolygonEditor`: dibujar polígonos sobre la sección y guardarlos.

## Fase 4 — Acabado cinematográfico
- Sun position por hora/fecha (CSM shadows en DEM), tone-mapping ACES, bloom suave en anomalías high-confidence.
- Materiales PBR: roca DEM con normal map procedural, vetas con material metálico-rugoso, anomalías como nubes volumétricas (raymarch shader).
- Exageración vertical configurable (1× / 1.5× / 2×), brújula 3D, escala gráfica métrica, mini-mapa 2D sincronizado.
- Animaciones: orbit cinemático al cargar, fly-to en click de target, transición suave entre tabs.
- HUD pro: leyenda lateral con barras de color, badge de capa activa, panel de cámara (vista plano / N / E / iso / libre).

## Fase 5 — UX y reportes
- Onboarding overlay primera visita (3 pasos).
- Exportar vista actual a PNG hi-res; cross-section a SVG; block model a CSV; pit shell a OBJ.
- Botón "Generar one-pager PDF" reutilizando reportGenerator.

## Detalles técnicos
- `useFrame` solo cuando hay animación; resto del tiempo `frameloop="demand"`.
- Block model: BufferGeometry con instanced mesh; LOD por distancia (decimación a 20×20×10 m lejos).
- Pit shell: marching cubes sobre cost field (revenue – mining cost) constraint angular 45°.
- Worker dedicado para desurvey + IDW + floating cone (no bloquear UI al regenerar).
- Cachear pit shells y block model en `scene_3d_cache` por `(project_id, params_hash)`.
- Todo lo sintético se marca con badge naranja "CONCEPTUAL · generado por IA" en cada hover/leyenda; el anexo del PDF v5 ya lo cubre conceptualmente.

## Entregables verificables
- `/live/losverdes` muestra Engine3D único con 6 tabs operativas.
- Al menos 15 sondajes virtuales + block model + 4 pit shells visibles y filtrables.
- Cross-section editable con polígonos y export PNG/SVG.
- Visual nivel demo de Leapfrog: sombras solares, materiales PBR, animaciones de cámara.
- Performance objetivo: 45+ fps en laptop integrada, 60+ fps en GPU dedicada.

## Fuera de alcance (siguiente iteración)
- Scheduling temporal (fases por año) y NPV.
- Kriging real (ordinario/indicador) — por ahora IDW + nota.
- Importador GEMS/Surpac/Datamine real (.dm, .str).
- Multi-usuario colaborativo en la sección.