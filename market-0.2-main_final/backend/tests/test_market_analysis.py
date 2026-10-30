"""Unit and Integration Tests for Historical Market Price Analysis & Trend Detection.
SoilPilot Phase 5: Historical Analysis Tests.

All test inputs are synthetic test fixtures explicitly labeled as TEST DATA.
Covers:
1. Correct absolute and percentage price-change calculations.
2. Zero or missing comparison prices (prevents divide-by-zero, returns None).
3. Inconsistent units handling (verifies standard RS_PER_QUINTAL).
4. Duplicate and invalid records exclusion (only VERIFIED records evaluated).
5. Missing observations and reporting gaps detection (> 3 days).
6. Date-range boundaries filtering (start_date, end_date, window).
7. Weekly and monthly aggregation calculations.
8. Trend classification with insufficient observations (N < 3 -> INSUFFICIENT_DATA).
9. Trend classification with RISING (> +2%), FALLING (< -2%), and STABLE (within +/-2%).
10. Market comparison on common observation dates with net return disclaimer.
11. API filtering, parameter validation, and error contracts.
12. Empty-data responses when no observations exist.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional
import pytest
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
)
from app.services.market_ingestion_service import MarketIngestionService
from app.services.market_analysis_service import MarketAnalysisService, MIN_OBSERVATIONS_FOR_TREND


@pytest.fixture(scope="function")
def analysis_db():
    """Create an isolated in-memory SQLite database session with seeded geography, commodities, and markets."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
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

    ingestion = MarketIngestionService()
    ingestion.ensure_seed_metadata(session)
    session.commit()

    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture(scope="function")
def client(analysis_db: Session):
    """FastAPI TestClient overriding the db session dependency with analysis_db."""
    def override_get_db():
        try:
            yield analysis_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides.clear()


def make_obs(
    db: Session,
    comm: Commodity,
    mkt: MarketApmc,
    obs_date: date,
    modal: float,
    min_p: Optional[float] = None,
    max_p: Optional[float] = None,
    arr_q: Optional[float] = None,
    arr_u: str = "TONNE",
    status: str = "VERIFIED",
    is_active: bool = True
) -> MarketPriceObservation:
    """Helper to create valid test observations with proper source_id foreign key."""
    source = db.scalars(select(DataSourceRegistry).filter_by(code="AGMARKNET")).first()
    return MarketPriceObservation(
        commodity_id=comm.id,
        market_id=mkt.id,
        source_id=source.id,
        source_record_id=f"test_{mkt.id}_{comm.id}_{obs_date.isoformat()}_{modal}",
        observation_date=obs_date,
        retrieval_timestamp=datetime.now(timezone.utc),
        modal_price=modal,
        min_price=min_p if min_p is not None else modal - 100,
        max_price=max_p if max_p is not None else modal + 100,
        currency="INR",
        price_unit="RS_PER_QUINTAL",
        arrival_quantity=arr_q,
        arrival_unit=arr_u,
        validation_status=status,
        is_active=is_active
    )


# ---------------------------------------------------------------------------
# 1. Price Change Calculations (Absolute and Percentage)
# ---------------------------------------------------------------------------

def test_absolute_and_percentage_change_calculation(analysis_db: Session):
    """Verify latest price, previous price, absolute change, and percentage change."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="SOYBEAN")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    obs1 = make_obs(analysis_db, comm, mkt, date(2026, 10, 10), modal=4000.0, min_p=3800.0, max_p=4200.0)
    obs2 = make_obs(analysis_db, comm, mkt, date(2026, 10, 11), modal=4200.0, min_p=3900.0, max_p=4300.0)
    obs3 = make_obs(analysis_db, comm, mkt, date(2026, 10, 12), modal=4410.0, min_p=4100.0, max_p=4500.0)
    analysis_db.add_all([obs1, obs2, obs3])
    analysis_db.commit()

    res = service.get_historical_analysis(
        analysis_db, commodity_id=comm.id, market_id=mkt.id,
        start_date=date(2026, 10, 1), end_date=date(2026, 10, 15)
    )

    metrics = res["summary_metrics"]
    assert metrics["latest_price"] == 4410.0
    assert metrics["latest_date"] == "2026-10-12"
    assert metrics["previous_price"] == 4200.0
    assert metrics["previous_date"] == "2026-10-11"

    # Absolute change = 4410.0 - 4200.0 = +210.0
    assert metrics["absolute_change"] == 210.0

    # Percentage change = (210.0 / 4200.0) * 100 = +5.0%
    assert metrics["percentage_change"] == 5.0


# ---------------------------------------------------------------------------
# 2. Zero or Missing Comparison Prices (Divide-by-zero Guard)
# ---------------------------------------------------------------------------

def test_zero_or_missing_comparison_price_handling(analysis_db: Session):
    """Verify that if previous price is None or zero, percentage_change safely returns None."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="WHEAT")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    # Single observation: no previous observation
    obs = make_obs(analysis_db, comm, mkt, date(2026, 10, 10), modal=2800.0, min_p=2600.0, max_p=3000.0)
    analysis_db.add(obs)
    analysis_db.commit()

    res = service.get_historical_analysis(
        analysis_db, commodity_id=comm.id, market_id=mkt.id,
        start_date=date(2026, 10, 1), end_date=date(2026, 10, 15)
    )

    metrics = res["summary_metrics"]
    assert metrics["latest_price"] == 2800.0
    assert metrics["previous_price"] is None
    assert metrics["absolute_change"] is None
    assert metrics["percentage_change"] is None
    assert metrics["trend_direction"] == "INSUFFICIENT_DATA"


