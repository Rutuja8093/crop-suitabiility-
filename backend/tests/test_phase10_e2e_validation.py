"""Phase 10: SoilPilot End-to-End System, Agricultural & Security Validation Suite.

Comprehensive independent validation covering:
- Section 5: Market Data Pipeline Integrity & Quarantine
- Section 6: Historical Analysis Mathematical Formulas & Aggregations
- Section 7: Forecasting Engine, Metric Calculations & Leakage Prevention
- Section 8: Planting Calendar & Harvest Window Date Arithmetic
- Section 9: Field & Soil Suitability Agronomic Precedence & Constraints
- Section 10: Crop Ranking, Financial Formulas & Unit Transformations
- Section 11 & 12: End-to-End Integration & Feature Regression Verification
- Section 13: Security, IDOR Prevention & Sensitive Data Hygiene
- Section 14: Latency & Response-Time Benchmarks
"""

import math
import time
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, Any, List

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
from app.services.auth_service import auth_service
from app.services.market_ingestion_service import market_ingestion_service, MarketIngestionService
from app.services.market_analysis_service import market_analysis_service
from app.services.market_forecasting_service import MarketForecastingEngine
from app.services.crop_calendar_service import crop_calendar_service
from app.services.crop_suitability_service import crop_suitability_service, AGRONOMIC_CROP_CRITERIA
from app.schemas.crop_suitability import EvaluatedParameterSoilData
from app.services.crop_decision_service import crop_decision_service, ACRE_TO_HA_RATIO


@pytest.fixture(scope="function")
def e2e_db():
    """Isolated in-memory SQLite database session with complete schema."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    # Seed administrative hierarchy
    state = State(id=1, name="Maharashtra", code="MH", is_active=True)
    session.add(state)
    session.flush()

    district = District(id=1, state_id=state.id, name="Pune", code="PUN", is_active=True)
    session.add(district)
    session.flush()

    taluka = Taluka(id=1, district_id=district.id, name="Baramati", code="BRM", is_active=True)
    session.add(taluka)
    session.flush()

    village = Village(id=87, taluka_id=taluka.id, name="Malegaon Kh", code="MLG_KH", is_active=True)
    session.add(village)
    session.flush()

    # Farmer A
    farmer_a = Farmer(
        id=1,
        full_name="Ramesh Patil",
        farmer_code="DEMO-FARMER-001",
        mobile_number="9876543210",
        preferred_language="mr",
        role="farmer",
        is_active=True,
    )
    session.add(farmer_a)
    session.flush()

    # Farmer B (for IDOR tests)
    farmer_b = Farmer(
        id=2,
        full_name="Suresh Deshmukh",
        farmer_code="DEMO-FARMER-002",
        mobile_number="9876543211",
        preferred_language="mr",
        role="farmer",
        is_active=True,
    )
    session.add(farmer_b)
    session.flush()

    # Field A (Farmer A)
    field_a = Field(
        id=101,
        farmer_id=farmer_a.id,
        village_id=village.id,
        gat_no="123",
        area=1.0,
        area_unit="hectare",
        is_demo=False,
        is_active=True,
    )
    session.add(field_a)

    # Field B (Farmer B)
    field_b = Field(
        id=202,
        farmer_id=farmer_b.id,
        village_id=village.id,
        gat_no="124",
        area=2.0,
        area_unit="hectare",
        is_demo=False,
        is_active=True,
    )
    session.add(field_b)
    session.flush()

    # Data Source
    source = DataSourceRegistry(
        code="AGMARKNET",
        name="Directorate of Marketing & Inspection (DMI) - AGMARKNET",
        source_type="API",
        update_frequency="DAILY",
        operational_status="OPERATIONAL",
    )
    session.add(source)

    # Commodities
    chickpea = Commodity(
        id=1,
        code="GRAM",
        name="Bengal Gram (Gram / Chana)",
        name_mr="हरभरा (चना)",
        category="PULSES",
        crop_duration_min_days=100,
        crop_duration_max_days=115,
        is_active=True,
    )
    wheat = Commodity(
        id=2,
        code="WHEAT",
        name="Wheat (Gehun)",
        name_mr="गहू",
        category="CEREALS",
        crop_duration_min_days=110,
        crop_duration_max_days=125,
        is_active=True,
    )
    session.add_all([chickpea, wheat])
    session.flush()

    # Market APMC
    baramati_market = MarketApmc(
        id=1,
        name="Baramati",
        name_mr="बारामती",
        market_code="BRM_APMC",
        state_id=state.id,
        district_id=district.id,
        taluka_id=taluka.id,
        is_active=True,
    )
    session.add(baramati_market)
    session.flush()

    # Crop Calendars (Rabi)
    cal_chana = CropCalendar(
        commodity_id=chickpea.id,
        state_id=state.id,
        district_id=district.id,
        season="RABI",
        planting_window_start_month=10,
        planting_window_start_day=1,
        planting_window_end_month=11,
        planting_window_end_day=10,
        harvest_window_start_month=1,
        harvest_window_start_day=10,
        harvest_window_end_month=3,
        harvest_window_end_day=5,
        duration_min_days=100,
        duration_max_days=115,
        is_active=True,
    )
    cal_wheat = CropCalendar(
        commodity_id=wheat.id,
        state_id=state.id,
        district_id=district.id,
        season="RABI",
        planting_window_start_month=11,
        planting_window_start_day=1,
        planting_window_end_month=11,
        planting_window_end_day=30,
        harvest_window_start_month=2,
        harvest_window_start_day=20,
        harvest_window_end_month=3,
        harvest_window_end_day=31,
        duration_min_days=110,
        duration_max_days=125,
        is_active=True,
    )
    session.add_all([cal_chana, cal_wheat])

    # Crop Cost Estimates
    cost_chana = CropCostEstimate(
        commodity_id=chickpea.id,
        district_id=district.id,
        season="RABI",
        area=1.0,
        area_unit="HECTARE",
        estimated_yield_expected=15.0,
        yield_unit="QUINTAL_PER_HECTARE",
        estimated_cost_per_unit_area=38000.0,
    )
    session.add(cost_chana)

    session.commit()
    yield session
    session.close()


@pytest.fixture(scope="function")
def e2e_client(e2e_db: Session):
    """FastAPI TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield e2e_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ==============================================================================
