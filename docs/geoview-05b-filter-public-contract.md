# GEO-VIEW-05B — Operations 3D parity and public manifest contract

## Objective

Complete the highest-risk legacy retirement blocker: the Operations dashboard must use the same
canonical GeoScene3D as the rest of GeoCapitals without losing the filters that operators already
use. At the same time, public/live surfaces need a machine-readable canonical layer contract before
their custom renderers can be retired safely.

## Operations 3D convergence

The Operations route no longer mounts `Map3DView` in its normal 3D flow. It mounts
`GeoScene3D mode="subsurface"` and passes the same operational state through `GeoSceneFilters`.

### Filter contract

`GeoSceneFilters` currently carries:

- `campaignId`: filters campaign-aware exploration targets;
- `timeCursor`: hides drillholes/trajectories whose `started_at` is later than the selected time;
- `highGradeOnly`: keeps assay intercepts with Au >= 1 g/t, matching the Operations threshold.

The policies live in `geoscene/filterPolicy.ts` so their semantics are testable without deck.gl.

### Snapshot provenance

The canonical canvas now publishes:

- `data-geo-layer-ids`;
- `data-geo-filters`.

The filter manifest is deterministic JSON and can be persisted by GEO-VIEW-06 together with bounds,
timestamp, CRS and source provenance.

## Map3DView status

`src/components/map/Map3DView.tsx` is no longer part of the normal Operations path and is marked
`reference_only` in the legacy viewer registry.

It is intentionally retained for one QA window because GitHub Actions is currently not executing
validation steps. It can be deleted after CI/build validation and a manual visual parity pass.

## Public canonical manifest

`src/lib/geospatial/publicGeoContract.ts` defines a public-safe manifest built from the same
Canonical Geospatial Layer Registry.

The contract contains:

- schema version;
- `public_live` preset id;
- project identity/center;
- canonical layer id;
- domain;
- evidence class;
- source system;
- scale;
- interpretation caution.

A layer without the `public` capability cannot enter a public manifest.

The Los Verdes public server payload now includes this canonical manifest. Existing public UI is
unchanged in this phase, so the change is backward-compatible while exposing the contract needed
for the next migration.

## Remaining public blockers

### Cholqui

The public page still uses the static `CholquiMasterViewer` compatibility adapter. Before replacing
it, the public server bundle needs a stable project identity and equivalent canonical payload for
catastro, assays, structures and satellite evidence.

### Los Verdes

The route now exposes canonical layer metadata but still renders `LosVerdesStrategicMap` and
`LosVerdesPublicScene`. Those components retain useful anonymous certification/filter UX and
server-backed anomaly data.

The next phase should make those renderers consume the canonical public manifest and then remove
duplicate layer definitions.

## Next

GEO-VIEW-05C:

1. implement a public canonical renderer adapter;
2. migrate Los Verdes first because its server contract already exists;
3. migrate Cholqui once its canonical public project lookup is stable;
4. remove the corresponding compatibility viewers after parity;
5. proceed to GEO-VIEW-06 snapshot/report manifests.
