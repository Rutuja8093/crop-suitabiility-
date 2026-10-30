"""Unit and Integration Tests for Market Data Ingestion Pipeline.
SoilPilot Phase 4: Real Market Data Source Integration Tests.

All test inputs are synthetic test fixtures explicitly labeled as TEST DATA.
Covers:
1. Valid source response parsing.
2. Missing optional fields (variety, grade, arrivals).
3. Invalid or negative prices.
4. Inconsistent minimum, modal, and maximum prices (spread checks).
5. Unit preservation (RS_PER_QUINTAL, TONNE).
6. Duplicate imports (idempotency and duplicate detection).
7. Multiple legitimate records on the same date.
8. Pagination and query filtering (commodity, district, date range).
9. Source network errors and timeouts.
10. Missing API credentials handling.
11. Database transaction rollback on failure.
12. API endpoints response structures and error contracts.
"""

from datetime import date, datetime, timezone
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.models.geography import State, District, Taluka, Village
from app.models.market_intelligence import (
    DataSourceRegistry,
    Commodity,
    MarketApmc,
    MarketPriceObservation,
)
from app.services.market_ingestion_service import MarketIngestionService


# ---------------------------------------------------------------------------
# Test Fixtures & In-Memory Database
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def test_db():
    """Create an isolated in-memory SQLite database session with seed metadata."""
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

    service = MarketIngestionService()
    service.ensure_seed_metadata(session)
    session.commit()

    try:
        yield session
    finally:
        session.rollback()
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture(scope="function")
def client(test_db: Session):
    """Create a FastAPI TestClient overriding the db session dependency."""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 1. Valid Source Response Parsing
# ---------------------------------------------------------------------------

def test_valid_source_bulletin_parsing(test_db: Session):
    """Test parsing a valid daily market bulletin with DD/MM/YYYY date and standard prices."""
    service = MarketIngestionService()
    raw_fixtures = [
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Soyabean",
            "variety": "Yellow",
            "grade": "FAQ",
            "arrival_date": "18/10/2026",
            "min_price": 4300.0,
            "modal_price": 4600.0,
            "max_price": 4800.0,
            "arrival_quantity": 65.5,
            "arrival_unit": "TONNE"
        }
    ]

    stats = service.ingest_records(test_db, raw_fixtures, source_code="AGMARKNET")
    assert stats["records_fetched"] == 1
    assert stats["records_validated"] == 1
    assert stats["records_inserted"] == 1
    assert stats["records_rejected"] == 0
    assert stats["records_skipped"] == 0

    # Verify saved database observation
    obs = test_db.scalars(select(MarketPriceObservation)).all()
    assert len(obs) == 1
    o = obs[0]
    assert o.observation_date == date(2026, 10, 18)
    assert float(o.min_price) == 4300.0
    assert float(o.modal_price) == 4600.0
    assert float(o.max_price) == 4800.0
    assert float(o.arrival_quantity) == 65.5
    assert o.price_unit == "RS_PER_QUINTAL"
    assert o.arrival_unit == "TONNE"
    assert o.validation_status == "VERIFIED"
    assert o.source_record_id is not None
    assert o.retrieval_timestamp is not None


# ---------------------------------------------------------------------------
# 2. Missing Optional Fields Handling
# ---------------------------------------------------------------------------

def test_missing_optional_fields_preservation(test_db: Session):
    """Test that missing variety, grade, or arrival quantity remain genuinely None and do not fail."""
    service = MarketIngestionService()
    raw_fixture = [
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Baramati",
            "commodity": "Wheat",
            "variety": None,       # optional
            "grade": None,         # optional
            "arrival_date": "2026-10-19",
            "min_price": 2400.0,
            "modal_price": 2600.0,
            "max_price": 2800.0,
            "arrival_quantity": None,  # genuinely unavailable
            "arrival_unit": None
        }
    ]

    stats = service.ingest_records(test_db, raw_fixture, source_code="AGMARKNET")
    assert stats["records_validated"] == 1
    assert stats["records_inserted"] == 1
    assert stats["records_rejected"] == 0

    obs = test_db.scalars(select(MarketPriceObservation)).all()
    assert len(obs) == 1
    o = obs[0]
    assert o.arrival_quantity is None
    assert o.commodity.code == "WHEAT"


