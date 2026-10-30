"""Unit and Integration Tests for Market Price Forecasting Engine.
SoilPilot Phase 6: Time-Series Forecasting & Walk-Forward Backtesting.

All test inputs are synthetic test fixtures explicitly labeled as TEST DATA.
Covers:
1. Chronological dataset preparation, sorting, and deduplication.
2. Missing dates and reporting gap detection (> 3 days).
3. Exclusion of invalid, inactive, and zero-price records.
4. Prevention of lookahead bias / strict training cutoff date.
5. Baseline forecast calculations (Naive, Moving Average, Drift).
6. Holt's Linear Exponential Smoothing parameter optimization.
7. Rolling-origin walk-forward chronological backtesting.
8. Evaluation metrics calculation (MAE, RMSE, MAPE, MASE).
9. Best model selection vs Naive baseline.
10. Uncertainty interval validation (0 <= lower <= predicted <= upper).
11. Insufficient data responses (N < 15 -> UNAVAILABLE_INSUFFICIENT_DATA).
12. Forecast persistence and auditability in PriceForecast database table.
13. API endpoint validation and responses.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional
import pytest
import numpy as np
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.geography import State, District, Taluka
from app.models.market_intelligence import (
    DataSourceRegistry,
    Commodity,
    MarketApmc,
    MarketPriceObservation,
    PriceForecast,
)
from app.services.market_forecasting_service import (
    MarketForecastingEngine,
    DISCLAIMER_PHASE_6,
)


@pytest.fixture(scope="function")
def forecast_db():
    """Create an isolated in-memory SQLite database session with seeded geography, commodities, and markets."""
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
        code="TEST_AGMARKNET",
        name="Agmarknet Portal (Test Fixture)",
        source_type="GOVERNMENT_PORTAL",
        official_url="https://agmarknet.gov.in",
        operational_status="ACTIVE",
        is_active=True,
    )
    session.add(source)
    session.flush()

    # Seed commodities
    soybean = Commodity(
        id=1,
        code="SOYBEAN",
        name="Soybean",
        name_mr="सोयाबीन",
        category="OILSEEDS",
        standard_unit="QUINTAL",
        crop_duration_min_days=90,
        crop_duration_max_days=110,
        is_active=True,
    )
    onion = Commodity(
        id=2,
        code="ONION",
        name="Onion",
        name_mr="कांदा",
        category="VEGETABLES",
        standard_unit="QUINTAL",
        crop_duration_min_days=120,
        crop_duration_max_days=150,
        is_active=True,
    )
    session.add_all([soybean, onion])
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
    session.commit()

    yield session
    session.close()


def add_test_obs(
    db: Session,
    commodity_id: int,
    market_id: int,
    obs_date: date,
    modal: float,
    min_p: Optional[float] = None,
    max_p: Optional[float] = None,
    validation_status: str = "VERIFIED",
    is_active: bool = True,
    arrival: float = 25.0,
):
    """Helper to populate isolated synthetic observations for testing."""
    if min_p is None:
        min_p = modal - 150.0
    if max_p is None:
        max_p = modal + 150.0

    obs = MarketPriceObservation(
        commodity_id=commodity_id,
        market_id=market_id,
        source_id=1,
        source_record_id=f"TEST_{obs_date}_{modal}",
        observation_date=obs_date,
        retrieval_timestamp=datetime.now(timezone.utc),
        min_price=min_p,
        modal_price=modal,
        max_price=max_p,
        arrival_quantity=arrival,
        arrival_unit="TONNE",
        currency="INR",
        price_unit="RS_PER_QUINTAL",
        validation_status=validation_status,
        is_active=is_active,
    )
    db.add(obs)
    db.commit()


# ==========================================
# 1. DATASET PREPARATION & TIME ORDERING
# ==========================================

def test_dataset_preparation_chronological_ordering(forecast_db):
    """Verifies dataset preparation sorts observations ascending and deduplicates on date."""
    # Insert in scrambled chronological order
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 15), 4400.0)
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 10), 4300.0)
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 20), 4500.0)
    # Duplicate on 2026-10-15 with higher arrival
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 15), 4420.0, arrival=80.0)

    engine = MarketForecastingEngine(forecast_db)
    observations, quality = engine.prepare_dataset(commodity_id=1, market_id=1)

    assert len(observations) == 3
    # Strict chronological order
    assert observations[0].observation_date == date(2026, 10, 10)
    assert observations[1].observation_date == date(2026, 10, 15)
    assert observations[2].observation_date == date(2026, 10, 20)
    # Deduplication preserved the higher arrival record
    assert float(observations[1].modal_price) == 4420.0


def test_missing_dates_and_reporting_gaps(forecast_db):
    """Verifies gap detection tallies reporting intervals exceeding 3 days."""
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 1), 4000.0)
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 3), 4050.0)  # gap = 2d (OK)
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 12), 4150.0)  # gap = 9d (> 3d)
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 20), 4250.0)  # gap = 8d (> 3d)

    engine = MarketForecastingEngine(forecast_db)
    _, quality = engine.prepare_dataset(commodity_id=1, market_id=1)

    assert quality.reporting_gaps_count == 2
    assert any("Irregular reporting detected" in w for w in quality.quality_warnings)


def test_duplicate_and_invalid_records_exclusion(forecast_db):
    """Verifies invalid or inactive records are excluded from training."""
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 1), 4000.0, validation_status="VERIFIED")
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 2), 4050.0, validation_status="INVALID")
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 3), 4100.0, is_active=False)
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 4), 4150.0, validation_status="VALID")

    engine = MarketForecastingEngine(forecast_db)
    observations, quality = engine.prepare_dataset(commodity_id=1, market_id=1)

    assert len(observations) == 2
    dates = [o.observation_date for o in observations]
    assert date(2026, 10, 1) in dates
    assert date(2026, 10, 4) in dates
    assert date(2026, 10, 2) not in dates
    assert date(2026, 10, 3) not in dates


# ==========================================
# 2. CHRONOLOGICAL SEPARATION & LEAKAGE
# ==========================================

def test_train_test_chronological_separation_and_leakage_prevention(forecast_db):
    """Verifies future observations after training cutoff date are never included."""
    base_date = date(2026, 9, 1)
    for i in range(20):
        d = base_date + timedelta(days=i)
        add_test_obs(forecast_db, 1, 1, d, 4000.0 + (i * 20.0))

    engine = MarketForecastingEngine(forecast_db)
    cutoff = date(2026, 9, 10)  # Only first 10 days should be in training
    observations, quality = engine.prepare_dataset(commodity_id=1, market_id=1, cutoff_date=cutoff)

    assert len(observations) == 10
    assert quality.training_cutoff_date == cutoff
    assert max(o.observation_date for o in observations) <= cutoff


# ==========================================
# 3. BASELINES & MODEL MATHEMATICS
# ==========================================

def test_baseline_calculations():
    """Tests Naive, Moving Average, and Drift baseline calculations."""
    y = np.array([4000.0, 4050.0, 4100.0, 4150.0, 4200.0])

    # 1. Naive: projects last observed value
    naive_pred = MarketForecastingEngine.forecast_naive(y, horizon_steps=5)
    assert naive_pred == 4200.0

    # 2. Moving Average: mean of last 3 points
    sma_pred = MarketForecastingEngine.forecast_moving_average(y, horizon_steps=5, window=3)
    assert sma_pred == round((4100.0 + 4150.0 + 4200.0) / 3, 2)

    # 3. Drift: y[-1] + h * ((y[-1] - y[0]) / (n - 1))
    # slope = (4200 - 4000) / 4 = 50.0 per step. For h=2 -> 4200 + 2*50 = 4300.0
    drift_pred = MarketForecastingEngine.forecast_drift(y, horizon_steps=2)
    assert drift_pred == 4300.0


def test_holt_exponential_smoothing_optimization():
    """Verifies Holt's Exponential Smoothing fits level/trend and grid-searches alpha/beta."""
    # Linear upward trend series
    y = np.array([4000.0 + 20.0 * i for i in range(15)])

    pred, alpha, beta = MarketForecastingEngine.forecast_holt(y, horizon_steps=3)
    assert pred > y[-1]
    assert 0.0 < alpha <= 1.0
    assert 0.0 < beta <= 1.0


