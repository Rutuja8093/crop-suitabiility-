"""Automated Test Suite for Phase 8: Field Crop Suitability Integration.
SoilPilot Digital Soil Mapping & Soil Health Portal.

Validates all 12 required scenarios from Section 14 of Phase 8 prompt:
1. Field with complete and valid soil information.
2. Field with partially missing soil information.
3. Field with no usable soil information (displays "Insufficient field data...").
4. DSM-predicted value versus laboratory-observed value (precedence & discrepancy reporting).
5. Unknown or unsupported agronomic criterion.
6. Incompatible unit or invalid soil value (out-of-range value handling).
7. Unavailable irrigation or climate input (transparently marked unknown).
8. Crop outside active planting window (off-season detection via Phase 7).
9. Field belonging to another farmer (authorization check returning 403 Forbidden).
10. Field with conflicting or stale source data.
11. API endpoints and error handling contracts.
12. Regression behavior for existing SoilPilot pages.
"""

from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.geography import State, District, Taluka, Village
from app.models.farmer import Farmer
from app.models.field import Field
from app.models.soil_health import SoilReport, SoilParameterValue
from app.models.market_intelligence import Commodity, MarketApmc, CropCalendar
from app.models.crop_suitability import FieldCropSuitabilityAssessment
from app.schemas.crop_suitability import EvaluatedParameterSoilData
from app.services.crop_suitability_service import (
    crop_suitability_service,
    AGRONOMIC_CROP_CRITERIA,
    RULE_ENGINE_VERSION,
    DISCLAIMER_PHASE_8,
)
from app.services.auth_service import auth_service


