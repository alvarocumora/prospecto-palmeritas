# Mapa Interactivo en Oportunidades IA

Añadir un visor espacial MapLibre a `/_authenticated/dashboard/opportunities` para explorar concesiones rankeadas junto con anomalías satelitales, depósitos cercanos y targets de exploración. Sin nuevas dependencias (ya tenemos `maplibre-gl`).

## 1. ServerFn nueva: `getOpportunitiesGeo`

Archivo: `src/lib/cadastreOpportunities.functions.ts` (añadir export).

- Input: `{ limit?: number; minScore?: number; region?: string; bbox?: [w,s,e,n] }`.
- Usa `supabaseAdmin` + RPC SQL con PostGIS (`ST_AsGeoJSON`, `ST_Centroid`, `ST_Intersects`) para devolver **GeoJSON FeatureCollections** ya proyectadas a EPSG:4326:
  - `concessions`: top N de `cadastre_opportunities` join `cadastre_national` → polígonos + props (`score`, `commodity_hint`, `holder_name`, `ai_thesis`, `ai_action`, `id`).
  - `anomalies`: `satellite_anomalies` que intersecten el bbox/concesiones (puntos o polígonos).
  - `deposits`: `mineral_deposits` con `lat/lon` dentro del bbox (puntos).
  - `targets`: `exploration_targets` con `geometry_geojson` dentro del bbox.
- Limites duros (500 features por capa) para proteger payload.
- Protegida con `requireSupabaseAuth`.

Crear migration con función SECURITY DEFINER `opportunities_geo(_limit int, _min_score numeric, _region text, _bbox geometry)` que devuelva un JSON con las 4 colecciones — evita 4 round-trips.

## 2. Componente `OpportunitiesMap`

Archivo nuevo: `src/features/opportunities/OpportunitiesMap.tsx`.

- MapLibre GL con estilo base claro (mismo proveedor que usan `LosVerdesStrategicMap` / `Map3DView` — reutilizar helper de estilo si existe).
- Capas (toggles arriba a la derecha):
  - **Concesiones** (fill + line, color por `score` rampa verde→ámbar→rojo).
  - **Anomalías satelitales** (círculos magenta semi-transp).
  - **Depósitos** (triángulos azules con label commodity).
  - **Targets de exploración** (estrellas naranjas).
- Interacción:
  - Hover → cursor pointer + outline.
  - Click en concesión → popup con score, commodity, holder, `ai_thesis` (truncado) y botón **"Ver detalle"** que hace scroll y resalta la fila correspondiente en la tabla existente.
  - Click en fila de la tabla → `flyTo` al centroide de esa concesión.
- Auto-fit a bounds del top-N en la primera carga; recarga datos cuando cambia filtro `region` / `minScore` (mismo estado que la tabla).
- Leyenda fija inferior-izquierda; control de zoom y escala MapLibre estándar.

## 3. Integración en la ruta

Editar `src/routes/_authenticated.dashboard.opportunities.tsx`:

- Añadir tabs `Mapa | Tabla | Copiloto` (Shadcn `Tabs`) — la tabla y el copiloto actuales se mantienen sin cambios funcionales.
- Sincronizar selección: estado compartido `selectedConcessionId` entre mapa y tabla.
- En tab "Mapa", layout dividido (mapa 70% / panel lateral derecho con top-10 oportunidades clickeables 30%) en desktop; full-width con drawer en mobile.

## 4. Detalles técnicos

- Token-free basemap: usar el mismo estilo claro ya configurado en `LosVerdesStrategicMap` (helper compartido). Si no existe, inline `https://tiles.openfreemap.org/styles/positron`.
- Carga vía TanStack Query `queryOptions({ queryKey: ['opp-geo', filters], queryFn: () => fetchOppGeo({ data: filters }) })`, `staleTime: 60_000`.
- Limpieza de capas/sources en `useEffect` cleanup para evitar leaks al cambiar de tab.
- Manejo de error y empty-state ("Sin oportunidades en el área. Ajusta filtros o recomputa ranking").

## Archivos a tocar / crear

```text
+ src/features/opportunities/OpportunitiesMap.tsx       (nuevo)
+ supabase/migrations/<ts>_opportunities_geo_fn.sql     (nuevo, RPC PostGIS)
~ src/lib/cadastreOpportunities.functions.ts            (añade getOpportunitiesGeo)
~ src/routes/_authenticated.dashboard.opportunities.tsx (tabs + estado compartido)
```

## Fuera de alcance (siguiente iteración)

- 3D / extrusión de score → ya cubierto por `Geology3DViewer`, se enlazará con un botón "Ver en 3D".
- Edición de polígonos / dibujo de AOI.
- Clustering de anomalías (lo añadimos si el dataset supera ~2k puntos visibles).
