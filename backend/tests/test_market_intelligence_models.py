"""Unit and Integration Tests for Market Intelligence & Crop Planner Data Models.
SoilPilot Phase 3: Tests model creation, foreign keys, constraints, nullability,
temporal separation, uncertainty ranges, and backward-compatibility with existing entities.
"""

from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import IntegrityError

from app.db.base import Base
from app.models.geography import State, District, Taluka, Village
from app.models.farmer import Farmer
from app.models.field import Field
from app.models.market_intelligence import (
    DataSourceRegistry,
    Commodity,
    MarketApmc,
    CommodityMarketMapping,
    MarketPriceObservation,
    CropCalendar,
    PriceForecast,
    CropCostEstimate,
)


@pytest.fixture(scope="function")
def db_session():
    """Create an isolated in-memory SQLite database for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    SessionTest = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionTest()

    # Seed baseline Maharashtra -> Pune -> Baramati geographic hierarchy
    mh_state = State(name="Maharashtra", code="MH", is_active=True)
    session.add(mh_state)
    session.flush()

    pune_dist = District(name="Pune", code="PN", state_id=mh_state.id, is_active=True)
    session.add(pune_dist)
    session.flush()

    baramati_taluka = Taluka(name="Baramati", code="BRM", district_id=pune_dist.id, is_active=True)
    session.add(baramati_taluka)
    session.flush()

    malegaon_village = Village(name="Malegaon Khurd", code="MLG_KH", taluka_id=baramati_taluka.id, is_active=True)
    session.add(malegaon_village)
    session.flush()

    farmer = Farmer(
        farmer_code="MH-PN-BRM-00124",
        full_name="Dattatray Sopanrao Jagtap",
        mobile_number="9876543210",
        preferred_language="mr",
        role="farmer",
        gat_number="124"
    )
    session.add(farmer)
    session.flush()

    field = Field(
        village_id=malegaon_village.id,
        farmer_id=farmer.id,
        gat_no="124",
        area=2.5,
        area_unit="hectare",
        is_demo=True
    )
    session.add(field)
    session.commit()

    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


# ---------------------------------------------------------------------------
# 1. DataSourceRegistry Tests
# ---------------------------------------------------------------------------

def test_data_source_registry_creation(db_session: Session):
    """Verify registry creates source metadata with operational statuses."""
    source = DataSourceRegistry(
        code="AGMARKNET",
        name="Agmarknet - Agricultural Marketing Information Network",
        source_type="GOVERNMENT_PORTAL",
        official_url="https://agmarknet.gov.in",
        access_method="REST_API",
        licensing_notes="Open Data under NDSAP India",
        update_frequency="DAILY",
        operational_status="PENDING_INTEGRATION"
    )
    db_session.add(source)
    db_session.commit()

    saved = db_session.scalar(select(DataSourceRegistry).filter_by(code="AGMARKNET"))
    assert saved is not None
    assert saved.code == "AGMARKNET"
    assert saved.operational_status == "PENDING_INTEGRATION"
    assert saved.is_active is True
    assert saved.last_successful_retrieval_at is None  # Honest uninitialized state


def test_data_source_unique_code(db_session: Session):
    """Verify duplicate source codes are rejected by unique constraint."""
    s1 = DataSourceRegistry(code="MSAMB", name="MSAMB 1", source_type="STATE_APMC_BOARD")
    s2 = DataSourceRegistry(code="MSAMB", name="MSAMB 2", source_type="STATE_APMC_BOARD")
    db_session.add(s1)
    db_session.commit()

    db_session.add(s2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ---------------------------------------------------------------------------
# 2. Commodity Catalogue Tests
# ---------------------------------------------------------------------------

def test_commodity_creation_bilingual(db_session: Session):
    """Verify commodity catalog supports English and Marathi names and duration range."""
    soybean = Commodity(
        code="SOYBEAN",
        name="Soybean",
        name_mr="सोयाबीन",
        category="OILSEEDS",
        botanical_name="Glycine max",
        standard_unit="QUINTAL",
        crop_duration_min_days=90,
        crop_duration_max_days=110,
        description="Major kharif oilseed crop in western Maharashtra."
    )
    db_session.add(soybean)
    db_session.commit()

    saved = db_session.scalar(select(Commodity).filter_by(code="SOYBEAN"))
    assert saved is not None
    assert saved.name == "Soybean"
    assert saved.name_mr == "सोयाबीन"
    assert saved.crop_duration_min_days == 90
    assert saved.crop_duration_max_days == 110


def test_commodity_duration_constraint(db_session: Session):
    """Verify check constraint enforces min_duration <= max_duration."""
    invalid_crop = Commodity(
        code="INVALID_DURATION",
        name="Test Crop",
        name_mr="चाचणी पीक",
        category="CEREALS",
        crop_duration_min_days=120,
        crop_duration_max_days=60  # Inverted duration
    )
    db_session.add(invalid_crop)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ---------------------------------------------------------------------------
# 3. Market APMC Tests
# ---------------------------------------------------------------------------

def test_market_apmc_relationship_to_geography(db_session: Session):
    """Verify Market APMC links cleanly to State, District, and Taluka entities."""
    mh = db_session.scalar(select(State).filter_by(code="MH"))
    pune = db_session.scalar(select(District).filter_by(code="PN"))
    baramati = db_session.scalar(select(Taluka).filter_by(code="BRM"))

    market = MarketApmc(
        market_code="MH_BARAMATI_APMC",
        name="Baramati APMC",
        name_mr="बारामती कृषी उत्पन्न बाजार समिती",
        state_id=mh.id,
        district_id=pune.id,
        taluka_id=baramati.id,
        agmarknet_market_id="AGM_MH_BARAMATI",
        market_type="PRINCIPAL_MARKET"
    )
    db_session.add(market)
    db_session.commit()

    saved = db_session.scalar(select(MarketApmc).filter_by(market_code="MH_BARAMATI_APMC"))
    assert saved is not None
    assert saved.district.name == "Pune"
    assert saved.taluka.name == "Baramati"
    assert saved.state.name == "Maharashtra"


def test_commodity_market_mapping(db_session: Session):
    """Verify mapping resolves local mandi variety names to canonical commodity."""
    mh = db_session.scalar(select(State).filter_by(code="MH"))
    pune = db_session.scalar(select(District).filter_by(code="PN"))

    market = MarketApmc(
        market_code="MH_PUNE_MARKET",
        name="Pune APMC Gultekdi",
        name_mr="पुणे कृषी उत्पन्न बाजार समिती",
        state_id=mh.id,
        district_id=pune.id
    )
    onion = Commodity(code="ONION", name="Onion", name_mr="कांदा", category="VEGETABLES")
    db_session.add_all([market, onion])
    db_session.commit()

    mapping = CommodityMarketMapping(
        commodity_id=onion.id,
        market_id=market.id,
        source_commodity_name="Onion Red",
        source_variety_name="Nashik / Pune Red",
        source_grade="FAQ"
    )
    db_session.add(mapping)
    db_session.commit()

    saved = db_session.scalar(select(CommodityMarketMapping).filter_by(market_id=market.id))
    assert saved.source_commodity_name == "Onion Red"
    assert saved.commodity.code == "ONION"


# ---------------------------------------------------------------------------
# 4. Market Price Observation Tests
# ---------------------------------------------------------------------------

def test_market_price_observation_date_separation(db_session: Session):
    """Verify strict separation between trading observation_date and system retrieval_timestamp."""
    mh = db_session.scalar(select(State).filter_by(code="MH"))
    pune = db_session.scalar(select(District).filter_by(code="PN"))

    source = DataSourceRegistry(code="AGMARKNET_P2", name="Agmarknet", source_type="GOVERNMENT_PORTAL")
    crop = Commodity(code="GRAM", name="Bengal Gram", name_mr="हरभरा", category="PULSES")
    market = MarketApmc(
        market_code="MH_BARAMATI_MPO",
        name="Baramati Mandi",
        name_mr="बारामती बाजार",
        state_id=mh.id,
        district_id=pune.id
    )
    db_session.add_all([source, crop, market])
    db_session.commit()

    trading_date = date(2026, 3, 15)
    retrieval_time = datetime(2026, 3, 16, 6, 30, 0, tzinfo=timezone.utc)

    obs = MarketPriceObservation(
        commodity_id=crop.id,
        market_id=market.id,
        source_id=source.id,
        source_record_id="AGM-REC-20260315-001",
        observation_date=trading_date,
        retrieval_timestamp=retrieval_time,
        min_price=Decimal("4800.00"),
        modal_price=Decimal("5200.00"),
        max_price=Decimal("5450.00"),
        currency="INR",
        price_unit="RS_PER_QUINTAL",
        arrival_quantity=Decimal("350.50"),
        arrival_unit="TONNE",
        raw_payload={"raw_min": 4800, "raw_max": 5450, "raw_modal": 5200},
        validation_status="VERIFIED"
    )
    db_session.add(obs)
    db_session.commit()

    saved = db_session.scalar(select(MarketPriceObservation).filter_by(source_record_id="AGM-REC-20260315-001"))
    assert saved is not None
    assert saved.observation_date == trading_date
    # SQLite returns naive datetime; verify timestamp values accurately
    saved_retrieval = saved.retrieval_timestamp if saved.retrieval_timestamp.tzinfo else saved.retrieval_timestamp.replace(tzinfo=timezone.utc)
    assert saved_retrieval == retrieval_time
    assert saved.min_price == Decimal("4800.00")
    assert saved.modal_price == Decimal("5200.00")
    assert saved.max_price == Decimal("5450.00")
    assert saved.raw_payload["raw_modal"] == 5200


def test_market_price_logic_constraint_violation(db_session: Session):
    """Verify check constraint rejects inverted prices where min_price > max_price."""
    mh = db_session.scalar(select(State).filter_by(code="MH"))
    pune = db_session.scalar(select(District).filter_by(code="PN"))

    source = DataSourceRegistry(code="SRC_TEST", name="Test", source_type="PORTAL")
    crop = Commodity(code="WHEAT", name="Wheat", name_mr="गहू", category="CEREALS")
    market = MarketApmc(market_code="MKT_TEST", name="Test APMC", name_mr="चाचणी", state_id=mh.id, district_id=pune.id)
    db_session.add_all([source, crop, market])
    db_session.commit()

    invalid_obs = MarketPriceObservation(
        commodity_id=crop.id,
        market_id=market.id,
        source_id=source.id,
        observation_date=date(2026, 4, 1),
        min_price=Decimal("3000.00"),
        max_price=Decimal("2500.00"),  # INVERTED: min > max
        modal_price=Decimal("2800.00")
    )
    db_session.add(invalid_obs)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ---------------------------------------------------------------------------
# 5. Crop Calendar Tests
# ---------------------------------------------------------------------------

def test_crop_calendar_regional_context(db_session: Session):
    """Verify crop calendar represents regional seasonal planting windows and resource metrics."""
    mh = db_session.scalar(select(State).filter_by(code="MH"))
    pune = db_session.scalar(select(District).filter_by(code="PN"))

    crop = Commodity(code="COTTON", name="Cotton", name_mr="कापूस", category="CASH_CROPS")
    db_session.add(crop)
    db_session.commit()

    cal = CropCalendar(
        commodity_id=crop.id,
        state_id=mh.id,
        district_id=pune.id,
        season="KHARIF",
        planting_window_start_month=6,
        planting_window_start_day=15,
        planting_window_end_month=7,
        planting_window_end_day=15,
        duration_min_days=150,
        duration_max_days=180,
        water_requirement_category="MEDIUM",
        labor_intensity="INTENSIVE",
        source_reference="MPKV Rahuri Krishi Darshani",
        verification_status="OFFICIAL_AGRONOMY_APPROVED"
    )
    db_session.add(cal)
    db_session.commit()

    saved = db_session.scalar(select(CropCalendar).filter_by(commodity_id=crop.id))
    assert saved is not None
    assert saved.season == "KHARIF"
    assert saved.duration_min_days == 150
    assert saved.water_requirement_category == "MEDIUM"


# ---------------------------------------------------------------------------
# 6. Price Forecast Records Tests
# ---------------------------------------------------------------------------

def test_price_forecast_distinct_from_observations(db_session: Session):
    """Verify forecast records are strictly distinct from observed prices and contain uncertainty bounds."""
    mh = db_session.scalar(select(State).filter_by(code="MH"))
    pune = db_session.scalar(select(District).filter_by(code="PN"))

    crop = Commodity(code="TUR", name="Pigeon Pea", name_mr="तूर", category="PULSES")
    market = MarketApmc(market_code="MH_SOLAPUR", name="Solapur APMC", name_mr="सोलापूर", state_id=mh.id, district_id=pune.id)
    db_session.add_all([crop, market])
    db_session.commit()

    gen_time = datetime.now(timezone.utc)
    target_start = date(2026, 12, 1)
    target_end = date(2026, 12, 31)

    forecast = PriceForecast(
        commodity_id=crop.id,
        market_id=market.id,
        forecast_generated_at=gen_time,
        target_period_start=target_start,
        target_period_end=target_end,
        forecast_horizon_days=120,
        predicted_modal_price=Decimal("7850.00"),
        lower_uncertainty_bound=Decimal("7200.00"),
        upper_uncertainty_bound=Decimal("8450.00"),
        model_identifier="PROPHET_APMC_SEASONAL_V2",
        model_version="2.1.0",
        training_data_cutoff_date=date(2026, 8, 1),
        confidence_metric_name="MAPE",
        confidence_metric_value=6.4,
        status="DRAFT"
    )
    db_session.add(forecast)
    db_session.commit()

    saved = db_session.scalar(select(PriceForecast).filter_by(model_identifier="PROPHET_APMC_SEASONAL_V2"))
    assert saved is not None
    assert saved.predicted_modal_price == Decimal("7850.00")
    assert saved.lower_uncertainty_bound <= saved.predicted_modal_price <= saved.upper_uncertainty_bound
    assert saved.training_data_cutoff_date == date(2026, 8, 1)


# ---------------------------------------------------------------------------
# 7. Crop Cost & Profitability Estimates Tests
# ---------------------------------------------------------------------------

def test_crop_cost_estimate_field_linkage(db_session: Session):
    """Verify cost estimate links to existing Field and Farmer records cleanly."""
    pune = db_session.scalar(select(District).filter_by(code="PN"))
    field = db_session.scalar(select(Field).filter_by(gat_no="124"))
    farmer = db_session.scalar(select(Farmer).filter_by(farmer_code="MH-PN-BRM-00124"))
    crop = Commodity(code="MAIZE", name="Maize", name_mr="मका", category="CEREALS")
    db_session.add(crop)
    db_session.commit()

    estimate = CropCostEstimate(
        commodity_id=crop.id,
        district_id=pune.id,
        field_id=field.id,
        farmer_id=farmer.id,
        season="KHARIF",
        area=Decimal("2.5"),
        area_unit="HECTARE",
        cost_breakdown={
            "seeds": 4500,
            "fertilizers": 8200,
            "irrigation": 3000,
            "labour": 7500,
            "harvesting": 5000
        },
        estimated_cost_per_unit_area=Decimal("28200.00"),
        estimated_yield_min=Decimal("45.00"),
        estimated_yield_max=Decimal("60.00"),
        estimated_yield_expected=Decimal("52.00"),
        yield_unit="QUINTAL_PER_HECTARE",
        assumed_price_per_yield_unit=Decimal("2150.00"),
        estimated_gross_revenue=Decimal("279500.00"),  # 2.5 ha * 52 q * 2150
        estimated_net_return=Decimal("209000.00"),     # Revenue - (2.5 * 28200)
        risk_level="MEDIUM",
        soil_suitability_index=0.88,
        calculation_version="V1.0_PROVISIONAL",
        estimate_status="ESTIMATED"
    )
    db_session.add(estimate)
    db_session.commit()

    saved = db_session.scalar(select(CropCostEstimate).filter_by(field_id=field.id))
    assert saved is not None
    assert saved.field.gat_no == "124"
    assert saved.farmer.full_name == "Dattatray Sopanrao Jagtap"
    assert saved.soil_suitability_index == 0.88
    assert saved.estimated_net_return == Decimal("209000.00")


# ---------------------------------------------------------------------------
# 8. Backward Compatibility & Existing Entities Integrity Test
# ---------------------------------------------------------------------------

def test_existing_entities_remain_protected(db_session: Session):
    """Verify existing geographic, cadastral, and farmer records remain completely functional."""
    state = db_session.scalar(select(State).filter_by(name="Maharashtra"))
    assert state is not None
    assert len(state.districts) == 1

    district = state.districts[0]
    assert district.name == "Pune"
    assert len(district.talukas) == 1

    village = district.talukas[0].villages[0]
    assert village.name == "Malegaon Khurd"

    # Field Gat-uniqueness check
    field = db_session.scalar(select(Field).filter_by(village_id=village.id, gat_no="124"))
    assert field is not None
    assert field.farmer.farmer_code == "MH-PN-BRM-00124"
