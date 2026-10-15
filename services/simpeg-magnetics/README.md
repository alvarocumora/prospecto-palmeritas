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

## Local HTTP node

The same worker can run as a private HTTP node for a local GeoCapitals backend.
It accepts one inversion at a time, requires a bearer token, limits input size,
observations and active mesh cells, and returns the compressed NPZ artifact as
base64 with its SHA-256 digest. It does not expose uploaded project data publicly
or persist jobs; the calling application remains responsible for authorization,
job history and private artifact storage.

Run natively from this directory after installing `requirements.txt`:

Use Python 3.11 or newer for SimPEG 0.25.x. The system Python on some macOS
installations is older; create an isolated environment rather than modifying
the system interpreter.

```bash
export SIMPEG_MAGNETICS_TOKEN='use-a-long-random-secret'
uvicorn api:app --host 127.0.0.1 --port 8090
```

Or build and run the container, keeping the port bound to the local machine:

```bash
docker build -t geocapitals-simpeg-node .
docker run --rm -p 127.0.0.1:8090:8090 \
  -e SIMPEG_MAGNETICS_TOKEN='use-a-long-random-secret' \
  geocapitals-simpeg-node
```

`GET /health` checks availability. `POST /v1/magnetic-inversion` receives the
same JSON contract as `runner.py` and requires `Authorization: Bearer <token>`.
The GeoCapitals server adapter in `src/lib/simpegMagnetics.functions.ts` calls
this endpoint after checking project membership and confirming that both input
datasets are registered, hashed, non-synthetic, and use the submitted projected
metric CRS. It records the compute job and stores the verified artifact in the
private `engine-artifacts` bucket. Configure `SIMPEG_MAGNETICS_URL` and
`SIMPEG_MAGNETICS_TOKEN` as server-only environment variables; never expose the
token in browser code. A deployed app cannot reach a developer's loopback
address; production needs a private network endpoint and durable queue/storage
before this synchronous worker is exposed. The function hashes the submitted
JSON package and stores the registered dataset IDs and hashes as lineage, but
does not yet load the dataset files itself; only call it with values prepared
from those exact source datasets. No current project dataset has been run.

A successful run emits JSON to stdout and writes `magnetic_inversion.npz`. The result includes a SHA-256 digest so the artifact can be persisted and referenced from the geoscience compute job without losing reproducibility.

## Scope

v1 is intentionally TMI + induced scalar susceptibility only. Magnetic vector inversion, remanence, tiled/distributed inversion, gravity, IP and EM remain out of scope.
