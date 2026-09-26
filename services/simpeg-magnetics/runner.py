#!/usr/bin/env python3
"""SimPEG Magnetics v1 worker.

Consumes one JSON job payload containing projected TMI observations and topography,
runs a bounded scalar-susceptibility inversion, and emits a JSON result. Numerical
artifacts are written to an NPZ file so the caller can persist them in object storage.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np
from discretize import TensorMesh
from discretize.utils import active_from_xyz
from simpeg import (
    data,
    data_misfit,
    directives,
    inverse_problem,
    inversion,
    maps,
    optimization,
    regularization,
)
from simpeg.potential_fields import magnetics

SCHEMA_VERSION = "1"
ENGINE = "simpeg"
MODEL_TYPE = "scalar_susceptibility"


class ContractError(ValueError):
    """Raised when an inversion payload violates the v1 contract."""


def _finite(value: Any, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ContractError(f"{name} must be numeric")
    result = float(value)
    if not math.isfinite(result):
        raise ContractError(f"{name} must be finite")
    return result


def validate_payload(payload: dict[str, Any]) -> None:
    if payload.get("schema_version") != SCHEMA_VERSION:
        raise ContractError(f"schema_version must be {SCHEMA_VERSION!r}")
    for key in ("job_id", "project_id", "crs"):
        if not isinstance(payload.get(key), str) or not payload[key].strip():
            raise ContractError(f"{key} is required")

    crs = payload["crs"].upper().replace(" ", "")
    if crs in {"EPSG:4326", "WGS84", "WGS-84"}:
        raise ContractError("crs must be a projected metric CRS, not geographic WGS84")

    observations = payload.get("observations")
    if not isinstance(observations, list) or len(observations) < 4:
        raise ContractError("at least 4 magnetic observations are required")
    for index, obs in enumerate(observations):
        if not isinstance(obs, dict):
            raise ContractError(f"observations[{index}] must be an object")
        for key in ("x_m", "y_m", "z_m", "tmi_nt", "std_nt"):
            value = _finite(obs.get(key), f"observations[{index}].{key}")
            if key == "std_nt" and value <= 0:
                raise ContractError(f"observations[{index}].std_nt must be > 0")

    topography = payload.get("topography")
    if not isinstance(topography, list) or len(topography) < 3:
        raise ContractError("at least 3 topography points are required")
    for index, point in enumerate(topography):
        if not isinstance(point, dict):
            raise ContractError(f"topography[{index}] must be an object")
        for key in ("x_m", "y_m", "z_m"):
            _finite(point.get(key), f"topography[{index}].{key}")

    field = payload.get("inducing_field")
    if not isinstance(field, dict):
        raise ContractError("inducing_field is required")
    amplitude = _finite(field.get("amplitude_nt"), "inducing_field.amplitude_nt")
    inclination = _finite(field.get("inclination_deg"), "inducing_field.inclination_deg")
    declination = _finite(field.get("declination_deg"), "inducing_field.declination_deg")
    if amplitude <= 0:
        raise ContractError("inducing_field.amplitude_nt must be > 0")
    if not -90 <= inclination <= 90:
        raise ContractError("inducing_field.inclination_deg must be between -90 and 90")
    if not -360 <= declination <= 360:
        raise ContractError("inducing_field.declination_deg must be between -360 and 360")

    mesh = payload.get("mesh")
    if not isinstance(mesh, dict):
        raise ContractError("mesh is required")
    cell = _finite(mesh.get("cell_size_m"), "mesh.cell_size_m")
    padding = _finite(mesh.get("padding_m"), "mesh.padding_m")
    depth = _finite(mesh.get("depth_m"), "mesh.depth_m")
    max_cells = mesh.get("max_cells", 250_000)
    if cell <= 0 or padding < 0 or depth <= 0:
        raise ContractError("mesh dimensions must be positive (padding may be zero)")
    if not isinstance(max_cells, int) or isinstance(max_cells, bool) or max_cells < 1_000:
        raise ContractError("mesh.max_cells must be an integer >= 1000")

    settings = payload.get("inversion", {})
    if not isinstance(settings, dict):
        raise ContractError("inversion must be an object")
    max_iterations = settings.get("max_iterations", 20)
    if not isinstance(max_iterations, int) or isinstance(max_iterations, bool) or not 1 <= max_iterations <= 100:
        raise ContractError("inversion.max_iterations must be an integer between 1 and 100")
    lower = _finite(settings.get("lower_bound_si", 0.0), "inversion.lower_bound_si")
    upper = _finite(settings.get("upper_bound_si", 1.0), "inversion.upper_bound_si")
    start = _finite(
        settings.get("starting_susceptibility_si", 1e-4),
        "inversion.starting_susceptibility_si",
    )
    if not lower < upper:
        raise ContractError("inversion.lower_bound_si must be < upper_bound_si")
    if not lower <= start <= upper:
        raise ContractError("starting susceptibility must lie within inversion bounds")


def _arrays(payload: dict[str, Any]) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    observations = payload["observations"]
    locations = np.asarray(
        [[row["x_m"], row["y_m"], row["z_m"]] for row in observations], dtype=float
    )
    observed = np.asarray([row["tmi_nt"] for row in observations], dtype=float)
    std = np.asarray([row["std_nt"] for row in observations], dtype=float)
    topo = np.asarray(
        [[row["x_m"], row["y_m"], row["z_m"]] for row in payload["topography"]], dtype=float
    )
    return locations, observed, std, topo


def build_mesh(payload: dict[str, Any], locations: np.ndarray, topo: np.ndarray) -> TensorMesh:
    spec = payload["mesh"]
    cell = float(spec["cell_size_m"])
    padding = float(spec["padding_m"])
    depth = float(spec["depth_m"])

    all_x = np.r_[locations[:, 0], topo[:, 0]]
    all_y = np.r_[locations[:, 1], topo[:, 1]]
    x_min, x_max = float(all_x.min() - padding), float(all_x.max() + padding)
    y_min, y_max = float(all_y.min() - padding), float(all_y.max() + padding)
    z_top = float(max(locations[:, 2].max(), topo[:, 2].max()) + cell)
    z_bottom = float(topo[:, 2].min() - depth)

    nx = max(2, int(math.ceil((x_max - x_min) / cell)))
    ny = max(2, int(math.ceil((y_max - y_min) / cell)))
    nz = max(2, int(math.ceil((z_top - z_bottom) / cell)))
    n_cells = nx * ny * nz
    if n_cells > int(spec.get("max_cells", 250_000)):
        raise ContractError(
            f"mesh would contain {n_cells} cells, exceeding max_cells={spec.get('max_cells', 250_000)}"
        )

    return TensorMesh(
        [np.full(nx, cell), np.full(ny, cell), np.full(nz, cell)],
        x0=[x_min, y_min, z_bottom],
    )


def run_inversion(payload: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    validate_payload(payload)
    started = time.perf_counter()
    locations, observed, std, topo = _arrays(payload)
    mesh = build_mesh(payload, locations, topo)
    active = active_from_xyz(mesh, topo)
    n_active = int(active.sum())
    if n_active < 8:
        raise ContractError(f"inversion mesh has too few active cells: {n_active}")

    receiver = magnetics.receivers.Point(locations, components=["tmi"])
    field = payload["inducing_field"]
    source = magnetics.sources.UniformBackgroundField(
        receiver_list=[receiver],
        amplitude=float(field["amplitude_nt"]),
        inclination=float(field["inclination_deg"]),
        declination=float(field["declination_deg"]),
    )
    survey = magnetics.survey.Survey(source)

    identity = maps.IdentityMap(nP=n_active)
    simulation = magnetics.simulation.Simulation3DIntegral(
        survey=survey,
        mesh=mesh,
        chiMap=identity,
        active_cells=active,
        store_sensitivities="ram",
    )
    data_object = data.Data(survey, dobs=observed, standard_deviation=std)
    misfit = data_misfit.L2DataMisfit(simulation=simulation, data=data_object)
    reg = regularization.WeightedLeastSquares(mesh, active_cells=active, mapping=identity)

    settings = payload.get("inversion", {})
    max_iterations = int(settings.get("max_iterations", 20))
    lower = float(settings.get("lower_bound_si", 0.0))
    upper = float(settings.get("upper_bound_si", 1.0))
    start = float(settings.get("starting_susceptibility_si", 1e-4))
    beta0_ratio = float(settings.get("beta0_ratio", 10.0))

    optimizer = optimization.ProjectedGNCG(
        maxIter=max_iterations,
        lower=lower,
        upper=upper,
        maxIterLS=20,
        cg_maxiter=20,
        cg_rtol=1e-3,
    )
    inv_problem = inverse_problem.BaseInvProblem(misfit, reg, optimizer)
    inv = inversion.BaseInversion(
        inv_problem,
        directiveList=[
            directives.UpdateSensitivityWeights(),
            directives.BetaEstimate_ByEig(beta0_ratio=beta0_ratio),
            directives.UpdatePreconditioner(),
        ],
    )

    starting_model = np.full(n_active, start, dtype=float)
    recovered = np.asarray(inv.run(starting_model), dtype=float)
    predicted = np.asarray(simulation.dpred(recovered), dtype=float)
    residual = observed - predicted
    normalized_rms = float(np.sqrt(np.mean(np.square(residual / std))))

    output_dir.mkdir(parents=True, exist_ok=True)
    artifact = output_dir / "magnetic_inversion.npz"
    np.savez_compressed(
        artifact,
        recovered_susceptibility_si=recovered,
        active_cell_centers_m=mesh.cell_centers[active],
        predicted_tmi_nt=predicted,
        observed_tmi_nt=observed,
        standard_deviation_nt=std,
        observation_locations_m=locations,
        active_cells=active,
        mesh_shape=np.asarray(mesh.shape_cells),
        mesh_origin_m=np.asarray(mesh.origin),
    )
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()

    return {
        "schema_version": SCHEMA_VERSION,
        "job_id": payload["job_id"],
        "project_id": payload["project_id"],
        "status": "succeeded",
        "engine": ENGINE,
        "engine_version": __import__("simpeg").__version__,
        "model_type": MODEL_TYPE,
        "crs": payload["crs"],
        "metrics": {
            "observation_count": int(observed.size),
            "mesh_cells": int(mesh.n_cells),
            "active_cells": n_active,
            "iterations": int(getattr(optimizer, "iter", max_iterations)),
            "normalized_rms": normalized_rms,
            "runtime_seconds": float(time.perf_counter() - started),
        },
        "artifact": {
            "path": str(artifact),
            "sha256": digest,
            "content_type": "application/x-npz",
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a SimPEG TMI susceptibility inversion")
    parser.add_argument("input", type=Path, help="Path to v1 JSON payload")
    parser.add_argument("--output-dir", type=Path, default=Path("./output"))
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()

    try:
        payload = json.loads(args.input.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ContractError("payload root must be an object")
        validate_payload(payload)
        if args.validate_only:
            result = {"schema_version": SCHEMA_VERSION, "status": "valid"}
        else:
            result = run_inversion(payload, args.output_dir)
        print(json.dumps(result, separators=(",", ":"), sort_keys=True))
        return 0
    except (ContractError, json.JSONDecodeError, OSError, ValueError) as exc:
        print(
            json.dumps(
                {"schema_version": SCHEMA_VERSION, "status": "failed", "error": str(exc)},
                separators=(",", ":"),
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
