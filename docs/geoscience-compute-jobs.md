# Geoscience Compute Jobs v1

Geoscience Compute Jobs are the universal execution contract between the Global Geoscience Dataset Registry and numerical engines such as SimPEG, GemPy, pyGIMLi and future geostatistical services.

## Contract

Every run records:

- project, job type, numerical engine and engine version;
- immutable dataset inputs as dataset ID + dataset version + content hash + semantic role;
- complete parameters used by the numerical method;
- outputs and their hashes;
- convergence/runtime metrics;
- status, timestamps and execution error;
- creator and database timestamps.

This creates reproducible lineage:

`dataset version(s) -> compute job -> derived dataset/model -> Mining Asset Graph`

## Evidence gate

Inputs are validated with the same registry rule used by interpretation workflows. A dataset with `qaStatus=synthetic` or `qaStatus=failed` cannot enter a technical compute job. Spatial datasets that require CRS must also have an explicit CRS before they can be used.

This specifically prevents procedural DEMs or drillholes planned from targets from becoming inversion/model evidence.

## Initial engine mapping

- SimPEG: magnetic, gravity, IP, resistivity and EM inversion.
- GemPy: implicit geological, vein and mantle modelling.
- pyGIMLi: optional geophysical inversion adapter.
- GSTools/custom: variography, kriging and future geostatistics.

The contract does not embed an engine-specific schema. Engine adapters translate `parameters` and `outputs` while preserving the universal job identity and provenance envelope.
