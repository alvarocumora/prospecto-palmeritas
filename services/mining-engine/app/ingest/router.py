"""Authenticated preview endpoints; never persist or publish uploaded geometry."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field

from ..geodesy import transform_xy
from ..security import require_engine_auth
from .kml import MAX_UPLOAD_BYTES, preview_kml

router = APIRouter(tags=["geospatial-preview"])


class TransformRequest(BaseModel):
    x: float = Field(allow_inf_nan=False)
    y: float = Field(allow_inf_nan=False)
    source_epsg: int = Field(ge=1000, le=999999)
    target_epsg: int = Field(ge=1000, le=999999)


class TransformResult(BaseModel):
    x: float
    y: float
    source_epsg: int
    target_epsg: int


@router.post("/geodesy/transform", response_model=TransformResult)
def transform_coordinates(
    data: TransformRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> TransformResult:
    require_engine_auth(authorization)
    try:
        x, y = transform_xy(
            data.x, data.y, data.source_epsg, data.target_epsg
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return TransformResult(
        x=x, y=y,
        source_epsg=data.source_epsg, target_epsg=data.target_epsg,
    )


@router.post("/ingest/preview-kml")
async def upload_preview_kml(
    file: Annotated[UploadFile, File()],
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    require_engine_auth(authorization)
    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="upload_size_exceeded")
    try:
        return preview_kml(file.filename or "", payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        await file.close()
