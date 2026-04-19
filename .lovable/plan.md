
## Mapa Operacional — Centro de Operaciones Geocapitals

### Objetivo
Convertir el mapa en la pantalla principal (`/dashboard/map`) donde un geólogo vea **todo el proyecto a la vez**: catastro, geofísica con drones, secciones de exploración, muestras y resultados de lab. Click en cualquier elemento → panel lateral con detalle y acciones (editar, exportar, ir al módulo).

### Arquitectura propuesta

```text
/dashboard/map  ← nueva ruta principal (default tras login)
┌─────────────────────────────────────────────┐
│ TopBar: proyecto · campaña activa · export  │
├──┬──────────────────────────────────┬───────┤
│L │                                  │ R     │
│a │        MAPA LEAFLET              │ Panel │
│y │     (single source of truth)     │ ctx   │
│e │                                  │       │
│r │  + Drawing/Measure/Section tool  │ feat  │
│s │                                  │ inspc │
├──┴──────────────────────────────────┴───────┤
│ Footer: coords · escala · campaña · QA flags│
└─────────────────────────────────────────────┘
```

### Capas maestras (grupos en LayerOpacityPanel)

1. **Catastro** — ya existe (SERNAGEOMIN dinámico + `mining_concessions`).
2. **Geofísica** — surveys/lines/stations existentes + **nuevo: drones**:
   - Tabla nueva `drone_flights` (geometría LineString del path, altura, sensor: mag/lidar/RGB, fecha, piloto).
   - Tabla nueva `drone_rasters` (URL a tile/COG, bounds, tipo: orto/dem/mag-grid).
   - En el mapa: paths de vuelo + overlays raster (orto-foto, mag-grid).
3. **Sección/Campaña de exploración** — nuevo concepto `exploration_campaigns`:
   - Tabla con fechas, AOI poligono, fase (recon/scoping/PFS), responsable.
   - Filtro temporal en topbar: "Campaña activa" → mapa solo muestra datos de esa campaña.
   - Herramienta **Section Builder**: dibujas línea sobre el mapa → genera vista 2D lateral con holes proyectados.
4. **Muestreo + Lab** — `sampling_results` ya existe:
   - Cada muestra como circle marker, color por Au g/t (gradiente), tamaño por ley.
   - Click → popup con todos los elementos + flag QA/QC (blank/std/dup).
   - Toggle "solo high-grade ≥1 g/t Au".
5. **Sondajes** — ya existe, mejorar: collar coloreado por mejor intercept, halo por score.

### Panel contextual derecho (nuevo)

Aparece al hacer click en cualquier feature:
- Concesión: titular, vencimiento, alertas, link a /dashboard/catastro.
- Estación geofísica: valores mag/IP, gráfico mini, link a survey.
- Drone flight: ficha de vuelo, sensor, descargar GeoTIFF.
- Drill collar: depth, mejor intercept, mini strip-log, link a hole.
- Muestra: assays, QA flags, certificado lab.

### Nuevas funcionalidades clave del mapa

- **Filtro temporal global** (slider de fecha): muestra solo datos hasta fecha X → time-machine visual.
- **Section builder**: dibuja line → modal con sección 2D (drill holes proyectados ±50m, lito, intercepts).
- **Capas guardadas (vistas)**: usuario guarda combo "Inspección catastro mensual" con set de capas/opacidades; aparece en dropdown.
- **Snapshot**: botón → PNG del estado actual del mapa con leyenda y escala (para informes).
- **Multi-proyecto overlay** (super_admin/owner con varios proyectos): comparar 2 AOIs.

### Cambios técnicos

**DB (1 migración)**
- `drone_flights` (project_id, campaign_id, flown_at, sensor, pilot, geometry_geojson, altitude_m, area_ha, notes)
- `drone_rasters` (project_id, campaign_id, flight_id, raster_type, url, bounds_geojson, captured_at)
- `exploration_campaigns` (project_id, name, phase, started_at, ended_at, aoi_geojson, lead_user_id, status)
- `map_views` (user_id, project_id, name, layer_state_json, center, zoom)
- Añadir `campaign_id` (nullable FK conceptual) a `geophysics_surveys`, `sampling_results`, `drill_holes` para filtrado temporal.
- RLS estándar (member-based, igual que el resto).

**Frontend**
- `src/routes/_authenticated.dashboard.map.tsx` — nueva ruta principal full-screen.
- `src/components/map/MasterMap.tsx` — refactor de `ProjectMap` para soportar panel contextual + capas drone.
- `src/components/map/FeatureInspectorPanel.tsx` — panel derecho con tabs por tipo.
- `src/components/map/CampaignSelector.tsx` — dropdown topbar.
- `src/components/map/SectionBuilder.tsx` — dibujo de línea + render 2D (canvas/svg).
- `src/components/map/droneLayer.ts` — vuelos + rasters.
- `src/components/map/sampleLayer.ts` — muestras coloreadas por Au.
- `src/hooks/useDroneFlights.ts`, `useExplorationCampaigns.ts`, `useMapViews.ts`.
- Hacer `/dashboard/map` la **ruta default tras login** (cambiar redirect de `/dashboard` → `/dashboard/map`).
- Fix runtime: error de hidratación SSR en spinner `min-h-screen` (envolver en `<Suspense>` o `mounted` guard).

### Entrega en 3 fases (cada una funcional sola)

**Fase A (base operacional)** — lo que arranca el centro de operaciones:
- Migración DB completa.
- Ruta `/dashboard/map` con MasterMap (refactor de ProjectMap full-screen).
- Capa de muestras coloreadas + panel inspector contextual.
- Selector de campaña + filtro temporal básico.

**Fase B (drones + section builder)** — diferenciador visual:
- CRUD `drone_flights` (form para subir GeoJSON path o KML).
- Overlay raster de drones (URL externa + bounds).
- Section builder con render 2D de holes proyectados.

**Fase C (vistas guardadas + snapshot + multi-proyecto)** — pulido productivo:
- `map_views` CRUD + dropdown.
- Snapshot PNG con leyenda.
- Comparador multi-proyecto.

### Recomendación
Arrancar por **Fase A**. Es ~6-8 archivos nuevos + 1 migración, entregable en una sesión, y deja el mapa ya como pantalla principal con muestras + panel inspector + campañas. Fases B y C se construyen encima sin tocar lo de A.

¿Apruebas Fase A, o prefieres ver primero un mock de UI o ajustar el alcance?
