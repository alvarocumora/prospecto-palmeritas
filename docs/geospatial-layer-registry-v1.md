# GEO-VIEW-01 — Canonical Geospatial Layer Registry

## Objective

Consolidate GeoCapitals around one geospatial contract without rebuilding the mature viewers.
The official experience is composed of:

- **2D:** `ProjectMap` as the canonical surface workbench.
- **3D:** `GeoScene3D` as the canonical 3D scene.
- **Field:** `FieldMap` as a mobile/field experience using the same canonical layers.
- **Public/Live:** read-only projections of the same datasets and evidence classes.

Project-specific components such as Cholqui or Palmeras become adapters/presets. They must not
create another independent definition of evidence, layer names or provenance.

## Why this is needed

The repository currently contains several useful generations of viewers:

| Component | Keep | Migration role |
| --- | --- | --- |
| `ProjectMap` | Leaflet tools, drawing, measurement, opacity, catastro, geology, geophysics, samples, drillholes, targets, snapshots | Official 2D engine |
| `ProjectMasterViewer` | Evidence taxonomy, scale warnings, grouped Territory / Remote sensing / Geophysics / Exploration | Compatibility layer while metadata moves to registry |
| `GeoScene3D` | Surface / Subsurface / Resource and deck.gl migration path | Official 3D engine |
| `SatelliteMapViewer` | InSAR, hyperspectral, DEM-diff and target filters | Layer donor; standalone viewer to retire later |
| `FieldMap` | GPS, POIs, GPX, mobile controls | Field mode |
| Palmeras / Trackmin views | Clear geology, collars, workings, compact legend | Project preset/presentation, not a separate map engine |
| `Geology3DViewer` | Historical drill/target rendering | Already deprecated; remove after layer parity |

## Canonical layer contract

`src/lib/geospatial/layerRegistry.ts` defines every layer using:

- canonical id;
- domain;
- evidence class;
- analytical use;
- source system;
- dataset type;
- units / scale label;
- supported surfaces: 2D, 3D, field, public and report;
- legacy aliases during migration;
- evidence caution where a layer can be over-interpreted.

The registry contains metadata only. It does not instantiate Leaflet, MapLibre or deck.gl objects.

## Canonical domains

1. Basemap
2. Territory
3. Remote sensing
4. Geology
5. Geophysics
6. Geochemistry
7. Sampling
8. Targets
9. Drilling
10. Models

These domains replace viewer-specific group names. The UI may localize labels, but the canonical
ids remain stable.

## Evidence rules

- **OFICIAL:** source controlled by an official provider such as SERNAGEOMIN or a named DEM.
- **MEDIDO:** project/field measurement.
- **CERTIFICADO:** laboratory or equivalent certified analytical result.
- **DERIVADO:** remote sensing or another deterministic derived product.
- **INTERPRETADO:** interpolation, inversion or geological interpretation.
- **PROPUESTO:** planned work such as conceptual drilling.
- **CONTEXTO:** regional/background information not suitable for prospect-scale claims.

Regional EMAG2/WGM2012 remain context even when visible beside project data.

## Migration aliases

The registry deliberately resolves old identifiers such as:

- `tenencia` and `concessions:project` → `territory.cadastre`
- `magneticaRegional` and `geophys:emag2` → `geophysics.emag2`
- `ensayes` and `samples:project` → `sampling.assays`
- `sondajes` → `drilling.proposed`
- `geophys:planned` → `geophysics.planned_survey`
- `geophys:hillshade` / `relieve` → `territory.hillshade`
- `sat:s2-truecolor` → `remote_sensing.sentinel2_truecolor`

Aliases are temporary compatibility, not new canonical names.

## Presets

The first presets are:

- `official_workbench`
- `official_3d`
- `field`
- `public_live`
- `toki2_field`

A preset only chooses canonical layers/default visibility. It does not fork the renderer or data
model.

## Official target architecture

```
Geoscience Dataset Registry / canonical domain tables
                     |
                     v
        Canonical Geospatial Layer Registry
                     |
       +-------------+-------------+
       |             |             |
       v             v             v
 ProjectMap 2D   GeoScene3D    FieldMap
       |             |             |
       +-------------+-------------+
                     |
             Map Snapshot Engine
                     |
                Reporting Hub
```

## Delivery sequence

### GEO-VIEW-01 — registry and contract
This PR. Introduce the canonical registry, aliases, presets and tests. Make the compatibility
master viewer consume registry metadata.

### GEO-VIEW-02 — official 2D workbench
Implemented: `ProjectMap` now starts from a canonical preset, identifies itself as the official
2D workbench and its layer panel resolves canonical domains, evidence badges, source, scale and
interpretation cautions from the shared registry. Legacy runtime ids remain compatible through
aliases while project counts/details stay visible.

### GEO-VIEW-03 — 3D convergence
Implemented: `GeoScene3D` defaults to the `official_3d` preset on MapLibre + deck.gl, consumes
canonical ids, exposes provenance-aware layer controls, separates measured and proposed drilling,
publishes its canonical layer manifest for snapshots and hides the legacy engine selector from
normal users. Legacy remains available only for explicit QA while feature parity is completed.

### GEO-VIEW-04 — project presets
Implemented for the authenticated workspace: Cholqui, Palmeras and Los Verdes now enter the
official 2D/3D engines through `CanonicalProjectViewer` profiles, and Toki 2 is a `toki2_field`
preset over its parent Cholqui project. Public/live compatibility viewers remain until GEO-VIEW-05
verifies anonymous-data parity and retires duplicate engines.

### GEO-VIEW-05 — retire duplicates
**05A implemented:** authenticated `ProjectMap` is now centered on the active project and no longer
loads Palmeras static AOI/veins/palms/workings/drill/anomaly geometry by default. Those assets are
lazy-loaded only by the explicit Palmeras public compatibility mode. Remaining duplicate viewers
are tracked in `legacyViewerRegistry.ts` with successors and parity blockers.

**05B implemented:** Operations now uses GeoScene3D with campaign/time/high-grade filter parity,
and Los Verdes public payloads publish a canonical `public_live` layer manifest. `Map3DView` is
reference-only pending one QA window.

**05C implemented:** Los Verdes and Cholqui public routes now consume `PublicGeoBundle` through
`PublicCanonicalMap` and, for Los Verdes, `PublicCanonicalScene`. Public sampling, certified
assays, derived satellite lineaments, interpreted veins and official tenure remain separate
canonical evidence classes. The former project-specific public renderers are reference-only for one
QA window while Actions CI is unavailable.

### GEO-VIEW-06 — reports and snapshots
**06A implemented:** the official 2D and 3D engines publish project, mode, canonical visible layer
ids, WGS84 view state and applicable campaign/time filters. `GeoSnapshotManifest` canonicalizes
aliases and derives evidence/source/scale metadata only from the layer registry. Unknown or
non-report-capable visible layers block report eligibility, and the PDF map model can retain the
same manifest beside the captured image.

`stableGeoSnapshotPayload` provides a deterministic evidence payload for a future SHA-256 snapshot
identity. The bitmap itself is **not yet** claimed as deterministic: headless/server rendering,
artifact storage, image hash and immutable snapshot versioning remain GEO-VIEW-06B.
