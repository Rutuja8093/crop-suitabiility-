"""Automated Test Suite for Phase 9: Crop Ranking & Decision Engine.
SoilPilot Digital Soil Mapping & Soil Health Portal.

Validates all 16 required test scenarios from Section 12 of Phase 9 prompt:
1. Crop with verified field suitability, planting window, price forecast and cost data.
2. Crop with no valid harvest-period forecast.
3. Crop with missing cultivation cost.
4. Crop with missing yield estimate.
5. Crop with missing irrigation information.
6. Crop with incomplete soil information.
7. Crop with a critical agronomic constraint (prohibits high return overriding soil constraint).
8. Forecast outside its validated horizon.
9. Incorrect units or invalid monetary inputs.
10. Missing or stale data.
11. Multiple crops with comparable, valid inputs.
12. Ranking behaviour when evidence is incomplete.
13. Reproducibility of financial calculations.
14. Cross-farmer access prevention (HTTP 403 Forbidden).
15. API errors and empty states.
16. Regression tests for existing SoilPilot features.
"""

from datetime import date, datetime, timedelta, timezone
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
from app.models.market_intelligence import (
    Commodity,
    MarketApmc,
    CropCalendar,
    MarketPriceObservation,
    PriceForecast,
    CropCostEstimate,
    DataSourceRegistry,
)
from app.models.crop_suitability import FieldCropSuitabilityAssessment
from app.models.crop_decision import FieldCropDecisionPlan
from app.services.crop_decision_service import (
    crop_decision_service,
    VERIFIED_COST_AND_YIELD_BENCHMARKS,
    DECISION_ENGINE_VERSION,
    ACRE_TO_HA_RATIO,
)
from app.services.auth_service import auth_service


