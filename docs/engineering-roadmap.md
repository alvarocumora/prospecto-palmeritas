# Engineering roadmap

This document tracks the technical stabilization plan for Prospecto Palmeritas / Geocapitals.

## Phase 1 — Stabilization

- Add repeatable validation scripts.
- Add TypeScript typecheck script.
- Add Vitest + Testing Library baseline.
- Add GitHub Actions CI for pull requests and main branch pushes.
- Tighten ESLint without immediately blocking legacy unused variables.

## Phase 2 — Palmeras dashboard refactor

Target file:

- `src/routes/_authenticated.dashboard.palmeras.tsx`

Recommended structure:

```txt
src/features/palmeras/
  data/project.ts
  components/PalmerasDashboard.tsx
  components/Overview.tsx
  components/Geology.tsx
  components/Geophysics.tsx
  components/Targets.tsx
  components/Sampling.tsx
  components/DrillProgram.tsx
  components/Budget.tsx
  hooks/usePalmerasReport.ts
```

Goal: keep the TanStack route thin and move product logic into feature modules.

## Phase 3 — Map architecture refactor

Target file:

- `src/components/ProjectMap.tsx`

Recommended structure:

```txt
src/components/map/hooks/
  useLeafletMap.ts
  useCatastroLayers.ts
  useGeophysicsLayers.ts
  useDrillingLayers.ts
  useDroneLayers.ts
  useTargetLayers.ts
  useMeasurementTool.ts
  useFullscreenMap.ts
```

Goal: isolate map initialization, layer orchestration, interaction tools, and data-specific layer builders.

## Phase 4 — Data access modernization

- Move Supabase data access to `src/services/*`.
- Migrate high-value hooks from `useEffect + useState` to `@tanstack/react-query`.
- Add caching, stale times, retry strategy, and focused error states.

Initial candidates:

- `useGeologyData`
- `useGeophysicsData`
- `useMiningConcessions`
- `useDrilling`
- `useSamplingResults`

## Phase 5 — Test coverage

Initial test targets:

- Auth provider behavior.
- Protected route redirects.
- Geology data service success/error cases.
- Palmeras dashboard smoke render.
- Map layer state utilities.

## Release discipline

Each phase should be shipped as a small pull request. Avoid combining structural refactors with UI changes or business logic changes.
