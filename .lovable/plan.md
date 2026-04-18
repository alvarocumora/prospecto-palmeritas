
User wants a mobile-friendly (PWA-ish) geophysics field tool that uses GPS to capture stations in the field for the active project. Per Lovable PWA guidance: do NOT install vite-plugin-pwa or service workers (breaks preview). User just needs field GPS capture — a responsive mobile-optimized route with geolocation API is the right call. Mention installability later if they want it.

Scope:
- New mobile route `/dashboard/geophysics/$surveyId/field` (also accessible from survey detail)
- Uses `navigator.geolocation.watchPosition` for live GPS
- Shows distance from project center, accuracy, lat/lng/elev
- Quick-capture form: pick survey + method (mag/IP), one-tap "Capturar estación" → inserts into `geophysics_stations` with current GPS
- Mini live map (Leaflet) showing user location + recent stations + survey lines
- Offline queue: if insert fails (no signal), buffer in localStorage and retry on reconnect
- Mobile-first UI: large touch targets, sticky bottom action bar

Technical:
- New file `src/routes/_authenticated.dashboard.geophysics.$surveyId.field.tsx`
- New hook `src/hooks/useGeolocation.ts` (watchPosition wrapper, accuracy, error handling)
- New hook `src/hooks/useOfflineQueue.ts` (localStorage buffer for failed inserts)
- New component `src/components/geophysics/FieldCaptureMap.tsx` (Leaflet mini-map with user marker pulsing)
- Add "Modo terreno" button in survey detail view linking to field route
- Reuse `useSurvey` and `useGeophysicsMutations` hooks

Field measurement inputs (manual, since phone has no magnetometer-grade sensor):
- Mag (nT), IP chargeability (mV/V), IP resistivity (Ω·m) — optional numeric inputs
- Auto-generated station_id (e.g. `ST-{count+1}` based on existing)
- Notes field

UX:
- Big "📍 CAPTURAR" button at bottom (sticky)
- GPS status indicator (color-coded by accuracy: <10m green, 10-30m amber, >30m red)
- Distance from project center
- List of last 5 captured stations with edit/delete

Phase 1 only — not a full PWA install. Mention later if user wants installable shortcut.