# ==========================================
# 4. WALK-FORWARD BACKTEST & METRICS
# ==========================================

def test_walk_forward_backtest_metrics():
    """Verifies walk-forward evaluation produces valid MAE, RMSE, MAPE, MASE on held-out steps."""
    y = np.array([
        4000, 4020, 4050, 4030, 4070, 4090, 4120, 4110, 4150, 4180,
        4200, 4220, 4250, 4240, 4280, 4300, 4320, 4350, 4380, 4400
    ], dtype=float)

    session_mock = None
    engine = MarketForecastingEngine(session_mock)
    results = engine.perform_walk_forward_backtest(y, horizon_steps=1)

    assert "NAIVE_LAST_OBSERVATION" in results
    assert "MOVING_AVERAGE" in results
    assert "DRIFT_TREND" in results
    assert "HOLT_LINEAR_EXPONENTIAL_SMOOTHING" in results

    naive_metrics = results["NAIVE_LAST_OBSERVATION"]
    assert naive_metrics["mae"] > 0
    assert naive_metrics["rmse"] >= naive_metrics["mae"]  # RMSE is always >= MAE
    assert naive_metrics["sample_size"] == 10  # 20 - 10 initial window


def test_model_selection_rule(forecast_db):
    """Verifies that the best model is selected based on out-of-sample MAE."""
    base_date = date(2026, 8, 1)
    # Generate 20 daily observations with steady positive drift
    for i in range(20):
        d = base_date + timedelta(days=i)
        add_test_obs(forecast_db, 1, 1, d, 4000.0 + (i * 25.0))

    engine = MarketForecastingEngine(forecast_db)
    res = engine.generate_forecast(commodity_id=1, market_id=1, horizon_days=30, persist=True)

    assert res.status in ("PUBLISHED", "EXPERIMENTAL")
    assert res.predicted_modal_price is not None
    assert len(res.candidate_models) == 4

    # Selected model must be the one with lowest MAE
    selected = next(m for m in res.candidate_models if m.is_selected)
    min_mae = min(m.mae for m in res.candidate_models)
    assert selected.mae == min_mae


