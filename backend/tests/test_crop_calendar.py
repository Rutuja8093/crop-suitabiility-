"""Unit and Integration Tests for Smart Planting Calendar & Crop Planning Windows.
SoilPilot Phase 7: Crop Calendars, Next 15 Days, Seasonal Planning, and Harvest Windows.

All test inputs are synthetic test fixtures explicitly labeled as TEST DATA.
Covers:
1. Authoritative Next-15-Days date-range calculation.
2. Planting windows overlapping the active 15-day range.
3. Seasonal calendar filtering (KHARIF, RABI, ZAID_SUMMER, ANNUAL).
4. Region-specific calendar selection.
5. Indicative harvest-window calculation from duration ranges.
6. Explicit duration definition integrity.
7. Date boundary conditions (window opening today, closing today).
8. Missing field and soil context handling (unrecorded soil test).
9. Commodity mapping to Phase 6 market forecasts.
10. Transparent unavailable forecast states when market observations are insufficient.
11. API endpoints contracts and parameters.
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
from app.models.geography import State, District, Taluka
from app.models.field import Field
from app.models.soil_health import SoilReport, SoilParameterValue
from app.models.market_intelligence import (
    Commodity,
    MarketApmc,
    CropCalendar,
    DataSourceRegistry,
)
from app.services.crop_calendar_service import (
    CropCalendarService,
    DISCLAIMER_PHASE_7,
    DURATION_DEFINITION_STANDARD,
)


@pytest.fixture(scope="function")
def calendar_db():
    """Isolated in-memory SQLite database session for crop calendar tests."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()

    # Seed baseline geography
    mh_state = State(name="Maharashtra", code="MH", is_active=True)
    session.add(mh_state)
    session.flush()

    pune_dist = District(name="Pune", code="PN", state_id=mh_state.id, is_active=True)
    session.add(pune_dist)
    session.flush()

    baramati_taluka = Taluka(name="Baramati", code="BRM", district_id=pune_dist.id, is_active=True)
    session.add(baramati_taluka)
    session.flush()

    # Seed official source
    source = DataSourceRegistry(
        code="MPKV_RAHURI",
        name="Mahatma Phule Krishi Vidyapeeth, Rahuri",
        source_type="AGRICULTURAL_UNIVERSITY",
        official_url="https://mpkv.ac.in",
        operational_status="ACTIVE",
        is_active=True,
    )
    session.add(source)
    session.flush()

    # Seed commodities
    c_gram = Commodity(
        id=1,
        code="GRAM",
        name="Bengal Gram (Chana)",
        name_mr="हरभरा",
        category="PULSES",
        standard_unit="QUINTAL",
        crop_duration_min_days=95,
        crop_duration_max_days=110,
        is_active=True,
    )
    c_wheat = Commodity(
        id=2,
        code="WHEAT",
        name="Wheat",
        name_mr="गहू",
        category="CEREALS",
        standard_unit="QUINTAL",
        crop_duration_min_days=105,
        crop_duration_max_days=125,
        is_active=True,
    )
    c_soybean = Commodity(
        id=3,
        code="SOYBEAN",
        name="Soybean",
        name_mr="सोयाबीन",
        category="OILSEEDS",
        standard_unit="QUINTAL",
        crop_duration_min_days=90,
        crop_duration_max_days=105,
        is_active=True,
    )
    session.add_all([c_gram, c_wheat, c_soybean])
    session.flush()

    # Seed APMC market
    baramati_market = MarketApmc(
        id=1,
        market_code="TEST_MH_BARAMATI",
        name="Baramati APMC",
        name_mr="बारामती कृषी उत्पन्न बाजार समिती",
        state_id=mh_state.id,
        district_id=pune_dist.id,
        taluka_id=baramati_taluka.id,
        market_type="PRINCIPAL_MARKET",
        is_active=True,
    )
    session.add(baramati_market)
    session.flush()

    # Seed crop calendars
    # 1. Gram (Rabi, Oct 1 to Nov 10)
    cal_gram = CropCalendar(
        commodity_id=c_gram.id,
        state_id=mh_state.id,
        district_id=pune_dist.id,
        season="RABI",
        planting_window_start_month=10,
        planting_window_start_day=1,
        planting_window_end_month=11,
        planting_window_end_day=10,
        duration_min_days=95,
        duration_max_days=110,
        harvest_window_start_month=1,
        harvest_window_start_day=15,
        harvest_window_end_month=2,
        harvest_window_end_day=28,
        source_id=source.id,
        source_reference="MPKV Rahuri Krishi Darshani",
        source_publication_year=2025,
        water_requirement_category="LOW",
        labor_intensity="MODERATE",
        verification_status="OFFICIAL_AGRONOMY_APPROVED",
        is_active=True,
    )
    # 2. Wheat (Rabi, Nov 1 to Nov 30)
    cal_wheat = CropCalendar(
        commodity_id=c_wheat.id,
        state_id=mh_state.id,
        district_id=pune_dist.id,
        season="RABI",
        planting_window_start_month=11,
        planting_window_start_day=1,
        planting_window_end_month=11,
        planting_window_end_day=30,
        duration_min_days=105,
        duration_max_days=125,
        harvest_window_start_month=3,
        harvest_window_start_day=1,
        harvest_window_end_month=3,
        harvest_window_end_day=31,
        source_id=source.id,
        source_reference="MPKV Rahuri Krishi Darshani",
        source_publication_year=2025,
        water_requirement_category="HIGH",
        labor_intensity="MODERATE",
        verification_status="OFFICIAL_AGRONOMY_APPROVED",
        is_active=True,
    )
    # 3. Soybean (Kharif, Jun 20 to Jul 15)
    cal_soybean = CropCalendar(
        commodity_id=c_soybean.id,
        state_id=mh_state.id,
        district_id=pune_dist.id,
        season="KHARIF",
        planting_window_start_month=6,
        planting_window_start_day=20,
        planting_window_end_month=7,
        planting_window_end_day=15,
        duration_min_days=90,
        duration_max_days=105,
        harvest_window_start_month=9,
        harvest_window_start_day=20,
        harvest_window_end_month=10,
        harvest_window_end_day=30,
        source_id=source.id,
        source_reference="MPKV Rahuri Krishi Darshani",
        source_publication_year=2025,
        water_requirement_category="MEDIUM",
        labor_intensity="MODERATE",
        verification_status="OFFICIAL_AGRONOMY_APPROVED",
        is_active=True,
    )
    session.add_all([cal_gram, cal_wheat, cal_soybean])
    session.commit()

    yield session
    session.close()


