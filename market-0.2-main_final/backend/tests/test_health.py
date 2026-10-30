from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    """Verify GET /api/v1/health returns status 200 and expected payload."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "SoilPilot API",
    }


def test_root_endpoint():
    """Verify root / returns API metadata and links."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "SoilPilot API"
    assert data["health"] == "/api/v1/health"
