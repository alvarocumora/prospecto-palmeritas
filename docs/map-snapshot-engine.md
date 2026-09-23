# GeoCapitals Map Snapshot Engine v1

## Goal

Institutional exports must use the same geospatial evidence shown in the Live Map. PDF generators must not replace available project geometry with decorative XY diagrams or invented geological bodies.

## Pipeline

`Live Map -> active evidence layers -> high-resolution snapshot -> provenance manifest -> PDF composer`

The manifest records project, UTC timestamp, WGS84 bounds, center, zoom and visible layers.

## Export policy

1. A map figure is evidence-bearing, not decorative.
2. Prefer actual satellite/topographic basemap plus project tenure, field observations, assays, structures and published remote-sensing candidates.
3. If a real snapshot cannot be captured, state that it is unavailable. Do not generate a schematic substitute.
4. DERIVED and INTERPRETED layers must remain visually and textually distinct from CERTIFIED/VERIFIED evidence.
5. No 3D orebody may be inferred from surface observations. Future 3D exports must distinguish terrain, observed geology, interpretation and modeled volumes.
6. Public contact in exported documents is GeoCapitals only.

## v1

This PR establishes the reusable capture contract and PDF handoff, and updates the Cholqui investment PDF to reserve an institutional Live Map figure with its provenance.

## Next

- Wire the Geological Evidence Map's Leaflet instance to publish snapshots after tile/layer readiness.
- Add map composition presets: Regional, Tenure, Geological Evidence, Remote Sensing, Convergence.
- Add headless/server export for deterministic documents.
- Add terrain/3D scene capture with explicit evidence classes.
