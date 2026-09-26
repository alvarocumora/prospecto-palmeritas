# Global Geoscience Dataset Registry v1

This registry is the common ingestion boundary for professional exploration workflows. Measurements stay in their existing domain tables/files; the registry records dataset identity, CRS, vertical datum, units, provenance, QA/QC, spatial extent, acquisition dates, resolution, version and content hash.

Supported dataset families: geophysics, geochemistry, drilling, DEM, remote sensing, geology, structures, assays, 3D models and block models.

## Non-negotiable evidence rules

- Synthetic DEM or synthetic/planned drillholes are tagged `qaStatus=synthetic` and are not technical evidence.
- A derived satellite/geophysical/geological interpretation remains DERIVED or INTERPRETED; it is not upgraded to CERTIFIED by proximity to certified samples.
- Spatial datasets requiring a CRS cannot enter technical interpretation without an explicit CRS.
- Units are stored per measurement family and must be normalized before inversion, interpolation or resource estimation.
- Dataset versions are immutable inputs to reproducible model runs; future model-run records must reference exact dataset IDs/versions/hashes.

## Global workflow

`ingest -> registry -> QA/QC -> normalization -> interpretation/inversion -> GeoScene3D -> targets -> geological model -> estimation -> investment asset`

The Mining Asset Graph references registry records rather than duplicating measurements. This lets a magnetic survey, assay campaign, DEM, drill campaign or implicit model participate in the same provenance graph.

## Next numerical engines

1. Geophysics: adapters for magnetics, gravity, IP/resistivity and EM, then SimPEG/pyGIMLi inversion jobs with mesh, topography, data uncertainty, objective function and convergence metadata.
2. Structural geology: observation points/contacts/orientations into implicit 3D geological surfaces (GemPy-compatible job contract).
3. Geostatistics: domains, composites, declustering, variograms, anisotropy, estimation and validation. Current synthetic/IDW visual models must not be promoted to resource classifications.
4. Traceability: production batches and commodity lots link downstream only after measured production exists.
