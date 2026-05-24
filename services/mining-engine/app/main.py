"""FastAPI entrypoint para mining-engine."""
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .desurvey import desurvey

app = FastAPI(title="mining-engine", version="0.1.0")

AUTH_TOKEN = os.environ.get("MINING_ENGINE_TOKEN")


def _check_auth(authorization: Optional[str]) -> None:
    if not AUTH_TOKEN:
        return  # sin token configurado: modo dev
    if not authorization or authorization != f"Bearer {AUTH_TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


class Shot(BaseModel):
    depth: float = Field(ge=0)
    azimuth: float
    dip: float


class DesurveyRequest(BaseModel):
    collar_x: float
    collar_y: float
    collar_z: float
    shots: List[Shot]
    step: float = Field(default=1.0, gt=0, le=50)


class TrajectoryPoint(BaseModel):
    md: float
    x: float
    y: float
    z: float


class DesurveyResponse(BaseModel):
    points: List[TrajectoryPoint]
    total_length: float


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "mining-engine", "version": app.version}


@app.post("/desurvey", response_model=DesurveyResponse)
def desurvey_endpoint(
    body: DesurveyRequest,
    authorization: Optional[str] = Header(default=None),
) -> DesurveyResponse:
    _check_auth(authorization)
    if len(body.shots) < 2:
        raise HTTPException(status_code=400, detail="se requieren ≥2 survey shots")

    pts = desurvey(
        body.collar_x, body.collar_y, body.collar_z,
        [(s.depth, s.azimuth, s.dip) for s in body.shots],
        step=body.step,
    )
    total = pts[-1]["md"] - pts[0]["md"] if pts else 0.0
    return DesurveyResponse(
        points=[TrajectoryPoint(**p) for p in pts],
        total_length=total,
    )


# Stubs para próximos sprints ---------------------------------------------------

class StubResponse(BaseModel):
    status: str
    message: str


@app.post("/composite", response_model=StubResponse)
def composite_stub(authorization: Optional[str] = Header(default=None)) -> StubResponse:
    _check_auth(authorization)
    return StubResponse(status="todo", message="compositing pendiente (sprint 2)")


@app.post("/variogram", response_model=StubResponse)
def variogram_stub(authorization: Optional[str] = Header(default=None)) -> StubResponse:
    _check_auth(authorization)
    return StubResponse(status="todo", message="variografía pendiente (sprint 3)")


@app.post("/krige", response_model=StubResponse)
def krige_stub(authorization: Optional[str] = Header(default=None)) -> StubResponse:
    _check_auth(authorization)
    return StubResponse(status="todo", message="kriging pendiente (sprint 4, requiere pygslib)")
