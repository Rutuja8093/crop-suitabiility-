import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.gat_farmer import GatFarmer
from app.models.geography import Village

client = TestClient(app)


def test_get_farmers_by_gat_known_gat_124():
    """Verify Gat 124 returns all 140 imported records with exact Marathi names."""
    response = client.get("/api/v1/farmers/by-gat", params={"village": "Malegaon Khurd", "gat_no": "124"})
    assert response.status_code == 200
    data = response.json()
    assert data["village"] == "Malegaon Khurd"
    assert data["gat_no"] == "124"
    assert data["total"] == 140
    assert len(data["farmers"]) == 140
    # Verify Marathi text of first record
    first_farmer = data["farmers"][0]
    assert first_farmer["name"] == "दत्तात्रय दिनकर देवकाते"
    assert first_farmer["source_row"] == 1613


def test_get_farmers_by_gat_known_gat_1():
    """Verify Gat 1 returns all 24 records."""
    response = client.get("/api/v1/farmers/by-gat", params={"village": "Malegaon Khurd", "gat_no": "1"})
    assert response.status_code == 200
    data = response.json()
    assert data["gat_no"] == "1"
    assert data["total"] == 24
    assert len(data["farmers"]) == 24
    assert data["farmers"][0]["name"] == "प्रदीप तात्याबा लडकत"
    assert data["farmers"][1]["name"] == "संदीप तात्याबा लडकत"
    assert data["farmers"][2]["name"] == "कमल बाळासाहेब साबळे"


def test_gat_number_normalization():
    """Verify Gat number prefix variations resolve to the same normalized Gat."""
    r1 = client.get("/api/v1/farmers/by-gat", params={"village": "Malegaon Khurd", "gat_no": "Gat 124"})
    r2 = client.get("/api/v1/farmers/by-gat", params={"village": "Malegaon Khurd", "gat_no": " 124 "})
    r3 = client.get("/api/v1/farmers/by-gat", params={"village": "Malegaon Khurd", "gat_no": "गट क्र. 124"})

    assert r1.status_code == 200 and r1.json()["total"] == 140
    assert r2.status_code == 200 and r2.json()["total"] == 140
    assert r3.status_code == 200 and r3.json()["total"] == 140


def test_village_alias_handling():
    """Verify both 'Malegaon Khurd', 'Malegaon Kh', and village_id=87 resolve correctly."""
    r_name = client.get("/api/v1/farmers/by-gat", params={"village": "Malegaon Kh", "gat_no": "1"})
    r_id = client.get("/api/v1/farmers/by-gat", params={"village_id": 87, "gat_no": "1"})

    assert r_name.status_code == 200
    assert r_id.status_code == 200
    assert r_name.json()["total"] == 24
    assert r_id.json()["total"] == 24


def test_empty_results_handling():
    """Verify that a Gat without records returns 200 with total 0 and clear message."""
    response = client.get("/api/v1/farmers/by-gat", params={"village": "Malegaon Khurd", "gat_no": "99999"})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["farmers"] == []
    assert "No farmer names found" in data["message"]


def test_village_isolation():
    """Verify Gat records for Malegaon Khurd are not returned when querying another village."""
    # Village 86 is Malegaon Bk
    response = client.get("/api/v1/farmers/by-gat", params={"village_id": 86, "gat_no": "124"})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert len(data["farmers"]) == 0


def test_get_available_gats():
    """Verify /api/v1/farmers/gats returns all 222 Gats totaling 2,365 records."""
    response = client.get("/api/v1/farmers/gats", params={"village": "Malegaon Khurd"})
    assert response.status_code == 200
    data = response.json()
    assert data["total_gats"] == 222
    assert data["total_farmers"] == 2365
    assert len(data["gats"]) == 222

    # Verify Gat 124 is present with 140 count
    g124 = next(g for g in data["gats"] if g["gat_no"] == "124")
    assert g124["farmer_count"] == 140


def test_empty_gat_validation_error():
    """Verify empty Gat number returns 400 Bad Request."""
    response = client.get("/api/v1/farmers/by-gat", params={"village": "Malegaon Khurd", "gat_no": "   "})
    assert response.status_code == 400
    assert "cannot be empty" in response.json()["detail"]
