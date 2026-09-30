# GEO-VIEW-05C — Canonical public viewers

## Objective

Move the public Cholqui and Los Verdes maps onto the same canonical layer definitions used by the
authenticated GeoCapitals workspace, while preserving anonymous access and explicit evidence
semantics.

## Canonical public renderer

Two renderer components now consume `PublicGeoBundle`:

- `PublicCanonicalMap` — MapLibre 2D;
- `PublicCanonicalScene` — MapLibre terrain + deck.gl 3D.

Neither renderer queries authenticated project state. They receive a public-safe manifest and
public feature collections.

Both expose:

- canonical layer ids;
- source system;
- evidence class;
- scale;
- interpretation cautions;
- certification mode.

Certification mode is defined centrally as `OFICIAL | CERTIFICADO | MEDIDO`. Derived,
interpreted and proposed layers are suppressed without changing the underlying payload.

## Sampling correction

Los Verdes public sampling comes from `sampling_results` and can include draft records. It is now
mapped to `sampling.results` with evidence `MEDIDO`, not `sampling.assays`.

`sampling.assays` remains reserved for laboratory/certified evidence. Cholqui's seven published
laboratory results use that certified layer.

## Los Verdes

The public route no longer mounts `LosVerdesStrategicMap` or `LosVerdesPublicScene`.

Its canonical bundle combines:

- official concession geometry;
- exploration targets;
- full satellite anomaly geometry;
- satellite-derived structural lineaments;
- mapped vein/structure geometry;
- magnetic anomaly targets;
- project sampling results;
- DEM terrain in 3D.

Satellite-derived lineaments are represented by
`remote_sensing.lineaments / DERIVADO`, not by the measured `geology.structures` class.

The old Los Verdes public renderers remain in the repository as reference-only for one QA window.

## Cholqui

The public Cholqui dashboard no longer mounts `CholquiMasterViewer`.

`buildCholquiPublicGeoBundle` maps the historical/public evidence into canonical ids:

- official SERNAGEOMIN cadastre;
- pending and proposed tenure as separate non-official layers;
- declared survey monuments;
- satellite anomaly candidates;
- measured geological structures;
- metallogenic belts and known deposits;
- seven certified assay points;
- proposed drill grid.

The authenticated Cholqui workspace continues to use `CanonicalProjectViewer`.

## Retirement state

The following are no longer active route renderers:

- `CholquiMasterViewer`;
- `LosVerdesStrategicMap`;
- `LosVerdesPublicScene`.

They are marked `reference_only` until CI/build validation and a visual QA pass are available.

## Remaining work

GEO-VIEW-06 should make snapshots and reports persist the canonical public/authenticated scene
manifest:

- project id;
- canonical layer ids;
- filters;
- bounds/camera;
- CRS;
- timestamp;
- dataset/source references;
- provenance/evidence class;
- renderer version.

After CI is restored, reference-only viewer files can be deleted in a dedicated cleanup PR.
