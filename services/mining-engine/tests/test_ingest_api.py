"""Preview endpoint requires machine auth and does not persist uploaded KML."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

KML = b"""<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark>
<Point><coordinates>-70.66,-33.45</coordinates></Point>
</Placemark></kml>"""


def test_preview_rejects_without_token(monkeypatch):
    monkeypatch.delenv("MINING_ENGINE_TOKEN", raising=False)
    response = client.post(
        "/ingest/preview-kml",
        files={"file": ("demo.kml", KML, "application/vnd.google-earth.kml+xml")},
    )
    assert response.status_code == 503


def test_preview_returns_nonpersistent_data(monkeypatch):
    monkeypatch.setenv("MINING_ENGINE_TOKEN", "test-secret-only")
    response = client.post(
        "/ingest/preview-kml",
        headers={"Authorization": "Bearer test-secret-only"},
        files={"file": ("demo.kml", KML, "application/vnd.google-earth.kml+xml")},
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "preview_unverified"
    assert result["features"][0]["geometry"]["coordinates"] == [-70.66, -33.45]


def test_transform_api_requires_explicit_epsg(monkeypatch):
    monkeypatch.setenv("MINING_ENGINE_TOKEN", "test-secret-only")
    headers = {"Authorization": "Bearer test-secret-only"}
    assert client.post("/geodesy/transform", json={"x": -70.66, "y": -33.45}, headers=headers).status_code == 422
    response = client.post(
        "/geodesy/transform",
        json={"x": -70.66, "y": -33.45, "source_epsg": 4326, "target_epsg": 32719},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert 300000 < response.json()["x"] < 450000
