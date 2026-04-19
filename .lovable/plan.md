
Add a "mineralization halo" around drill collar markers in `ProjectMap` based on best intercept's grade·length score (Au g/t × meters).

## Approach

Reuse existing `useProjectCoreLogs` + `computeIntercepts` + `bestIntercept` utilities to derive a metal-score per hole. Render an extra halo `circleMarker` (larger radius, low fill opacity, no fill — colored stroke) underneath the existing collar dot.

### Score → color scale
- score = `au_gpt × length_m` (units: g·m/t — common "GT" metric)
- Bins (typical for Au exploration):
  - score = 0 or no intercept → no halo
  - 0 < s ≤ 5 → light green `#86efac` (low)
  - 5 < s ≤ 20 → yellow-green `#bef264` (moderate)
  - 20 < s ≤ 50 → amber `#fbbf24` (good)
  - 50 < s ≤ 150 → orange `#fb923c` (high)
  - s > 150 → deep red `#dc2626` (exceptional)
- Halo radius scales: 12px base + min(score/10, 18) → max ~30px
- Stroke weight 2.5, fillOpacity 0.18

## Files

### 1. Edit `src/lib/drilling/intercepts.ts`
- Add `interceptScore(it)` → `(it.au_gpt ?? 0) * it.length`
- Add `scoreToHaloColor(score)` returning `{ color, radius } | null`

### 2. Edit `src/components/map/drillCollarsLayer.ts`
- Accept optional second arg `scoresByHole?: Record<string, number>` in `buildDrillCollarsLayer`
- For each hole with score > 0, add halo `circleMarker` BEFORE the collar dot
- Halo popup also shows the best intercept summary line if score available

### 3. Edit `src/components/ProjectMap.tsx`
- Already imports `useDrillHoles`. Add `useProjectCoreLogs(activeProjectId)`
- Compute `scoresByHole` via `useMemo` (best intercept per hole, cutoff 0.5 / dilution 2)
- Pass to `buildDrillCollarsLayer(L, holes, scoresByHole)`
- Add a small legend chip for the halo scale next to the existing "X sondajes" chip

## No DB / no deps.
