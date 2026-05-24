"""FastAPI entrypoint para mining-engine."""
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .desurvey import desurvey
from .composite import composite_intervals

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


class CompositeInterval(BaseModel):
    from_: float = Field(alias="from", ge=0)
    to: float = Field(ge=0)
    values: dict = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class CompositeRequest(BaseModel):
    intervals: List[CompositeInterval]
    length: float = Field(default=1.0, gt=0, le=100)
    start: Optional[float] = None
    end: Optional[float] = None
    min_recovery: float = Field(default=0.5, ge=0, le=1)


class CompositeResultItem(BaseModel):
    from_: float = Field(alias="from")
    to: float
    length: float
    recovery: float
    values: dict

    class Config:
        populate_by_name = True


class CompositeResponse(BaseModel):
    composites: List[CompositeResultItem]
    count: int


@app.post("/composite", response_model=CompositeResponse)
def composite_endpoint(
    body: CompositeRequest,
    authorization: Optional[str] = Header(default=None),
) -> CompositeResponse:
    _check_auth(authorization)
    if not body.intervals:
        raise HTTPException(status_code=400, detail="intervals requerido")
    raw = [
        {"from": it.from_, "to": it.to, "values": it.values}
        for it in body.intervals
    ]
    composites = composite_intervals(
        raw,
        length=body.length,
        start=body.start,
        end=body.end,
        min_recovery=body.min_recovery,
    )
    items = [
        CompositeResultItem(
            **{"from": c["from"], "to": c["to"], "length": c["length"],
               "recovery": c["recovery"], "values": c["values"]}
        )
        for c in composites
    ]
    return CompositeResponse(composites=items, count=len(items))


@app.post("/variogram", response_model=StubResponse)
def variogram_stub(authorization: Optional[str] = Header(default=None)) -> StubResponse:
    _check_auth(authorization)
    return StubResponse(status="todo", message="variografía pendiente (sprint 3)")


@app.post("/krige", response_model=StubResponse)
def krige_stub(authorization: Optional[str] = Header(default=None)) -> StubResponse:
    _check_auth(authorization)
    return StubResponse(status="todo", message="kriging pendiente (sprint 4, requiere pygslib)")
