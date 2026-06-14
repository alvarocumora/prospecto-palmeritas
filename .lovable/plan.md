# Plan de estabilización + orden de código (Geocapitals)

## 1. Estado actual (auditoría)

### Despliegue — CRÍTICO
- **Producción HTTP 500 en TODAS las rutas** (`/`, `/inversionistas` ambas 500). El wrapper anti-h3 sirve correctamente el fallback HTML branded ("Servicio temporalmente no disponible") → la capa 2 funciona, pero la causa raíz NO está resuelta.
- **Logs vacíos**: `server-function-logs` no devuelve nada en la última hora → o nadie está pegando, o el wrapper aún no está logueando el error capturado a stdout visible para ClickHouse.
- **Vite dev**: sin errores recientes en el log del sandbox.
- **Conclusión**: el sitio publicado está caído end-to-end. Hay que diagnosticar la causa real (no solo el síntoma) antes que cualquier feature investor.

### Tamaño y orden del código
- **75 rutas**, **71 hooks**, **64 archivos en `src/lib/`** (mezclando `.functions.ts`, `.server.ts`, helpers puros, exportadores PDF, AI clients).
- **Archivos monstruo** (>800 líneas):
  - `LosVerdesEngine3D.tsx` 1962
  - `pdf/sections.ts` 1624
  - `TrackminDashboard.tsx` 1518
  - `satelliteIntel.functions.ts` 1504
  - `LosVerdesScene3D.tsx` 1486
  - `ProjectMap.tsx` 1163
  - 5 rutas de dashboard > 800 líneas (ni43101, geophysics, catastro, qps, targets)
- **Features sin namespace investor**: `catastro-public`, `franco`, `lv5`, `mag3d`, `marketing`, `opportunities`, `palmeras`, `reports`, `terminal`. No hay `investor/`, `portal/`, `data-room/`, `kyc/`.
- **`src/lib/` plano**: 64 archivos hermanos sin agrupación temática (catastro, losverdes, mag, satellite, livemap, geo, ni43101 todos mezclados).
- **`src/routes/` plano**: 75 archivos `_authenticated.dashboard.*.tsx` en un solo directorio.

## 2. Plan en 3 fases

### Fase A — Estabilizar despliegue (HOY, bloqueante)
Objetivo: producción devuelve 200 en `/`, `/inversionistas`, `/terminal`, `/auth` y rutas core.

1. **Forzar logging del error real**: en `src/server.ts`, antes del fallback, escribir `console.error` con stringify completo del payload h3 swallowed + `consumeLastCapturedError()` + URL + headers. Garantizar que sale a stdout (ClickHouse worker logs).
2. **Re-deploy** y pegar `/` para que la captura ocurra; leer `stack_modern--server-function-logs` para obtener stack real.
3. **Diagnosticar root cause**. Hipótesis ordenadas por probabilidad:
   - (a) Loader de `__root.tsx` o de `index.tsx` llama un serverFn que falla en SSR (Supabase admin import top-level, `process.env` undefined, módulo Node-only).
   - (b) Falta `attachSupabaseAuth` en `start.ts` (solo tiene 6 líneas — verificar).
   - (c) `head()` global del root referencia asset inexistente.
   - (d) Worker bundle incluye un import de `*.server.ts` desde una ruta pública.
4. **Fix quirúrgico** según diagnóstico (no especulativo).
5. **Verificar**: `curl -sI` debe devolver 200; preview también.
6. **Smoke test**: `/`, `/inversionistas`, `/terminal`, `/auth`, `/contacto`, `/catastro`, `/dashboard` (con cookie) — todas 200.

### Fase B — Orden estructural de código (1 sprint)
Objetivo: navegabilidad clara, separación pública/privada/investor, lib agrupada.

1. **Reagrupar `src/routes/`** por dominio físico (TanStack soporta carpetas):
   ```text
   src/routes/
     (marketing)/        → index, inversionistas, empresas, proyectos, recursos, contacto
     (public-tools)/     → catastro.*, live.*, share.*
     auth.tsx
     _authenticated/
       dashboard/        → 40+ archivos actuales (operador)
       portal/           → (NUEVO, vacío) workspace investor
       admin/            → admin.*, approvals, audit
     api/public/         → ya existe
   ```
   Sin cambio de URLs (los grupos `(name)` no afectan path). Reduce ruido en el explorer.

