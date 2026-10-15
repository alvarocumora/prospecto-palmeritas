"""Authenticated local HTTP node for the SimPEG inversion worker.

This node is intended for a local development machine or a private compute host.
It has no persistent job queue: the caller owns job persistence and artifacts.
"""
from __future__ import annotations

import asyncio
import base64
import hmac
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from runner import ContractError, run_inversion, validate_payload

app = FastAPI(title="geocapitals-simpeg-node", version="1.0.0")
MAX_REQUEST_BYTES = 10 * 1024 * 1024
MAX_ARTIFACT_BYTES = 64 * 1024 * 1024
MAX_CELLS = 250_000
MAX_OBSERVATIONS = 50_000
MAX_TOPOGRAPHY_POINTS = 100_000
JOB_ID = re.compile(r"^[0-9a-fA-F-]{36}$")
AUTH_TOKEN = os.environ.get("SIMPEG_MAGNETICS_TOKEN", "")
SINGLE_JOB = asyncio.Semaphore(1)


def _authorize(authorization: Optional[str]) -> None:
    if not AUTH_TOKEN:
        raise HTTPException(status_code=503, detail="compute node token is not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    supplied = authorization.removeprefix("Bearer ")
    if not hmac.compare_digest(supplied, AUTH_TOKEN):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": app.title, "version": app.version}


@app.post("/v1/magnetic-inversion")
async def magnetic_inversion(
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    _authorize(authorization)
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > MAX_REQUEST_BYTES:
            raise HTTPException(status_code=413, detail="request exceeds 10 MiB limit")
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ContractError("payload root must be an object")
        validate_payload(payload)
    except (json.JSONDecodeError, ContractError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not JOB_ID.fullmatch(str(payload.get("job_id", ""))):
        raise HTTPException(status_code=422, detail="job_id must be a UUID")
    if len(payload["observations"]) > MAX_OBSERVATIONS:
        raise HTTPException(status_code=413, detail="too many observations")
    if len(payload["topography"]) > MAX_TOPOGRAPHY_POINTS:
        raise HTTPException(status_code=413, detail="too many topography points")

    mesh = payload.setdefault("mesh", {})
    requested_cells = mesh.get("max_cells", MAX_CELLS)
    mesh["max_cells"] = min(int(requested_cells), MAX_CELLS)

    if SINGLE_JOB.locked():
        raise HTTPException(status_code=429, detail="compute node is busy; retry later")
    async with SINGLE_JOB:
        try:
            with tempfile.TemporaryDirectory(prefix="geocapitals-simpeg-") as directory:
                output_dir = Path(directory)
                result = await run_in_threadpool(run_inversion, payload, output_dir)
                artifact_path = Path(result["artifact"]["path"])
                artifact = artifact_path.read_bytes()
                if len(artifact) > MAX_ARTIFACT_BYTES:
                    raise HTTPException(status_code=413, detail="result artifact exceeds 64 MiB")
                return {
                    **result,
                    "artifact": {
                        "filename": "magnetic_inversion.npz",
                        "sha256": result["artifact"]["sha256"],
                        "content_type": "application/x-npz",
                        "byte_length": len(artifact),
                        "base64": base64.b64encode(artifact).decode("ascii"),
                    },
                }
        except HTTPException:
            raise
        except (ContractError, ValueError) as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:  # Keep internal stack traces out of the API response.
            raise HTTPException(status_code=500, detail=f"inversion failed: {type(exc).__name__}") from exc
