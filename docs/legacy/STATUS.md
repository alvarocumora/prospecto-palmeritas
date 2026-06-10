# Geocapitals · Estado del Proyecto

**Generado:** 2026-04-19 · **Stack:** TanStack Start v1 + React 19 + Vite 7 + Lovable Cloud (Supabase)
**Proyecto demo:** Prospecto Las Palmeras (TRK-ALH-001 · Au-Ag · Atacama, Chile)

---

## ✅ Verificación técnica

| Check                                   | Resultado                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| TypeScript (`tsc --noEmit`)             | **0 errores**                                                                    |
| Supabase Linter (RLS / índices)         | **0 issues**                                                                     |
| Capas Fase 7 enchufadas en `ProjectMap` | OK (`sernageominLayers`, `satelliteLayers`, `targetsLayer`, `geoIntelInspector`) |
| Sidebar HSE + Reports                   | OK (`_authenticated.tsx` líneas 146-147)                                         |
| Permisos por módulo (`useProjectRole`)  | OK (`hse`, `reports` listados)                                                   |
| Auth + sesión activa en preview         | OK (super_admin, proyecto cargado)                                               |
| ESLint                                  | Solo warnings de Prettier (formato), sin errores funcionales                     |

---

## 📦 Fases implementadas

| Fase     | Alcance                                                               | Archivos clave                                                                                   |
| -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **1**    | QA/QC + roles + workflow aprobación + KPIs ejecutivos                 | `useQaQc`, `useRecordApproval`, `useExecutiveKpis`, `RecordStatusBadge`, `RoleGate`              |
| **2**    | Pipeline de targets de exploración                                    | `useExplorationTargets`, `_authenticated.dashboard.targets.tsx`, `targetsLayer.ts`               |
| **3**    | Inventario de testigos (core boxes)                                   | `useCoreInventory`, `_authenticated.dashboard.inventory.tsx`                                     |
| **4**    | Finanzas de campaña (presupuesto vs gasto)                            | `useCampaignFinance`, `_authenticated.dashboard.finance.tsx`                                     |
| **5**    | Reportes PDF mensuales + NI 43-101                                    | `lib/pdf/monthly-report.ts`, `lib/export-ni43101-pdf.ts`, `_authenticated.dashboard.reports.tsx` |
| **6**    | HSE: permisos + incidentes + comunidad                                | `useHse`, `_authenticated.dashboard.hse.tsx`                                                     |
| **7**    | Capas geocientíficas reales (SERNAGEOMIN, Sentinel-2, Copernicus DEM) | `sernageominLayers.ts`, `satelliteLayers.ts`, `geoIntelInspector.ts`                             |
| **Auth** | Login rediseñado con experiencia geológica                            | `auth.tsx`, `assets/auth-hero.jpg`                                                               |

---

## 🗺️ Inventario de rutas (30 archivos)

```
/                          index.tsx (landing)
/auth                      auth.tsx (login rediseñado)
/reset-password            reset-password.tsx
/invitations/$token        invitations.$token.tsx

/dashboard                 _authenticated.dashboard.index.tsx (KPIs ejecutivos)
/dashboard/map             mapa principal con todas las capas
/dashboard/catastro        catastro SERNAGEOMIN
/dashboard/geophysics      surveys + field capture (subrutas $surveyId)
/dashboard/drilling        sondajes + core logs
/dashboard/sampling        muestreo + assays
/dashboard/qaqc            estándares + duplicados + blanks
/dashboard/approvals       cola de aprobación de registros
/dashboard/audit           audit log
/dashboard/targets         pipeline de targets
/dashboard/campaigns       campañas de exploración
/dashboard/inventory       core boxes
/dashboard/finance         presupuesto vs gasto
/dashboard/reports         PDF mensual + NI 43-101
/dashboard/hse             permisos + incidentes + comunidad
/dashboard/drones          vuelos + ortofotos
/dashboard/palmeras        módulo específico del prospecto
/dashboard/marketplace     stub
/dashboard/projects        gestión de proyectos
/dashboard/team            miembros + invitaciones
/dashboard/profile         perfil de usuario
/dashboard/admin           super-admin (gestión global)
```

---

## 🗄️ Base de datos

**26 tablas** con RLS habilitado y políticas por rol de proyecto.

**Funciones SECURITY DEFINER** (10):

