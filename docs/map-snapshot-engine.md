# GeoCapitals Map Snapshot Engine v1

## Goal

Institutional exports must use the same geospatial evidence shown in the official viewer. PDF generators must not replace available project geometry with decorative XY diagrams or invented geological bodies.

## Pipeline

`Official 2D/3D viewer -> runtime state -> canonical provenance manifest -> image capture -> PDF composer`

The evidence manifest and the bitmap are one controlled figure. A report map is not complete if the image cannot be tied back to the viewer state that produced it.

## Runtime manifest

GEO-VIEW-06A adds a shared `GeoSnapshotManifest` for both official engines.

The manifest records:

- schema version and UTC generation timestamp;
- project id and canonical project profile;
- 2D/3D mode and renderer engine;
- canonical preset;
- CRS (`EPSG:4326` for viewer state);
- center, WGS84 bounds and zoom;
- pitch/bearing in 3D;
- campaign/time/high-grade filters when present;
- visible canonical layer ids;
- layer domain, evidence class, analytical use, source system, dataset type, units, scale and caution;
- report eligibility issues.

Legacy aliases are canonicalized through `layerRegistry.ts`; snapshot code does not reclassify evidence independently.

## Viewer integration

### 2D

`SnapshotAwareProjectMap` wraps the official `ProjectMap`, consumes its Leaflet instance and listens to the shared runtime layer-state event. It publishes project, preset, visible canonical layers, bounds, center and zoom as `data-geo-*` attributes.

### 3D

`GeoSceneCanvas` publishes the same contract from MapLibre + deck.gl. It records only layers that are actually bound to the current Surface/Subsurface mode, plus the rendered Esri imagery basemap. Campaign/time/high-grade filters are preserved in the manifest.

Resource mode does not fabricate a snapshot while it is still a non-canonical/stub surface.

## Report eligibility gate

`buildGeoSnapshotManifest` rejects silent ambiguity:

- unknown visible layer -> `UNKNOWN_LAYER:<id>`;
- visible layer without the `report` capability -> `NOT_REPORT_CAPABLE:<id>`.

Such a manifest can still be inspected for QA but is not eligible for a report figure.

`buildReportMapBlock` only creates a report `map` block when the manifest is report-eligible. The PDF model stores the same `snapshotManifest` beside the map image.

Report eligibility is derived only from the canonical evidence manifest and viewer state; CI/runtime tooling status is operational metadata and is never serialized as evidence provenance.

This does **not** mean that a viewer screenshot is automatically technical evidence. The evidence class and caution come from the canonical registry and remain attached to each layer.

## Export policy

1. A map figure is evidence-bearing, not decorative.
2. Prefer actual satellite/topographic basemap plus project tenure, field observations, assays, structures and published remote-sensing candidates.
3. If a real snapshot cannot be captured, state that it is unavailable. Do not generate a schematic substitute.
4. DERIVED and INTERPRETED layers must remain visually and textually distinct from CERTIFIED/MEDIDO/OFICIAL evidence.
5. No 3D orebody may be inferred from surface observations. Terrain, observed geology, interpretation and modeled volumes remain separate.
6. Proposed drilling remains PROPUESTO even when rendered in the same 3D scene as completed drilling.
7. Regional EMAG2/WGM2012 remain contextual and must not be presented as prospect-scale measurements.
8. Public contact in exported documents is GeoCapitals only.

## Determinism

`stableGeoSnapshotPayload` produces a stable evidence payload independent of generation time and input layer ordering. It is intended as the deterministic input for a later SHA-256 snapshot identity/versioning step.

The current phase does **not** yet implement a deterministic server/headless bitmap renderer, storage artifact, or final image hash. Those remain separate work so the platform does not claim reproducibility before it exists.

## Implemented in GEO-VIEW-06A

- canonical 2D and 3D viewer runtime state;
- canonical visible-layer manifest;
- bounds/center/zoom + 3D pitch/bearing;
- campaign/time/high-grade filter handoff;
- evidence/source/scale metadata sourced only from the registry;
- report eligibility gate;
- PDF model handoff via `snapshotManifest`;
- stable manifest payload for future hashing.

## Next — GEO-VIEW-06B

- deterministic headless/server image rendering after tile/layer readiness;
- persist image + manifest + SHA-256 as one immutable snapshot artifact;
- store dataset/run/version references where available;
- expose snapshot selection/versioning from the Reporting Hub;
- add institutional map composition presets such as Regional, Tenure, Geological Evidence, Remote Sensing and Convergence;
- verify pixel output and manifest together before controlled report emission.