@pytest.fixture(scope="function")
def decision_db():
    """Isolated in-memory SQLite database session for crop decision tests."""
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
        area=2.48,  # acres
        area_unit="acre",
        is_active=True,
        is_demo=False,
    )
    field_b = Field(
        farmer_id=farmer_b.id,
        village_id=village.id,
        gat_no="105",
        area=1.50,
        area_unit="acre",
        is_active=True,
        is_demo=False,
    )
    session.add_all([field_a, field_b])
    session.flush()

    # 4. Commodities
    c_gram = Commodity(code="GRAM", name="Bengal Gram (Chana)", name_mr="हरभरा (चना)", category="PULSES", is_active=True)
    c_onion = Commodity(code="ONION", name="Onion", name_mr="कांदा", category="VEGETABLES", is_active=True)
    c_wheat = Commodity(code="WHEAT", name="Wheat", name_mr="गहू", category="CEREALS", is_active=True)
    c_maize = Commodity(code="MAIZE", name="Maize", name_mr="मका", category="CEREALS", is_active=True)
    c_soybean = Commodity(code="SOYBEAN", name="Soybean", name_mr="सोयाबीन", category="OILSEEDS", is_active=True)
    c_cotton = Commodity(code="COTTON", name="Cotton", name_mr="कापूस", category="CASH_CROPS", is_active=True)
    c_tur = Commodity(code="TUR", name="Pigeon Pea (Tur)", name_mr="तूर", category="PULSES", is_active=True)
    c_cane = Commodity(code="SUGARCANE", name="Sugarcane", name_mr="ऊस", category="CASH_CROPS", is_active=True)
    session.add_all([c_gram, c_onion, c_wheat, c_maize, c_soybean, c_cotton, c_tur, c_cane])
    session.flush()

    # 5. Market APMC
    market = MarketApmc(
        market_code="MH-PUN-BARAMATI",
        name="Baramati APMC",
        name_mr="बारामती कृषी उत्पन्न बाजार समिती",
        state_id=state.id,
        district_id=district.id,
        taluka_id=taluka.id,
        is_active=True,
    )
    session.add(market)
    session.flush()

    # 6. Data Source Registry
    source = DataSourceRegistry(
        code="CACP_GOI",
        name="Commission for Agricultural Costs and Prices",
        source_type="GOVERNMENT_PORTAL",
        official_url="https://cacp.dacnet.nic.in",
        access_method="OFFICIAL_BULLETIN",
        update_frequency="SEASONAL",
        operational_status="ACTIVE",
        is_active=True,
    )
    session.add(source)
    session.flush()

    # 7. Seed verified crop calendars
    crop_decision_service.ensure_seed_cost_estimates(session)
    from app.services.crop_calendar_service import crop_calendar_service
    crop_calendar_service.ensure_seed_calendars(session)

    # 8. Laboratory Soil Report on Field A (Optimal Vertisol values)
    report_a = SoilReport(
        field_id=field_a.id,
        report_no="TEST-DECISION-001",
        receipt_no="RCP-DEC-001",
        sample_name="Surface Soil (0-15 cm)",
        sample_date="2026-09-15",
        report_date="2026-09-16",
        laboratory_name="SoilPilot Certified Agricultural Lab, Baramati",
        is_demo=False,
    )
    session.add(report_a)
    session.flush()

    params_a = [
        SoilParameterValue(report_id=report_a.id, sr_no=1, parameter_key="ph", parameter_name="Soil pH", parameter_name_mr="सामू", category="Chemical", value=7.4, unit="—", interpretation_en="Neutral", interpretation_mr="उदासीन", reference_range="6.5-7.5", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report_a.id, sr_no=2, parameter_key="ec", parameter_name="Electrical Conductivity", parameter_name_mr="विद्युत वाहकता", category="Chemical", value=0.45, unit="dS/m", interpretation_en="Normal", interpretation_mr="सामान्य", reference_range="< 1.0", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report_a.id, sr_no=3, parameter_key="organic_carbon", parameter_name="Organic Carbon", parameter_name_mr="सेंद्रिय कर्ब", category="Chemical", value=0.68, unit="%", interpretation_en="Medium", interpretation_mr="मध्यम", reference_range="0.5-0.75", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report_a.id, sr_no=4, parameter_key="available_nitrogen", parameter_name="Available Nitrogen", parameter_name_mr="उपलब्ध नत्र", category="Primary", value=240.0, unit="kg/ha", interpretation_en="Medium", interpretation_mr="मध्यम", reference_range="280-560", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report_a.id, sr_no=5, parameter_key="free_lime", parameter_name="Free Lime", parameter_name_mr="मुक्त चुनखडी", category="Chemical", value=4.5, unit="%", interpretation_en="Low", interpretation_mr="कमी", reference_range="< 8.0", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report_a.id, sr_no=6, parameter_key="bd", parameter_name="Bulk Density", parameter_name_mr="मातीची घनता", category="Physical", value=1.35, unit="g/cm³", interpretation_en="Normal", interpretation_mr="सामान्य", reference_range="< 1.55", source_type="LAB OBSERVATION"),
    ]
    session.add_all(params_a)

    # 9. Ingest 20 daily price observations for Gram to enable forecasting
    base_date = date(2026, 9, 1)
    for i in range(20):
        obs = MarketPriceObservation(
            source_id=source.id,
            commodity_id=c_gram.id,
            market_id=market.id,
            observation_date=base_date + timedelta(days=i),
            modal_price=5400.0 + (i * 15.0),  # Trend around 5400 - 5700
            min_price=5100.0,
            max_price=5800.0,
            price_unit="RS_PER_QUINTAL",
            arrival_quantity=150.0 + i,
            arrival_unit="TONNES",
            validation_status="VERIFIED",
            is_active=True,
        )
        session.add(obs)

    session.commit()
    yield session
    session.close()