- `is_project_member`, `has_project_role`, `is_super_admin` — auth helpers
- `handle_new_user`, `add_project_owner_member` — triggers de signup
- `accept_project_invitation`, `get_invitation_preview` — flujo de invitaciones
- `log_audit_change` — trigger genérico de auditoría
- `update_updated_at_column` — trigger de timestamps

**Validaciones por trigger** (en lugar de CHECK constraints):
`validate_target_workflow`, `validate_sample_custody`, `validate_record_status`, `validate_core_box`, `validate_campaign_finance`, `validate_expense`, `validate_hse_permit`, `validate_hse_incident`, `validate_community_event`.

---

## 🌍 Capas de mapa (Fase 7 completa)

| Grupo              | Capas                                                                                          | Fuente                          |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| **Basemap**        | OSM · Satélite · Topo                                                                          | Esri / OSM                      |
| **Geología Chile** | SERNAGEOMIN 1:1M · Yacimientos · Faenas · Macrostrat (fallback)                                | SERNAGEOMIN ArcGIS REST público |
| **Satelital**      | Sentinel-2 true color · Alteración arcillosa B11/B12 · Óxidos B4/B2 · Copernicus DEM hillshade | EOX · Esri World Elevation      |
| **Geofísica**      | EMAG2 (regional) · WGM2012 Bouguer · Surveys del proyecto                                      | NOAA · BGI · DB                 |
| **Catastro**       | Concesiones SERNAGEOMIN                                                                        | ArcGIS REST oficial             |
| **Proyecto**       | AOI · vetas · sondajes · muestras · drones · targets                                           | DB + GeoJSON local              |

**Inspector multi-fuente** (`geoIntelInspector.ts`): click en mapa → litología SERNAGEOMIN + elevación + distancia a yacimiento más cercano.

---

## 🧪 Flujos verificados vs pendientes

### ✅ Verificado automáticamente

- Compilación TypeScript completa
- RLS policies sin warnings de seguridad
- Sesión Supabase activa y proyecto cargando (`/dashboard/catastro` 200 OK)
- Imports de capas Fase 7 resueltos

### ⏳ Pendiente de QA manual (recomendado)

- Crear/editar/aprobar un drill_core_log y verificar audit_log
- Importar CSV de stations y assays (componentes `StationCsvImport`, `AssayCsvImport`)
- Generar PDF mensual con datos reales (`/dashboard/reports`)
- Crear permiso HSE con vencimiento futuro y verificar badge
- Click en mapa para validar el inspector multi-fuente
- Aceptar una invitación con un email distinto al owner

---

## 🚀 Próximos pasos sugeridos

1. **Notificaciones email** para permisos HSE por vencer (edge function + cron + Resend).
2. **Storage bucket** para documentos HSE y fotos de incidentes (`hse-docs`, `incident-photos`).
3. **Datalineage**: registrar provenance de cada assay (lab, batch, certificado URL → tabla `qaqc_results` ya soporta `certificate`).
4. **Dashboard ejecutivo móvil**: vista responsive del KPI dashboard para uso en campo.
5. **Cron job** para sincronizar catastro SERNAGEOMIN semanalmente y detectar concesiones nuevas/canceladas.
6. **Format pass**: correr `prettier --write src/` para limpiar warnings de formato (no afectan funcionalidad, solo estética del código).

---

## 📂 Estructura final del proyecto

```
src/
├── routes/                 30 archivos · file-based TanStack
├── components/
│   ├── map/                28 archivos · todas las capas + inspector
│   ├── drilling/           CoreLogPanel, StripLog
│   ├── sampling/           AssayCsvImport
│   ├── geophysics/         FieldCaptureMap, StationCsvImport
│   ├── team/               InviteMemberDialog, MembersTable
│   └── ui/                 shadcn (50+ componentes)
├── hooks/                  27 hooks · sin duplicación detectada
├── lib/
│   ├── pdf/                monthly-report + ni43101 + figures + primitives
│   ├── geo/                parseKml
│   ├── sampling/           assayParser
│   ├── section/            projection
│   └── drilling/           intercepts
├── data/geo/               GeoJSON locales (AOI, vetas, workings)
└── integrations/supabase/  cliente + middleware (auto-generado)
```

**Total:** ~150 archivos · 0 duplicación funcional · 0 errores TS · 0 warnings RLS.