# ==========================================
# 5. UNCERTAINTY INTERVALS
# ==========================================

def test_uncertainty_interval_validation(forecast_db):
    """Verifies 0 <= lower_bound <= predicted_price <= upper_bound."""
    base_date = date(2026, 8, 1)
    for i in range(20):
        d = base_date + timedelta(days=i)
        add_test_obs(forecast_db, 1, 1, d, 4000.0 + (i * 15.0) + (10 if i % 2 == 0 else -10))

    engine = MarketForecastingEngine(forecast_db)
    res = engine.generate_forecast(commodity_id=1, market_id=1, horizon_days=30, persist=True)

    assert res.predicted_modal_price is not None
    assert res.lower_uncertainty_bound is not None
    assert res.upper_uncertainty_bound is not None
    assert 0.0 <= res.lower_uncertainty_bound <= res.predicted_modal_price <= res.upper_uncertainty_bound


# ==========================================
# 6. INSUFFICIENT DATA & EMPTY RESPONSES
# ==========================================

def test_insufficient_data_response(forecast_db):
    """Verifies that N < 15 returns explicit UNAVAILABLE_INSUFFICIENT_DATA and None prices."""
    # Only 4 observations inserted
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 1), 4000.0)
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 2), 4050.0)
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 3), 4100.0)
    add_test_obs(forecast_db, 1, 1, date(2026, 10, 4), 4150.0)

    engine = MarketForecastingEngine(forecast_db)
    res = engine.generate_forecast(commodity_id=1, market_id=1, horizon_days=30, persist=False)

    assert res.status == "UNAVAILABLE_INSUFFICIENT_DATA"
    assert res.predicted_modal_price is None
    assert res.lower_uncertainty_bound is None
    assert res.upper_uncertainty_bound is None
    assert "minimum of 15 observations is required" in res.unavailability_reason
    assert res.data_quality.is_sufficient is False


# ==========================================
# 7. FORECAST PERSISTENCE & VERSIONING
# ==========================================

def test_forecast_persistence_and_versioning(forecast_db):
    """Verifies that generated forecasts are stored in the PriceForecast table with audit trail."""
    base_date = date(2026, 8, 1)
    for i in range(18):
        d = base_date + timedelta(days=i)
        add_test_obs(forecast_db, 1, 1, d, 4200.0 + (i * 10.0))

    engine = MarketForecastingEngine(forecast_db)
    res = engine.generate_forecast(commodity_id=1, market_id=1, horizon_days=30, persist=True)

    # Query database
    forecast_rec = (
        forecast_db.query(PriceForecast)
        .filter(
            PriceForecast.commodity_id == 1,
            PriceForecast.market_id == 1,
            PriceForecast.forecast_horizon_days == 30,
        )
        .first()
    )

    assert forecast_rec is not None
    assert forecast_rec.model_version == "v1.0.0"
    assert forecast_rec.model_identifier == res.model_identifier
    assert float(forecast_rec.predicted_modal_price) == res.predicted_modal_price
    assert forecast_rec.currency == "INR"
    assert forecast_rec.price_unit == "RS_PER_QUINTAL"
    assert forecast_rec.training_data_cutoff_date is not None


# ==========================================
# 8. API INTEGRATION TESTS
# ==========================================

def test_api_forecasts_endpoints(forecast_db):
    """Tests GET /forecasts, POST /forecasts/generate, and GET /forecasts/models endpoints."""
    app.dependency_overrides[get_db] = lambda: forecast_db
    client = TestClient(app)

    # 1. Models transparency endpoint
    res_models = client.get("/api/v1/market-intelligence/forecasts/models")
    assert res_models.status_code == 200
    models_data = res_models.json()
    assert models_data["engine_version"] == "v1.0.0"
    assert len(models_data["candidate_algorithms"]) >= 4
    assert models_data["supported_price_unit"] == "RS_PER_QUINTAL"

    # 2. Forecasts query endpoint (Insufficient data scenario)
    res_fc = client.get("/api/v1/market-intelligence/forecasts?commodity_id=1&market_id=1&horizon_days=30")
    assert res_fc.status_code == 200
    fc_data = res_fc.json()
    assert fc_data["status"] == "UNAVAILABLE_INSUFFICIENT_DATA"
    assert fc_data["predicted_modal_price"] is None
    assert "disclaimer" in fc_data

    # 3. Generate forecast via POST
    post_payload = {
        "commodity_id": 1,
        "market_id": 1,
        "horizon_days": 30,
    }
    res_post = client.post("/api/v1/market-intelligence/forecasts/generate", json=post_payload)
    assert res_post.status_code == 200

    app.dependency_overrides.clear()
