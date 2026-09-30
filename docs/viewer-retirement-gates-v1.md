# GEO-VIEW-05A — Internal legacy isolation and retirement gates

## Objective

Stop legacy/project-specific map data from leaking into the authenticated multi-project workbench,
while preserving public/live compatibility until anonymous data parity is proven.

## ProjectMap correction

The official `ProjectMap` previously still carried Palmeras-era assumptions:

- fixed fallback center from the historical prospect;
- static AOI, veins, palm clusters, workings, collars and anomalies loaded for every map instance;
- Palmeras-specific legend rendered for every project.

GEO-VIEW-05A changes this behavior:

- authenticated maps center on the active project's `center_lat/center_lng`;
- catastro queries and SERNAGEOMIN links use that active project center;
- Palmeras static feature bundles are disabled by default;
- the bundle can only be enabled with `legacyStaticProjectFeatures`;
- its special legend is only rendered in that compatibility mode;
- the DOM exposes `data-legacy-static-project-features` for QA/snapshot audits.

This removes the main cross-project visualization contamination risk without deleting public data.

## Palmeras public compatibility

`/live/palmeras` explicitly uses `TrackminGeoIntel publicMode`.

Public mode mounts `ProjectMap` with:

- `public_live` preset;
- `legacyStaticProjectFeatures` enabled.

Authenticated Palmeras continues through `CanonicalProjectViewer`.

This separation is intentional: the public demo keeps working while authenticated multi-project
screens no longer inherit its historical static bundle.

## Retirement registry

`src/lib/geospatial/legacyViewerRegistry.ts` records each remaining duplicate viewer, its status,
successor, unique capability and blocker.

Statuses are:

- `qa_only`
- `public_compatibility`
- `active_compatibility`
- `reference_only`

A file is not deleted merely because a canonical successor exists. Feature/access parity must be
explicit first.

## Current blockers

### Map3DView

Still used by the Operations 2D/3D toggle because it accepts campaign/time-filtered holes, logs and
targets directly. Replacing it immediately with GeoScene3D would silently drop those filters.

Required before retirement:

1. canonical scene filter contract;
2. campaign id support;
3. time cursor support;
4. snapshot manifest records those filters.

### Cholqui public viewer

Requires an anonymous/public adapter for the same canonical domain datasets before
`CholquiMasterViewer` can disappear.

### Los Verdes public viewers

`LosVerdesStrategicMap` and `LosVerdesPublicScene` still implement an anonymous server-backed
contract and public certification/filter UX. They remain public compatibility surfaces until the
canonical public adapter has equivalent RLS, disclosure and layer behavior.

### Legacy 3D QA

`Geology3DViewer` and `SatToSubsurface3DViewer` remain QA-only while the explicit legacy switch
exists. Their heuristic subsurface bodies are not promoted to canonical evidence.

## Outcome

Authenticated project maps are now project-aware and no longer receive Palmeras static geometry by
default. Public legacy viewers are isolated and named as compatibility surfaces rather than
silently coexisting as equal "official" engines.

## Next

GEO-VIEW-05B should add a canonical public data contract, beginning with Cholqui or Los Verdes,
then remove public duplicate renderers one by one. After that GEO-VIEW-06 can persist canonical
layer ids, filters, bounds, timestamp, CRS and provenance in report snapshots.
