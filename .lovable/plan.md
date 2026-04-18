
Add drill collar layer to ProjectMap.

## Approach

Need to check how easting/northing should convert to lat/lng. Looking at `drill_holes` schema, fields are `easting`/`northing` (numeric). Chile is UTM 19S typically. But many projects may store lat/lng directly in those fields. Safest: if values look like lat/lng range (-90..90, -180..180), use directly; otherwise treat as UTM 19S and convert via inline formula. Actually, simpler and more reliable: assume lat/lng for now (since static data uses lon/lat in geojson) and document. Better — auto-detect: if |easting|<=180 and |northing|<=90, treat as lng/lat; else UTM 19S → WGS84.

Will add inline UTM→WGS84 converter (no deps).

## Scope

### 1. New file `src/components/map/drillCollarsLayer.ts`
- `buildDrillCollarsLayer(L, holes)`: returns Leaflet GeoJSON/LayerGroup of circleMarkers
- Color by status: proposed `#64748b`, in_progress `#f59e0b`, completed `#0d9488`, abandoned `#dc2626`
- Inline `utmToLatLng(easting, northing, zone=19, south=true)` (standard formula)
- Auto-detect coord system per hole
- Popup: hole_id (mono bold), status badge, target_zone, planned/actual depth, progress %, az/dip

### 2. New hook usage in `ProjectMap.tsx`
- Import `useDrillHoles(activeProjectId)` 
- Add useEffect to build/replace `drills:project` managed layer when holes change
- Register in `LayerOpacityPanel` with group "Proyecto", visible by default
- Add count chip "X sondajes"

### 3. No DB changes, no deps.

## Files
- create: `src/components/map/drillCollarsLayer.ts`
- edit: `src/components/ProjectMap.tsx` (add hook + effect + managed layer registration + chip)