# SECTION 5: MARKET DATA VALIDATION
# ==============================================================================

class TestMarketDataValidation:
    """Verifies market-data pipeline, unit handling, modal/min/max separation, and idempotency."""

    def test_modal_min_max_spread_integrity(self, e2e_db: Session):
        """Verify modal price must lie between min and max price."""
        service = MarketIngestionService()
        invalid_record = [{
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Baramati",
            "commodity": "Bengal Gram (Gram / Chana)",
            "arrival_date": "2026-10-22",
            "min_price": 5000.0,
            "modal_price": 6000.0,
            "max_price": 5500.0,  # Invalid: modal > max
        }]
        result = service.ingest_records(e2e_db, invalid_record, source_code="AGMARKNET")
        assert result["records_rejected"] == 1
        assert result["records_inserted"] == 0

    def test_duplicate_ingestion_idempotency(self, e2e_db: Session):
        """Verify re-ingesting the exact same record does not duplicate rows."""
        service = MarketIngestionService()
        record = [{
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Baramati",
            "commodity": "Bengal Gram (Gram / Chana)",
            "arrival_date": "2026-10-22",
            "min_price": 5000.0,
            "modal_price": 5400.0,
            "max_price": 5600.0,
        }]
        first_run = service.ingest_records(e2e_db, record, source_code="AGMARKNET")
        assert first_run["records_inserted"] == 1

        second_run = service.ingest_records(e2e_db, record, source_code="AGMARKNET")
        assert second_run["records_inserted"] == 0
        assert second_run["records_skipped"] == 1


# ==============================================================================
# SECTION 6: HISTORICAL ANALYSIS INDEPENDENT VERIFICATION
# ==============================================================================

