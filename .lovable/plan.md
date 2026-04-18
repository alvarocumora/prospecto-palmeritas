

User wants real improvements to the map: layer opacity controls, and a real system for geophysics + exploration management. Let me think about scope.

Current state:
- Map has basemaps + overlays via Leaflet layer control (toggle only, no opacity)
- Geophysics data is read-only from Supabase (surveys/lines/stations)
- No CRUD UI for surveys, lines, stations, drill holes, sampling

Scope is huge. Need to prioritize concrete deliverables vs aspirational. Let me design a focused, achievable plan.

**Plan focus:**
1. **Opacity sliders panel** for all overlays (catastro, geofísica WMS, geología, hillshade, capa de líneas/estaciones)
2. **Drawing tools** on map (polígonos AOI, líneas geofísicas, puntos drill collar) → save to Supabase
3. **Geophysics CRUD modal** (crear/editar/eliminar campañas, líneas, estaciones)
4. **Drill hole CRUD modal** (proposed → drilling → completed con depth, azimuth, dip)
5. **Coordinate display + click-to-copy** (lat/lng en cursor, footer)
6. **Export GeoJSON** de cualquier capa dibujada

This is too much for one plan — should focus on the top-priority pieces and propose phases.

## Plan: Mejoras Mapa + Sistema Real Geofísica/Exploración

### Diagnóstico actual
- Capas toggleables sin control de opacidad — usuario no puede ver superposiciones
- Geofísica: solo lectura desde Supabase, no se pueden crear/editar campañas ni líneas
- Drill holes: hardcoded en GeoJSON, sin estado real (proposed/drilling/completed)
- Sin herramientas de dibujo — no se pueden definir nuevas AOIs ni líneas geofísicas
- Sin lectura de coordenadas en cursor
- Tablas Supabase ya existen: `geophysics_surveys/lines/stations`, `drill_holes`, `drill_core_logs`, `sampling_results` — todas con RLS por `created_by`

### Solución en 4 módulos

**Módulo 1 — Panel de Opacidad y Capas Avanzado**
Reemplaza el control de capas Leaflet por un panel propio (lateral derecho colapsable):
- Lista de todas las capas (basemaps, geología Macrostrat, geofísica WMS EMAG2/WGM2012, hillshade SRTM, catastro 4 tipos, geofísica planificada, features proyecto)
- Toggle visibilidad + slider opacidad 0-100% por capa
- Reorder via drag (z-index)
- Persistencia en localStorage (`map:layer-state`)

**Módulo 2 — Herramientas de Dibujo (`leaflet-draw`)**
Botón en toolbar abre paleta de dibujo:
- Polígono → guarda como AOI custom (tabla nueva `custom_aois` o reusa `geological_features` con `feature_type='aoi'`)
- Polilínea → crea línea geofísica (`geophysics_lines` con `is_synthetic=false`)
- Marker → crea drill hole propuesto (`drill_holes` con `status='proposed'`)
- Edit/delete handles para features dibujadas
- Export GeoJSON botón único

**Módulo 3 — Modal CRUD Geofísica**
Botón "Gestionar campañas" abre dialog con tabs:
- **Campañas**: lista `geophysics_surveys`, crear/editar (nombre, método Mag/IP/CSAMT, km, costo USD, spacing, depth, status)
- **Líneas**: lista filtrable por survey, link a dibujo en mapa
- **Estaciones**: tabla con valores mag/IP, edición inline
Persistencia directa a Supabase con `auth.uid()` en `created_by`. Realtime opcional.

**Módulo 4 — Modal CRUD Sondajes**
Botón "Gestionar sondajes" abre dialog:
- Lista `drill_holes` con status (proposed/drilling/completed/abandoned)
- Form: hole_id, easting/northing/elevation, azimuth, dip, planned_depth, target_zone, fechas
- Sub-tabla: logs de testigo (`drill_core_logs`) — depth from/to, litología, alteración, Au/Cu/Ag, RQD, recovery
- Color del marker según status

### Coordenadas + UX
- Footer del mapa: `Lat/Lng cursor` + `escala gráfica` + botón "copiar coordenadas"
- Atajos teclado: `F`=fullscreen, `M`=medir, `D`=dibujar, `Esc`=cancelar

### Auth requerido
Todas las tablas tienen RLS `auth.uid() = created_by` para insert/update/delete. **Si el usuario no está autenticado, las operaciones de escritura fallarán silenciosamente.** Necesitamos:
- Verificar si existe pantalla de login en el proyecto
- Si NO existe → agregar autenticación email/password antes del módulo CRUD (o avisar al usuario)
- Botón "Login" en TopNav si no hay sesión

### Archivos afectados

```text
NUEVO  src/components/map/LayerOpacityPanel.tsx     ← panel lateral con sliders
NUEVO  src/components/map/DrawingTools.tsx          ← integra leaflet-draw
NUEVO  src/components/map/CoordinateFooter.tsx      ← lat/lng cursor
NUEVO  src/components/geophysics/SurveyManager.tsx  ← modal CRUD campañas
NUEVO  src/components/drilling/DrillHoleManager.tsx ← modal CRUD sondajes
NUEVO  src/hooks/useLayerState.ts                   ← persistencia opacidad
NUEVO  src/hooks/useAuth.ts                         ← session helper
EDIT   src/components/ProjectMap.tsx                ← integra todo
EDIT   src/routes/index.tsx                         ← botones en TopNav
DEPS   leaflet-draw, @types/leaflet-draw
```

### Fases sugeridas (recomiendo aprobar fase a fase)

**Fase 1 (esta iteración)** — Panel opacidad + footer coordenadas + dibujo básico (export GeoJSON local, sin guardar a DB)
**Fase 2** — Auth + CRUD geofísica completo
**Fase 3** — CRUD sondajes + core logs
**Fase 4** — Sampling results + integración con PDF NI 43-101

### Pregunta antes de implementar

Antes de codear necesito confirmar el alcance. Voy a preguntar al usuario qué priorizar.