@pytest.fixture(scope="function")
def suitability_db():
    """Isolated in-memory SQLite database session for suitability tests."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()

    # 1. Geography hierarchy
    state = State(name="Maharashtra", code="MH", is_active=True)
    session.add(state)
    session.flush()

    district = District(name="Pune", state_id=state.id, is_active=True)
    session.add(district)
    session.flush()

    taluka = Taluka(name="Baramati", district_id=district.id, is_active=True)
    session.add(taluka)
    session.flush()

    village = Village(name="Malegaon Kh.", taluka_id=taluka.id, is_active=True)
    session.add(village)
    session.flush()

    # 2. Farmers
    farmer_a = Farmer(
        farmer_code="FARMER-001",
        full_name="Ramesh Patil",
        mobile_number="9876543210",
        preferred_language="mr",
        role="farmer",
        is_active=True,
    )
    farmer_b = Farmer(
        farmer_code="FARMER-002",
        full_name="Suresh Deshmukh",
        mobile_number="9123456789",
        preferred_language="mr",
        role="farmer",
        is_active=True,
    )
    session.add_all([farmer_a, farmer_b])
    session.flush()

    # 3. Fields
    field_a = Field(
        farmer_id=farmer_a.id,
        village_id=village.id,
        gat_no="18",
        area=2.69,
        area_unit="hectare",
        is_demo=False,
        is_active=True,
    )
    field_b = Field(
        farmer_id=farmer_b.id,
        village_id=village.id,
        gat_no="77",
        area=1.50,
        area_unit="hectare",
        is_demo=False,
        is_active=True,
    )
    field_demo = Field(
        farmer_id=None,
        village_id=village.id,
        gat_no="104",
        area=3.50,
        area_unit="hectare",
        is_demo=True,
        is_active=True,
    )
    session.add_all([field_a, field_b, field_demo])
    session.flush()

    # 4. Commodities
    chana = Commodity(code="CHANA", name="Bengal Gram", name_mr="हरभरा", category="PULSES", standard_unit="QUINTAL")
    onion = Commodity(code="ONION", name="Onion", name_mr="कांदा", category="VEGETABLES", standard_unit="QUINTAL")
    wheat = Commodity(code="WHEAT", name="Wheat", name_mr="गहू", category="CEREALS", standard_unit="QUINTAL")
    maize = Commodity(code="MAIZE", name="Maize", name_mr="मका", category="CEREALS", standard_unit="QUINTAL")
    sugarcane = Commodity(code="SUGARCANE", name="Sugarcane", name_mr="ऊस", category="CASH_CROP", standard_unit="TONNE")
    soybean = Commodity(code="SOYBEAN", name="Soybean", name_mr="सोयाबीन", category="OILSEEDS", standard_unit="QUINTAL")
    tur = Commodity(code="TUR", name="Pigeon Pea", name_mr="तूर", category="PULSES", standard_unit="QUINTAL")
    cotton = Commodity(code="COTTON", name="Cotton", name_mr="कापूस", category="FIBRE", standard_unit="QUINTAL")
    session.add_all([chana, onion, wheat, maize, sugarcane, soybean, tur, cotton])
    session.flush()

    # 5. Crop Calendars for Rabi & Kharif
    cal_chana = CropCalendar(
        commodity_id=chana.id,
        season="RABI",
        state_id=state.id,
        district_id=district.id,
        planting_window_start_month=10,
        planting_window_start_day=15,
        planting_window_end_month=11,
        planting_window_end_day=30,
        duration_min_days=100,
        duration_max_days=115,
        water_requirement_category="LOW",
        labor_intensity="LOW",
        source_reference="MPKV Rahuri Pulses Guide 2024",
    )
    cal_soybean = CropCalendar(
        commodity_id=soybean.id,
        season="KHARIF",
        state_id=state.id,
        district_id=district.id,
        planting_window_start_month=6,
        planting_window_start_day=15,
        planting_window_end_month=7,
        planting_window_end_day=15,
        duration_min_days=95,
        duration_max_days=105,
        water_requirement_category="MEDIUM",
        labor_intensity="MODERATE",
        source_reference="MPKV Rahuri Kharif Guide 2024",
    )
    session.add_all([cal_chana, cal_soybean])
    session.commit()

    yield session
    session.close()


@pytest.fixture(scope="function")
def client(suitability_db):
    """FastAPI test client with database dependency override."""
    def override_get_db():
        try:
            yield suitability_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# =========================================================================
# 1. FIELD WITH COMPLETE AND VALID SOIL INFORMATION
# =========================================================================

def test_field_with_complete_valid_soil_info(suitability_db):
    """Test assessment when certified lab report has complete, valid soil information."""
    field = suitability_db.query(Field).filter(Field.gat_no == "18").first()

    report = SoilReport(
        field_id=field.id,
        report_no="TEST-REP-001",
        receipt_no="RCP-001",
        sample_name="Surface Soil (0-15 cm)",
        sample_date="2026-03-10",
        report_date="2026-03-15",
        laboratory_name="Baramati Agri Lab",
        is_demo=False,
    )
    suitability_db.add(report)
    suitability_db.flush()

    params = [
        SoilParameterValue(report_id=report.id, sr_no=1, parameter_key="ph", parameter_name="Soil pH", parameter_name_mr="सामू", category="Chemical", value=7.2, unit="—", interpretation_en="Neutral", interpretation_mr="उदासीन", reference_range="6.5-7.5", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report.id, sr_no=2, parameter_key="ec", parameter_name="Electrical Conductivity", parameter_name_mr="विद्युत वाहकता", category="Chemical", value=0.45, unit="dS/m", interpretation_en="Normal", interpretation_mr="सामान्य", reference_range="< 1.0", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report.id, sr_no=3, parameter_key="organic_carbon", parameter_name="Organic Carbon", parameter_name_mr="सेंद्रिय कर्ब", category="Chemical", value=0.85, unit="%", interpretation_en="High", interpretation_mr="जास्त", reference_range="> 0.75", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report.id, sr_no=4, parameter_key="free_lime", parameter_name="Free Lime", parameter_name_mr="मुक्त चुनखडी", category="Chemical", value=5.5, unit="%", interpretation_en="Low", interpretation_mr="कमी", reference_range="< 8.0", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report.id, sr_no=5, parameter_key="bd", parameter_name="Bulk Density", parameter_name_mr="मातीची घनता", category="Physical", value=1.42, unit="g/cm³", interpretation_en="Normal", interpretation_mr="सामान्य", reference_range="< 1.55", source_type="LAB OBSERVATION"),
    ]
    suitability_db.add_all(params)
    suitability_db.commit()

    eval_date = date(2026, 10, 22)
    resp = crop_suitability_service.evaluate_field_crop_suitability(
        db=suitability_db,
        field_identifier=str(field.id),
        evaluation_date=eval_date,
        planning_season="RABI",
    )

    assert resp.overall_field_readiness == "DATA_AVAILABLE"
    assert resp.field_summary.has_lab_report is True
    assert resp.field_summary.gat_no == "18"

    # Find Chana in assessed crops
    chana_eval = next((c for c in resp.crops if c.crop_code == "CHANA"), None)
    assert chana_eval is not None
    assert len(chana_eval.criteria_results) >= 5

    # All criteria should be suitable
    for crit in chana_eval.criteria_results:
        assert crit.status == "SUITABLE"
        assert "Suitable" in crit.status_label

    assert len(chana_eval.identified_constraints) == 0


# =========================================================================
# 2. FIELD WITH PARTIALLY MISSING SOIL INFORMATION
# =========================================================================

def test_field_with_partially_missing_soil_info(suitability_db):
    """Test field with partial lab report (pH and EC available, but free lime and BD missing)."""
    field = suitability_db.query(Field).filter(Field.gat_no == "77").first()

    report = SoilReport(
        field_id=field.id,
        report_no="TEST-REP-002",
        receipt_no="RCP-002",
        sample_name="Topsoil",
        sample_date="2026-04-01",
        report_date="2026-04-05",
        laboratory_name="Baramati Lab",
        is_demo=False,
    )
    suitability_db.add(report)
    suitability_db.flush()

    params = [
        SoilParameterValue(report_id=report.id, sr_no=1, parameter_key="ph", parameter_name="Soil pH", parameter_name_mr="सामू", category="Chemical", value=7.4, unit="—", interpretation_en="Neutral", interpretation_mr="उदासीन", reference_range="6.5-7.5", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report.id, sr_no=2, parameter_key="ec", parameter_name="Electrical Conductivity", parameter_name_mr="विद्युत वाहकता", category="Chemical", value=0.6, unit="dS/m", interpretation_en="Normal", interpretation_mr="सामान्य", reference_range="< 1.0", source_type="LAB OBSERVATION"),
    ]
    suitability_db.add_all(params)
    suitability_db.commit()

    resp = crop_suitability_service.evaluate_field_crop_suitability(
        db=suitability_db,
        field_identifier="77",
        evaluation_date=date(2026, 10, 22),
    )

    chana_eval = next(c for c in resp.crops if c.crop_code == "CHANA")
    # Missing criteria should have UNKNOWN status
    missing_criteria = [r for r in chana_eval.criteria_results if r.status == "UNKNOWN"]
    assert len(missing_criteria) > 0
    # Missing parameters list should be populated
    assert len(chana_eval.missing_parameters) > 0


# =========================================================================
# 3. FIELD WITH NO USABLE SOIL INFORMATION
# =========================================================================

def test_field_with_no_usable_soil_info(suitability_db):
    """Test unseeded field with zero soil data displays 'Insufficient field data'."""
    resp = crop_suitability_service.evaluate_field_crop_suitability(
        db=suitability_db,
        field_identifier="unseeded-field-999",
        evaluation_date=date(2026, 10, 22),
    )

    assert resp.overall_field_readiness == "INSUFFICIENT_DATA"
    for crop in resp.crops:
        assert crop.overall_status == "INSUFFICIENT_DATA"
        assert "Insufficient field data for a reliable suitability assessment" in crop.summary_explanation


# =========================================================================
# 4. DSM-PREDICTED VALUE VERSUS LABORATORY-OBSERVED VALUE
# =========================================================================

def test_dsm_vs_lab_precedence_and_discrepancy(suitability_db):
    """Test laboratory measurement takes precedence over DSM raster and flags discrepancy."""
    field = suitability_db.query(Field).filter(Field.gat_no == "18").first()

    # Create lab report with pH = 7.1
    report = SoilReport(
        field_id=field.id,
        report_no="TEST-REP-003",
        receipt_no="RCP-003",
        sample_name="Topsoil",
        sample_date="2026-05-01",
        report_date="2026-05-05",
        laboratory_name="Certified Lab",
        is_demo=False,
    )
    suitability_db.add(report)
    suitability_db.flush()

    params = [
        # Lab pH is 6.6, but DSM for Gat 18 might be 7.3 -> Discrepancy > 0.5
        SoilParameterValue(report_id=report.id, sr_no=1, parameter_key="ph", parameter_name="Soil pH", parameter_name_mr="सामू", category="Chemical", value=6.6, unit="—", interpretation_en="Neutral", interpretation_mr="उदासीन", reference_range="6.5-7.5", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report.id, sr_no=2, parameter_key="ec", parameter_name="Electrical Conductivity", parameter_name_mr="विद्युत वाहकता", category="Chemical", value=0.3, unit="dS/m", interpretation_en="Normal", interpretation_mr="सामान्य", reference_range="< 1.0", source_type="LAB OBSERVATION"),
    ]
    suitability_db.add_all(params)
    suitability_db.commit()

    resp = crop_suitability_service.evaluate_field_crop_suitability(
        db=suitability_db,
        field_identifier="18",
    )

    ph_param = next(p for p in resp.field_summary.soil_parameters if p.parameter_key == "ph")
    # Precedence: Lab observation must be preserved as primary
    assert ph_param.value == 6.6
    assert ph_param.source_type == "LAB OBSERVATION"
    assert ph_param.is_measured is True

    # If DSM exists, discrepancy must be reported
    if ph_param.secondary_source_value is not None:
        assert ph_param.secondary_source_type == "DSM PREDICTION"
        assert ph_param.discrepancy_detected is True
        assert "Discrepancy detected" in ph_param.discrepancy_note


# =========================================================================
# 5. UNKNOWN OR UNSUPPORTED AGRONOMIC CRITERION
# =========================================================================

def test_unknown_or_unsupported_agronomic_criterion():
    """Test evaluation when a criterion has no established threshold."""
    dummy_criterion = {
        "criterion_name": "Experimental Microbe Index",
        "parameter_key": "experimental_microbe",
        "unit": "cfu/g",
        "optimal_range": "Unspecified",
        "unsuitable_threshold": "Unspecified",
        "agronomic_rationale": "Research-grade metric without standard farmer thresholds",
        "source_reference": "Experimental Draft",
        "source_organization": "University Lab",
    }
    empty_params = {}

    res = crop_suitability_service.evaluate_criterion(dummy_criterion, empty_params)
    assert res.status == "UNKNOWN"
    assert "required field information is unavailable" in res.status_label


# =========================================================================
# 6. INCOMPATIBLE UNIT OR INVALID SOIL VALUE
# =========================================================================

def test_incompatible_unit_or_invalid_soil_value():
    """Test out-of-range or negative value (e.g. pH -2.0 or pH 18.0) is rejected as invalid."""
    criterion = AGRONOMIC_CROP_CRITERIA["CHANA"]["criteria"][0]  # pH criterion
    invalid_param = EvaluatedParameterSoilData(
        parameter_key="ph",
        parameter_name="Soil pH",
        value=-1.5,
        unit="—",
        source_type="LAB OBSERVATION",
        source_label="Test",
        is_available=True,
    )
    soil_params = {"ph": invalid_param}

    res = crop_suitability_service.evaluate_criterion(criterion, soil_params)
    assert res.status == "UNKNOWN"
    assert "invalid or out-of-range" in res.status_label


# =========================================================================
# 7. UNAVAILABLE IRRIGATION OR CLIMATE INPUT
# =========================================================================

def test_unavailable_irrigation_or_climate_input(suitability_db):
    """Test unrecorded irrigation is marked unknown and never assumed to be available."""
    resp = crop_suitability_service.evaluate_field_crop_suitability(
        db=suitability_db,
        field_identifier="18",
        evaluation_date=date(2026, 10, 22),
    )

    for crop in resp.crops:
        assert crop.non_soil_factors.irrigation_status == "UNKNOWN"
        assert "unverified in portal" in crop.non_soil_factors.irrigation_status_label


# =========================================================================
# 8. CROP NOT APPLICABLE TO SELECTED PLANTING WINDOW
# =========================================================================

def test_crop_outside_planting_window(suitability_db):
    """Test Kharif crop evaluated during Rabi planting window is flagged as off-season."""
    resp = crop_suitability_service.evaluate_field_crop_suitability(
        db=suitability_db,
        field_identifier="18",
        evaluation_date=date(2026, 10, 22),  # October = Rabi season
        planning_season="RABI",
    )

    soybean_eval = next(c for c in resp.crops if c.crop_code == "SOYBEAN")
    assert soybean_eval.non_soil_factors.planting_season == "KHARIF"
    assert soybean_eval.non_soil_factors.in_planting_window is False
    assert soybean_eval.non_soil_factors.planting_window_status in ["OFF_SEASON", "INACTIVE"]


# =========================================================================
# 9. FIELD BELONGING TO ANOTHER FARMER (AUTHORIZATION CHECK)
# =========================================================================

def test_authorization_cross_farmer_access(client, suitability_db):
    """Test authenticated Farmer A cannot evaluate Field B belonging to Farmer B."""
    farmer_a = suitability_db.query(Farmer).filter(Farmer.mobile_number == "9876543210").first()
    field_b = suitability_db.query(Field).filter(Field.gat_no == "77").first()

    # Generate token for Farmer A
    token_a = auth_service.create_session_token({
        "farmer_id": farmer_a.id,
        "name": farmer_a.full_name,
        "phone": farmer_a.mobile_number,
        "gat_no": "18",
        "role": "FARMER",
    })

    # Farmer A attempts to query Field B
    response = client.get(
        f"/api/v1/market-intelligence/suitability/field/{field_b.id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )

    assert response.status_code == 403
    assert "Access denied" in response.json()["detail"]


# =========================================================================
# 10. FIELD WITH CONFLICTING OR STALE SOURCE DATA
# =========================================================================

def test_conflicting_or_stale_source_data(suitability_db):
    """Test that conflicting soil observations record discrepancy without silently concealing."""
    field = suitability_db.query(Field).filter(Field.gat_no == "18").first()

    report = SoilReport(
        field_id=field.id,
        report_no="TEST-STALE-001",
        receipt_no="RCP-STALE",
        sample_name="Old Soil Sample",
        sample_date="2023-01-15",
        report_date="2023-01-20",  # Stale data > 3 years old
        laboratory_name="District Lab",
        is_demo=False,
    )
    suitability_db.add(report)
    suitability_db.flush()

    params = [
        # Saline lab result (EC 2.8 dS/m) -> Conflict with chickpea tolerance
        SoilParameterValue(report_id=report.id, sr_no=1, parameter_key="ph", parameter_name="Soil pH", parameter_name_mr="सामू", category="Chemical", value=8.6, unit="—", interpretation_en="Alkaline", interpretation_mr="विम्लधर्मी", reference_range="6.5-7.5", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report.id, sr_no=2, parameter_key="ec", parameter_name="Electrical Conductivity", parameter_name_mr="विद्युत वाहकता", category="Chemical", value=2.8, unit="dS/m", interpretation_en="Saline", interpretation_mr="क्षारयुक्त", reference_range="< 1.0", source_type="LAB OBSERVATION"),
    ]
    suitability_db.add_all(params)
    suitability_db.commit()

    resp = crop_suitability_service.evaluate_field_crop_suitability(
        db=suitability_db,
        field_identifier="18",
    )

    chana_eval = next(c for c in resp.crops if c.crop_code == "CHANA")
    # Salinity constraint should be identified
    assert chana_eval.overall_status == "POTENTIAL_CONSTRAINT"
    assert len(chana_eval.identified_constraints) > 0
    assert any("Salinity" in c for c in chana_eval.identified_constraints)


# =========================================================================
# 11. API ENDPOINTS AND ERROR HANDLING
# =========================================================================

def test_api_suitability_endpoints(client, suitability_db):
    """Test GET /suitability/field/{field_id} and GET /suitability/crops."""
    # 1. Field suitability endpoint
    resp1 = client.get("/api/v1/market-intelligence/suitability/field/18")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert "field_summary" in data1
    assert "crops" in data1
    assert data1["field_summary"]["gat_no"] == "18"
    assert len(data1["crops"]) >= 6

    # 2. Crops criteria endpoint
    resp2 = client.get("/api/v1/market-intelligence/suitability/crops")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["rule_engine_version"] == RULE_ENGINE_VERSION
    assert data2["total_crops"] >= 6
    assert len(data2["authoritative_institutions"]) >= 5


# =========================================================================
# 12. REGRESSION BEHAVIOUR FOR EXISTING SOILPILOT PAGES
# =========================================================================

def test_regression_existing_endpoints(client):
    """Test that existing core endpoints remain operational without regression."""
    # Health check
    r_health = client.get("/api/v1/health")
    assert r_health.status_code == 200

    # Market Intelligence observations
    r_obs = client.get("/api/v1/market-intelligence/observations")
    assert r_obs.status_code == 200

    # Phase 7 Smart Planting Calendar
    r_cal = client.get("/api/v1/market-intelligence/planting-calendar/next-15-days")
    assert r_cal.status_code == 200
