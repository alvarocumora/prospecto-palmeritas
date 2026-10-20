"""Validated geoscience job contracts. PR A does not enqueue or process work.

Both the persistence adapter and job executor will be implemented later.
Use project-scoped registered asset IDs instead of raw untrusted URLs.
"""
from __future__ import annotations

from enum import Enum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GeoJobType(str, Enum):
    VECTOR_INGEST = "vector_ingest"
    DEM_CONTOURS = "dem_contours"
    ANOMALY_GRID = "anomaly_grid"
    EXPORT = "export"


class GeoJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GeoJobSpec(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    schema_version: Annotated[int, Field(ge=1, le=1)] = 1
    project_id: UUID
    input_asset_id: UUID
    job_type: GeoJobType
    source_crs_epsg: Annotated[int, Field(ge=2000, le=999999)]
    target_crs_epsg: Annotated[int, Field(ge=2000, le=999999)] = 4326
    parameters: dict[str, str | int | float | bool | None] = Field(default_factory=dict)

    @field_validator("parameters")
    @classmethod
    def bounded_parameters(cls, value: dict[str, str | int | float | bool | None]):
        if len(value) > 24 or any(len(key) > 64 for key in value):
            raise ValueError("parameters_exceed_limit")
        if any(isinstance(item, str) and len(item) > 1024 for item in value.values()):
            raise ValueError("parameter_value_exceeds_limit")
        return value


class GeoJobValidation(BaseModel):
    """A validated request is NOT a job scheduled or executed."""

    schema_version: int = 1
    project_id: UUID
    input_asset_id: UUID
    job_type: GeoJobType
    state: str = "validated_not_submitted"
    can_execute: bool = False


class GeoJobRecord(BaseModel):
    """Persistence-facing contract, not a database migration."""

    model_config = ConfigDict(extra="forbid")

    job_id: UUID
    spec: GeoJobSpec
    status: GeoJobStatus
    result_asset_id: UUID | None = None
    error_code: str | None = Field(default=None, max_length=80)