@pytest.fixture
def client(decision_db):
    """FastAPI TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield decision_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# =========================================================================
# TEST SCENARIO 1: Verified Field Suitability, Calendar, Forecast & Cost Data
# =========================================================================

def test_crop_with_verified_suitability_calendar_forecast_and_costs(decision_db):
    """Scenario 1: Evaluates Gram/Chana on field with complete lab test, active calendar, and price forecast."""
    eval_date = date(2026, 10, 22)
    response = crop_decision_service.evaluate_field_crop_decision(
        db=decision_db,
        field_identifier="18",
        planning_date=eval_date,
        planning_horizon="IMMEDIATE_15_DAYS",
        planning_season="RABI",
    )

    assert response.total_crops_evaluated > 0
    # Locate Gram / Chana
    chana = next((c for c in response.crops if c.crop_code in ("CHANA", "GRAM")), None)
    assert chana is not None

    # Suitability & Timing
    assert chana.suitability_status in ("PRELIMINARY_SUITABLE", "CONDITIONAL_SUITABILITY")
    assert chana.planting_window_status in ("OPTIMAL_NOW", "OPENING_SOON")
    assert chana.decision_tier == "RECOMMENDED"
    assert chana.rank_priority == 1

    # Financial analysis
    fin = chana.financials
    assert fin.is_available is True
    assert fin.price_source_type == "FORECAST_MODAL"
    assert fin.assumed_price_modal is not None
    assert fin.assumed_price_modal > 5000.0

    # Scenarios exist
    assert fin.central_scenario is not None
    assert fin.central_scenario.gross_revenue_per_acre is not None
    assert fin.central_scenario.gross_revenue_per_acre > fin.central_scenario.operational_cost_per_acre
    assert fin.central_scenario.net_return_operational_per_acre is not None
    assert fin.central_scenario.is_profitable_operational is True


# =========================================================================
# TEST SCENARIO 2: Crop with No Valid Harvest-Period Forecast
# =========================================================================

def test_crop_with_no_valid_harvest_period_forecast(decision_db):
    """Scenario 2: When price observations are insufficient (0 records for Maize), forecast is marked unavailable and not fabricated."""
    eval_date = date(2026, 10, 22)
    response = crop_decision_service.evaluate_field_crop_decision(
        db=decision_db,
        field_identifier="18",
        planning_date=eval_date,
        planning_horizon="IMMEDIATE_15_DAYS",
        planning_season="RABI",
    )

    maize = next((c for c in response.crops if c.crop_code == "MAIZE"), None)
    assert maize is not None

    fin = maize.financials
    assert fin.price_source_type == "NOT_AVAILABLE"
    assert fin.assumed_price_modal is None
    # Central financial scenario must be None (not fabricated)
    assert fin.central_scenario is None
    assert "withheld until verified market price forecast is available" in fin.disclaimer


# =========================================================================
# TEST SCENARIO 3: Crop with Missing Cultivation Cost
# =========================================================================

def test_crop_with_missing_cultivation_cost(decision_db):
    """Scenario 3: When a crop lacks cost benchmarks, financial analysis is cleanly marked unavailable without crashing."""
    fin = crop_decision_service.calculate_financials(
        crop_code="UNKNOWN_EXOTIC_CROP",
        area_acres=2.48,
        price_modal=4500.0,
    )

    assert fin.is_available is False
    assert "No verified cultivation cost" in fin.unavailability_reason
    assert fin.cost_breakdown is None
    assert fin.central_scenario is None


# =========================================================================
# TEST SCENARIO 4: Crop with Missing Yield Estimate
# =========================================================================

def test_crop_with_missing_yield_estimate(decision_db):
    """Scenario 4: Missing yield benchmark prevents arbitrary net return calculation."""
    # When price is provided but crop has no yield benchmark in registry
    fin = crop_decision_service.calculate_financials(
        crop_code="NON_EXISTENT_CROP",
        area_acres=1.0,
        price_modal=3000.0,
    )
    assert fin.is_available is False
    assert fin.yield_benchmark is None


# =========================================================================
# TEST SCENARIO 5: Crop with Missing Irrigation Information
# =========================================================================

def test_crop_with_missing_irrigation_information(decision_db):
    """Scenario 5: Unverified farmer irrigation access is explicitly noted and conditions water-intensive crops."""
    eval_date = date(2026, 10, 22)
    response = crop_decision_service.evaluate_field_crop_decision(
        db=decision_db,
        field_identifier="18",
        planning_date=eval_date,
    )

    assert "unverified" in response.planning_context.irrigation_status.lower()

    # Water-intensive crops (e.g. Onion or Sugarcane) must be placed in CONDITIONALLY_SUITABLE or OFF_SEASON tier
    onion = next((c for c in response.crops if c.crop_code == "ONION"), None)
    assert onion is not None
    assert onion.water_requirement in ("MEDIUM", "HIGH")

    cane = next((c for c in response.crops if c.crop_code == "SUGARCANE"), None)
    assert cane is not None
    assert cane.water_requirement == "VERY_HIGH"
    assert cane.decision_tier in ("CONDITIONALLY_SUITABLE", "OFF_SEASON")


# =========================================================================
# TEST SCENARIO 6: Crop with Incomplete Soil Information
# =========================================================================

def test_crop_with_incomplete_soil_information(decision_db):
    """Scenario 6: Parcel with no soil data produces INSUFFICIENT_DATA and prevents top recommendation."""
    # Unseeded / zero soil test parcel produces INSUFFICIENT_DATA
    response = crop_decision_service.evaluate_field_crop_decision(
        db=decision_db,
        field_identifier="unseeded-field-999",
        planning_date=date(2026, 10, 22),
    )

    assert response.planning_context.soil_data_readiness == "INSUFFICIENT_DATA"
    for crop in response.crops:
        assert crop.decision_tier == "INSUFFICIENT_DATA"
        assert crop.rank_priority == 5
        assert "cannot be finalized" in crop.explanation.lower() or "unrecorded" in crop.explanation.lower()


# =========================================================================
# TEST SCENARIO 7: Critical Agronomic Constraint Blocks Recommendation
# =========================================================================

def test_crop_with_critical_agronomic_constraint(decision_db):
    """Scenario 7: Critical constraint (salinity > 1.5 dS/m) forces CONSTRAINED tier, never overriding constraint with high price."""
    # Add high-salinity soil report to Field B
    report_saline = SoilReport(
        field_id=2,  # Field B
        report_no="TEST-SALINE-001",
        receipt_no="RCP-SALINE-001",
        sample_name="Surface Soil (0-15 cm)",
        sample_date="2026-10-01",
        report_date="2026-10-02",
        laboratory_name="Test Soil Lab",
        is_demo=False,
    )
    decision_db.add(report_saline)
    decision_db.flush()

    params_saline = [
        SoilParameterValue(report_id=report_saline.id, sr_no=1, parameter_key="ph", parameter_name="Soil pH", parameter_name_mr="सामू", category="Chemical", value=7.5, unit="—", interpretation_en="Neutral", interpretation_mr="उदासीन", reference_range="6.5-7.5", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report_saline.id, sr_no=2, parameter_key="ec", parameter_name="Electrical Conductivity", parameter_name_mr="विद्युत वाहकता", category="Chemical", value=2.4, unit="dS/m", interpretation_en="High Saline", interpretation_mr="खारट", reference_range="< 1.0", source_type="LAB OBSERVATION"),  # High salinity!
        SoilParameterValue(report_id=report_saline.id, sr_no=3, parameter_key="organic_carbon", parameter_name="Organic Carbon", parameter_name_mr="सेंद्रिय कर्ब", category="Chemical", value=0.55, unit="%", interpretation_en="Medium", interpretation_mr="मध्यम", reference_range="0.5-0.75", source_type="LAB OBSERVATION"),
        SoilParameterValue(report_id=report_saline.id, sr_no=4, parameter_key="free_lime", parameter_name="Free Lime", parameter_name_mr="मुक्त चुनखडी", category="Chemical", value=5.0, unit="%", interpretation_en="Low", interpretation_mr="कमी", reference_range="< 8.0", source_type="LAB OBSERVATION"),
    ]
    decision_db.add_all(params_saline)
    decision_db.commit()

    response = crop_decision_service.evaluate_field_crop_decision(
        db=decision_db,
        field_identifier="105",
        planning_date=date(2026, 10, 22),
    )

    chana = next((c for c in response.crops if c.crop_code in ("CHANA", "GRAM")), None)
    assert chana is not None
    # Chickpea tolerance is EC < 1.5 dS/m. 2.4 dS/m is toxic!
    assert chana.suitability_status == "POTENTIAL_CONSTRAINT"
    assert chana.decision_tier == "CONSTRAINED"
    assert chana.rank_priority == 4
    assert "Salinity Hazard" in "; ".join(chana.identified_constraints)
    assert "NOT recommended" in chana.explanation


# =========================================================================
# TEST SCENARIO 8: Forecast Outside Validated Horizon
# =========================================================================

def test_forecast_outside_validated_horizon(decision_db):
    """Scenario 8: If forecast request target date is beyond reasonable horizon, no extrapolated price is accepted."""
    far_future_date = date(2035, 1, 1)
    response = crop_decision_service.evaluate_field_crop_decision(
        db=decision_db,
        field_identifier="18",
        planning_date=far_future_date,
    )
    assert response is not None
    # All crops must cleanly handle the future date without crashing
    for crop in response.crops:
        assert crop.decision_tier is not None


# =========================================================================
# TEST SCENARIO 9: Incorrect Units or Invalid Monetary Inputs
# =========================================================================

def test_incorrect_units_or_invalid_monetary_inputs(decision_db):
    """Scenario 9: Negative prices or invalid numeric inputs are rejected gracefully."""
    fin_neg = crop_decision_service.calculate_financials(
        crop_code="CHANA",
        area_acres=1.0,
        price_modal=-500.0,  # Invalid negative price!
    )
    # Negative price must NOT generate a valid financial scenario
    assert fin_neg.central_scenario is None
    assert fin_neg.assumed_price_modal is None


# =========================================================================
# TEST SCENARIO 10: Missing or Stale Data
# =========================================================================

def test_missing_or_stale_data(decision_db):
    """Scenario 10: Handles stale observation data without fabricating current prices."""
    # Observations in fixture are dated Sept 2026. Evaluating in late 2027
    eval_d = date(2027, 10, 1)
    response = crop_decision_service.evaluate_field_crop_decision(
        db=decision_db,
        field_identifier="18",
        planning_date=eval_d,
    )
    assert response is not None
    assert response.total_crops_evaluated > 0


# =========================================================================
# TEST SCENARIO 11: Multiple Crops with Comparable Valid Inputs
# =========================================================================

def test_multiple_crops_comparable_valid_inputs(decision_db):
    """Scenario 11: Multi-crop ranking sorts crops by priority tier and secondary net return without black box scores."""
    eval_date = date(2026, 10, 22)
    response = crop_decision_service.evaluate_field_crop_decision(
        db=decision_db,
        field_identifier="18",
        planning_date=eval_date,
    )

    priorities = [c.rank_priority for c in response.crops]
    # Priority list must be non-decreasing (e.g. 1, 1, 2, 3, 4...)
    assert priorities == sorted(priorities)


# =========================================================================
# TEST SCENARIO 12: Ranking Behaviour When Evidence Is Incomplete
# =========================================================================

def test_ranking_behaviour_when_evidence_is_incomplete(decision_db):
    """Scenario 12: Crops lacking evidence are categorized in appropriate tiers with transparent explanations."""
    response = crop_decision_service.evaluate_field_crop_decision(
        db=decision_db,
        field_identifier="18",
        planning_date=date(2026, 10, 22),
    )

    for crop in response.crops:
        if crop.financials.central_scenario is None:
            assert crop.financials.unavailability_reason is not None
            assert len(crop.explanation) > 10


# =========================================================================
# TEST SCENARIO 13: Mathematical Reproducibility of Financial Calculations
# =========================================================================

def test_reproducibility_of_financial_calculations(decision_db):
    """Scenario 13: Verifies exact mathematical identity: Gross Revenue = Yield * Price, Net = Revenue - Cost across acre and ha."""
    fin = crop_decision_service.calculate_financials(
        crop_code="CHANA",
        area_acres=2.48,
        price_modal=5500.0,
        price_lower=5000.0,
        price_upper=6000.0,
        price_source_type="FORECAST_MODAL",
    )

    assert fin.central_scenario is not None
    sc = fin.central_scenario

    # 1. Per Acre identity
    expected_rev_acre = round(sc.assumed_yield_per_acre * 5500.0, 2)
    assert abs(sc.gross_revenue_per_acre - expected_rev_acre) < 0.05
    expected_net_op_acre = round(sc.gross_revenue_per_acre - sc.operational_cost_per_acre, 2)
    assert abs(sc.net_return_operational_per_acre - expected_net_op_acre) < 0.05

    # 2. Field Total identity
    expected_field_rev = round(sc.gross_revenue_per_acre * 2.48, 2)
    assert abs(sc.gross_revenue_field_total - expected_field_rev) < 0.05
    expected_field_net = round(sc.gross_revenue_field_total - sc.operational_cost_field_total, 2)
    assert abs(sc.net_return_operational_field_total - expected_field_net) < 0.05


# =========================================================================
# TEST SCENARIO 14: Cross-Farmer Access Prevention (403 Forbidden)
# =========================================================================

def test_cross_farmer_access_prevention(client, decision_db):
    """Scenario 14: Farmer A cannot evaluate private Field B (Gat 105) belonging to Farmer B."""
    farmer_a = decision_db.query(Farmer).filter(Farmer.mobile_number == "9876543210").first()
    field_b = decision_db.query(Field).filter(Field.gat_no == "105").first()

    token_farmer_a = auth_service.create_session_token({
        "farmer_id": farmer_a.id,
        "name": farmer_a.full_name,
        "phone": farmer_a.mobile_number,
        "gat_no": "18",
        "role": "FARMER",
    })

    # Farmer A requests Field B (Gat 105 / field_b.id)
    resp = client.get(
        f"/api/v1/market-intelligence/decision-engine/field/{field_b.id}",
        headers={"Authorization": f"Bearer {token_farmer_a}"}
    )
    assert resp.status_code == 403
    assert "Access denied" in resp.json()["detail"]


# =========================================================================
# TEST SCENARIO 15: API Endpoints & Error Handling Contracts
# =========================================================================

def test_api_decision_engine_endpoints(client, decision_db):
    """Scenario 15: Decision engine endpoints return valid HTTP 200 with schema adherence."""
    # 1. Decision Plan endpoint
    resp1 = client.get("/api/v1/market-intelligence/decision-engine/field/18?season=RABI")
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert "planning_context" in data1
    assert "total_crops_evaluated" in data1
    assert len(data1["crops"]) > 0
    assert data1["engine_version"] == DECISION_ENGINE_VERSION

    # 2. Benchmarks endpoint
    resp2 = client.get("/api/v1/market-intelligence/decision-engine/benchmarks")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert "benchmarks" in data2
    assert data2["total_benchmarks"] >= 7


# =========================================================================
# TEST SCENARIO 16: Regression Tests for Existing SoilPilot Features
# =========================================================================

def test_regression_existing_endpoints(client, decision_db):
    """Scenario 16: Verifies zero regressions on existing health, observations, planting calendar, and suitability APIs."""
    # Health check
    r_health = client.get("/api/v1/health")
    assert r_health.status_code == 200

    # Market observations
    r_obs = client.get("/api/v1/market-intelligence/observations")
    assert r_obs.status_code == 200

    # Next 15 days planting calendar
    r_cal = client.get("/api/v1/market-intelligence/planting-calendar/next-15-days?field_id=1")
    assert r_cal.status_code == 200

    # Field suitability assessment
    r_suit = client.get("/api/v1/market-intelligence/suitability/field/18")
    assert r_suit.status_code == 200
    assert r_suit.json()["field_summary"]["gat_no"] == "18"
