# GeoCapitals Geoscience Workbench — integration plan

## Objective

Turn the project viewer into an evidence-driven geoscience workbench. Remote sensing,
public geophysics, field geophysics, geology and 3D interpretation must remain distinct
evidence classes and retain source, scale, CRS, units, version and processing lineage.

## Canonical viewer contract

GEO-VIEW-01 establishes `src/lib/geospatial/layerRegistry.ts` as the single layer metadata
contract shared by ProjectMap, GeoScene3D, FieldMap, Public/Live views and report snapshots.
Existing viewer-specific ids are migration aliases only. New layers must receive a canonical id,
domain, evidence class, source/scale metadata and explicit renderer capabilities before being
surfaced in another viewer.

The official engines are:

- 2D surface workbench: `ProjectMap`
- 3D scene: `GeoScene3D`
- field experience: `FieldMap`

Project-specific viewers should progressively become adapters/presets over these engines.

## Viewer information architecture

1. **Territory**
   - SERNAGEOMIN cadastre
   - geology / lithology / structures
   - DEM / hillshade
2. **Remote sensing**
   - Sentinel-2 spectral alteration proxies
   - Sentinel-1 radar / lineaments / InSAR where available
   - spectral candidates and coverage mask
3. **Geophysics**
   - regional magnetic anomaly (EMAG2 v3)
   - regional Bouguer gravity (WGM2012)
   - SERNAGEOMIN aeromagnetics / gamma spectrometry where available
   - project field surveys: magnetics, IP/resistivity, TEM, CSAMT, seismic
   - inversion outputs
4. **Exploration**
   - certified assays
   - mapped geology / structural observations
   - targets
   - proposed / completed drillholes

Regional grids must never be styled or labelled as prospect-scale measured geophysics.

## Open data / API layer

### Chile
- **SERNAGEOMIN Portal Geomin** — geology, geochemistry and geophysics catalogue.
  SERNAGEOMIN states that its national geophysics program includes high-resolution
  airborne magnetometry and U-Th-K gamma spectrometry, commonly delivered at 1:100,000.
- **IDE Chile** — metadata and OGC-oriented national geospatial catalogue.

### Earth observation
- **Copernicus Data Space STAC 1.1** — Sentinel discovery and reproducible scene selection.
- **OpenTopography API** — COP30, SRTM, ALOS and other DEM products.
- **OneGeology** — WMS/WFS/WCS access to geological-map services from participating surveys.

### Regional geophysics
- **NOAA NCEI EMAG2 v3** — 2 arc-minute magnetic anomaly grid compiled from satellite,
  airborne and marine observations. Context only at project scale.
- **BGI WGM2012** — 2 arc-minute Bouguer, isostatic and free-air gravity anomaly grids.
  Context only at project scale.

## Open-source compute stack

### Potential fields
- **SimPEG** — production engine for magnetic / gravity inversion. Magnetic inversion v1
  already exists in this repository.
- **Fatiando a Terra / Harmonica** — gravity and magnetic processing, forward modelling,
  equivalent sources and potential-field utilities.
- **Verde** — gridding, interpolation and spatial cross-validation.

### Electrical / EM / seismic
- **pyGIMLi** — 2D/3D FEM/FVM forward modelling and inversion; suitable for ERT/IP and
  multi-method constrained or joint inversion.

### Structural geology / 3D geology
- **GemPy v3** — implicit 3D geological modelling from interfaces and orientations,
  including faults, unconformities and uncertainty workflows.
- **LoopStructural** — implicit structural modelling with fault networks, fold kinematics
  and overprinting relationships; exports VTK, OMF, GOCAD and other formats.

### 3D interchange and visualization
- **PyVista / VTK** — server-side mesh/volume processing and rendering.
- **Open Mining Format (OMF)** — interoperable mining/geoscience exchange format; use the
  stable version for production exports while OMF v2 remains pre-release.

## Recommended compute pipeline

```
SERNAGEOMIN / Sentinel / DEM / field data
        |
        v
Geoscience Dataset Registry
(CRS + units + provenance + version + hash)
        |
        +--> remote-sensing processing --> spectral/structural candidates
        |
        +--> SimPEG/Harmonica ----------> magnetic/gravity models
        |
        +--> pyGIMLi -------------------> IP/ERT/EM models
        |
        +--> geology observations
                  |
                  v
          GemPy / LoopStructural
                  |
                  v
      3D structural geological model
                  |
                  +--> VTK/PyVista
                  +--> OMF export
                  +--> GeoCapitals 3D viewer
                  |
                  v
        evidence-weighted targets
```

## 3D modelling gate

A 3D geological structure must not be generated from a satellite anomaly alone.
Minimum useful constraints are:

- DEM/topographic surface;
- geological contacts or mapped unit boundaries;
- structural orientations (strike/dip or equivalent);
- fault/vein traces where known;
- drillhole contacts when available;
- explicit CRS and units.

Magnetic, gravity or IP inversion volumes can constrain or test the structural interpretation,
but remain geophysical models rather than observed geology.

## Implementation phases

### Phase A — viewer
Group controls by Territory / Remote sensing / Geophysics / Exploration and expose the
existing EMAG2/WGM2012 regional overlays with scale warnings.

### Phase B — project geophysics
Wire `geophysics_surveys/lines/stations/anomalies` into the master viewer. Add continuous
surfaces/contours for measured magnetics and IP instead of circular decorative halos.

### Phase C — public data adapters
Add registry adapters for SERNAGEOMIN/IDE, Copernicus STAC, OpenTopography and OneGeology.
Every imported dataset gets immutable source metadata and QA status.

### Phase D — 3D structural worker
Create a GemPy/LoopStructural worker behind `geoscience_compute_jobs` for
`implicit_geological_model`. Inputs are immutable registry versions; outputs are versioned
`model_3d` / `structure` datasets plus VTK/OMF artifacts.

### Phase E — joint interpretation
Allow magnetic/gravity/IP inversion volumes to be co-rendered with the structural model and
rank targets by independent evidence layers. Do not automatically upgrade interpreted targets
to certified evidence.
