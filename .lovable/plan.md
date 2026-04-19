
Add a thin "intercept marker" rail to the right of the Alt column in `StripLog`, showing yellow/amber bars spanning each computed mineralized intercept (Au cutoff 0.5, dilution 2m). Tooltip shows `length @ grade Au g/t`.

## Files
- **edit** `src/components/drilling/StripLog.tsx`:
  - Import `computeIntercepts`, `formatIntercept` from `@/lib/drilling/intercepts`
  - Compute `intercepts` via `useMemo`
  - Add new narrow column (10px) after Alt rendering each intercept as an amber rail with darker amber border
  - Header label "Int"

No deps, no DB, no other files.