# ---------------------------------------------------------------------------
# 3. Invalid or Negative Prices
# ---------------------------------------------------------------------------

def test_negative_or_zero_price_validation(test_db: Session):
    """Test that negative prices are rejected and recorded in errors list."""
    service = MarketIngestionService()
    raw_fixtures = [
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Soyabean",
            "arrival_date": "20/10/2026",
            "min_price": -500.0,   # Negative
            "modal_price": 4500.0,
            "max_price": 4800.0
        },
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Wheat",
            "arrival_date": "20/10/2026",
            "min_price": 2200.0,
            "modal_price": -10.0,  # Negative
            "max_price": 2600.0
        }
    ]

    stats = service.ingest_records(test_db, raw_fixtures, source_code="AGMARKNET")
    assert stats["records_fetched"] == 2
    assert stats["records_validated"] == 0
    assert stats["records_inserted"] == 0
    assert stats["records_rejected"] == 2
    assert len(stats["errors"]) == 2
    assert "Negative min_price" in stats["errors"][0]
    assert "Negative modal_price" in stats["errors"][1]


# ---------------------------------------------------------------------------
# 4. Inconsistent Minimum, Modal, and Maximum Prices
# ---------------------------------------------------------------------------

def test_inconsistent_price_spread_validation(test_db: Session):
    """Test rejection when min_price > max_price or modal price lies outside the spread."""
    service = MarketIngestionService()
    raw_fixtures = [
        {
            # min > max
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Onion",
            "arrival_date": "20/10/2026",
            "min_price": 3500.0,
            "modal_price": 3000.0,
            "max_price": 2500.0,
        },
        {
            # modal > max
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Onion",
            "arrival_date": "20/10/2026",
            "min_price": 2000.0,
            "modal_price": 4000.0,
            "max_price": 3000.0,
        },
        {
            # modal < min
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Onion",
            "arrival_date": "20/10/2026",
            "min_price": 2000.0,
            "modal_price": 1500.0,
            "max_price": 3000.0,
        }
    ]

    stats = service.ingest_records(test_db, raw_fixtures, source_code="AGMARKNET")
    assert stats["records_fetched"] == 3
    assert stats["records_validated"] == 0
    assert stats["records_inserted"] == 0
    assert stats["records_rejected"] == 3
    assert any("min_price" in err and "max_price" in err for err in stats["errors"])
    assert any("modal_price" in err for err in stats["errors"])


# ---------------------------------------------------------------------------
# 5. Unit Preservation
# ---------------------------------------------------------------------------

def test_unit_preservation(test_db: Session):
    """Test that Indian mandi price units are consistently stored as RS_PER_QUINTAL."""
    service = MarketIngestionService()
    fixture = [
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Cotton",
            "arrival_date": "2026-10-21",
            "min_price": 7000.0,
            "modal_price": 7400.0,
            "max_price": 7800.0,
            "arrival_quantity": 120.0,
            "arrival_unit": "TONNE"
        }
    ]
    service.ingest_records(test_db, fixture)
    obs = test_db.scalars(select(MarketPriceObservation)).first()
    assert obs.price_unit == "RS_PER_QUINTAL"
    assert obs.currency == "INR"
    assert obs.arrival_unit == "TONNE"


# ---------------------------------------------------------------------------
# 6. Duplicate Imports & Idempotent Ingestion
# ---------------------------------------------------------------------------

