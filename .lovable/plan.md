## Objetivo

Un solo visor público del prospecto Los Verdes / Tilama en **`/live/losverdes`** que muestre, sobre imagen satelital + DEM real:

1. Catastro minero (SERNAGEOMIN + concesiones del proyecto resaltadas).
2. Targets de exploración (sincronizados con el mapa de campo, ya hecho).
3. Anomalías satelitales y magnéticas (extruidas en 3D, ya hecho — se mejoran).
4. **Estructuras y vetas** dibujadas con rumbo/manteo correctos y extruidas en profundidad.
5. **Plan de explotación conceptual + cubicación** (fases, tonelaje, ley, NPV/CAPEX rápido por target).
6. Botón de **PDF descargable** (lo que hoy tiene `/live/tilama`).

`/live/tilama` queda como redirect a `/live/losverdes` para no romper links.

---

## Fase 1 · Unificar rutas

- Convertir `src/routes/live.tilama.tsx` en un redirect simple a `/live/losverdes`.
- Mover el header "Pre-NI 43-101", KPIs, botón PDF y paneles (catastro / anomalías / targets) desde `live.tilama.tsx` al layout de `live.losverdes.tsx`.
- Mantener el `LosVerdesScene3D` (MapLibre + Esri + DEM Terrarium + anomalías extruidas) como visor principal, y el `FieldMapPublic` como segunda sección de campo.

## Fase 2 · Datos: vetas y plan de explotación

Migración nueva (Supabase):

- **`public.veins`**: `id`, `project_id`, `code`, `name`, `commodity`, `strike_deg` (rumbo 0–360), `dip_deg` (manteo 0–90), `dip_dir_deg`, `thickness_m` (potencia), `length_m`, `depth_top_m`, `depth_bottom_m`, `grade_estimate` (jsonb: `{cu_pct, au_gpt, ag_gpt}`), `density_tm3` (default 2.7), `confidence` (low/medium/high), `geometry` (GeoJSON LineString WGS84 — traza en superficie), `notes`.
- **`public.mine_plan_phases`**: `id`, `project_id`, `phase_no`, `name`, `target_id` (fk exploration_targets), `method` (open_pit/underground/heap_leach), `area_polygon` (GeoJSON Polygon), `avg_thickness_m`, `density_tm3`, `cutoff_grade`, `recovery_pct`, `capex_usd`, `opex_usd_t`, `metal_price_assumption` (jsonb), `start_year`, `duration_years`, `notes`.
- GRANTs `service_role` + `authenticated`; RLS por `project_id` vía `user_can_access_project()` (helper ya existente).
- Política pública de lectura SOLO filtrada por el `LOSVERDES_PROJECT_ID` para que los serverFn `getLosVerdesPublicLayers`/nuevos puedan leer con `supabaseAdmin` sin exponer otros proyectos.
- **Seed** con datos reales del distrito Los Verdes (5–8 vetas con rumbo NS/NNW típico del cinturón + 2–3 fases de plan: óxidos heap leach superficial → sulfuros open pit → underground en profundidad).
- **Fallback**: si `veins` está vacío para el proyecto, derivar trazas desde `STRUCTURAL_LINEAMENTS` de `satellite_anomalies` (rumbo desde la polilínea, manteo 70°, potencia 5 m por defecto).

## Fase 3 · Server functions

`src/lib/livemap-public.functions.ts`:

- `getLosVerdesVeins()` → devuelve `Vein[]` (curadas o fallback de lineamientos).
- `getLosVerdesMinePlan()` → devuelve `{ phases: Phase[], summary: { totalTonnes, totalContainedCu_t, totalContainedAu_oz, totalCapex, weightedNpv } }`. Cubicación por fase:
  - `tonnes = area_m2 × avg_thickness_m × density_tm3`
  - `containedMetal = tonnes × grade × recovery`
  - NPV simplificado: `(price × metal_recovered − opex × tonnes − capex) / (1+0.08)^year_mid`.
- Extender `getLosVerdesPublicLayers` para devolver también `veins` y `minePlan` en un solo round-trip.

## Fase 4 · Visualización 3D de vetas (`LosVerdesScene3D.tsx`)

