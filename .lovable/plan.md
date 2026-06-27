
# Plan: Onboarding real + Landing + Dashboard segmentado

Objetivo: abrir la puerta a clientes reales (inversionistas, equipos técnicos, holders) con un flujo self-serve, una landing que muestra datos vivos, y un dashboard que cambia según el rol — todo conectado al backend ya existente (135 tablas, 35 edge functions, hooks reales).

---

## Fase 1 — Completar rutas públicas (medio día)

Auditar y asegurar que estas rutas devuelven 200 con SSR, sin tocar `requireSupabaseAuth` en loaders públicos:

- `/` (landing) · `/inversionistas` · `/empresas` · `/recursos` · `/contacto` · `/proyectos` · `/terminal` · `/catastro` · `/auth` · `/unsubscribe`
- `/api/public/health` ya existe — añadir `/api/public/stats` (server route con publishable key + `TO anon` SELECT) que devuelve: nº concesiones monitoreadas, anomalías satelitales últimos 30d, deals activos, proyectos públicos.
- Crear `notFoundComponent` y `errorComponent` consistentes en cada ruta pública.

## Fase 2 — Landing con datos reales (1 día)

Reemplazar contadores hardcoded del `HeroLiveMap` y `MarketingLanding` por datos vivos del nuevo `/api/public/stats`:

- **Hero counters**: "X concesiones monitoreadas · Y anomalías detectadas esta semana · Z deals activos" (refresh cada 60s vía `useQuery`).
- **Sección "Cómo funciona" por audiencia** — 3 tabs con CTAs diferenciados:
  - *Inversionista* → "Ver deal flow" → `/inversionistas` → CTA "Crear cuenta gratis"
  - *Equipo técnico* → "Ver workspace de proyecto" → demo Palmeras/Franco → CTA "Empezar proyecto"
  - *Holder* → "Monitorear mis concesiones" → `/catastro` → CTA "Activar alertas"
- **Un solo CTA dominante** sticky en header: "Crear cuenta gratis" → `/auth?mode=signup`.
- **Proof points reales**: cards con métricas Palmeras (Cu/Mo), Franco (Au), LV5 (Illapel) extraídas de `projects` públicos.

## Fase 3 — Self-serve signup + perfil (1 día)

- `/auth` ya soporta email + Google (Lovable Cloud). Verificar que Google esté configurado vía `configure_social_auth`.
- Trigger DB: al crear `auth.users`, auto-insertar fila en `profiles` con `onboarding_status='pending'` y rol por defecto `viewer` en `app_roles`.
- Wizard post-signup en `/dashboard` (primer login):
  1. "¿Cuál es tu perfil?" → investor / technical / holder / explorer (guarda en `profiles.profile_type`)
  2. "¿Cuál es tu objetivo?" (opciones por perfil)
  3. "Conecta tu primer dato" (investor: watchlist · technical: crea/únete a proyecto · holder: importa RUT/folio)
- Persiste progreso en `onboarding_status` (ya existe la tabla).

## Fase 4 — Dashboard general segmentado (2 días)

Refactor `/dashboard` (ruta `_authenticated/dashboard`) en un layout único `AppShell variant="workspace"` con 3 zonas:

**Header KPIs ejecutivos reales** — via `useExecutiveKpis` ya existente:
- Proyectos activos · Alertas catastro sin leer · Anomalías sat nuevas · Deals en pipeline · Vencimientos próximos 90d

**Onboarding checklist** (colapsa cuando `onboarding_status='completed'`):
- ☐ Perfil completo · ☐ Primer proyecto / watchlist · ☐ Equipo invitado · ☐ Primera alerta configurada · ☐ Primer reporte / data room

**Acceso rápido por rol** — cards distintas según `profile_type`:
- **Investor** → Deal flow (`deals` activos), Watchlist catastro, Data rooms con acceso, Reportes NI 43-101 firmados recientes
- **Technical/Geologist** → Proyecto activo (último visitado), Drill holes pendientes QAQC, Targets sin validar, Anomalías sat del AOI
- **Holder** → Mis concesiones (`concession_holders`), Patentes próximas a vencer, Bulletin alerts, Court cases abiertos
- **Admin/PM** → Equipo + invitaciones pendientes, Audit log reciente, Compliance score, Subscription status

**Feed de actividad** (últimos 7 días) — query unificada sobre `audit_log` + `catastro_alerts` + `satellite_anomalies` + `signature_audit_trail` + `project_invitations`.

## Fase 5 — Conexión back↔front sin mocks (paralelo)

Auditar y reemplazar mocks en las pantallas que el onboarding tocará primero:
- `OpportunitiesMap` → `usePropertyListings` real
- `TerminalShell` → `useExecutiveKpis` + `useCommodityPrices`
- `PalmerasDashboard` overview → `useProjectMiningConcessions` + `useProjectSatelliteAnomalies`
- Reporte: `docs/audit/back-front-coverage.md` con tabla `hook · tabla · pantalla · estado (real/mock/parcial)`.

## Fase 6 — Verificación

- Playwright headless: `/`, `/auth` signup flow, `/dashboard` con cuenta nueva (3 perfiles), `/dashboard` con cuenta poblada.
- `bun run build:dev` verde.
- Lighthouse landing > 90 performance / SEO.

---

## Detalles técnicos

- **No nuevas tablas mayores** — usar `profiles.profile_type` (añadir columna) + `onboarding_status` existente.
- **Migration mínima**: 1) `profiles.profile_type text`, 2) trigger `handle_new_user` que inserta profile + onboarding_status + rol viewer, 3) `/api/public/stats` requiere políticas `TO anon SELECT` solo en agregados (vistas materializadas si hace falta).
- **Dashboard re-usa `AppShell variant="workspace"`** ya existente — no se crea shell nuevo.
- **Hooks ya existen** para todos los KPIs — `useExecutiveKpis`, `useConcessionAlerts`, `useUnreadCatastroAlerts`, `useProjects`, `useProjectRole`, `useOnboardingStatus` (crear si falta).
- **Lovable AI Gateway** para el wizard "sugerir próximos pasos" en onboarding (opcional, Fase 4+).

## Orden de ejecución sugerido

1. Fase 1 (rutas + `/api/public/stats`) — desbloquea landing.
2. Fase 2 (landing) — desbloquea signups.
3. Fase 3 (signup + wizard) — desbloquea dashboard segmentado.
4. Fase 4 (dashboard) — entrega de valor al cliente.
5. Fase 5 (auditoría/mocks) en paralelo desde día 2.
6. Fase 6 al final.

Estimación total: **5–6 días** de trabajo enfocado.
