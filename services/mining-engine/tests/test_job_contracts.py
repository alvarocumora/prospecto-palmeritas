from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.job_contracts import GeoJobRecord, GeoJobSpec, GeoJobStatus


@pytest.fixture
def valid_spec():
    return dict(
        project_id=uuid4(),
        input_asset_id=uuid4(),
        job_type="vector_ingest",
        source_crs_epsg=32719,
    )


def test_strict_schema_with_registered_assets(valid_spec):
    spec = GeoJobSpec(**valid_spec)
    assert spec.target_crs_epsg == 4326
    assert spec.schema_version == 1
    assert spec.parameters == {}


@pytest.mark.parametrize("override", [
    {"source_crs_epsg": None},
    {"source_crs_epsg": 0},
    {"job_type": "arbitrary_python"},
    {"input_url": "https://evil.example/data.zip"},
    {"parameters": {f"field{i}": "value" for i in range(25)}},
    {"parameters": {"filename": "x" * 1025}},
])
def test_untrusted_input_rejected(valid_spec, override):
    with pytest.raises(ValidationError):
        GeoJobSpec(**{**valid_spec, **override})


def test_job_record_status_is_explicit(valid_spec):
    record = GeoJobRecord(job_id=uuid4(), spec=GeoJobSpec(**valid_spec), status=GeoJobStatus.QUEUED)
    assert record.result_asset_id is None
    assert record.status == GeoJobStatus.QUEUED
