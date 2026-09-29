# GEO-VIEW-02 — Official 2D Geo Workbench

## Scope

This phase promotes `ProjectMap` from a feature-rich project map into the official 2D
GeoCapitals workbench without replacing its Leaflet implementation.

## What changed

### Canonical defaults

`ProjectMap` accepts an `initialPreset` and defaults to `official_workbench`.
The preset is resolved by `layerStateForPreset`, which maps current runtime ids through the
canonical registry before deciding initial visibility.

Existing user choices stored in localStorage continue to take precedence after initialization.

### Canonical layer panel

The former runtime groups (Proyecto, Catastro, Satelital, etc.) are no longer the primary
information architecture. The visible layer panel groups registered layers by:

1. Base
2. Territory
3. Remote sensing
4. Geology
5. Geophysics
6. Geochemistry
7. Sampling
8. Targets
9. Drilling
10. Models

Each registered layer exposes:

- evidence class;
- scale/resolution;
- source system;
- interpretation caution when applicable;
- runtime detail such as feature/station counts.

Unregistered layers remain usable under an explicit legacy section so migration can be gradual
rather than destructive.

### Corrected aliases

GEO-VIEW-02 also removes several ambiguous mappings discovered during consolidation:

- Sentinel-2 true color is visualization, not an alteration anomaly.
- The project center marker is not a geological structure.
- Planned geophysics is not proposed drilling.
- Hillshade is a derived terrain visualization, distinct from the elevation DEM itself.

## Explicit non-goals

This phase does not remove `ProjectMasterViewer`, `SatelliteMapViewer` or legacy 3D engines.
Removal comes only after feature parity.

It also does not change the canonical evidence stored in domain tables or the geoscience dataset
registry. This is a viewer-governance change.

## Next step

GEO-VIEW-03 connects `GeoScene3D` to the same canonical ids and begins migrating the remaining
legacy surface/subsurface layers onto the deck.gl/MapLibre canvas. Once parity is sufficient, the
legacy engine selector can be hidden from normal users.
