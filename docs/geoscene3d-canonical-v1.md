# GEO-VIEW-03 — Canonical GeoScene3D

## Objective

Make GeoScene3D consume the same canonical layer ids and evidence rules as the official 2D
workbench. Normal users should no longer have to choose between a modern and a legacy engine.

## Canonical default

GeoScene3D now defaults to `official_3d` and MapLibre + deck.gl. The legacy switch is hidden from
normal users and can only be exposed explicitly with `showLegacyEngineSwitch` or forced with the
`engine` prop for QA/migration.

The legacy viewers remain code-split and available for comparison until GEO-VIEW-05 removes them.

## 3D evidence bindings

| Runtime layer | Canonical id | Evidence |
| --- | --- | --- |
| Terrain DEM | `territory.dem` | OFICIAL |
| Sentinel alteration anomalies | `remote_sensing.sentinel2_alteration` | DERIVADO |
| Exploration targets | `targets.exploration` | INTERPRETADO |
| Completed/in-progress drillholes | `drilling.completed` | MEDIDO |
| Planned drillholes | `drilling.proposed` | PROPUESTO |
| Drill intercepts | `sampling.drill_intercepts` | INTERPRETADO |
| Geophysics anomalies | `geophysics.anomalies` | INTERPRETADO |
| Geological wireframes | `models.implicit_geology` | INTERPRETADO |

The deck.gl layer ids use the same canonical namespace, allowing future snapshots to persist the
visible evidence manifest without translating renderer-specific names.

## Drilling split

The old 3D scene rendered planned and executed holes together. GEO-VIEW-03 separates:

- executed/in-progress collars and trajectories;
- proposed collars and trajectories;
- composited/interpreted assay intercepts.

This prevents a proposed drill trace from being mistaken for measured drilling.

## Layer panel

The 3D layer panel reads directly from the canonical registry. It exposes evidence class, source,
scale and cautions before a layer is interpreted.

Terrain can be disabled without destroying the MapLibre scene: GeoScene3D degrades to the
satellite basemap with pitch.

## Legacy parity decisions

Some visual heuristics from the deprecated `SatToSubsurface3DViewer` are intentionally **not**
promoted into the canonical engine:

- synthetic porphyry cylinders inferred only from satellite score;
- conceptual open-pit footprints inferred from target priority;
- satellite anomalies extruded downward as if they were subsurface bodies.

Those graphics can remain available in QA legacy mode during migration, but they are not canonical
technical evidence. Reintroducing them requires an explicit PROPOSED/INTERPRETED layer with
traceable assumptions.

## Snapshot readiness

The deck.gl canvas publishes:

- `data-geo-engine="deckgl"`;
- `data-geo-layer-ids` containing the sorted canonical layer manifest.

GEO-VIEW-06 can consume this state for reproducible report snapshots.

## Next step

GEO-VIEW-04 replaces project-specific viewer forks in Cholqui, Palmeras and Los Verdes with
canonical presets/adapters. Toki 2 becomes a focus/preset over the same 2D/3D infrastructure.
