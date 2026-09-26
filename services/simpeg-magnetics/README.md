# SimPEG Magnetics v1

Python worker for bounded 3D scalar magnetic-susceptibility inversion using SimPEG.

## Contract

The worker accepts TMI observations in a **projected metric CRS**. Geographic WGS84 coordinates are rejected because the inversion mesh operates in physical distance units.

Required input groups:

- job/project identity and CRS
- observation points: x/y/z metres, TMI nT, standard deviation nT
- topography x/y/z metres
- inducing field amplitude/inclination/declination
- mesh cell size, padding, depth and a hard maximum-cell guard
- optional bounded inversion settings

The v1 solver uses a TensorMesh, topography-derived active cells, `Simulation3DIntegral`, weighted L2 data misfit, weighted least-squares regularization and bounded ProjectedGNCG optimization.

## Run

```bash
python runner.py job.json --output-dir ./output
```

Validation only:

```bash
python runner.py job.json --validate-only
```

A successful run emits JSON to stdout and writes `magnetic_inversion.npz`. The result includes a SHA-256 digest so the artifact can be persisted and referenced from the geoscience compute job without losing reproducibility.

## Scope

v1 is intentionally TMI + induced scalar susceptibility only. Magnetic vector inversion, remanence, tiled/distributed inversion, gravity, IP and EM remain out of scope.
