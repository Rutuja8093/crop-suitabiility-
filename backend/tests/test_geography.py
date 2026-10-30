import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.geography import State, District, Taluka, Village
from app.models.field import Field

client = TestClient(app)

PUNE_16_TALUKAS = [
    "Haveli", "Pune City", "Maval", "Mulshi", "Shirur", "Baramati",
    "Daund", "Indapur", "Bhor", "Velha", "Purandar", "Khed",
    "Junnar", "Ambegaon", "Pimpri-Chinchwad", "Loni Kalbhor"
]


def test_pune_administrative_hierarchy_seeded():
    """Verify that Maharashtra -> Pune contains all 16 official talukas."""
    db = SessionLocal()
    try:
        state = db.query(State).filter(State.name == "Maharashtra").first()
        assert state is not None, "State Maharashtra should exist"

        pune = db.query(District).filter(District.name == "Pune", District.state_id == state.id).first()
        assert pune is not None, "District Pune should exist under Maharashtra"

        db_talukas = [t.name for t in pune.talukas]
        for expected_t in PUNE_16_TALUKAS:
            assert expected_t in db_talukas, f"Taluka '{expected_t}' missing from Pune district"
    finally:
        db.close()


def test_api_get_talukas_defaults_to_pune():
    """Verify GET /api/v1/geography/talukas returns all 16 Pune talukas."""
    response = client.get("/api/v1/geography/talukas")
    assert response.status_code == 200
    talukas = response.json()
    assert len(talukas) == 16
    taluka_names = [t["name"] for t in talukas]
    for expected in PUNE_16_TALUKAS:
        assert expected in taluka_names


def test_api_get_villages_by_taluka_name():
    """Verify GET /api/v1/geography/villages?taluka=Baramati returns Baramati Census villages."""
    response = client.get("/api/v1/geography/villages?taluka=Baramati")
    assert response.status_code == 200
    villages = response.json()
    assert len(villages) > 0
    village_names = [v["name"] for v in villages]
    assert "Malegaon Bk" in village_names
    assert "Katewadi" in village_names
    assert "Dorlewadi" in village_names


def test_api_get_villages_by_daund():
    """Verify GET /api/v1/geography/villages?taluka=Daund returns Daund Census villages."""
    response = client.get("/api/v1/geography/villages?taluka=Daund")
    assert response.status_code == 200
    villages = response.json()
    village_names = [v["name"] for v in villages]
    assert "Kurkumbh" in village_names
    assert "Kedgaon" in village_names
    assert "Patas" in village_names


def test_api_field_lookup_success():
    """Verify field lookup with valid Maharashtra -> Pune -> Baramati -> Malegaon Bk -> 123."""
    response = client.get("/api/v1/fields/by-gat?taluka=Baramati&village=Malegaon%20Bk&gat_no=123")
    assert response.status_code == 200
    data = response.json()
    assert data["gat_no"] == "123"
    assert data["village"]["name"] == "Malegaon Bk"
    assert data["village"]["taluka_name"] == "Baramati"
    assert data["village"]["district_name"] == "Pune"
    assert data["geometry_wkt"] is not None
    assert "MULTIPOLYGON" in data["geometry_wkt"]


def test_api_field_hierarchy_mismatch_rejected():
    """Verify that pairing a village with the WRONG taluka is rejected with HTTP 400."""
    response = client.get("/api/v1/fields/by-gat?taluka=Daund&village=Malegaon%20Bk&gat_no=123")
    assert response.status_code == 400
    data = response.json()
    assert "Hierarchy mismatch" in data["detail"]
    assert "Malegaon Bk" in data["detail"]
    assert "Daund" in data["detail"]


def test_api_field_nonexistent_gat():
    """Verify 404 is returned when Gat number does not exist in the village."""
    response = client.get("/api/v1/fields/by-gat?taluka=Baramati&village=Malegaon%20Bk&gat_no=NON_EXISTENT_999")
    assert response.status_code == 404
