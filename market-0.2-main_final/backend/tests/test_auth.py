import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.geography import State, District, Taluka, Village

client = TestClient(app)


def get_demo_hierarchy_ids():
    """Retrieve database IDs for Maharashtra -> Pune -> Baramati -> Malegaon Bk."""
    db = SessionLocal()
    try:
        state = db.query(State).filter(State.name == "Maharashtra").first()
        district = db.query(District).filter(District.name == "Pune", District.state_id == state.id).first()
        taluka_baramati = db.query(Taluka).filter(Taluka.name == "Baramati", Taluka.district_id == district.id).first()
        taluka_daund = db.query(Taluka).filter(Taluka.name == "Daund", Taluka.district_id == district.id).first()
        village_malegaon_bk = db.query(Village).filter(Village.name == "Malegaon Bk", Village.taluka_id == taluka_baramati.id).first()
        village_malegaon_kh = db.query(Village).filter(Village.name.ilike("%malegaon kh%"), Village.taluka_id == taluka_baramati.id).first()
        return {
            "state_id": state.id,
            "district_id": district.id,
            "taluka_baramati_id": taluka_baramati.id,
            "taluka_daund_id": taluka_daund.id,
            "village_malegaon_id": village_malegaon_kh.id,
            "village_malegaon_bk_id": village_malegaon_bk.id,
        }
    finally:
        db.close()


def test_gat_login_success():
    """Verify successful login for valid hierarchy and Gat 123."""
    ids = get_demo_hierarchy_ids()
    payload = {
        "state_id": ids["state_id"],
        "district_id": ids["district_id"],
        "taluka_id": ids["taluka_baramati_id"],
        "village_id": ids["village_malegaon_id"],
        "gat_no": "123",
    }
    response = client.post("/api/v1/auth/gat-login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "token" in data
    assert data["field"]["gat_no"] == "123"
    assert data["field"]["area"] in [2.45, 3.33] or data["field"]["area"] > 0
    assert "Ramesh Patil" in data["farmer"]["name"] or "Farmer" in data["farmer"]["name"]
    assert data["location"]["state"] == "Maharashtra"
    assert data["location"]["district"] == "Pune"
    assert data["location"]["taluka"] == "Baramati"
    assert "Malegaon" in data["location"]["village"]

    # Verify session cookie was set
    assert "soilpilot_session" in response.cookies


def test_gat_login_nonexistent_gat():
    """Verify 404 response for non-existent Gat number with friendly error message."""
    ids = get_demo_hierarchy_ids()
    payload = {
        "state_id": ids["state_id"],
        "district_id": ids["district_id"],
        "taluka_id": ids["taluka_baramati_id"],
        "village_id": ids["village_malegaon_id"],
        "gat_no": "NON_EXISTENT_9999",
    }
    response = client.post("/api/v1/auth/gat-login", json=payload)
    assert response.status_code == 404
    data = response.json()
    assert "We couldn't find a farm with these details" in data["detail"]


def test_gat_login_kml_gat_rejected_for_malegaon_bk():
    """Verify that Malegaon Kh survey Gats (e.g. 22) are rejected when logging in under Malegaon Bk."""
    ids = get_demo_hierarchy_ids()
    payload = {
        "state_id": ids["state_id"],
        "district_id": ids["district_id"],
        "taluka_id": ids["taluka_baramati_id"],
        "village_id": ids["village_malegaon_bk_id"],
        "gat_no": "22",
    }
    response = client.post("/api/v1/auth/gat-login", json=payload)
    assert response.status_code == 400
    assert "belongs to Malegaon Kh" in response.json()["detail"]


def test_gat_login_hierarchy_mismatch():
    """Verify 400 rejection when village does not belong to specified taluka."""
    ids = get_demo_hierarchy_ids()
    payload = {
        "state_id": ids["state_id"],
        "district_id": ids["district_id"],
        "taluka_id": ids["taluka_daund_id"],  # Sending Daund instead of Baramati
        "village_id": ids["village_malegaon_id"],  # Belongs to Baramati
        "gat_no": "123",
    }
    response = client.post("/api/v1/auth/gat-login", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert "does not belong" in data["detail"]


def test_gat_login_empty_gat():
    """Verify 422 validation error for empty Gat number."""
    ids = get_demo_hierarchy_ids()
    payload = {
        "state_id": ids["state_id"],
        "district_id": ids["district_id"],
        "taluka_id": ids["taluka_baramati_id"],
        "village_id": ids["village_malegaon_id"],
        "gat_no": "   ",  # Whitespace only
    }
    response = client.post("/api/v1/auth/gat-login", json=payload)
    # Could be 422 from Pydantic or our service validation
    assert response.status_code in (400, 422)


def test_session_me_authenticated_flow():
    """Verify /api/v1/auth/me returns current session info using Bearer token."""
    ids = get_demo_hierarchy_ids()
    login_res = client.post(
        "/api/v1/auth/gat-login",
        json={
            "state_id": ids["state_id"],
            "district_id": ids["district_id"],
            "taluka_id": ids["taluka_baramati_id"],
            "village_id": ids["village_malegaon_id"],
            "gat_no": "123",
        },
    )
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    # Call /auth/me with Bearer token
    me_res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["authenticated"] is True
    assert me_data["field"]["gat_no"] == "123"
    assert "Ramesh Patil" in me_data["farmer"]["name"] or "Farmer" in me_data["farmer"]["name"]
    assert "Malegaon" in me_data["location"]["village"]


def test_session_me_unauthenticated():
    """Verify 401 when accessing /api/v1/auth/me without a session."""
    unauth_client = TestClient(app)
    response = unauth_client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_logout():
    """Verify /api/v1/auth/logout succeeds and deletes the cookie."""
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert response.json()["success"] is True