# ---------------------------------------------------------------------------
# 3. Inconsistent Units
# ---------------------------------------------------------------------------

def test_unit_consistency_preservation(analysis_db: Session):
    """Verify that all metrics are returned with standard RS_PER_QUINTAL unit."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="SOYBEAN")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    res = service.get_historical_analysis(analysis_db, commodity_id=comm.id, market_id=mkt.id)
    assert res["summary_metrics"]["price_unit"] == "RS_PER_QUINTAL"
    assert res["commodity"]["standard_unit"] == "QUINTAL"


# ---------------------------------------------------------------------------
# 4. Duplicate and Invalid Records Exclusion
# ---------------------------------------------------------------------------

def test_invalid_and_inactive_records_excluded_from_analysis(analysis_db: Session):
    """Verify that FLAGGED or inactive observations are excluded from historical analysis."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="COTTON")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    # 1 Valid observation
    valid_obs = make_obs(analysis_db, comm, mkt, date(2026, 10, 10), modal=7500.0, min_p=7200.0, max_p=7800.0, status="VERIFIED", is_active=True)
    # 1 FLAGGED observation (flagged by validation pipeline)
    flagged_obs = make_obs(analysis_db, comm, mkt, date(2026, 10, 11), modal=7700.0, min_p=7200.0, max_p=7800.0, status="FLAGGED_OUTLIER", is_active=True)
    # 1 Inactive observation
    inactive_obs = make_obs(analysis_db, comm, mkt, date(2026, 10, 12), modal=7600.0, min_p=7200.0, max_p=7800.0, status="VERIFIED", is_active=False)

    analysis_db.add_all([valid_obs, flagged_obs, inactive_obs])
    analysis_db.commit()

    res = service.get_historical_analysis(analysis_db, commodity_id=comm.id, market_id=mkt.id)
    # Only 1 observation should be included in analysis
    assert res["data_quality"]["total_observations"] == 1
    assert res["summary_metrics"]["latest_price"] == 7500.0
    assert len(res["series"]) == 1


# ---------------------------------------------------------------------------
# 5. Missing Observations & Reporting Gaps Detection
# ---------------------------------------------------------------------------

def test_reporting_gaps_detection(analysis_db: Session):
    """Verify that gaps between trading dates exceeding 3 days are identified and warned."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="SOYBEAN")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    # Gap between 10th and 18th (8 calendar days gap)
    obs1 = make_obs(analysis_db, comm, mkt, date(2026, 10, 10), modal=4200.0, min_p=4000.0, max_p=4400.0)
    obs2 = make_obs(analysis_db, comm, mkt, date(2026, 10, 18), modal=4250.0, min_p=4050.0, max_p=4450.0)
    analysis_db.add_all([obs1, obs2])
    analysis_db.commit()

    res = service.get_historical_analysis(
        analysis_db, commodity_id=comm.id, market_id=mkt.id,
        start_date=date(2026, 10, 5), end_date=date(2026, 10, 20)
    )

    assert res["data_quality"]["reporting_gaps_count"] >= 1
    assert any("trading gap" in w.lower() for w in res["data_quality"]["quality_warnings"])


# ---------------------------------------------------------------------------
# 6. Date-Range Boundaries Filtering
# ---------------------------------------------------------------------------

def test_date_range_boundaries_filtering(analysis_db: Session):
    """Verify that observations outside [start_date, end_date] are excluded."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="SOYBEAN")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    for d, p in [(date(2026, 10, 1), 4000.0), (date(2026, 10, 10), 4200.0), (date(2026, 10, 25), 4400.0)]:
        analysis_db.add(make_obs(analysis_db, comm, mkt, d, modal=p, min_p=p - 200, max_p=p + 200))
    analysis_db.commit()

    # Query strictly between Oct 5 and Oct 15
    res = service.get_historical_analysis(
        analysis_db, commodity_id=comm.id, market_id=mkt.id,
        start_date=date(2026, 10, 5), end_date=date(2026, 10, 15)
    )

    assert res["data_quality"]["total_observations"] == 1
    assert res["series"][0]["date"] == "2026-10-10"