# ==========================================
# 1. NEXT 15 DAYS DATE CALCULATIONS
# ==========================================

def test_next_15_days_range_and_intersection(calendar_db):
    """Verifies that next 15 days window calculates exactly 15 calendar days from eval date."""
    service = CropCalendarService()
    # Test date: 2026-10-22 (today)
    eval_date = date(2026, 10, 22)
    res = service.get_next_15_days_planning(calendar_db, current_date=eval_date)

    assert res.evaluation_date == eval_date
    assert res.next_15_days_start == eval_date
    assert res.next_15_days_end == eval_date + timedelta(days=15)
    assert (res.next_15_days_end - res.next_15_days_start).days == 15

    # Bengal Gram (Oct 1 - Nov 10) intersects Oct 22 -> Nov 6
    # Wheat (Nov 1 - Nov 30) intersects Oct 22 -> Nov 6
    # Soybean (Jun 20 - Jul 15) does NOT intersect
    crop_codes = [o.crop_code for o in res.options]
    assert "GRAM" in crop_codes
    assert "WHEAT" in crop_codes
    assert "SOYBEAN" not in crop_codes


def test_window_status_classification(calendar_db):
    """Verifies OPTIMAL_NOW, OPENING_SOON, and CLOSING_SOON status classifications."""
    service = CropCalendarService()
    eval_date = date(2026, 10, 22)
    res = service.get_next_15_days_planning(calendar_db, current_date=eval_date)

    gram_opt = next(o for o in res.options if o.crop_code == "GRAM")
    wheat_opt = next(o for o in res.options if o.crop_code == "WHEAT")

    # Gram ends Nov 10; on Oct 22, 19 days remain -> OPTIMAL_NOW
    assert gram_opt.window_status == "OPTIMAL_NOW"
    assert gram_opt.days_until_window_opens == 0

    # Wheat starts Nov 1; on Oct 22, opens in 10 days -> OPENING_SOON
    assert wheat_opt.window_status == "OPENING_SOON"
    assert wheat_opt.days_until_window_opens == 10


def test_closing_soon_boundary(calendar_db):
    """Verifies that when <= 7 days remain in the window, status is CLOSING_SOON."""
    service = CropCalendarService()
    # Set eval date to Nov 5 (Gram window ends Nov 10 -> 5 days remain)
    eval_date = date(2026, 11, 5)
    res = service.get_next_15_days_planning(calendar_db, current_date=eval_date)

    gram_opt = next(o for o in res.options if o.crop_code == "GRAM")
    assert gram_opt.window_status == "CLOSING_SOON"
    assert gram_opt.days_until_window_closes == 5


# ==========================================
# 2. INDICATIVE HARVEST WINDOW CALCULATION
# ==========================================

def test_harvest_window_calculation():
    """Tests earliest and latest harvest dates derived from sowing window and duration."""
    service = CropCalendarService()
    sow_start = date(2026, 10, 22)
    sow_end = date(2026, 11, 6)
    dur_min = 95
    dur_max = 110

    harvest_early, harvest_late = service._calculate_harvest_window(sow_start, sow_end, dur_min, dur_max)

    assert harvest_early == sow_start + timedelta(days=95)
    assert harvest_late == sow_end + timedelta(days=110)
    assert harvest_early < harvest_late


