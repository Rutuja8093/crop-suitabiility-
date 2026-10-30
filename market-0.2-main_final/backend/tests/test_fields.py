import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.geography import State, District, Taluka, Village

client = TestClient(app)


def get_auth_token_for_gat(gat_no: str = "22"):
    """Helper to authenticate and return a valid session token."""
    db = SessionLocal()
    try:
        state = db.query(State).filter(State.name == "Maharashtra").first()
        district = db.query(District).filter(District.name == "Pune", District.state_id == state.id).first()
        taluka_baramati = db.query(Taluka).filter(Taluka.name == "Baramati", Taluka.district_id == district.id).first()
        village = db.query(Village).filter(Village.name.like("Malegaon Kh%"), Village.taluka_id == taluka_baramati.id).first()
        if not village:
            village = db.query(Village).filter(Village.name.like("Malegaon%"), Village.taluka_id == taluka_baramati.id).first()
        payload = {
            "state_id": state.id,
            "district_id": district.id,
            "taluka_id": taluka_baramati.id,
            "village_id": village.id,
            "gat_no": gat_no,
        }
        res = client.post("/api/v1/auth/gat-login", json=payload)
        assert res.status_code == 200, f"Login failed: {res.text}"
        return res.json()["token"]
    finally:
        db.close()


def test_get_authenticated_field_unauthorized():
    """Verify that accessing /api/v1/fields/me without token returns 401."""
    response = client.get("/api/v1/fields/me")
    assert response.status_code == 401
    assert "session" in response.json()["detail"].lower()


def test_get_authenticated_field_success():
    """Verify that authenticated farmer can fetch their field with GeoJSON geometry."""
    token = get_auth_token_for_gat("22")
    response = client.get(
        "/api/v1/fields/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()

    assert data["gat_no"] == "22"
    assert data["area"] > 0
    assert data["taluka"] == "Baramati"
    assert data["district"] == "Pune"
    assert data["state"] == "Maharashtra"
    assert data["geometry"] is not None
    assert data["geometry"]["type"] in ["Polygon", "MultiPolygon"]
    assert len(data["geometry"]["coordinates"]) > 0


def test_get_field_by_gat():
    """Verify lookup endpoint /api/v1/fields/by-gat."""
    response = client.get("/api/v1/fields/by-gat", params={"gat_no": "22", "village": "Malegaon Kh", "taluka": "Baramati"})
    assert response.status_code == 200
    data = response.json()
    assert data["gat_no"] == "22"
    assert data["area"] > 0


def test_get_field_by_kml_gat_12():
    """Verify lookup for KML plot 12 in Malegaon Kh."""
    response = client.get("/api/v1/fields/by-gat", params={"gat_no": "12", "village": "Malegaon Kh", "taluka": "Baramati"})
    assert response.status_code == 200
    data = response.json()
    assert data["gat_no"] == "12"
    assert data["area"] in [0.38, 16.2]


def test_get_field_by_gat_normalized_string():
    """Verify Gat normalization handles whitespace and 'Gat' prefixes."""
    response = client.get("/api/v1/fields/by-gat", params={"gat_no": "  Gat 22  ", "village": "Malegaon Kh", "taluka": "Baramati"})
    assert response.status_code == 200
    data = response.json()
    assert data["gat_no"] == "22"


def test_get_field_by_gat_not_found():
    """Verify non-existent Gat returns 404."""
    response = client.get("/api/v1/fields/by-gat", params={"gat_no": "99999", "village": "Malegaon Kh", "taluka": "Baramati"})
    assert response.status_code == 404
    assert "No farm plot was found" in response.json()["detail"]


def test_get_field_wrong_village():
    """Verify Gat in wrong village returns 404."""
    response = client.get("/api/v1/fields/by-gat", params={"gat_no": "22", "village": "Katewadi", "taluka": "Baramati"})
    assert response.status_code == 404


def test_kml_gat_rejected_for_malegaon_bk():
    """Verify KML plot 12 cannot be accessed under Malegaon Bk."""
    response = client.get("/api/v1/fields/by-gat", params={"gat_no": "12", "village": "Malegaon Bk", "taluka": "Baramati"})
    assert response.status_code == 404


def test_get_village_geojson():
    """Verify /api/v1/fields/geojson returns normalized GeoJSON FeatureCollection."""
    response = client.get("/api/v1/fields/geojson", params={"village": "Malegaon", "taluka": "Baramati"})
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) >= 11
    # Check property normalization
    first_feat = data["features"][0]
    assert "gat_no" in first_feat["properties"]
    assert "village" in first_feat["properties"]
    assert first_feat["geometry"]["type"] in ["Polygon", "MultiPolygon"]