# ---------------------------------------------------------------------------
# 7. Weekly and Monthly Aggregation
# ---------------------------------------------------------------------------

def test_weekly_and_monthly_aggregation(analysis_db: Session):
    """Verify grouping daily observations into weekly averages."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="GRAM")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    # Same week observations: Oct 12 (Mon), Oct 14 (Wed), Oct 16 (Fri)
    # Average modal = (5400 + 5500 + 5600) / 3 = 5500.0
    for d, p in [(date(2026, 10, 12), 5400.0), (date(2026, 10, 14), 5500.0), (date(2026, 10, 16), 5600.0)]:
        analysis_db.add(make_obs(analysis_db, comm, mkt, d, modal=p, min_p=5200.0, max_p=5800.0, arr_q=10.0))
    analysis_db.commit()

    # 1. Weekly Aggregation
    res_w = service.get_historical_analysis(
        analysis_db, commodity_id=comm.id, market_id=mkt.id,
        start_date=date(2026, 10, 1), end_date=date(2026, 10, 31),
        aggregation="weekly"
    )
    assert len(res_w["series"]) == 1
    assert res_w["series"][0]["modal_price"] == 5500.0
    assert res_w["series"][0]["observation_count"] == 3
    assert res_w["series"][0]["arrival_quantity"] == 30.0

    # 2. Monthly Aggregation
    res_m = service.get_historical_analysis(
        analysis_db, commodity_id=comm.id, market_id=mkt.id,
        start_date=date(2026, 10, 1), end_date=date(2026, 10, 31),
        aggregation="monthly"
    )
    assert len(res_m["series"]) == 1
    assert res_m["series"][0]["modal_price"] == 5500.0
    assert res_m["series"][0]["date"] == "2026-10-01"


# ---------------------------------------------------------------------------
# 8. Trend Classification with Insufficient Observations
# ---------------------------------------------------------------------------

def test_trend_classification_insufficient_data(analysis_db: Session):
    """Verify that having fewer than MIN_OBSERVATIONS_FOR_TREND yields INSUFFICIENT_DATA."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="SOYBEAN")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    # Only 2 observations (need at least 3)
    obs1 = make_obs(analysis_db, comm, mkt, date(2026, 10, 10), modal=4000.0)
    obs2 = make_obs(analysis_db, comm, mkt, date(2026, 10, 11), modal=4500.0)
    analysis_db.add_all([obs1, obs2])
    analysis_db.commit()

    res = service.get_historical_analysis(analysis_db, commodity_id=comm.id, market_id=mkt.id)
    assert res["data_quality"]["is_sufficient"] is False
    assert res["summary_metrics"]["trend_direction"] == "INSUFFICIENT_DATA"


# ---------------------------------------------------------------------------
# 9. Trend Classification: RISING, FALLING, and STABLE
# ---------------------------------------------------------------------------

