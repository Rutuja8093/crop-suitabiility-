"""Unit and integration tests for Soil Health endpoints and interpretation."""
from fastapi.testclient import TestClient
from app.main import app
from app.services.soil_interpretation import interpret_parameter, SOIL_THRESHOLDS

client = TestClient(app)

def test_soil_interpretation_rules():
    # Test pH
    en, mr, ref = interpret_parameter("ph", 8.38)
    assert "Alkaline" in en
    assert "6.5 – 7.5" in ref or "6.5" in ref

    # Test Organic Carbon
    en, mr, ref = interpret_parameter("organic_carbon", 1.02)
    assert "High" in en
    assert "0.50" in ref and "0.75%" in ref

    # Test Nitrogen
    en, mr, ref = interpret_parameter("available_nitrogen", 163.0)
    assert "Low" in en

    # Test Missing/None
    en, mr, ref = interpret_parameter("zinc", None)
    assert en == "Not Available"

def test_get_soil_health_demo_field():
    response = client.get("/api/v1/soil-health/field/demo-field-gat-104")
    assert response.status_code == 200
    data = response.json()
    
    assert data["farmer"]["name"] in ["Pradip Bhauso Shelar", "Ramesh Patil (रमेश पाटील)", "Ramesh Patil"] or len(data["farmer"]["name"]) > 0
    assert data["field"]["gat_no"] == "104"
    assert data["field"]["village"] == "Malegaon Bk"
    assert data["field"]["taluka"] == "Baramati"
    assert data["field"]["district"] == "Pune"
    assert data["is_demo"] is True
    
    # Check parameters
    params = data["parameters"]
    assert len(params) >= 14
    
    ph_param = next(p for p in params if p["key"] == "ph")
    assert ph_param["value"] > 6.0
    assert ph_param["unit"] in ["pH", "—", "", None]
    assert ph_param["source"] in ["DSM PREDICTION", "LAB OBSERVATION"]
    
    ec_param = next(p for p in params if p["key"] == "ec")
    assert ec_param["value"] == 0.10
    assert ec_param["unit"] == "dS/m"
    assert "Normal" in ec_param["interpretation"] or "Non-saline" in ec_param["interpretation"]

def test_get_soil_health_summary_demo_field():
    response = client.get("/api/v1/soil-health/field/demo-field-gat-104/summary")
    assert response.status_code == 200
    data = response.json()
    
    assert data["field_id"] == "demo-field-gat-104"
    assert data["has_report"] is True
    assert data["is_demo"] is True
    assert data["primary_parameters"]["ph"]["value"] > 6.0
    assert data["primary_parameters"]["organic_carbon"]["value"] > 0

def test_get_soil_health_unseeded_field():
    # A real or non-demo UUID should return clean structure without fake data
    response = client.get("/api/v1/soil-health/field/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 200
    data = response.json()
    assert data["has_report"] is False
    assert data["report"] is None
    assert len(data["parameters"]) == 0
