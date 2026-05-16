# Refactor execution plan

This document turns the engineering roadmap into an executable sequence of pull requests for Prospecto Palmeritas / Geocapitals.

## Objective

Stabilize the application architecture without interrupting product development. The current app already has valuable modules for geological intelligence, cadastral layers, geophysics, drilling, sampling, NI 43-101 reporting, dashboards, and Supabase-backed workflows. The next step is to reduce technical risk by separating large files into maintainable feature modules and services.

## Current baseline

The repository now includes a quality baseline:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run validate`
- Vitest configuration
- Smoke test
- GitHub Actions CI
- Initial engineering roadmap

All new refactor work should preserve these commands.

## Guiding principles

1. Small pull requests.
2. No visual redesign during structural refactors.
3. No business logic rewrites unless the PR explicitly targets that behavior.
4. Keep TanStack route files thin.
5. Move reusable logic into `features`, `services`, `hooks`, or `lib`.
6. Add tests around extracted logic when practical.
7. Avoid touching generated files manually.
8. Prefer typed interfaces over implicit object shapes.

---

# PR sequence

## PR 1 — Palmeras feature module extraction

### Goal

Reduce the size and responsibility of:

- `src/routes/_authenticated.dashboard.palmeras.tsx`

### Proposed target structure

```txt
src/features/palmeras/
  data/project.ts
  data/tabs.ts
  components/PalmerasDashboard.tsx
  components/PalmerasTopNav.tsx
  components/OverviewTab.tsx
  components/GeologyTab.tsx
  components/GeophysicsTab.tsx
  components/TargetsTab.tsx
  components/SamplingTab.tsx
  components/DrillProgramTab.tsx
  components/BudgetTab.tsx
  components/CrossSection.tsx
  components/primitives/Card.tsx
  components/primitives/Badge.tsx
  components/primitives/SectionTitle.tsx
  components/primitives/StatusDot.tsx
  types.ts
```

### Route after refactor

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { PalmerasDashboard } from "@/features/palmeras/components/PalmerasDashboard";

export const Route = createFileRoute("/_authenticated/dashboard/palmeras")({
  head: () => ({
    meta: [
      { title: "Trackmin GeoIntel · Prospecto Palmeras (TRK-ALH-001)" },
      {
        name: "description",
        content:
          "Dashboard de inteligencia geológica para Prospecto Palmeras, Alhué — exploración Au–Cu epitermal–mesotermal.",
      },
    ],
  }),
  component: PalmerasDashboard,
});
```

### Acceptance criteria

- Route behavior remains the same.
- Existing tabs render as before.
- No product copy changes unless required by extraction.
- `npm run validate` passes.
- The route file becomes a thin route wrapper.

### Risk level

Medium. The file is large and has many local components, but extraction can be done incrementally.

---

## PR 2 — ProjectMap hook extraction, phase 1

### Goal

Extract low-risk map concerns from:

- `src/components/ProjectMap.tsx`

### First extraction targets

```txt
src/components/map/hooks/useFullscreenMap.ts
src/components/map/hooks/useMeasurementTool.ts
src/components/map/hooks/useMapBasemapOverride.ts
```

### Acceptance criteria

- No map visual behavior changes.
- Fullscreen button still works.
- Measure tool still works.
- Basemap override still works for report capture.
- `npm run validate` passes.

### Risk level

Medium/high. Map interactions rely on Leaflet mutable refs, so keep changes surgical.

---

## PR 3 — ProjectMap layer orchestration extraction, phase 2

### Goal

Extract data-specific layer orchestration while keeping the main map component readable.

### Proposed hooks

```txt
src/components/map/hooks/useCatastroLayers.ts
src/components/map/hooks/useProjectConcessionLayer.ts
src/components/map/hooks/useDrillCollarLayer.ts
src/components/map/hooks/useSampleLayer.ts
src/components/map/hooks/useDroneLayer.ts
src/components/map/hooks/useTargetLayer.ts
src/components/map/hooks/useGeophysicsProjectLayers.ts
```

