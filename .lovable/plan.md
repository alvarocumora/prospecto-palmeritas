
User wants to continue with the phases. Let me check what phases are pending from the original strategic plan.

Phases completed so far:
- **Fase 1**: QA/QC ✅, Roles granulares ✅, Workflow aprobación ✅, Dashboard ejecutivo KPIs ✅
- **Fase 2**: Targets Pipeline (Kanban) ✅
- **Fase 3**: Inventario físico (core boxes + custody) ✅
- **Fase 4**: Costos & Budget por campaña ✅

Pending phases mentioned originally:
- **Fase 5**: Reportes ejecutivos PDF mensuales (snapshot KPIs + targets + QA/QC + costos)
- **Fase 6**: HSE & Compliance (permisos ambientales, incidentes, comunidad)
- **Fase 7**: Auditoría completa & data lineage
- Plus user said "revisar y compilar" → review/compile what's been built

Approach: Do **Fase 5 (Reportes Mensuales)** + **Fase 6 (HSE)** in this sprint, since they close the governance loop. Then a brief consolidation pass.

## Plan: Fase 5 + Fase 6

### Fase 5 — Reporte Mensual Ejecutivo (PDF)
New module `/dashboard/reports` that generates a monthly snapshot PDF consolidating everything:
- Cover with project + month range
- KPIs (drilling meters, samples, Au avg, costs)
- Targets pipeline status (counts by stage)
- QA/QC compliance (pass/warn/fail rate)
- Approval workflow status (pending/approved counts)
- Budget vs Actual (USD/m, by category)
- Top 5 intercepts of the month
- Inventory custody movements

**Files**:
- `src/lib/pdf/monthly-report.ts` — generator using existing `primitives.ts`
- `src/routes/_authenticated.dashboard.reports.tsx` — UI with month selector + download button
- Reuse: `useExecutiveKpis`, `useQaQc`, `useExplorationTargets`, `useCampaignFinance`

### Fase 6 — HSE & Compliance
Track environmental permits, safety incidents, community engagement events.

**Schema (migration)**:
- `hse_permits` (project_id, permit_type, authority, number, issued_at, expires_at, status, document_url, notes)
- `hse_incidents` (project_id, occurred_at, severity, category, description, people_affected, corrective_actions, status, reported_by)
- `community_events` (project_id, event_type, community_name, event_date, attendees, summary, commitments, follow_up_date)
- RLS: members view, hse_officer + admins edit
- Validation triggers for enums

**Frontend**:
- `src/hooks/useHse.ts` — CRUD for permits/incidents/community
- `src/routes/_authenticated.dashboard.hse.tsx` — 3-tab interface:
  1. Permits (with expiration alerts <90 days)
  2. Incidents (severity color-coded, status tracker)
  3. Community (engagement log)
- KPI strip: active permits, expiring soon, open incidents, last community event

### Consolidation
- Add **Reports** + **HSE** entries to sidebar in `_authenticated.tsx`
- Update `MODULE_ROLES` in `useProjectRole.ts` (hse → hse_officer + admins; reports → all except viewer)
- Add HSE & Reports KPIs to executive dashboard (expiring permits, open incidents)

### Architecture diagram
```text
Dashboard
├── Governance (existing)
│   ├── Approvals
│   ├── QA/QC
│   └── Audit
├── Operations (existing)
│   ├── Drilling, Sampling, Geophysics, Drones
│   ├── Targets, Inventory, Finance
└── Compliance (NEW)
    ├── HSE (permits, incidents, community)
    └── Monthly Reports (PDF snapshot)
```

### Out of scope
- Real document storage (will use URL field, file upload bucket later)
- Email notifications for expiring permits (future sprint)
- Multilingual reports (Spanish only for now)
