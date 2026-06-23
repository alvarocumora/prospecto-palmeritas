# Plan — Estabilización + UI/UX unificada + Back↔Front

## Paso 0 · Desbloquear el build (crítico, primero)

El último build falla con:
```
[commonjs--resolver] Could not load /dev-server/node_modules/entities/lib/decode.js: ENOENT
```

Causa: en `vite.config.ts` se añadieron aliases `entities/lib/decode.js` y `entities/lib/encode.js` apuntando a `node_modules/entities/lib/...`, pero `entities@6` tiene esos archivos en la raíz del paquete (`node_modules/entities/decode.js`), no en `lib/`. Mientras esto no se arregle, nada se despliega.

Acción: corregir los dos `replacement` en `vite.config.ts` para que apunten a `entities/decode.js` y `entities/encode.js` (y verificar con `bun run build:dev` antes de seguir).

---

## Fase A · Rutas públicas estables (1 día)

Objetivo: `/`, `/inversionistas`, `/terminal`, `/catastro`, `/contacto`, `/auth` devuelven 200 reales (no fallback) en producción.

1. Tras Paso 0, redeploy y `curl -sI` a las 6 rutas. Si alguna sigue 500, leer `stack_modern--server-function-logs` (el wrapper de `src/server.ts` ya loguea `[geo-ssr-500]` con stack).
2. Auditar loaders de las rutas públicas: ninguno debe llamar serverFn con `requireSupabaseAuth` (causa 401 en SSR/build:dev). Mover esas llamadas a `useQuery` en componente.
3. Auditar `process.env.*` a nivel de módulo en todos los `.functions.ts` y rutas `/api/public/*` — mover dentro de `.handler()`.
4. Auditar imports top-level de `@/integrations/supabase/client.server` fuera de `*.server.ts` — mover a `await import()` dentro del handler.
5. Crear `src/routes/api/public/health.ts` → `{ok:true, commit, ts}` sin tocar DB (para uptime monitor + CI gate).
6. Endurecer `.github/workflows/ci.yml`: paso `bun run build:dev` + `curl` post-deploy a `/` esperando 200; falla el pipeline si 500.

---

## Fase B · Unificar UI/UX bajo un AppShell único (2-3 días)

Decisión del usuario: mantener estética actual (dark Bloomberg-terminal), solo unificar.

1. Definir contrato `src/components/shell/AppShell.tsx` (ya en memoria) con slots: `header`, `sidebar?`, `subnav?`, `main`, `footer?`, props de densidad y ancho. Tokens semánticos de `src/styles.css` (sin colores hardcoded).
2. Refactor de las 4 shells existentes para heredar de AppShell sin perder identidad:
   - `MarketingShell` (público + landing)
   - `TerminalShell` (Bloomberg-style)
   - `DashboardShell` (operador interno, hoy implícito en rutas `_authenticated.dashboard.*`)
   - `PortalShell` (NUEVO, vacío por ahora, para investor)
3. Unificar primitives compartidas: header, footer, breadcrumbs, page-title, empty-state, error-state, loading-skeleton, KPI card, data-table. Todas en `src/components/shell/` consumiendo solo tokens.
4. Pasada de QA visual: spacing, tipografía (mono + sans del proyecto), focus states, dark contrast AA. Capturas Playwright a `/`, `/terminal`, `/dashboard`, `/inversionistas`.
5. Sin cambios de URL ni de lógica de negocio en esta fase.

---

## Fase C · Auditoría back↔front (entregable: matriz)

Generar `docs/audit/backend-frontend-matrix.md` con una fila por hook/feature:

| Hook / feature | Tabla(s) Supabase | Estado | Notas |
|---|---|---|---|
| `useProjects` | `projects`, `project_members` | real | RLS ok |
| `useGeologyData` | `geological_features`, `lithology_units` | parcial | falta wire de wireframes |
| `TrackminDashboard.kpis` | — | mock | hardcoded en `data/overview.ts` |
| … | … | … | … |

Cobertura:
- 71 hooks en `src/hooks/`
- 64 archivos en `src/lib/` (functions + helpers)
- 35 edge functions Supabase
- 135 tablas

Salida: tabla completa + lista priorizada de "wire-ups pendientes" (lo que está mock y debería ser real) ordenada por impacto investor (catastro, satelital, NI 43-101, deals, data room). No se cablea nada en esta fase — solo el reporte.

---

## Fase D · Reorganización de carpetas (paralelizable con C)

Sin cambio de URLs (TanStack soporta carpetas `(group)`).

`src/routes/`:
```
(marketing)/     → index, inversionistas, empresas, proyectos, recursos, contacto
(public-tools)/  → catastro.*, live.*, share.*
auth.tsx
_authenticated/
  dashboard/     → ~40 archivos actuales (operador)
  portal/        → (vacío, futuro investor)
  admin/         → admin.*, approvals, audit
api/public/      → ya existe
```

`src/lib/`:
```
catastro/   losverdes/   satellite/   livemap/   ni43101/
mining/     ai/          pdf/         core/      email/
notifications/   (ya existe)
```

Mover por dominio, un commit por dominio, find/replace de imports.

Al final: actualizar `mem://index.md` con la nueva geografía.

---

## Entregables y orden

| # | Entregable | Tiempo | Bloquea |
|---|---|---|---|
| 0 | Fix `entities` aliases en `vite.config.ts` | 5 min | TODO |
| A | Rutas públicas 200 + health endpoint + CI gate | 1 día | publish |
| B | AppShell único + 4 shells refactorizadas | 2-3 días | — |
| C | Matriz back↔front (reporte) | 1 día (paralelo a B) | wire-ups futuros |
| D | Carpetas reorganizadas + mem actualizada | 1-2 días (paralelo a B/C) | — |

Tras aprobar este plan ejecuto Paso 0 + Fase A en el primer turno (es lo que desbloquea el despliegue). B, C, D siguen como sprints separados.
