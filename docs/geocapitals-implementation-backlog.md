# Geocapitals implementation backlog

This backlog converts the Geocapitals executive vision into implementable engineering PRs.

Source document:

- `docs/geocapitals-executive-summary.md`

## Strategy

The highest-leverage sequence is:

1. Harden the current technical base.
2. Continue extracting data access and map architecture.
3. Add observability primitives.
4. Add SaaS controls: plans, feature flags, usage limits.
5. Implement AI/3D differentiators on top of a cleaner foundation.

The next PRs should avoid large feature rewrites. Each one should preserve current UI behavior unless explicitly marked as a product feature PR.

---

# Recommended PR sequence

## PR A — Finish mining concessions query modernization

### Goal

Migrate `useMiningConcessions` to React Query, preserving:

```ts
const { data, loading, error, refresh } = useMiningConcessions(projectId);
```

### Why

This completes the same pattern already applied to geology and geophysics.

### Files

- `src/hooks/useMiningConcessions.ts`

### Acceptance criteria

- `refresh` calls `query.refetch`.
- Query key includes `projectId`.
- Missing `projectId` returns `[]` through the service.
- Existing imports keep working.
- Tests pass.

### Risk

Medium.

---

## PR B — Add request-id utility foundation

### Goal

Prepare observability without changing backend contracts yet.

### Files

```txt
src/lib/observability/requestId.ts
src/lib/observability/requestId.test.ts
```

### Implementation

Add utilities to:

- Generate client request IDs.
- Normalize existing request IDs.
- Create headers for future edge function calls.

### Acceptance criteria

- Deterministic tests for ID normalization.
- No runtime integration yet.

### Risk

Low.

---

## PR C — Add feature flag foundation

### Goal

Prepare SaaS commercial controls: plan-based enablement and tenant capabilities.

### Files

```txt
src/lib/features/featureFlags.ts
src/lib/features/featureFlags.test.ts
src/types/featureFlags.ts
```

### Initial flags

```txt
geocapital.ai_copilot
geocapital.ni43101_export
geocapital.investor_crm
geocapital.marketplace
geocapital.advanced_3d
geocapital.bulk_sync
```

### Acceptance criteria

- Static evaluator supports plan + explicit override.
- No DB dependency yet.
- Tests cover enabled/disabled/override behavior.

### Risk

Low.

---

## PR D — Add usage limit primitives

### Goal

Prepare tenant-level usage limits before full SaaS billing.

### Files

```txt
src/lib/usage/limits.ts
src/lib/usage/limits.test.ts
src/types/usage.ts
```

### Initial limit domains

- Projects per organization.
- AI briefs per month.
- NI 43-101 exports per month.
- Storage GB.
- Heavy sync jobs per day.

### Acceptance criteria

- Pure functions only.
- Plan defaults are typed.
- Supports future DB-backed usage values.

### Risk

Low.

---

## PR E — Add job status model foundation

### Goal

Prepare the job runner roadmap without implementing workers yet.

### Files

```txt
src/types/jobs.ts
src/lib/jobs/status.ts
src/lib/jobs/status.test.ts
```

### Initial statuses

```txt
queued
running
succeeded
failed
retrying
cancelled
stale
```

### Acceptance criteria

- Status classifier can identify stale jobs from timestamps.
- Retry eligibility helper is tested.
- No Supabase schema changes yet.

### Risk

Low.

---

## PR F — Add Fusion Score model foundation

### Goal

Prepare AI + 3D target scoring with a pure scoring utility.

### Files

```txt
src/types/fusionScore.ts
src/lib/fusionScore/scoring.ts
src/lib/fusionScore/scoring.test.ts
```

### Inputs

- Geophysics score.
- Geochemistry score.
- Structural score.
- Satellite alteration score.
- Drilling confidence.

### Output

```ts
type FusionScore = {
  score: number;
  confidence: "low" | "medium" | "high";
  drivers: string[];
};
```

### Acceptance criteria

- Pure deterministic scorer.
- Weighted model is explicit.
- Tests cover low/medium/high confidence.

### Risk

Low/medium.

---

## PR G — Add GeoCopilot evidence types

### Goal

Prepare traceable AI explainer and brief generation.

### Files

```txt
src/types/geoCopilot.ts
src/lib/geoCopilot/evidence.ts
src/lib/geoCopilot/evidence.test.ts
```

### Evidence categories

- Target.
- Intercept.
- Lithology.
- Alteration.
- Concession.
- Permit.
- Assay.
- Raster.

### Acceptance criteria

- Evidence references are typed.
- Helper groups evidence by category.
- Helper generates compact evidence labels.

### Risk

Low.

---

## PR H — Continue ProjectMap extraction

### Goal

Once the full file is available locally, apply the hook wiring documented in:

- `docs/project-map-hook-wiring.md`

### Scope

- Replace basemap override inline effect with `useBasemapOverride`.
- Replace fullscreen local state/effect with `useFullscreenMap`.

### Acceptance criteria

- No visual map behavior changes.
- `npm run validate` passes.

### Risk

Medium due to size of `ProjectMap.tsx`.

---

# Product roadmap mapping

| Executive roadmap item       | Implementable next PRs                       |
| ---------------------------- | -------------------------------------------- |
| F1 — Endurecer seguridad     | PR B, later SECURITY DEFINER audit checklist |
| F2 — Job runner robusto      | PR E, then edge-function job status UI       |
| F3 — Modularización frontend | PR H + continued service/query migrations    |
| F4 — Fusion Score 3D + IA    | PR F + PR G                                  |
| F5 — SaaS multi-tenant       | PR C + PR D                                  |
| F6 — Observabilidad          | PR B + request headers integration           |
| F7 — Go-to-market            | Demo seed data + onboarding checklist later  |

---

# Recommended immediate order

1. PR A — Mining concessions React Query migration.
2. PR B — Request ID utility foundation.
3. PR C — Feature flag foundation.
4. PR D — Usage limit primitives.
5. PR F — Fusion Score model foundation.
6. PR G — GeoCopilot evidence types.

This order compounds the current architecture work while moving the product toward SaaS and AI differentiation.
