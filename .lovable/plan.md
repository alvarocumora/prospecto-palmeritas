
## Diagnóstico

- **Home (`/`)** publica OK en `geocapitals.com` y `prospecto-palmeritas.lovable.app`. No hay caída global.
- **`/live/losverdes`** en producción renderiza el `errorComponent` ("Something went wrong"). El worker responde 200, así que el fallo es **client-side** dentro de la ruta.
- Causas probables (en orden de probabilidad):
  1. El visor `LosVerdesEngine3D` (monolito de 1.962 líneas) tira durante el lazy import o el primer render. En preview se ve además el error `Failed to fetch dynamically imported module: virtual:tanstack-start-client-entry`, típico de un chunk roto.
  2. Una de las 3 `useQuery` (`getLosVerdesPublicLayers`, `getLosVerdesMining`, `getTilamaReport`) lanza al renderizar el shell antes de que el `errorBoundary` del visor la atrape.
  3. El worker `martini.worker.ts` o `terrain/dem.functions` se importa a nivel módulo y rompe SSR/edge bundle.
- No hay logs de error en workerd para esa URL → confirma que es runtime de cliente.

## Plan (3 pasos, escalonados)

### 1) Hotfix de publicación (1 turno)
Objetivo: que `/live/losverdes` deje de mostrar la pantalla roja y al menos cargue el shell + datos, aun si el canvas 3D queda detrás de un toggle.

- Envolver `<LosVerdesEngine3D />` en un `ErrorBoundary` local con fallback "Visor 3D no disponible — recargar".
- Mover el `lazy(() => import("@/engine3d/LosVerdesEngine3D"))` detrás de un botón "Activar visor 3D" (no auto-cargar al entrar). Así el shell + KPIs + PDF ya funcionan sin depender del monolito.
- Añadir `errorComponent` y `pendingComponent` propios a la ruta `live.losverdes` para no caer en el boundary genérico del root.
- Confirmar que ningún `*.functions.ts` importado en el route hace `import` estático de algo que toque `window` (revisar `losverdes-veins`, `tilama`, `livemap-public`, `conceptualModel`).

### 2) Reducir el monolito a un MVP real (3–4 turnos)
El visor actual tiene 40+ `useState`, 1.962 líneas y muchas capas que ni están en datos reales. MVP mínimo "vendible":

**Capas obligatorias (todo lo demás se quita o queda flag-off):**
- DEM Copernicus + drape Sentinel (ya existe en `scene3d.server`).
- Concesiones SERNAGEOMIN del polígono Tilama (catastro real).
- Anomalías satelitales WGS84 extruidas (real).
- Vetas Cu-Au-Ag (real desde `veins` table).
- Targets de exploración con popup (real).
- Sondajes reales si existen; **ocultar** "modelo conceptual" detrás de un toggle "Datos sintéticos".

**Extracciones desde el monolito:**
- `useEngineData` → hook único con las queries (capas, mining, report, targets, holes).
- `useEngineLayers` → estado de visibilidad (un solo objeto `Record<LayerId, boolean>`).
- `EngineHUD` → barra de capas + leyenda.
- `EngineScene` → solo Canvas + capas R3F.
- Borrar paneles experimentales que no aportan al MVP: AI Geologist, drillTarget worker, isosurface, voxel, qaqc, sections fuera del visor.

### 3) Roadmap MVP "real" (post-hotfix)

```text
Sprint A — Estabilidad (esta semana)
  · Hotfix + ErrorBoundary + lazy on-demand
  · Telemetría: log de qué capa falló al montar
  · Smoke test E2E: /live/losverdes carga, KPIs > 0, botón "Activar 3D" renderiza canvas

Sprint B — Datos reales únicos
  · Cargar DEM + Sentinel del AOI Tilama desde tiles cacheados
  · Concesiones, anomalías sat, vetas, targets desde Supabase (sin sintéticos)
  · Quitar / esconder bloques, pit shells e isosurface generados

Sprint C — UX consolidada
  · Reemplazar el monolito por GeoSceneCanvas (deck.gl ya existente) en modo "surface+subsurface"
  · Panel lateral único: capas + leyenda + selección
  · PDF "Informe ejecutivo Tilama" con snapshot de las capas activas

Sprint D — Diferenciación
  · Fly-to desde anclajes del copilot (ya hay anchorRegistry)
  · Sección 2D bajo demanda (clip plane simple, sin worker pesado)
  · Compartir vista por URL (?layers=…&camera=…)
```

## Detalles técnicos relevantes

- Cambios concentrados en `src/routes/live.losverdes.tsx` (hotfix) y `src/engine3d/LosVerdesEngine3D.tsx` (división).
- `GeoSceneCanvas` (MapLibre + deck.gl) ya está implementado y es candidato para reemplazar al visor R3F en Sprint C.
- Las 6 alertas de seguridad recién corregidas no afectan a `/live/losverdes` (las tablas `veins` / `mine_plan_phases` ahora requieren auth; verificar que las funciones `getLosVerdesMining` / `getLosVerdesPublicLayers` se llamen con `supabaseAdmin` o que sean tablas con grant `anon`, sino esto **explica también el error** del visor público y entra como parte del Sprint A).

## Salida del Sprint A (definición de "publicada y no falla")

- `geocapitals.com/live/losverdes` muestra header + KPIs + tabla + botón PDF sin pantalla roja.
- Botón "Activar visor 3D" carga el canvas; si falla, muestra mensaje, no pantalla negra.
- Logs del worker sin 5xx, sin "Unauthorized" en las 3 server functions de la ruta.
