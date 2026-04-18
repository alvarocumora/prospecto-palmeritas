
Add mineralized intercept calculation for drill holes.

## Logic
- `computeIntercepts(logs, cutoff, maxInternalDilution)`: sort by depth_from, walk intervals, group contiguous (gap ≤ maxInternalDilution, default 2m) where `au_gpt >= cutoff`. For each intercept: from, to, length, length-weighted Au/Cu/Ag averages, # intervals.
- Length-weighted avg: `Σ(grade_i × len_i) / Σ(len_i)` (skip nulls per-element).

## Files
1. **New** `src/lib/drilling/intercepts.ts` — pure function + types. Default cutoff 0.5 g/t Au, default dilution 2m.
2. **Edit** `src/components/drilling/CoreLogPanel.tsx`:
   - Cutoff input (number, default 0.5) + dilution input (default 2m) in header
   - New "Intercepts mineralizados" section above intervals table: highlighted card-table with from-to, length, Au g/t (bold amber), Cu%, Ag g/t, # intervalos
   - Empty state if no intercepts
3. **Edit** `src/routes/_authenticated.dashboard.drilling.tsx`:
   - For each hole, fetch its logs lazily via batch (single query: `drill_core_logs` filtered by `hole_id IN (...)` for current project)
   - Compute best intercept per hole (longest, or highest grade·length)
   - Add new column "Mejor intercept" showing e.g. `12.5m @ 2.34 g/t Au` colored amber, or "—"
   - Use cutoff 0.5 (fixed at table level; configurable in panel)

## Approach for table column
- New hook `useProjectCoreLogs(projectId)` returning all logs grouped by hole_id (single query, low overhead for typical project sizes <10k intervals).
- Compute intercepts per hole in `useMemo`.

## No DB changes, no deps.