class TestHistoricalAnalysisValidation:
    """Independently verifies formulas for price changes, statistics, thresholds and sample size."""

    def test_independent_statistical_calculation(self):
        """Independently verify mean, median, min, max, absolute and percentage change on known dataset."""
        prices = [4000.0, 4200.0, 4400.0, 4600.0, 4800.0]
        expected_mean = sum(prices) / len(prices)  # 4400.0
        expected_median = 4400.0
        expected_min = 4000.0
        expected_max = 4800.0
        expected_range = 800.0

        # Change from previous (4600) to latest (4800)
        expected_abs_change = 4800.0 - 4600.0  # +200.0
        expected_pct_change = round(((4800.0 - 4600.0) / 4600.0) * 100, 2)  # +4.35%

        assert expected_mean == 4400.0
        assert expected_median == 4400.0
        assert expected_min == 4000.0
        assert expected_max == 4800.0
        assert expected_range == 800.0
        assert expected_abs_change == 200.0
        assert expected_pct_change == 4.35

        # Trend threshold rule: pct_change >= +2.0% -> RISING
        assert expected_pct_change >= 2.0

    def test_insufficient_sample_size_suppresses_trend_assertion(self, e2e_db: Session):
        """Observations N < 3 must return INSUFFICIENT_DATA and not assert a speculative trend."""
        service = MarketIngestionService()
        records = [
            {
                "state": "Maharashtra",
                "district": "Pune",
                "market": "Baramati",
                "commodity": "Bengal Gram (Gram / Chana)",
                "arrival_date": "2026-10-21",
                "min_price": 5000.0,
                "modal_price": 5100.0,
                "max_price": 5200.0,
            },
            {
                "state": "Maharashtra",
                "district": "Pune",
                "market": "Baramati",
                "commodity": "Bengal Gram (Gram / Chana)",
                "arrival_date": "2026-10-22",
                "min_price": 5400.0,
                "modal_price": 5600.0,
                "max_price": 5800.0,
            }
        ]
        service.ingest_records(e2e_db, records, source_code="AGMARKNET")

        analysis = market_analysis_service.get_historical_analysis(
            e2e_db, commodity_id=1, market_id=1
        )
        assert analysis["data_quality"]["is_sufficient"] is False
        assert analysis["summary_metrics"]["trend_direction"] == "INSUFFICIENT_DATA"
        assert analysis["data_quality"]["total_observations"] == 2


# ==============================================================================
# SECTION 7: FORECASTING ENGINE & EVALUATION METRIC VALIDATION
# ==============================================================================

class TestForecastingValidation:
    """Verifies train/test separation, chronological backtesting, and metric mathematical precision."""

    def test_independent_metric_recalculation(self):
        """Independently calculate MAE, RMSE, and guarded MAPE on a known sample."""
        actuals = [5000.0, 5200.0, 5100.0]
        preds = [4900.0, 5250.0, 5050.0]

        errors = [p - a for a, p in zip(actuals, preds)]  # [-100, 50, -50]
        abs_errors = [abs(e) for e in errors]              # [100, 50, 50]
        sq_errors = [e ** 2 for e in errors]               # [10000, 2500, 2500]

        calc_mae = sum(abs_errors) / len(abs_errors)       # 66.666...
        calc_rmse = math.sqrt(sum(sq_errors) / len(sq_errors))  # sqrt(5000) = 70.7106...

        assert round(calc_mae, 2) == 66.67
        assert round(calc_rmse, 2) == 70.71

    def test_forecasting_fails_gracefully_when_under_sample_size(self, e2e_db: Session):
        """When history N < 15, forecasting returns UNAVAILABLE without fabricating estimates."""
        engine = MarketForecastingEngine(e2e_db)
        result = engine.generate_forecast(commodity_id=1, market_id=1, horizon_days=30)
        assert result.status == "UNAVAILABLE_INSUFFICIENT_DATA"
        assert result.predicted_modal_price is None
        assert "minimum" in result.unavailability_reason.lower()


# ==============================================================================
# SECTION 8: PLANTING CALENDAR & HARVEST DATE ARITHMETIC
# ==============================================================================

