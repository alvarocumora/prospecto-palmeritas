
Add a CSV bulk-import dialog for geophysics stations. Scope:

- New component `src/components/geophysics/StationCsvImport.tsx` — Dialog with:
  - File input (.csv) + textarea paste alternative
  - Parse client-side (no library needed; simple CSV parser handling quoted fields, commas, semicolons, tab separators)
  - Header detection: required `station_id, lat, lng`; optional `mag_nt, ip_chargeability_mvv, ip_resistivity_ohmm, notes`
  - Validate per-row: numeric lat (-90..90), lng (-180..180), numerics for mag/IP, non-empty station_id, dedupe within file
  - Preview table (first 50 rows) with row-level error badges; counts of valid/invalid
  - "Importar N estaciones" button → bulk insert via supabase.from("geophysics_stations").insert([...]) in chunks of 200, with project_id + survey_id + is_synthetic=false + created_by
  - Toast + onSaved refresh
- Wire into survey detail page (`/dashboard/geophysics/$surveyId`) — add "Importar CSV" button next to existing actions
- Reuse existing `useSurvey().refresh` and auth user from useAuth

No DB changes needed (table already supports all fields). No new deps (parse CSV inline). 100% client-side validation; server still enforces RLS.
