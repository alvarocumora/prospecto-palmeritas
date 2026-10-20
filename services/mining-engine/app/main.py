"""FastAPI entrypoint para mining-engine."""
from __future__ import annotations

from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .security import require_engine_auth as _check_auth
from .job_contracts import GeoJobSpec, GeoJobValidation
from .desurvey import desurvey
from .composite import composite_intervals
from .section import project_trajectory, project_points
from .wireframe import rbf_wireframe
from .swath import swath_compare

app = FastAPI(title="mining-engine", version="0.2.0")

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


@app.post("/jobs/validate", response_model=GeoJobValidation)
def validate_geo_job(
    spec: GeoJobSpec,
    authorization: Optional[str] = Header(default=None),
) -> GeoJobValidation:
    """Validate an asset-referenced job request; never schedule or persist it."""
    _check_auth(authorization)
    return GeoJobValidation(
        project_id=spec.project_id,
        input_asset_id=spec.input_asset_id,
        job_type=spec.job_type,
    )


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


# ---------------------------------------------------------------------------
# /section — proyectar trayectorias y puntos sobre un plano vertical
# ---------------------------------------------------------------------------
class SectionTrajectory(BaseModel):
    hole_id: str
    hole_code: Optional[str] = None
    points: List[dict]  # [{md,x,y,z}, ...]
    intercepts: Optional[List[dict]] = None  # [{md_from,md_to,x,y,z,grade,...}]


class SectionRequest(BaseModel):
    origin_x: float
    origin_y: float
    origin_z: float
    azimuth_deg: float
    band_m: float = Field(default=50.0, gt=0, le=2000)
    trajectories: List[SectionTrajectory] = Field(default_factory=list)
    extra_points: List[dict] = Field(default_factory=list)


class SectionResponse(BaseModel):
    azimuth_deg: float
    band_m: float
    trajectories: List[dict]
    extra_points: List[dict]
    bounds: dict


@app.post("/section", response_model=SectionResponse)
def section_endpoint(
    body: SectionRequest,
    authorization: Optional[str] = Header(default=None),
) -> SectionResponse:
    _check_auth(authorization)
    out_traj = []
    all_s: list[float] = []
    all_h: list[float] = []
    for t in body.trajectories:
        proj = project_trajectory(
            t.points, body.origin_x, body.origin_y, body.origin_z,
            body.azimuth_deg, body.band_m,
        )
        intercepts_proj = []
        if t.intercepts:
            intercepts_proj = project_points(
                t.intercepts, body.origin_x, body.origin_y, body.origin_z,
                body.azimuth_deg, body.band_m,
            )
        for p in proj:
            if p["in_band"]:
                all_s.append(p["s"]); all_h.append(p["h"])
        out_traj.append({
            "hole_id": t.hole_id,
            "hole_code": t.hole_code,
            "points": proj,
            "intercepts": intercepts_proj,
        })
    extra = project_points(
        body.extra_points, body.origin_x, body.origin_y, body.origin_z,
        body.azimuth_deg, body.band_m,
    ) if body.extra_points else []
    bounds = {
        "s_min": min(all_s) if all_s else 0.0,
        "s_max": max(all_s) if all_s else 0.0,
        "h_min": min(all_h) if all_h else 0.0,
        "h_max": max(all_h) if all_h else 0.0,
    }
    return SectionResponse(
        azimuth_deg=body.azimuth_deg,
        band_m=body.band_m,
        trajectories=out_traj,
        extra_points=extra,
        bounds=bounds,
    )


# ---------------------------------------------------------------------------
# /wireframe-rbf — superficie implícita por RBF
# ---------------------------------------------------------------------------
class WireframeSample(BaseModel):
    x: float
    y: float
    z: float
    indicator: float = Field(ge=0, le=1)


class WireframeRequest(BaseModel):
    samples: List[WireframeSample]
    iso: float = Field(default=0.5, ge=0, le=1)
    grid_n: int = Field(default=32, ge=8, le=80)
    pad: float = Field(default=50.0, ge=0, le=1000)
    smooth: float = Field(default=5.0, ge=0, le=1000)


@app.post("/wireframe-rbf")
def wireframe_endpoint(
    body: WireframeRequest,
    authorization: Optional[str] = Header(default=None),
) -> dict:
    _check_auth(authorization)
    if len(body.samples) < 4:
        raise HTTPException(status_code=400, detail="≥4 muestras requeridas")
    return rbf_wireframe(
        [s.model_dump() for s in body.samples],
        iso=body.iso, grid_n=body.grid_n, pad=body.pad, smooth=body.smooth,
    )


# ---------------------------------------------------------------------------
# /swath-plot — validación visual estimación vs compositos
# ---------------------------------------------------------------------------
class SwathPoint(BaseModel):
    x: float
    y: float
    z: float
    grade: Optional[float] = None


class SwathRequest(BaseModel):
    composites: List[SwathPoint]
    blocks: List[SwathPoint]
    axis: str = Field(default="z")
    n_bands: int = Field(default=20, ge=5, le=100)


@app.post("/swath-plot")
def swath_endpoint(
    body: SwathRequest,
    authorization: Optional[str] = Header(default=None),
) -> dict:
    _check_auth(authorization)
    return swath_compare(
        [c.model_dump() for c in body.composites],
        [b.model_dump() for b in body.blocks],
        axis=body.axis, n_bands=body.n_bands,
    )


@app.post("/variogram", response_model=StubResponse)
def variogram_stub(authorization: Optional[str] = Header(default=None)) -> StubResponse:
    _check_auth(authorization)
    return StubResponse(status="todo", message="variografía pendiente (sprint 3)")


@app.post("/pit-optim", response_model=StubResponse)
def pit_optim_stub(authorization: Optional[str] = Header(default=None)) -> StubResponse:
    _check_auth(authorization)
    return StubResponse(status="todo", message="Lerchs-Grossmann pendiente (sprint 2)")


@app.post("/schedule", response_model=StubResponse)
def schedule_stub(authorization: Optional[str] = Header(default=None)) -> StubResponse:
    _check_auth(authorization)
    return StubResponse(status="todo", message="scheduling MILP pendiente (sprint 3)")
