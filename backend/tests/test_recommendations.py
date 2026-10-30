"""Unit and integration tests for Soil Recommendations Engine and API endpoints.
SoilPilot Phase 8
"""
from fastapi.testclient import TestClient
from app.main import app
from app.services.recommendation_engine import evaluate_parameter_recommendation

client = TestClient(app)


def test_recommendation_engine_ph_rules():
    """Verify deterministic recommendation logic for soil pH levels."""
    # Alkaline Vertisol (pH 8.38 - typical Malegaon / Baramati soil)
    rec_alkaline = evaluate_parameter_recommendation(
        key="ph",
        name="Soil pH",
        name_mr="मातीचा सामू (pH)",
        category="Primary",
        value=8.38,
        unit="",
        interpretation_en="Moderately Alkaline",
        interpretation_mr="मध्यम विम्ल",
    )
    assert rec_alkaline is not None
    assert rec_alkaline["priority_key"] == "moderate"
    assert rec_alkaline["needs_attention"] is True
    assert "manures" in rec_alkaline["action_guidance"].lower() or "fertilizers" in rec_alkaline["action_guidance"].lower()
    assert "खते" in rec_alkaline["action_guidance_mr"]

    # Strongly Acidic soil (pH < 5.0, e.g. 4.8)
    rec_acidic = evaluate_parameter_recommendation(
        key="ph",
        name="Soil pH",
        name_mr="मातीचा सामू (pH)",
        category="Primary",
        value=4.8,
        unit="",
        interpretation_en="Strongly Acidic",
        interpretation_mr="तीव्र आम्लधर्मी",
    )
    assert rec_acidic is not None
    assert rec_acidic["priority_key"] == "high"
    assert "lime" in rec_acidic["action_guidance"].lower()
    assert "चुना" in rec_acidic["action_guidance_mr"]

    # Neutral soil (pH 7.1)
    rec_neutral = evaluate_parameter_recommendation(
        key="ph",
        name="Soil pH",
        name_mr="मातीचा सामू (pH)",
        category="Primary",
        value=7.1,
        unit="",
        interpretation_en="Neutral",
        interpretation_mr="उदासीन",
    )
    assert rec_neutral is not None
    assert rec_neutral["priority_key"] == "info"
    assert rec_neutral["needs_attention"] is False


def test_recommendation_engine_oc_rules():
    """Verify organic carbon enhancement rules."""
    # Low Organic Carbon (0.35%)
    rec_low = evaluate_parameter_recommendation(
        key="organic_carbon",
        name="Organic Carbon",
        name_mr="सेंद्रिय कर्ब",
        category="Primary",
        value=0.35,
        unit="%",
        interpretation_en="Low",
        interpretation_mr="कमी",
    )
    assert rec_low is not None
    assert rec_low["priority_key"] in ["high", "moderate"]
    assert rec_low["needs_attention"] is True

    # High Organic Carbon (1.02%)
    rec_high = evaluate_parameter_recommendation(
        key="organic_carbon",
        name="Organic Carbon",
        name_mr="सेंद्रिय कर्ब",
        category="Primary",
        value=1.02,
        unit="%",
        interpretation_en="High",
        interpretation_mr="जास्त",
    )
    assert rec_high is not None
    assert rec_high["priority_key"] == "info"
    assert rec_high["needs_attention"] is False


def test_recommendation_engine_nitrogen_rules():
    """Verify nitrogen deficiency vs adequacy logic."""
    rec_low_n = evaluate_parameter_recommendation(
        key="available_nitrogen",
        name="Available Nitrogen",
        name_mr="उपलब्ध नत्र (N)",
        category="Primary",
        value=163.0,
        unit="kg/ha",
        interpretation_en="Low",
        interpretation_mr="कमी",
    )
    assert rec_low_n is not None
    assert rec_low_n["priority_key"] == "high"
    assert rec_low_n["needs_attention"] is True
    assert "nitrogen" in rec_low_n["action_guidance"].lower() or "urea" in rec_low_n["action_guidance"].lower()


def test_generic_evaluate_parameter_recommendation():
    """Verify general parameter dispatcher handles micronutrients."""
    rec = evaluate_parameter_recommendation(
        key="zinc",
        name="Zinc (Zn)",
        name_mr="जस्त (झिंक)",
        category="Micronutrient",
        value=0.45,
        unit="ppm",
        interpretation_en="Deficient",
        interpretation_mr="कमतरता",
        source="LAB OBSERVATION",
    )
    assert rec is not None
    assert rec["parameter_key"] == "zinc"
    assert rec["priority_key"] in ["high", "moderate"]
    assert rec["needs_attention"] is True


def test_get_recommendations_demo_field():
    """Integration test for GET /api/v1/recommendations/field/demo-field-gat-104."""
    response = client.get("/api/v1/recommendations/field/demo-field-gat-104")
    assert response.status_code == 200
    data = response.json()

    assert data["has_data"] is True
    assert data["field"]["gat_no"] == "104"
    assert data["field"]["village"] == "Malegaon Bk"

    summary = data["summary"]
    assert summary["parameters_reviewed"] >= 5
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

    # Soil overview check (pH, OC, N, P, K)
    overview = data["soil_overview"]
    assert len(overview) == 5
    keys = [item["key"] for item in overview]
    assert "ph" in keys
    assert "organic_carbon" in keys
    assert "available_nitrogen" in keys


def test_get_recommendations_alias_endpoint():
    """Verify alias endpoint /api/v1/recommendations/{field_id} works identically."""
    response = client.get("/api/v1/recommendations/demo-field-gat-104")
    assert response.status_code == 200
    data = response.json()
    assert data["has_data"] is True
    assert len(data["recommendations"]) > 0


def test_get_recommendations_empty_field():
    """Verify unseeded field returns gracefully structured response with empty recs."""
    response = client.get("/api/v1/recommendations/field/unseeded-field-999")
    assert response.status_code == 200
    data = response.json()
    assert data["has_data"] is False
    assert len(data["recommendations"]) == 0
    assert "message_en" in data
    assert "message_mr" in data
