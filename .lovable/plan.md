
Build full Drilling module CRUD on existing `drill_holes` and `drill_core_logs` tables (no migration needed).

## Scope

### 1. Hook `src/hooks/useDrilling.ts`
- `useDrillHoles(projectId)` — list + refresh
- `useDrillCoreLogs(holeId)` — list intervals for a hole + refresh
- Helpers: progress %, status colors, total drilled meters

### 2. Replace `src/routes/_authenticated.dashboard.drilling.tsx` (currently uses static data)
Header: project banner + "Nuevo sondaje"
Stats: total holes, planned, in_progress, completed, total drilled m, planned m, % avance global
Filters: status (all/proposed/in_progress/completed/abandoned)
Table of drill holes:
- hole_id, status (badge), target_zone, planned_depth, actual_depth, progress bar, started_at, completed_at, azimuth/dip, actions (logs, edit, delete)
- Click row → expand inline OR open dialog with core logs

Dialog "Nuevo/Editar sondaje":
- hole_id, target_zone, status (proposed|in_progress|completed|abandoned)
- easting, northing, elevation, azimuth, dip
- planned_depth, actual_depth
- started_at, completed_at, notes

### 3. Component `src/components/drilling/CoreLogPanel.tsx`
Opens for a selected hole. Shows:
- Header: hole metadata + "+ Nuevo intervalo"
- Table of intervals sorted by depth_from:
  - depth_from-depth_to (m), lithology, alteration, mineralization, structure, RQD%, recovery%, vein%, sulfide%, Au g/t, Cu %, Ag g/t, notes, actions
- Inline color coding for high grades (Au>1, Cu>0.5)
- Validation: depth_to > depth_from, no overlapping intervals (warn)
- Dialog "Nuevo/Editar intervalo" with all fields

### 4. No new deps. Reuse Dialog, toast, useAuth, useProjects.

### 5. Map integration: lightweight — add drill collars as a managed layer in ProjectMap (red dots colored by status, popup with hole_id + depth + status). Skipping for now to keep this focused — can add as follow-up.

Output: 1 hook + 1 route rewrite + 1 panel component.