- Nueva fuente GeoJSON `veins` con polígonos 3D generados desde la traza:
  - Para cada veta, construir un polígono rectangular en planta proyectando la traza perpendicular según `dip_dir_deg`, ancho = `length_m × cos(dip)` aprox, y extruir con `fill-extrusion-base = elevDEM − depth_top_m` y `fill-extrusion-height = depth_bottom_m − depth_top_m`.
  - Color por commodity (Cu rojo, Au dorado, Ag plata) y opacidad 0.55 para ver el DEM por detrás.
- Capa adicional `vein-trace` (line) para la traza en superficie con `line-width` proporcional a `thickness_m` y `line-dasharray` por confianza.
- Popup con rumbo/manteo/potencia/ley estimada/tonelaje conceptual.
- Nuevo toggle "Vetas / Estructuras" en el panel de capas.
- Sincronización con `losverdes-focus` (kind: `"vein"`, `"phase"`) → click en panel vuela y resalta.

## Fase 5 · Plan de explotación (UI + cubicación)

Componente nuevo `src/components/live/MinePlanPanel.tsx`:

- Tabla de fases con: nº, método, target, área (ha), tonelaje (Mt), ley promedio, metal contenido, CAPEX, NPV simple.
- Mini-cards de KPI agregados (total Mt, total Cu_t, total Au_oz, CAPEX total, NPV total).
- Cada fila clickeable → emite `losverdes:focus` para volar a la fase en el 3D.

Capa 3D "Fases de explotación":

- Polígonos `area_polygon` extruidos por `avg_thickness_m`, coloreados por número de fase (gradiente verde→ámbar→rojo).
- Etiqueta flotante por fase con tonelaje.

## Fase 6 · PDF y QA

- Extender `src/lib/tilama-pdf.ts` (renombrar internamente o dejar) para incluir secciones nuevas: tabla de vetas y tabla de plan de explotación con cubicación.
- Mover el botón "Descargar informe PDF" al header de `/live/losverdes`.
- Smoke test del flujo en preview: cargan capas, toggles funcionan, click en veta/fase vuela, PDF descarga.

---

## Detalle técnico (resumen)

- **Cubicación visual**: las vetas se extruyen como polígonos 3D porque MapLibre no soporta planos inclinados nativos; se compensa con `fill-extrusion-base` calculado a partir del DEM (sample del raster en el centroide) y `dip` se muestra como atributo + flecha de azimuth en superficie. Para v2 se evaluaría deck.gl `PolygonLayer` con offset por dip.
- **Fallback de vetas desde lineamientos**: `strikeFromPath()` ya existe en `livemap-public.functions.ts` (línea 248). Se reutiliza.
- **Cubicación**: módulo puro `src/lib/mining-calc.ts` con funciones `tonnage()`, `containedMetal()`, `simpleNpv()` testeables.
- **Rutas**: `/live/tilama` queda con `loader: () => redirect({ to: "/live/losverdes" })`.
- **Sin cambios** en `client.ts`, `types.ts`, `auth-middleware.ts` ni en otros visores autenticados (Geology3DViewer, MissionControl).

## Archivos a crear

- `src/components/live/MinePlanPanel.tsx`
- `src/components/live/VeinsLegend.tsx`
- `src/lib/mining-calc.ts` (+ tests)
- Migración SQL para `veins` y `mine_plan_phases` + seed Los Verdes

## Archivos a modificar

- `src/routes/live.losverdes.tsx` (layout completo: hero + KPIs + 3D + paneles + plan + PDF)
- `src/routes/live.tilama.tsx` (→ redirect)
- `src/components/live/LosVerdesScene3D.tsx` (capas vetas + fases + toggles + focus)
- `src/lib/livemap-public.functions.ts` (`getLosVerdesVeins`, `getLosVerdesMinePlan`, ampliar layers)
- `src/lib/losverdes-focus.ts` (añadir kinds `vein` y `phase`)
- `src/lib/tilama-pdf.ts` (secciones vetas + plan)
- `src/components/field/FieldMapPublic.tsx` (focus para `vein`/`phase` con anillo pulsante)
