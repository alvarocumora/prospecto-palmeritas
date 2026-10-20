"""Security regression tests: protected endpoints must fail closed."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

PAYLOAD = {
    "project_id": "fc3bc0a9-f349-4c6f-afca-8f1d9b0ce299",
    "input_asset_id": "b29b0f06-405a-4c6e-8c7d-b85b15aa9f14",
    "job_type": "vector_ingest",
    "source_crs_epsg": 32719,
}


def test_health_is_public_when_not_configured(monkeypatch):
    monkeypatch.delenv("MINING_ENGINE_TOKEN", raising=False)
    response = client.get("/health")
    assert response.status_code == 200


def test_missing_secret_fails_closed(monkeypatch):
    monkeypatch.delenv("MINING_ENGINE_TOKEN", raising=False)
    assert client.post("/jobs/validate", json=PAYLOAD).status_code == 503
    response = client.post("/desurvey", json={"collar_x": 0, "collar_y": 0, "collar_z": 10, "shots": []})
    assert response.status_code == 503


def test_blank_secret_fails_closed(monkeypatch):
    monkeypatch.setenv("MINING_ENGINE_TOKEN", "   ")
    assert client.post("/jobs/validate", json=PAYLOAD).status_code == 503


def test_wrong_or_missing_bearer(monkeypatch):
    monkeypatch.setenv("MINING_ENGINE_TOKEN", "test-service-secret")
    for header in (None, "Basic test-service-secret", "Bearer wrong", "Bearer "):
        headers = {} if header is None else {"Authorization": header}
        response = client.post("/jobs/validate", json=PAYLOAD, headers=headers)
        assert response.status_code == 401


def test_valid_bearer_validates_but_does_not_schedule(monkeypatch):
    monkeypatch.setenv("MINING_ENGINE_TOKEN", "test-service-secret")
    response = client.post(
        "/jobs/validate",
        json=PAYLOAD,
        headers={"Authorization": "Bearer test-service-secret"},
    )
    assert response.status_code == 200
    assert response.json()["state"] == "validated_not_submitted"
    assert response.json()["can_execute"] is False


def test_missing_source_crs_is_rejected(monkeypatch):
    monkeypatch.setenv("MINING_ENGINE_TOKEN", "test-service-secret")
    response = client.post(
        "/jobs/validate",
        json={key: val for key, val in PAYLOAD.items() if key != "source_crs_epsg"},
        headers={"Authorization": "Bearer test-service-secret"},
    )
    assert response.status_code == 422