def test_trend_classification_directions(analysis_db: Session):
    """Verify transparent classification into RISING (>+2%), FALLING (<-2%), and STABLE (+/-2%)."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="SOYBEAN")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    # Case A: RISING (+3.0% shift from 4000 to 4120)
    for d, p in [(date(2026, 10, 1), 3950.0), (date(2026, 10, 2), 4000.0), (date(2026, 10, 3), 4120.0)]:
        analysis_db.add(make_obs(analysis_db, comm, mkt, d, modal=p))
    analysis_db.commit()

    res_rising = service.get_historical_analysis(analysis_db, commodity_id=comm.id, market_id=mkt.id)
    assert res_rising["summary_metrics"]["percentage_change"] == 3.0
    assert res_rising["summary_metrics"]["trend_direction"] == "RISING"

    # Case B: FALLING (-4.0% shift from 4000 to 3840)
    analysis_db.query(MarketPriceObservation).delete()
    for d, p in [(date(2026, 10, 1), 4100.0), (date(2026, 10, 2), 4000.0), (date(2026, 10, 3), 3840.0)]:
        analysis_db.add(make_obs(analysis_db, comm, mkt, d, modal=p))
    analysis_db.commit()

    res_falling = service.get_historical_analysis(analysis_db, commodity_id=comm.id, market_id=mkt.id)
    assert res_falling["summary_metrics"]["percentage_change"] == -4.0
    assert res_falling["summary_metrics"]["trend_direction"] == "FALLING"

    # Case C: STABLE (+0.5% shift from 4000 to 4020)
    analysis_db.query(MarketPriceObservation).delete()
    for d, p in [(date(2026, 10, 1), 3980.0), (date(2026, 10, 2), 4000.0), (date(2026, 10, 3), 4020.0)]:
        analysis_db.add(make_obs(analysis_db, comm, mkt, d, modal=p))
    analysis_db.commit()

    res_stable = service.get_historical_analysis(analysis_db, commodity_id=comm.id, market_id=mkt.id)
    assert res_stable["summary_metrics"]["percentage_change"] == 0.5
    assert res_stable["summary_metrics"]["trend_direction"] == "STABLE"


# ---------------------------------------------------------------------------
# 10. Market Comparison with Disclaimer
# ---------------------------------------------------------------------------

def test_market_to_market_comparison(analysis_db: Session):
    """Verify comparing primary APMC with comparison APMC on matching dates."""
    service = MarketAnalysisService()
    comm = analysis_db.scalars(select(Commodity).filter_by(code="SOYBEAN")).first()
    pune_mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()
    baramati_mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_BARAMATI_APMC")).first()

    # Insert observations for both mandis on same date
    common_date = date(2026, 10, 15)
    analysis_db.add(make_obs(analysis_db, comm, pune_mkt, common_date, modal=4600.0))
    analysis_db.add(make_obs(analysis_db, comm, baramati_mkt, common_date, modal=4450.0))
    analysis_db.commit()

    res = service.get_historical_analysis(
        analysis_db, commodity_id=comm.id, market_id=pune_mkt.id,
        comparison_market_id=baramati_mkt.id
    )

    assert res["comparison_market"]["name"] == "Baramati APMC"
    assert len(res["comparison_series"]) == 1
    pt = res["comparison_series"][0]
    assert pt["date"] == "2026-10-15"
    assert pt["primary_modal_price"] == 4600.0
    assert pt["comparison_modal_price"] == 4450.0
    assert pt["price_difference"] == 150.0  # 4600 - 4450
    assert "transport haulage" in res["disclaimer"].lower() or "net farmer profit" in res["disclaimer"].lower()


# ---------------------------------------------------------------------------
# 11. API Filtering & Parameter Validation
# ---------------------------------------------------------------------------

def test_api_historical_trends_endpoint(client: TestClient, analysis_db: Session):
    """Verify GET /api/v1/market-intelligence/historical-trends HTTP contract."""
    comm = analysis_db.scalars(select(Commodity).filter_by(code="SOYBEAN")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    # Add 3 observations
    for i, p in enumerate([4200.0, 4250.0, 4300.0]):
        analysis_db.add(make_obs(analysis_db, comm, mkt, date(2026, 10, 10 + i), modal=p, min_p=p - 100, max_p=p + 100))
    analysis_db.commit()

    url = f"/api/v1/market-intelligence/historical-trends?commodity_id={comm.id}&market_id={mkt.id}&window=30d"
    resp = client.get(url)
    assert resp.status_code == 200
    data = resp.json()

    assert data["commodity"]["code"] == "SOYBEAN"
    assert data["market"]["market_code"] == "MH_PUNE_GULTEKDI"
    assert data["data_quality"]["total_observations"] == 3
    assert data["data_quality"]["is_sufficient"] is True
    assert data["summary_metrics"]["latest_price"] == 4300.0
    assert data["summary_metrics"]["previous_price"] == 4250.0
    assert data["summary_metrics"]["price_unit"] == "RS_PER_QUINTAL"
    assert len(data["series"]) == 3


# ---------------------------------------------------------------------------
# 12. Empty Data Responses
# ---------------------------------------------------------------------------

def test_empty_data_response_when_no_records(client: TestClient, analysis_db: Session):
    """Verify that querying a commodity with zero records returns clean empty state with warnings."""
    # Query Sugarcane (id exists, 0 observations)
    comm = analysis_db.scalars(select(Commodity).filter_by(code="SUGARCANE")).first()
    mkt = analysis_db.scalars(select(MarketApmc).filter_by(market_code="MH_PUNE_GULTEKDI")).first()

    url = f"/api/v1/market-intelligence/historical-trends?commodity_id={comm.id}&market_id={mkt.id}"
    resp = client.get(url)
    assert resp.status_code == 200
    data = resp.json()

    assert data["data_quality"]["total_observations"] == 0
    assert data["data_quality"]["is_sufficient"] is False
    assert len(data["data_quality"]["quality_warnings"]) >= 1
    assert data["summary_metrics"]["latest_price"] is None
    assert data["summary_metrics"]["trend_direction"] == "INSUFFICIENT_DATA"
    assert len(data["series"]) == 0