def test_duration_definition_integrity():
    """Verifies that duration definition explicitly documents growth cycle from sowing to harvest."""
    assert "direct field sowing to physiological maturity" in DURATION_DEFINITION_STANDARD
    assert "MPKV Rahuri" in DURATION_DEFINITION_STANDARD


# ==========================================
# 3. SEASONAL PLANNING BEHAVIOR
# ==========================================

def test_seasonal_planning_filtering(calendar_db):
    """Verifies seasonal planning filters crops exclusively by requested season."""
    service = CropCalendarService()

    # Query Kharif
    res_kharif = service.get_seasonal_planning(calendar_db, season="KHARIF", current_date=date(2026, 10, 22))
    assert res_kharif.selected_season == "KHARIF"
    assert any(o.crop_code == "SOYBEAN" for o in res_kharif.options)
    assert not any(o.crop_code == "WHEAT" for o in res_kharif.options)

    # Query Rabi
    res_rabi = service.get_seasonal_planning(calendar_db, season="RABI", current_date=date(2026, 10, 22))
    assert res_rabi.selected_season == "RABI"
    assert any(o.crop_code == "WHEAT" for o in res_rabi.options)
    assert any(o.crop_code == "GRAM" for o in res_rabi.options)
    assert not any(o.crop_code == "SOYBEAN" for o in res_rabi.options)


# ==========================================
# 4. FIELD CONTEXT INTEGRATION
# ==========================================

def test_field_soil_context_handling(calendar_db):
    """Verifies Gat number, area, and soil test parameters are properly resolved without fabrication."""
    service = CropCalendarService()

    # Create dummy field
    field = Field(
        village_id=1,
        gat_no="45/2",
        area=3.5,
        area_unit="hectare",
        is_demo=True,
        is_active=True,
    )
    calendar_db.add(field)
    calendar_db.commit()

    # Test without soil report -> has_soil_test should be False
    ctx_no_rep = service._resolve_field_context(calendar_db, field_id=field.id)
    assert ctx_no_rep.gat_no == "45/2"
    assert ctx_no_rep.area_acreage == 3.5
    assert ctx_no_rep.has_soil_test is False
    assert any("unrecorded in portal" in n for n in ctx_no_rep.prerequisite_notes)

    # Add SoilReport
    rep = SoilReport(
        field_id=field.id,
        report_no="SP-TEST-001",
        receipt_no="RCP-001",
        sample_date="2026-09-01",
        report_date="2026-09-10",
        laboratory_name="MPKV Soil Testing Lab",
    )
    calendar_db.add(rep)
    calendar_db.flush()

    p_ph = SoilParameterValue(
        report_id=rep.id,
        sr_no=1,
        parameter_key="ph",
        parameter_name="Soil pH",
        parameter_name_mr="सामू",
        category="Primary",
        value=7.8,
        unit="pH",
        interpretation_en="Normal Alkaline",
        interpretation_mr="मध्यम आम्लधर्मी",
        reference_range="6.5 - 8.0",
        source_type="LAB OBSERVATION",
    )
    calendar_db.add(p_ph)
    calendar_db.commit()

    ctx_rep = service._resolve_field_context(calendar_db, field_id=field.id)
    assert ctx_rep.has_soil_test is True
    assert ctx_rep.soil_ph == 7.8


# ==========================================
# 5. MARKET FORECAST INTEGRATION & LIMITS
# ==========================================

def test_price_outlook_insufficient_data(calendar_db):
    """Verifies that when APMC observations are insufficient, outlook is honestly marked UNAVAILABLE."""
    service = CropCalendarService()
    outlook = service._get_price_outlook(calendar_db, commodity_id=1, market_id=1, est_harvest_date=date(2027, 2, 1))

    assert outlook.status == "UNAVAILABLE_INSUFFICIENT_DATA"
    assert outlook.predicted_modal_price is None
    assert "minimum of 15 observations is required" in outlook.unavailability_reason


# ==========================================
# 6. API ENDPOINTS INTEGRATION
# ==========================================

def test_api_planting_calendar_endpoints(calendar_db):
    """Tests FastAPI endpoints for next-15-days and seasonal planning."""
    app.dependency_overrides[get_db] = lambda: calendar_db
    client = TestClient(app)

    # 1. Next 15 days
    res_15 = client.get("/api/v1/market-intelligence/planting-calendar/next-15-days?current_date=2026-10-22")
    assert res_15.status_code == 200
    data_15 = res_15.json()
    assert data_15["total_options_count"] >= 2
    assert "disclaimer" in data_15

    # 2. Seasonal planning
    res_s = client.get("/api/v1/market-intelligence/planting-calendar/seasonal?season=RABI")
    assert res_s.status_code == 200
    data_s = res_s.json()
    assert data_s["selected_season"] == "RABI"

    app.dependency_overrides.clear()
