# GEO-VIEW-04 — Project presets and adapters

## Objective

Remove project-specific map routing from the authenticated experience without deleting specialist
business/reporting modules. Cholqui, Toki 2, Palmeras and Los Verdes now enter the same official
2D and 3D engines through project profiles.

## Canonical project adapter

`CanonicalProjectViewer` is the single authenticated adapter. It:

- resolves the requested project family against the user's available workspace projects;
- activates the correct project before rendering to avoid mixing layers across initiatives;
- switches between `ProjectMap` and `GeoScene3D`;
- applies only canonical viewer presets;
- publishes `data-geo-profile` and project id for future snapshot/report provenance.

The adapter contains no project geology or assays itself.

## Project profiles

| Profile | Database project | 2D preset | 3D preset |
| --- | --- | --- | --- |
| Cholqui | CHOLQUI / FRC / FRANCO | `official_workbench` | `official_3d` |
| Palmeras | PALM / PALMERAS / TRK-ALH | `official_workbench` | `official_3d` |
| Los Verdes | LV5 / VERDES / TILAMA / LV-TIL | `official_workbench` | `official_3d` |
| Toki 2 | parent project Cholqui | `toki2_field` | `official_3d` |

Toki 2 is deliberately a focus/preset of Cholqui rather than a new project row.

## Migration by project

### Cholqui

Authenticated Cholqui now uses `CanonicalProjectViewer` for geospatial intelligence. The existing
`CholquiMasterViewer` remains only in the public compatibility page while public RLS/data parity
is completed.

The DEM/terrain module keeps its analytical outputs but, when authenticated, opens the same
canonical map through `toki2_field`.

### Palmeras

The Trackmin/Palmeras presentation shell remains for geology, targets, sampling, drill program and
budget narrative. Its embedded map has been replaced by `CanonicalProjectViewer`, so 2D and 3D
come from the official engines.

### Los Verdes

The authenticated project report no longer mounts the standalone LV5 Leaflet preview as its
default viewer. It now opens the canonical project adapter. The specialist LV5 preview stays in
the repository temporarily as a legacy reference until GEO-VIEW-05.

## Public/live routes

`/live/cholqui`, `/live/palmeras` and `/live/losverdes` are intentionally not removed in this
phase. They are public/read-only products with different authentication and disclosure constraints.

GEO-VIEW-05 will migrate or retire their duplicate map engines only after public data parity,
RLS/anonymous access and disclosure behavior are verified.

## Evidence guard

A project profile changes defaults and presentation only. It must never:

- duplicate domain data;
- recalculate evidence class;
- promote satellite interpretation into measured geology;
- convert planned drilling into completed drilling;
- create a resource or reserve statement from visualization.

## Next step

GEO-VIEW-05 inventories the remaining public/legacy viewers feature-by-feature, moves any unique
capability into ProjectMap/GeoScene3D or a public adapter, then deletes or hides duplicate engines.