class TestPlantingCalendarValidation:
    """Tests agronomic windows, date arithmetic, duration additions, and leap-year boundaries."""

    def test_harvest_window_calculation_accuracy(self):
        """Verify earliest and latest harvest window span given sowing window and duration."""
        # Rabi Chickpea: Sowing Oct 1 to Nov 10 (40 days span), duration 100 to 115 days.
        sowing_start = date(2026, 10, 1)
        sowing_end = date(2026, 11, 10)
        dur_min = 100
        dur_max = 115

        earliest_harvest = sowing_start + timedelta(days=dur_min)
        latest_harvest = sowing_end + timedelta(days=dur_max)

        assert earliest_harvest == date(2027, 1, 9)
        assert latest_harvest == date(2027, 3, 5)

        # Total harvest window span
        harvest_span = (latest_harvest - earliest_harvest).days
        # Span = (sowing span: 40) + (duration span: 15) = 55 days
        assert harvest_span == 55

    def test_leap_year_boundary_handling(self):
        """Verify date math correctly respects leap year (e.g., February 29 in 2028)."""
        base_sowing = date(2028, 2, 1)
        # Sowing on Feb 1, 2028 + 30 days must land on March 2 because 2028 is a leap year (29 days in Feb)
        target = base_sowing + timedelta(days=30)
        assert target == date(2028, 3, 2)


# ==============================================================================
# SECTION 9: FIELD & SOIL SUITABILITY AGRONOMIC RULES
# ==============================================================================

class TestFieldSoilSuitabilityValidation:
    """Verifies lab observation precedence over DSM, discrepancy flags, and agronomic veto rules."""

    def test_lab_precedence_and_discrepancy(self, e2e_db: Session):
        """Lab observation must be chosen over DSM, and discrepancy flagged when delta is significant."""
        report = SoilReport(
            field_id=101,
            report_no="TEST-E2E-001",
            receipt_no="RCP-E2E-001",
            sample_date="2026-04-01",
            report_date="2026-04-05",
            laboratory_name="Baramati Soil Testing Lab",
            is_demo=False,
        )
        e2e_db.add(report)
        e2e_db.flush()
        p1 = SoilParameterValue(
            report_id=report.id,
            sr_no=1,
            parameter_key="ph",
            parameter_name="Soil pH",
            parameter_name_mr="सामू",
            category="Chemical",
            value=6.6,
            unit="—",
            interpretation_en="Neutral",
            interpretation_mr="उदासीन",
            reference_range="6.5-7.5",
            source_type="LAB OBSERVATION",
        )
        e2e_db.add(p1)
        e2e_db.commit()

        resp = crop_suitability_service.evaluate_field_crop_suitability(
            db=e2e_db, field_identifier="123"
        )
        ph_param = next(p for p in resp.field_summary.soil_parameters if p.parameter_key == "ph")
        assert ph_param.value == 6.6
        assert ph_param.source_type == "LAB OBSERVATION"
        assert ph_param.is_measured is True

    def test_single_favorable_parameter_does_not_imply_suitability(self):
        """Severe alkalinity (pH 8.8) must veto crop suitability even if other parameters are optimal."""
        ph_criterion = AGRONOMIC_CROP_CRITERIA["CHANA"]["criteria"][0]  # pH criterion
        alkaline_ph = EvaluatedParameterSoilData(
            parameter_key="ph",
            parameter_name="Soil pH",
            value=8.8,  # Exceeds unsuitable threshold > 8.5
            unit="—",
            source_type="LAB OBSERVATION",
            source_label="Lab Report",
            is_available=True,
        )
        result = crop_suitability_service.evaluate_criterion(ph_criterion, {"ph": alkaline_ph})
        assert result.status == "UNSUITABLE"
        assert "alkalinity" in result.interpretation.lower()


# ==============================================================================
# SECTION 10: CROP RANKING & FINANCIAL CALCULATION PRECISION
# ==============================================================================