def test_duplicate_import_idempotency(test_db: Session):
    """Test importing the same bulletin record multiple times skips duplicates without creating extra records."""
    service = MarketIngestionService()
    fixture = [
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Gram (Chana)",
            "variety": "Desi",
            "arrival_date": "20/10/2026",
            "min_price": 5400.0,
            "modal_price": 5700.0,
            "max_price": 6000.0,
            "arrival_quantity": 30.0,
        }
    ]

    # Run 1: Should insert
    stats1 = service.ingest_records(test_db, fixture, source_code="AGMARKNET")
    assert stats1["records_inserted"] == 1
    assert stats1["records_skipped"] == 0

    # Run 2: Exact same payload should skip
    stats2 = service.ingest_records(test_db, fixture, source_code="AGMARKNET")
    assert stats2["records_inserted"] == 0
    assert stats2["records_skipped"] == 1

    # Total records in DB must remain exactly 1
    all_obs = test_db.scalars(select(MarketPriceObservation)).all()
    assert len(all_obs) == 1


# ---------------------------------------------------------------------------
# 7. Multiple Legitimate Records on Same Date
# ---------------------------------------------------------------------------

def test_multiple_legitimate_records_same_date(test_db: Session):
    """Test that distinct commodities, varieties, or markets on the same date are preserved and not falsely deduplicated."""
    service = MarketIngestionService()
    records = [
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Soyabean",
            "variety": "Yellow",
            "arrival_date": "20/10/2026",
            "min_price": 4200.0,
            "modal_price": 4500.0,
            "max_price": 4700.0,
        },
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Baramati",
            "commodity": "Soyabean",
            "variety": "Yellow",
            "arrival_date": "20/10/2026",
            "min_price": 4150.0,
            "modal_price": 4450.0,
            "max_price": 4650.0,
        },
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Wheat",
            "variety": "Lokwan",
            "arrival_date": "20/10/2026",
            "min_price": 2500.0,
            "modal_price": 2700.0,
            "max_price": 2900.0,
        }
    ]

    stats = service.ingest_records(test_db, records, source_code="AGMARKNET")
    assert stats["records_fetched"] == 3
    assert stats["records_validated"] == 3
    assert stats["records_inserted"] == 3
    assert stats["records_skipped"] == 0

    total = test_db.scalars(select(MarketPriceObservation)).all()
    assert len(total) == 3


# ---------------------------------------------------------------------------
# 8. Pagination and Query Filtering
# ---------------------------------------------------------------------------

def test_api_observations_filtering_and_pagination(client: TestClient, test_db: Session):
    """Test filtering by commodity, district, and date ranges via FastAPI endpoint."""
    service = MarketIngestionService()
    from datetime import timedelta
    today = date.today()
    d_recent = today.isoformat()
    d_older = (today - timedelta(days=5)).isoformat()
    d_range_start = (today - timedelta(days=1)).isoformat()
    d_range_end = (today + timedelta(days=1)).isoformat()

    test_records = [
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Soyabean",
            "arrival_date": d_older,
            "min_price": 4000.0,
            "modal_price": 4400.0,
            "max_price": 4600.0,
        },
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Soyabean",
            "arrival_date": d_recent,
            "min_price": 4300.0,
            "modal_price": 4650.0,
            "max_price": 4900.0,
        },
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Wheat",
            "arrival_date": d_recent,
            "min_price": 2500.0,
            "modal_price": 2700.0,
            "max_price": 2900.0,
        }
    ]
    service.ingest_records(test_db, test_records)

    # 1. Filter by District
    res = client.get("/api/v1/market-intelligence/observations?district=Pune")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 3
    assert data["data_freshness_status"] == "FRESH"

    # 2. Filter by Date Range
    res_date = client.get(f"/api/v1/market-intelligence/observations?start_date={d_range_start}&end_date={d_range_end}")
    assert res_date.status_code == 200
    data_date = res_date.json()
    assert data_date["total"] == 2

    # 3. Filter with limit / pagination
    res_page = client.get("/api/v1/market-intelligence/observations?limit=2&page=1")
    assert res_page.status_code == 200
    data_page = res_page.json()
    assert len(data_page["items"]) == 2
    assert data_page["total"] == 3


