
User wants a "disruptive Geology 5.0" plan. Current state: project has SERNAGEOMIN WMS layers, Sentinel-2, Copernicus DEM, exploration_targets, geology reference tables (lithology_units, alteration_zones, mineralogy, geological_features, geo_references), drill core logs, sampling results, geophysics surveys. The geology module today is mostly *display* of static reference data + map overlays.

"5.0" should mean: AI-native, predictive, multi-source fusion, 3D, real-time. Let me design something genuinely disruptive vs incremental.

## Plan: Geología 5.0 — Inteligencia Geológica Predictiva

### Concepto
Pasar de "ver capas" a **"el sistema entiende el yacimiento"**: fusión multi-fuente + IA generativa + modelo 3D + predicción de targets.

### Cinco pilares

**1. GeoAI Copilot (Lovable AI Gateway — gemini-2.5-pro)**
- Chat geológico contextual: "¿qué litología domina entre 120-180 m en DDH-04?", "compara mineralogía de DDH-02 vs DDH-05", "sugiere próximo collar".
- Inyecta contexto: core logs + assays + alteración + targets + SERNAGEOMIN del AOI.
- Responde con citas a filas de DB + coordenadas.
- Edge function `geo-copilot` (ya existe `geo-assistant` — extender).

**2. Modelo 3D del subsuelo (Three.js + React-Three-Fiber)**
- Vista 3D del AOI con: topografía Copernicus DEM, sondajes como cilindros coloreados por Au, vetas como superficies, alteración como volúmenes semi-transparentes.
- Sliders: profundidad, ley cutoff, filtro por dominio.
- Click en un sondaje 3D → abre StripLog 2D existente.

**3. Predicción de targets con ML ligero (servidor)**
- Edge function que cruza: targets validados + sondajes con intercepto + capas SERNAGEOMIN + Sentinel-2 alteración + distancia a yacimientos conocidos.
- Genera "heatmap de prospectividad" como GeoJSON grid (celdas 50×50 m con score 0-100).
- Se renderiza como capa nueva `prospectividad:ai` en el mapa.
- Cada celda explica su score (qué features pesaron más) → trazabilidad.

**4. Fusión multi-fuente automática (Geo-Intel Brief)**
- Botón "Generar Brief Geológico" en cualquier punto del mapa.
- En 1 click: SERNAGEOMIN + Macrostrat + elevación + Sentinel-2 alteración + sondajes a <500 m + muestras a <500 m + targets cercanos + permisos vigentes (HSE) + concesión titular (catastro).
- IA sintetiza un párrafo profesional + tabla de evidencias.
- Exportable a PDF (reutiliza primitives de Fase 5).

**5. Sección virtual interactiva (cross-section AI)**
- Trazas dos puntos en el mapa → el sistema proyecta sondajes cercanos sobre el plano.
- Interpola litología/alteración entre sondajes con kriging simple (lib `@turf/turf` + interpolación lineal por bandas).
- Muestra vetas inferidas, zonas de alteración, intercepts de Au.
- Editable: el geólogo puede "pintar" una unidad y guardarla como interpretación.

### Stack técnico

```text
Frontend:
  three + @react-three/fiber + @react-three/drei (3D model)
  d3-contour (heatmap rendering)
  
Backend (edge functions):
  geo-copilot (extiende geo-assistant) — chat con contexto DB
  prospectivity-grid — calcula heatmap, persiste en tabla nueva
  geo-brief — fusiona fuentes + síntesis IA
  
DB nueva:
  prospectivity_cells (project_id, geom geojson, score, features jsonb, generated_at)
  geo_interpretations (project_id, type, geom geojson, attributes jsonb, author, version)
  
AI: Lovable AI Gateway (gemini-2.5-pro principal, gemini-2.5-flash para chat rápido)
```

### Sprints propuestos

| Sprint | Pilar | Esfuerzo | Valor |
|---|---|---|---|
| 5.1 | GeoAI Copilot | Medio | Alto |
| 5.2 | Geo-Intel Brief + PDF | Bajo | Alto |
| 5.3 | Prospectividad ML (heatmap) | Alto | Muy alto |
| 5.4 | Modelo 3D Three.js | Alto | Visualmente disruptivo |
| 5.5 | Sección virtual con kriging | Medio | Alto |

### Diagrama

```text
┌───────────── Geología 5.0 ─────────────┐
│                                         │
│  ┌──────────┐   ┌──────────────────┐   │
│  │  Mapa 2D │   │  Vista 3D R3F    │   │
│  │ + heatmap│←→│  sondajes/vetas  │   │
│  │   AI     │   │  alteración vol. │   │
│  └────┬─────┘   └────────┬─────────┘   │
│       │                  │              │
│       └────┬─────────────┘              │
│            ↓                            │
│   ┌────────────────────┐                │
│   │  GeoAI Copilot 💬  │ ← gemini-2.5  │
│   └────────┬───────────┘                │
│            ↓                            │
│   contexto: DB + WMS + sondajes         │
│            ↓                            │
│   ┌────────────────────┐                │
│   │ Geo-Intel Brief PDF│                │
│   └────────────────────┘                │
└─────────────────────────────────────────┘
```

### Propuesta de arranque
Empezar por **Sprint 5.1 (Copilot) + 5.2 (Brief)** en una pasada — máximo valor, mínimo riesgo, sin dependencias 3D. Luego decidir si seguir con 5.3 (ML) o 5.4 (3D) según prioridad.

### Fuera de alcance ahora
- Inversión geofísica real (requiere cómputo pesado).
- Integración con software comercial (Leapfrog, Vulcan).
- Modelo de bloques económico (eso es Fase 8 — Mineral Resource Estimation).

### Pregunta antes de ejecutar
¿Quieres que arranque con **5.1 + 5.2** (Copilot + Brief, ~1 turno) o prefieres ver primero un mockup del **modelo 3D (5.4)** porque es el pilar más visual?