2. **Reagrupar `src/lib/`**:
   ```text
   src/lib/
     catastro/      → catastroPublic, catastroWatchlist, franco-cadastre
     losverdes/     → losverdes*, lv5
     satellite/     → satelliteIntel, mag*
     livemap/       → live-map, landingMap, livemap-public
     ni43101/       → ni43101Draft, export-ni43101-pdf
     mining/        → mining-calc, mining-economics, miningEngine, pitOptim
     ai/            → ai-gateway.server, geoCopilot, opportunityCopilot
     pdf/           → ya existe
     core/          → error-capture, error-page, observability
   ```
   Mover por dominio, actualizar imports con find/replace, sin cambio de lógica.

3. **Romper archivos > 800 líneas** que tocaremos en Fase C:
   - `satelliteIntel.functions.ts` → split por feature (anomalies, run, export).
   - Rutas dashboard gigantes → extraer panels a `src/components/<area>/`.
   - `LosVerdesEngine3D`, `LosVerdesScene3D`, `TrackminDashboard`: marcar como "no tocar salvo cambio funcional" — su tamaño es aceptable si no se editan.

4. **Convención AppShell**: confirmar que `MarketingShell`, `TerminalShell`, `PortalShell` (nuevo), `DashboardShell` heredan de `@/components/shell/AppShell` — tokens, spacing, header, footer unificados (ya en memoria del proyecto).

5. **Limpieza imports muertos / `.deprecated`**: pasar `knip` o búsqueda manual de exports no usados; eliminar.

6. **Memoria del proyecto**: actualizar `mem://index.md` con la nueva geografía de carpetas.

### Fase C — Hardening de despliegue continuo (paralelo a B)
1. **CI gate**: `ci.yml` ya existe; agregar paso `bun run build` + `curl` post-publish a `/` y `/inversionistas` esperando 200; falla si 500.
2. **Health route**: `src/routes/api/public/health.ts` que no toca DB, devuelve `{ok:true,commit}`. Stable para uptime monitor externo.
3. **Server-fn protegidas en loaders públicos**: auditar los 64 `.functions.ts` y confirmar que ninguno con `requireSupabaseAuth` se invoca desde loader de ruta pública (causa 401 en SSR/build:dev).
4. **Top-level `process.env`**: grep todos los `.functions.ts` por `process.env` fuera de `.handler()` — mover dentro.
5. **`client.server` leakage**: grep `from '@/integrations/supabase/client.server'` en archivos NO `.server.ts` y NO dentro de handlers `await import()` — corregir.
6. **Linter Supabase**: correr `supabase--linter` post-Fase A, dejar 0 errores.

## 3. Detalles técnicos

- **SSR fix**: no se reescribe el wrapper (ya tiene 4 capas correctas); el problema es que la causa raíz aún no se ha identificado por falta de log capturado. La acción es **instrumentación primero, fix después**, no más capas defensivas.
- **Reagrupación de rutas**: usar carpetas `(group)` de TanStack — el route-tree generator las soporta sin alterar `createFileRoute("/...")` strings. Mover archivos uno por uno con `git mv` (en este caso `mv` del sandbox + dejar que el plugin regenere `routeTree.gen.ts`).
- **Lib refactor**: cada movimiento es un commit atómico (1 dominio = 1 turno) para no romper imports masivamente.
- **Sin tocar**: `integrations/supabase/*` (auto-gen), `engine3d/*` (estable), 3D viewers existentes.

## 4. Riesgos
- **A.3**: si el error real es un módulo Node-only (sharp, child_process), puede requerir reemplazar paquete; el log dirá cuál.
- **B**: mover 75 rutas/64 libs genera muchos diffs; hacerlo por dominio reduce blast radius.
- **C.3-5**: auditoría de 64 functions es ~30 min de grep; barato y rentable.

## 5. Entregables
| Fase | Output | Tiempo |
|---|---|---|
| A | Producción 200 + root cause documentada | hoy |
| B | Carpetas reorganizadas + AppShell único + mem actualizada | 3-4 días |
| C | CI gate verde + health endpoint + 0 leaks server-only | 1-2 días, paralelo |

Tras Fase A entrego ya el sitio estable; con A+B+C la plataforma queda lista para sumar el plan investor (sprints separados).

Confirma y arranco con **Fase A.1** (instrumentación + re-deploy + diagnóstico).
