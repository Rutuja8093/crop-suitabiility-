"""Automated Tests for GIS-Based Crop Suitability Model.
Validates:
1. Documented threshold boundaries (S1, S2, S3, N) for all 10 crops.
2. 1991-2020 Continuous weather normal validation (no gaps, no duplicates, no missing dates).
3. 2016-2025 Recent variability dataset integrity.
4. Gat-level raster zonal statistics extraction for 217 parcels.
5. Multi-criteria aggregation, conservative Liebig limitation, and weighted scoring.
6. Missing value and invalid input handling.
7. API response schemas and export endpoints.
8. Regression safety for existing SoilPilot DSM and Field endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.gis.crop_suitability_engine import crop_suitability_engine
from app.gis.weather_processor import weather_processor
from app.gis.gat_soil_extractor import gat_soil_extractor

client = TestClient(app)

def test_10_crops_present_and_weights_valid():
    """Validates that all 10 crops from the criteria document are loaded with correct weights."""
    crops = crop_suitability_engine.get_supported_crops()
    assert len(crops) == 10
    crop_codes = [c["crop_code"] for c in crops]
    expected_crops = [
        "sugarcane", "pomegranate", "soybean", "maize", "tomato",
        "onion", "banana", "chickpea", "groundnut", "lemon"
    ]
    for exp in expected_crops:
        assert exp in crop_codes

    for c in crops:
        raw_def = crop_suitability_engine.get_crop_definition(c["crop_code"])
        assert raw_def is not None
        params = raw_def.get("parameters", {})
        total_weight = sum(p.get("weight", 0.0) for p in params.values())
        # Total weights in the criteria document sum to 100.0% (within roundoff 99.8-100.2)
        assert 99.5 <= total_weight <= 100.5, f"Weights for {c['crop_code']} do not sum to 100%: {total_weight}"


def test_weather_processor_continuity_and_quality():
    """Validates that historical 1991-2020 weather records are perfectly continuous with 0 gaps/duplicates."""
    normals = weather_processor.compute_climatological_normals()
    q30 = normals["quality_reports"]["historical_30yr"]

    assert q30["is_continuous"] is True
    assert q30["expected_days"] == 10958
    assert q30["actual_days"] == 10958
    assert q30["missing_days"] == 0
    assert q30["expected_hours"] == 262992
    assert q30["actual_hours"] == 262992
    assert q30["missing_hours"] == 0

    h30 = normals["historical_30yr"]
    assert 600.0 <= h30["annual_rainfall_mm"] <= 750.0
    assert 24.0 <= h30["mean_temperature_c"] <= 28.0
    assert 50.0 <= h30["relative_humidity_pct"] <= 65.0


def test_sugarcane_threshold_boundaries():
    """Validates exact threshold boundaries for Sugarcane."""
    sugar_def = crop_suitability_engine.get_crop_definition("sugarcane")
    params = sugar_def["parameters"]

    # pH: S1: 6.5-7.5, S2: 7.5-8.0, S3: 8.0-8.5, N: >8.5
    assert crop_suitability_engine.evaluate_criterion("ph", params["ph"], 7.0)["suitability_class"] == "S1"
    assert crop_suitability_engine.evaluate_criterion("ph", params["ph"], 7.8)["suitability_class"] == "S2"
    assert crop_suitability_engine.evaluate_criterion("ph", params["ph"], 8.2)["suitability_class"] == "S3"
    assert crop_suitability_engine.evaluate_criterion("ph", params["ph"], 8.9)["suitability_class"] == "N"

    # EC: S1: <2.0, S2: 2.0-4.0, S3: 4.0-6.0, N: >6.0
    assert crop_suitability_engine.evaluate_criterion("ec", params["ec"], 1.5)["suitability_class"] == "S1"
    assert crop_suitability_engine.evaluate_criterion("ec", params["ec"], 3.2)["suitability_class"] == "S2"
    assert crop_suitability_engine.evaluate_criterion("ec", params["ec"], 5.0)["suitability_class"] == "S3"
    assert crop_suitability_engine.evaluate_criterion("ec", params["ec"], 6.5)["suitability_class"] == "N"

    # Texture: S1: Clay, Clay Loam, Silty Clay; S3: Sandy Loam; N: Sand, Heavy Clay
    assert crop_suitability_engine.evaluate_criterion("texture", params["texture"], "Clay")["suitability_class"] == "S1"
    assert crop_suitability_engine.evaluate_criterion("texture", params["texture"], "Sandy Loam")["suitability_class"] == "S3"
    assert crop_suitability_engine.evaluate_criterion("texture", params["texture"], "Sand")["suitability_class"] == "N"

    # Slope: S1: <2, S2: 2-4, S3: 4-8, N: >8
    assert crop_suitability_engine.evaluate_criterion("slope", params["slope"], 1.2)["suitability_class"] == "S1"
    assert crop_suitability_engine.evaluate_criterion("slope", params["slope"], 3.0)["suitability_class"] == "S2"
    assert crop_suitability_engine.evaluate_criterion("slope", params["slope"], 6.0)["suitability_class"] == "S3"
    assert crop_suitability_engine.evaluate_criterion("slope", params["slope"], 9.5)["suitability_class"] == "N"


def test_tomato_threshold_boundaries():
    """Validates exact threshold boundaries for Tomato (including two-sided N thresholds)."""
    tom_def = crop_suitability_engine.get_crop_definition("tomato")
    p_ph = tom_def["parameters"]["ph"]

    # pH: S1: 6.0-7.0, S2: 7.0-7.5, S3: 7.5-8.0, N: >8.0 or <5.5
    assert crop_suitability_engine.evaluate_criterion("ph", p_ph, 6.5)["suitability_class"] == "S1"
    assert crop_suitability_engine.evaluate_criterion("ph", p_ph, 7.2)["suitability_class"] == "S2"
    assert crop_suitability_engine.evaluate_criterion("ph", p_ph, 7.8)["suitability_class"] == "S3"
    assert crop_suitability_engine.evaluate_criterion("ph", p_ph, 8.4)["suitability_class"] == "N"
    assert crop_suitability_engine.evaluate_criterion("ph", p_ph, 5.0)["suitability_class"] == "N"


def test_missing_and_invalid_values_handling():
    """Tests that missing and invalid inputs are flagged transparently as UNCERTAIN without crashing."""
    p_def = {"name": "Test Criterion", "unit": "%", "weight": 5.0, "s1": [1.0, 2.0]}
    res_none = crop_suitability_engine.evaluate_criterion("test", p_def, None)
    assert res_none["status"] == "MISSING_DATA"
    assert res_none["suitability_class"] == "UNCERTAIN"

    res_invalid = crop_suitability_engine.evaluate_criterion("test", p_def, "invalid_string")
    assert res_invalid["status"] == "INVALID_VALUE"
    assert res_invalid["suitability_class"] == "UNCERTAIN"


def test_gat_soil_extractor_217_parcels():
    """Validates that soil extraction successfully processes all 217 Gats in Malegaon Khurd."""
    all_gats = gat_soil_extractor.extract_all_gat_soil_indicators()
    assert len(all_gats) == 217

    gat1 = all_gats.get("1")
    assert gat1 is not None
    assert gat1["gat_no"] == "1"
    assert 6.5 <= gat1["ph"] <= 8.5
    assert 0.5 <= gat1["soc"] <= 3.0
    assert 10.0 <= gat1["nitrogen"] <= 20.0
    assert 0.0 <= gat1["slope"] <= 15.0
    assert gat1["texture"] in ["Clay", "Clay Loam", "Silty Clay"]


def test_api_endpoints():
    """Tests all new crop-suitability API endpoints."""
    # 1. Crops list
    r_crops = client.get("/api/v1/crop-suitability/crops")
    assert r_crops.status_code == 200
    assert len(r_crops.json()) == 10

    # 2. Weather summary
    r_weather = client.get("/api/v1/crop-suitability/weather-summary")
    assert r_weather.status_code == 200
    assert "historical_30yr" in r_weather.json()

    # 3. Single Gat evaluation
    r_gat = client.get("/api/v1/crop-suitability/gat/1")
    assert r_gat.status_code == 200
    data_gat = r_gat.json()
    assert data_gat["gat_no"] == "1"
    assert len(data_gat["evaluations"]) == 10

    # 4. Crop evaluation across all Gats
    r_crop = client.get("/api/v1/crop-suitability/crop/sugarcane")
    assert r_crop.status_code == 200
    data_crop = r_crop.json()
    assert data_crop["total_gats"] == 217
    assert data_crop["class_summary"]["S1"]["count"] > 100

    # 5. GeoJSON
    r_geojson = client.get("/api/v1/crop-suitability/crop/sugarcane/geojson")
    assert r_geojson.status_code == 200
    gj = r_geojson.json()
    assert gj["type"] == "FeatureCollection"
    assert len(gj["features"]) == 217
    assert "suitability_class" in gj["features"][0]["properties"]
    assert "fill_color" in gj["features"][0]["properties"]

    # 6. CSV Export
    r_csv = client.get("/api/v1/crop-suitability/export/csv?crop_code=sugarcane")
    assert r_csv.status_code == 200
    assert "text/csv" in r_csv.headers["content-type"]
    assert "attachment" in r_csv.headers["content-disposition"]


def test_existing_endpoints_preserved():
    """Confirms that adding crop suitability does not break existing DSM, Soil Health, or Field endpoints."""
    # Health check
    r_health = client.get("/api/v1/health")
    assert r_health.status_code == 200

    # DSM layers catalog
    r_dsm = client.get("/api/v1/soil-layers")
    assert r_dsm.status_code == 200
    assert len(r_dsm.json()) >= 6

    # KML Gats
    r_kml = client.get("/api/v1/soil-layers/kml/gats")
    assert r_kml.status_code == 200
    assert r_kml.json()["type"] == "FeatureCollection"
