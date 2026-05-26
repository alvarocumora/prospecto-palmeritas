# Plan de Estabilización: 1 Centro de Mando + limpieza de rutas y tablas

## Diagnóstico actual

- **62 archivos de rutas**, con varias pantallas que cumplen rol de "dashboard":
  - `dashboard/index` (Mission Control)
  - `dashboard/command-center`
  - `dashboard/map`, `dashboard/field-map`
  - `dashboard/3d-pro`, `dashboard/geology3d`, `dashboard/sat3d`
  - Dashboards de proyecto-piloto: `dashboard/palmeras`, `dashboard/franco`, `dashboard/lv5-page5`
  - Vistas live duplicadas: `live.palmeras`, `live.franco`, `live.losverdes`
- **200 tablas en `public`**, de las cuales **108 están vacías** (muchas son features inacabadas: `card_*`, `escrito_templates`, `mining_owner_profiles`, `marketplace_layer_reviews`, `satellite_layer_cache`, `dem_diffs`, `geology_wireframes`, etc.)
- Top de uso real: `cadastre_*`, `mineral_deposits`, `job_*`, `audit_log`, `resource_blocks`, `drill_*`, `sampling_results`, `exploration_targets`, `satellite_anomalies`.

## Objetivo

1. **Una sola ruta es el Centro de Mando**: `/dashboard` (`_authenticated.dashboard.index.tsx`).
2. Resto de pantallas pasan a ser **módulos** accesibles desde el sidebar, no "dashboards alternativos".
3. Eliminar rutas obsoletas y tablas huérfanas sin romper features vivos.

---

## Fase 1 — Consolidación de dashboards (UI, sin tocar DB)

**Centro de Mando único:** `/_authenticated/dashboard/` (Mission Control existente).

- **Fusionar** `command-center` dentro del index (mover sus widgets útiles), luego eliminar la ruta.
- **Renombrar conceptualmente** y degradar a módulos:
  - `3d-pro`, `geology3d`, `sat3d` → un solo módulo `/dashboard/3d` con tabs (Geology / Satellite / Pro).
  - `map`, `field-map` → un solo `/dashboard/map` con toggle "campo".
- **Dashboards de proyecto piloto** (`palmeras`, `franco`, `lv5-page5`):
  - Sacarlos del nav principal.
  - Mantenerlos detrás de una sola entrada genérica `/dashboard/project-report` que detecta el proyecto activo y carga el feature correspondiente (`features/palmeras`, `features/franco`).
- Actualizar `TopBar` + `ROUTE_LABELS` y el sidebar para reflejar la nueva IA (information architecture).

**Entregable Fase 1:** UI con un solo "centro de mando", sin borrar archivos todavía.

---

## Fase 2 — Limpieza de rutas

Borrar/redirigir rutas reemplazadas:

```text
ELIMINAR
  _authenticated.dashboard.command-center.tsx     → merged en /dashboard
  _authenticated.dashboard.3d-pro.tsx             → /dashboard/3d (tab pro)
  _authenticated.dashboard.geology3d.tsx          → /dashboard/3d (tab geology)
  _authenticated.dashboard.sat3d.tsx              → /dashboard/3d (tab satellite)
  _authenticated.dashboard.field-map.tsx          → /dashboard/map (modo campo)
  _authenticated.dashboard.lv5-page5.tsx          → behind /dashboard/project-report
  live.losverdes.tsx                              → no project activo, candidato a borrar
REVISAR (mantener si tienen tráfico real)
  diag.mining-engine.tsx, validation, mag-revalidations  → mover a /dashboard/admin/*
```

Para cada ruta borrada: redirección suave desde `__root` o un `notFoundComponent` que apunte a `/dashboard`. Validar `routeTree.gen.ts` se regenere limpio.

---

## Fase 3 — Limpieza de tablas

Política: **borrar solo si vacías + sin código que las referencie + sin FK entrantes**.

Pipeline por tabla candidata:
1. `SELECT count(*)` (ya tenemos 108 vacías).
2. `rg <table_name> src/ supabase/ services/` → 0 hits.
3. `SELECT … FROM pg_constraint WHERE confrelid = <oid>` → sin FKs entrantes.
4. Si pasa los 3 filtros → migration `DROP TABLE` agrupada por dominio.

**Lotes propuestos** (una migration por lote, revisable):

- **Lote A — features muertas obvias**: `card_comments`, `card_mentions`, `escrito_templates`, `mining_owner_profiles`, `marketplace_layer_reviews`, `workspace_function_roles`, `community_events`, `team_member_profiles`.
- **Lote B — satellite duplicado**: revisar y consolidar `satellite_jobs` vs `satellite_analysis_jobs`, `satellite_layers` vs `satellite_layer_cache`, `satellite_evidence` vs `satellite_evidence_reports`, `satellite_shared_views`, `satellite_targets`, `satellite_timeseries_points`, `stac_acquisitions`.
- **Lote C — catastro / holders duplicados**: `public_concessions_cache`, `public_holders`, `holder_files`, `holder_links`, `concession_files`, `concession_field_changes` (si están vacíos y reemplazados por `cadastre_*`).
- **Lote D — billing/credits sin uso**: `credit_ledger`, `credit_wallets`, `subscriptions`, `user_subscriptions`, `usage_counters` (mantener solo `billing_plans` + `organization_subscriptions`).
- **Lote E — QPS / signatures sin uso**: `signature_envelopes`, `signature_audit_trail`, `document_signatures`, `qp_signed_layers`, `evidence_qp_*`, `certifier_*` (si la feature QPS no está activa).
- **Lote F — misceláneas vacías**: `dem_diffs`, `geology_wireframes`, `map_annotations`, `map_views`, `user_map_layer_prefs`, `validation_snapshots`, `change_log`, `tenant_audit_log`, `client_error_log`.

Cada lote = 1 migration con `DROP TABLE IF EXISTS … CASCADE` solo tras confirmar los 3 filtros.

---

## Fase 4 — Verificación

- `npm run validate` + typecheck.
- Smoke manual: login → `/dashboard` carga, sidebar muestra módulos consolidados, navegación a 3D/Map/Estimation/Catastro/Targets funciona.
- `supabase--linter` para detectar policies huérfanas tras los DROPs.
- Actualizar `mem://plan/produccion-maestra` con la nueva IA.

---

## Preguntas antes de ejecutar

1. **Pilotos** (`palmeras`, `franco`, `lv5-page5`): ¿los conservamos detrás de `/dashboard/project-report` o los archivamos del todo?
2. **Feature QPS / firmas**: ¿está realmente en uso o puedo borrar el Lote E completo?
3. **Billing**: ¿usamos `organization_subscriptions` (es la activa) o el set `subscriptions`/`user_subscriptions`?

Con esas 3 respuestas arranco Fase 1 directamente.
