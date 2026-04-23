

# Plan disruptivo de geología — 5 features con impacto real

Objetivo: convertir Trackmin GeoIntel en una plataforma de exploración con automatización geocientífica que hoy solo existe en software caro de escritorio (Leapfrog, ioGAS, ENVI, Micromine). Todo se ejecuta dentro de Lovable Cloud reusando lo que ya tienes (assays, drill_core_logs, drone_rasters, exploration_targets).

## Roadmap por olas (ordenado por ratio impacto/esfuerzo)

### Ola 1 — Geochemical Fingerprint (PCA + clustering) ★ quick-win
Análisis multivariado automático sobre `samples` para detectar la firma del depósito (pórfido vs epitermal vs IOCG vs skarn) y vectorear hacia el centro mineralizado.

- Edge function `geochem-fingerprint`: corre PCA sobre Au, Ag, Cu, As, Sb, Hg, Pb, Zn, Mo; k-means para clusters de alteración; calcula índices pathfinder (As+Sb+Hg → epitermal, Mo+Bi+Te → pórfido).
- Tabla nueva `geochem_analyses` (run_id, pca_loadings, clusters, pathfinder_scores).
- UI `/dashboard/sampling` → tab "Fingerprint": biplot PC1/PC2, mapa con clusters coloreados, badge "Firma detectada: Epitermal Au-Ag low sulfidation (87%)".
- Acción: "Generar targets desde clusters" → crea `exploration_targets` automáticos en centroides de cluster con score basado en intensidad pathfinder.

### Ola 2 — Drone Lineament & Structural Detector
CV sobre DEM/orthomosaico para detectar lineamientos, fallas y intersecciones estructurales (los "trampas" de mineralización).

- Edge function `dem-lineaments`: hillshade multidireccional → Canny edge detection → Hough transform → líneas estructurales en GeoJSON.
- Tabla `structural_lineaments` (geometry, azimuth, length_m, confidence).
- UI `/dashboard/drones`: botón "Detectar estructuras" en cada DEM, capa nueva en mapa con rosa de azimutes.
- Cruce automático: intersección lineamientos × vetas mapeadas → score de "structural target" sumado al `prospectivity-grid` existente.

### Ola 3 — Implicit 3D Geology (RBF wireframes en `/dashboard/geology3d`)
Modelado implícito de cuerpos mineralizados usando RBF (Radial Basis Functions) sobre `drill_core_logs` — lo que hace Leapfrog Geo.

- Librería WASM compatible Worker (o JS puro): RBF interpolator sobre puntos de litología/ley.
- Edge function `implicit-model`: genera isosuperficies (Au≥0.5, Au≥1.0, Au≥3.0 g/t) en formato GLB/GLTF.
- Tabla `geology_models` (model_id, isovalue, mesh_url en Storage).
- UI Three.js extiende `Geology3DViewer.tsx` con toggle "Wireframe litología" y "Shell de ley".
- Cálculo automático de tonelaje preliminar (volumen × densidad asumida).

### Ola 4 — Drill Reconciliation & Deviation Alerts
Compara sondaje planificado vs ejecutado (cuando llegan datos MWD/Gyro) y alerta desviaciones críticas en tiempo real.

- Tabla `drill_surveys` (hole_id, depth, azimuth_actual, dip_actual, measured_at).
- Edge function `drill-deviation`: calcula trayectoria real vs planificada; flag si offset > 5 m del target geológico.
- UI `/dashboard/drilling`: vista 3D con tubo planificado (azul) vs real (rojo); panel de alertas activas; export reporte daily drilling.

### Ola 5 — NI 43-101 Auto-draft con IA
Aprovecha Lovable AI (`google/gemini-2.5-pro`) para pre-llenar secciones técnicas del reporte 43-101 desde los datos del proyecto.

- Edge function `ni43101-draft`: lee `samples`, `drill_holes`, `geochem_analyses`, `geology_models` → genera borrador de secciones 6 (Geological Setting), 7 (Deposit Types), 11 (Sample Preparation), 14 (Mineral Resource Estimates).
- UI `/dashboard/ni43101`: botón "Auto-draft sección" por QP; el QP edita y firma.
- Reduce el tiempo de redacción de ~80h a ~10h por reporte.

## Arquitectura técnica condensada

```text
                    ┌─────────────────────────┐
                    │  exploration_targets    │◄── score unificado
                    └────────▲────────────────┘
                             │
        ┌────────────────────┼────────────────────────┐
        │                    │                        │
┌───────┴────────┐  ┌────────┴────────┐  ┌────────────┴──────┐
│ geochem-       │  │ dem-lineaments  │  │ prospectivity-grid│
│ fingerprint    │  │ (Ola 2)         │  │ (existente)       │
│ (Ola 1)        │  └─────────────────┘  └───────────────────┘
└───────┬────────┘           │                      │
        │                    │                      │
        ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│                    samples · drill_core_logs            │
│                    drone_rasters · veins                │
└─────────────────────────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │ implicit-model (Ola 3)   │──► geology_models (3D)
              └──────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │ ni43101-draft (Ola 5)    │──► reportes auto
              └──────────────────────────┘
```

## Detalles técnicos clave

- **Sin dependencias Node-only**: PCA/k-means en JS puro (`ml-pca`, `ml-kmeans`), RBF en WASM, CV con `opencv.js` cargado bajo demanda en cliente para evitar runtime Worker.
- **RLS**: todas las tablas nuevas con `project_id` + policy basada en `has_project_role`.
- **Lovable AI Gateway** para Ola 5 (sin API key del usuario).
- **Storage**: bucket `geology-models` para meshes GLB, `lineaments` para overlays GeoJSON grandes.
- **Compat móvil**: todos los cómputos pesados en edge functions, frontend solo renderiza resultados.

## Entregable de la primera implementación
Recomiendo arrancar por **Ola 1 (Geochemical Fingerprint)** porque:
1. Reutiliza datos que ya tienes cargados (`samples`).
2. Resultado visible en <10 min de uso.
3. Genera targets automáticos que alimentan el resto del pipeline.
4. Cero dependencias nativas, 100% compatible Worker.

Al aprobar este plan, implemento Ola 1 completa: migración SQL + edge function + UI tab + integración con `exploration_targets`.