### Acceptance criteria

- Each hook owns only one layer domain.
- Layer IDs remain stable.
- Layer opacity panel continues to work.
- Active project switching still updates layers.
- `npm run validate` passes.

### Risk level

High. This should be split further if the diff becomes too large.

---

## PR 4 — Supabase services layer

### Goal

Move direct Supabase table access out of UI hooks where practical.

### Proposed structure

```txt
src/services/geology.service.ts
src/services/geophysics.service.ts
src/services/projects.service.ts
src/services/drilling.service.ts
src/services/sampling.service.ts
src/services/catastro.service.ts
```

### Example pattern

```ts
import { supabase } from "@/integrations/supabase/client";

export async function fetchGeologyData() {
  const [litho, alteration, minerals, features, references] = await Promise.all([
    supabase.from("lithology_units").select("*").order("display_order"),
    supabase.from("alteration_zones").select("*").order("display_order"),
    supabase.from("mineralogy").select("*").order("display_order"),
    supabase.from("geological_features").select("*").order("feature_code"),
    supabase.from("geo_references").select("*").order("year", { ascending: false }),
  ]);

  const firstError =
    litho.error || alteration.error || minerals.error || features.error || references.error;
  if (firstError) throw firstError;

  return {
    litho: litho.data ?? [],
    alteration: alteration.data ?? [],
    minerals: minerals.data ?? [],
    features: features.data ?? [],
    references: references.data ?? [],
  };
}
```

### Acceptance criteria

- UI hooks stop containing raw Supabase query composition where extracted.
- Error behavior remains equivalent or improves.
- Types remain explicit.
- `npm run validate` passes.

### Risk level

Medium.

---

## PR 5 — React Query migration for read-heavy data

### Goal

Use `@tanstack/react-query` for caching and lifecycle management of read-heavy data.

### Initial candidates

- `useGeologyData`
- `useGeophysicsData`
- `useMiningConcessions`
- `useDrillHoles`
- `useProjectCoreLogs`
- `useExplorationTargets`

### Example pattern

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchGeologyData } from "@/services/geology.service";

export function useGeologyData() {
  return useQuery({
    queryKey: ["geology-data"],
    queryFn: fetchGeologyData,
    staleTime: 1000 * 60 * 10,
  });
}
```

### Acceptance criteria

- Loading and error UI remains correct.
- Repeated navigation does not refetch unnecessarily.
- Queries are keyed by project ID where required.
- `npm run validate` passes.

### Risk level

Medium/high if hooks have incompatible return shapes. Use adapter compatibility if needed.

---

## PR 6 — First meaningful tests

### Goal

Go beyond the smoke test and cover extracted pure logic.

### Suggested test files

```txt
src/services/geology.service.test.ts
src/components/map/hooks/useLayerState.test.ts
src/features/palmeras/data/project.test.ts
src/lib/drilling/intercepts.test.ts
```

### Acceptance criteria

- Tests do not require a live Supabase connection.
- Supabase client is mocked where necessary.
- Pure functions are tested first.
- `npm run validate` passes.

### Risk level

Low/medium.

---

# Recommended order of execution

1. Palmeras module extraction.
2. Map low-risk hooks.
3. Supabase services for geology only.
4. React Query migration for geology only.
5. Tests around geology service and Palmeras rendering.
6. Continue map layer extraction in smaller PRs.

This order gives immediate maintainability wins without destabilizing the interactive map.

---

# Definition of done per PR

Every PR should include:

- Clear title.
- Summary of changed architecture.
- List of files moved or created.
- Testing notes.
- Known risks.
- `npm run validate` status.

If CI fails, do not merge until the failure is understood.

---

# Notes for future product work

The platform is evolving toward a serious mining intelligence product. As features grow, separate the product domains clearly:

```txt
src/features/
  palmeras/
  catastro/
  geophysics/
  drilling/
  sampling/
  ni43101/
  marketplace/
  projects/
  team/
```

This will make it easier to evolve from a demo/MVP into a scalable SaaS product for mineral exploration workflows.