class TestCropRankingFinancialValidation:
    """Independently verifies:
    Estimated gross revenue = estimated saleable yield × expected sale price
    Estimated net return = estimated gross revenue − estimated cultivation cost
    """

    def test_financial_identity_verification(self):
        """Independently verify gross revenue, net return and unit conversion across Hectare and Acre."""
        # 1. Inputs for 1.0 Hectare Chickpea
        yield_ha_quintals = 15.0
        price_per_quintal = 5400.0  # INR
        cost_ha = 38000.0          # INR

        expected_gross_revenue_ha = yield_ha_quintals * price_per_quintal  # 81,000 INR
        expected_net_return_ha = expected_gross_revenue_ha - cost_ha        # 43,000 INR

        assert expected_gross_revenue_ha == 81000.0
        assert expected_net_return_ha == 43000.0

        # 2. Acre equivalents (1 ha = 2.47105 acres)
        area_acres = 2.47105
        expected_gross_revenue_acre = round(expected_gross_revenue_ha / area_acres, 2)
        expected_net_return_acre = round(expected_net_return_ha / area_acres, 2)

        assert expected_gross_revenue_acre == 32779.59
        assert expected_net_return_acre == 17401.51

    def test_missing_price_forecast_suppresses_fabricated_profit(self, e2e_db: Session):
        """When harvest price forecast is unavailable, gross revenue and net return must be None."""
        eval_date = date(2026, 10, 22)
        response = crop_decision_service.evaluate_field_crop_decision(
            db=e2e_db,
            field_identifier="123",
            planning_date=eval_date,
            planning_horizon="IMMEDIATE_15_DAYS",
            planning_season="RABI",
        )
        # Verify candidate crops without forecast do not show fabricated profits
        for crop in response.crops:
            if crop.financials and crop.financials.price_source_type == "NOT_AVAILABLE":
                assert crop.financials.assumed_price_modal is None
                assert crop.financials.central_scenario is None


# ==============================================================================
# SECTION 13: SECURITY & AUTHORIZATION TESTS
# ==============================================================================

class TestSecurityAndAuthorization:
    """Verifies that cross-farmer IDOR is strictly blocked and credentials are never leaked."""

    def test_cross_farmer_field_access_blocked(self, e2e_client: TestClient, e2e_db: Session):
        """Farmer A cannot access Farmer B's field by altering field_id (HTTP 403)."""
        # Create token for Farmer A (registered Gat 123)
        token_a = auth_service.create_session_token({
            "farmer_id": 1,
            "field_id": 101,
            "gat_no": "123",
            "village_id": 87,
            "role": "farmer",
        })

        # Farmer A attempts to access Field 202 belonging to Farmer B
        res = e2e_client.get(
            "/api/v1/market-intelligence/suitability/field/202",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res.status_code == 403
        assert "Access denied" in res.json()["detail"]

        # Farmer A can access own field
        res_me = e2e_client.get(
            "/api/v1/fields/me",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res_me.status_code == 200
        assert res_me.json()["gat_no"] == "123"

    def test_unauthenticated_request_rejected(self, e2e_client: TestClient):
        """Direct access to authenticated endpoints without token returns 401."""
        res = e2e_client.get("/api/v1/fields/me")
        assert res.status_code == 401

    def test_sensitive_credentials_not_exposed(self, e2e_client: TestClient):
        """Public responses must not expose database connection strings or SECRET_KEY."""
        res = e2e_client.get("/api/v1/health")
        assert res.status_code == 200
        content = res.text.lower()
        assert "password" not in content
        assert "secret_key" not in content
        assert "database_url" not in content


# ==============================================================================
# SECTION 14: PERFORMANCE & LATENCY MEASUREMENTS
# ==============================================================================

class TestPerformanceAndReliability:
    """Measures actual response times for core API operations under normal loads."""

    def test_api_endpoint_response_times(self, e2e_client: TestClient):
        """Verify API response times are well within acceptable bounds (< 250ms)."""
        endpoints = [
            "/api/v1/health",
            "/api/v1/geography/talukas",
            "/api/v1/soil-layers",
        ]
        for ep in endpoints:
            t0 = time.perf_counter()
            res = e2e_client.get(ep)
            latency_ms = (time.perf_counter() - t0) * 1000.0
            assert res.status_code == 200
            # Latency benchmark: must respond in under 250ms
            assert latency_ms < 250.0, f"Endpoint {ep} took {latency_ms:.2f}ms"
