# Cholqui Remote Sensing — publication contract

The numerical engine already lives in `geocapitals-remote`. This document defines the boundary between reproducible processing and the public GeoCapitals UI.

## Processing

Run the Cholqui configuration with the remote package and publish only its generated `sampling_candidates.geojson`.

The pipeline:
1. searches Sentinel-2 L2A scenes for the configured AOI and dry-season window;
2. masks no-data, clouds, shadows, snow, water and vegetation;
3. computes broad-band spectral ratios (`fe_oxides`, `ferrous`, `aloh`, `gossan`);
4. calculates the Al-OH z-score against interpretable pixels in the AOI;
5. extracts spatially separated high-percentile sampling candidates;
6. exports WGS84 GeoJSON with index metadata, scene count, config SHA and disclaimer.

## Runtime publication

Set server environment variable:

`CHOLQUI_REMOTE_CANDIDATES_URL=<HTTPS URL to sampling_candidates.geojson>`

Until that variable points to a valid FeatureCollection, the Geological Evidence Map reports **not published** and renders no synthetic candidate layer.

## Scientific semantics

- Sentinel-2 broad bands do not identify a mineral.
- `B11/B12` is reported as an Al-OH-compatible SWIR response, not as sericite/kaolinite identification.
- A sampling candidate is **DERIVED evidence**, not a mineral occurrence, resource, reserve or deposit.
- Field verification and independent technical review remain required.