# ---------------------------------------------------------------------------
# 9. Source Network Errors & Timeouts Handling
# ---------------------------------------------------------------------------

def test_source_network_timeout_handling(test_db: Session):
    """Test that outbound HTTP timeouts or connection failures return an honest status rather than crashing."""
    import urllib.error
    service = MarketIngestionService()

    with patch("app.core.config.settings.DATA_GOV_IN_API_KEY", "test_mock_key_only"):
        with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("Connection timed out")):
            stats = service.fetch_and_ingest_data_gov_in(test_db, district="Pune")
            assert stats["status"] == "NETWORK_UNAVAILABLE"
            assert "timed out" in stats["errors"][0].lower() or "unreachable" in stats["detail"].lower()


# ---------------------------------------------------------------------------
# 10. Missing API Credentials Handling
# ---------------------------------------------------------------------------

def test_missing_api_credentials_handling(test_db: Session):
    """Test that missing DATA_GOV_IN_API_KEY yields NOT_CONFIGURED status without crashing."""
    service = MarketIngestionService()
    with patch("app.core.config.settings.DATA_GOV_IN_API_KEY", None):
        stats = service.fetch_and_ingest_data_gov_in(test_db, district="Pune")
        assert stats["status"] == "NOT_CONFIGURED"
        assert stats["records_inserted"] == 0
        assert "Missing DATA_GOV_IN_API_KEY" in stats["errors"]

        # Check that data source registry marked as CREDENTIALS_REQUIRED
        src = test_db.scalars(select(DataSourceRegistry).filter_by(code="AGMARKNET")).first()
        assert src.operational_status == "CREDENTIALS_REQUIRED"


# ---------------------------------------------------------------------------
# 11. Transaction Rollback on Failure
# ---------------------------------------------------------------------------

def test_transaction_rollback_on_failure(test_db: Session):
    """Test that database session rolls back cleanly if an unexpected database error occurs."""
    service = MarketIngestionService()
    raw_fixtures = [
        {
            "state": "Maharashtra",
            "district": "Pune",
            "market": "Pune",
            "commodity": "Soyabean",
            "arrival_date": "20/10/2026",
            "min_price": 4200.0,
            "modal_price": 4500.0,
            "max_price": 4700.0,
        }
    ]

    with patch.object(test_db, "commit", side_effect=Exception("Database connection terminated")):
        with pytest.raises(Exception):
            service.ingest_records(test_db, raw_fixtures)

    # Verify no partial records leaked
    obs = test_db.scalars(select(MarketPriceObservation)).all()
    assert len(obs) == 0


# ---------------------------------------------------------------------------
# 12. API Read Endpoints & Security
# ---------------------------------------------------------------------------

def test_api_read_endpoints_contracts(client: TestClient, test_db: Session):
    """Test commodities, markets, and sources endpoints return clean responses without leaking secrets."""
    # 1. Commodities endpoint
    res_comm = client.get("/api/v1/market-intelligence/commodities")
    assert res_comm.status_code == 200
    comms = res_comm.json()
    assert len(comms) >= 6
    soy = next(c for c in comms if c["code"] == "SOYBEAN")
    assert soy["name_mr"] == "सोयाबीन"

    # 2. Markets endpoint
    res_mkts = client.get("/api/v1/market-intelligence/markets?district_name=Pune")
    assert res_mkts.status_code == 200
    mkts = res_mkts.json()
    assert len(mkts) >= 1

    # 3. Sources endpoint
    res_src = client.get("/api/v1/market-intelligence/sources")
    assert res_src.status_code == 200
    srcs = res_src.json()
    assert len(srcs) >= 1
    # Ensure sensitive credentials/tokens are NOT exposed
    for s in srcs:
        assert "api_key" not in s
        assert "password" not in s
        assert "secret" not in s
