"""FastAPI endpoints for Market Intelligence & Crop Planner.
SoilPilot Phase 4: Real Market Data Ingestion & Verified Observations.
"""

from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.models.market_intelligence import Commodity, MarketApmc, DataSourceRegistry
from app.schemas.market_intelligence import (
    ObservationsListResponse,
    CommodityResponse,
    MarketResponse,
    DataSourceResponse,
    IngestionResultResponse,
    IngestBatchRequest,
    HistoricalAnalysisResponse,
    MarketForecastResponse,
    GenerateForecastRequest,
    Next15DaysPlanningResponse,
    SeasonalPlanningResponse,
)
from app.schemas.crop_suitability import FieldSuitabilityResponse
from app.schemas.crop_decision import FieldCropDecisionResponse
from app.services.market_ingestion_service import market_ingestion_service
from app.services.market_analysis_service import market_analysis_service
from app.services.market_forecasting_service import MarketForecastingEngine, DISCLAIMER_PHASE_6
from app.services.crop_calendar_service import crop_calendar_service
from app.services.crop_suitability_service import crop_suitability_service, AGRONOMIC_CROP_CRITERIA, RULE_ENGINE_VERSION
from app.services.crop_decision_service import (
    crop_decision_service,
    VERIFIED_COST_AND_YIELD_BENCHMARKS,
    DECISION_ENGINE_VERSION,
)
from app.api.v1.auth import extract_token
from app.services.auth_service import auth_service
from app.models.field import Field

router = APIRouter(prefix="/market-intelligence", tags=["Market Intelligence & Crop Planner"])


@router.get("/observations", response_model=ObservationsListResponse)
def get_market_observations(
    commodity_id: Optional[int] = Query(None, description="Filter by canonical Commodity ID"),
    market_id: Optional[int] = Query(None, description="Filter by APMC Market ID"),
    district: Optional[str] = Query(None, description="Filter by administrative District (e.g. Pune)"),
    start_date: Optional[str] = Query(None, description="Filter by start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (YYYY-MM-DD)"),
    page: int = Query(1, ge=1, description="Pagination page number"),
    limit: int = Query(50, ge=1, le=200, description="Page limit (max 200)"),
    db: Session = Depends(get_db)
):
    """
    Retrieve paginated verified market price observations.
    Filters by commodity, market, district, and trading observation date range.
    """
    s_date = None
    e_date = None
    if start_date:
        s_date = market_ingestion_service.parse_date(start_date)
    if end_date:
        e_date = market_ingestion_service.parse_date(end_date)

    result = market_ingestion_service.get_observations(
        db=db,
        commodity_id=commodity_id,
        market_id=market_id,
        district_name=district,
        start_date=s_date,
        end_date=e_date,
        page=page,
        limit=limit
    )
    return result


@router.get("/commodities", response_model=List[CommodityResponse])
def get_commodities(
    category: Optional[str] = Query(None, description="Filter by category (OILSEEDS, CEREALS, PULSES, etc.)"),
    db: Session = Depends(get_db)
):
    """Retrieve list of active agricultural commodities with English and Marathi metadata."""
    market_ingestion_service.ensure_seed_metadata(db)
    query = select(Commodity).filter(Commodity.is_active == True)  # noqa: E712
    if category:
        query = query.filter(Commodity.category == category.upper())
    query = query.order_by(Commodity.name)
    items = db.scalars(query).all()
    return items


@router.get("/markets", response_model=List[MarketResponse])
def get_markets(
    district_id: Optional[int] = Query(None, description="Filter by District ID"),
    district_name: Optional[str] = Query(None, description="Filter by District Name (e.g. Pune)"),
    db: Session = Depends(get_db)
):
    """Retrieve list of active Maharashtra APMC markets and trading yards."""
    market_ingestion_service.ensure_seed_metadata(db)
    query = select(MarketApmc).filter(MarketApmc.is_active == True)  # noqa: E712
    if district_id:
        query = query.filter(MarketApmc.district_id == district_id)
    if district_name:
        from app.models.geography import District
        query = query.join(MarketApmc.district).filter(District.name == district_name)
    query = query.order_by(MarketApmc.name)
    items = db.scalars(query).all()

    result = []
    for m in items:
        result.append({
            "id": m.id,
            "market_code": m.market_code,
            "name": m.name,
            "name_mr": m.name_mr,
            "state_id": m.state_id,
            "district_id": m.district_id,
            "taluka_id": m.taluka_id,
            "district_name": m.district.name if m.district else None,
            "taluka_name": m.taluka.name if m.taluka else None,
            "agmarknet_market_id": m.agmarknet_market_id,
            "market_type": m.market_type
        })
    return result


@router.get("/sources", response_model=List[DataSourceResponse])
def get_data_sources(db: Session = Depends(get_db)):
    """Retrieve registry and operational health statuses of market data sources."""
    market_ingestion_service.ensure_seed_metadata(db)
    items = db.scalars(select(DataSourceRegistry).order_by(DataSourceRegistry.id)).all()
    result = []
    for s in items:
        result.append({
            "id": s.id,
            "code": s.code,
            "name": s.name,
            "source_type": s.source_type,
            "access_method": s.access_method,
            "operational_status": s.operational_status,
            "update_frequency": s.update_frequency,
            "last_successful_retrieval_at": s.last_successful_retrieval_at.isoformat() if s.last_successful_retrieval_at else None,
            "last_attempted_retrieval_at": s.last_attempted_retrieval_at.isoformat() if s.last_attempted_retrieval_at else None,
            "official_url": s.official_url
        })
    return result


@router.post("/sync", response_model=IngestionResultResponse)
def trigger_data_gov_in_sync(
    district: Optional[str] = Query("Pune", description="District filter (default Pune)"),
    market: Optional[str] = Query(None, description="Optional APMC filter"),
    commodity: Optional[str] = Query(None, description="Optional Commodity filter"),
    limit: int = Query(100, ge=10, le=500, description="Max records to fetch"),
    db: Session = Depends(get_db)
):
    """
    Trigger real-time daily synchronization from the official data.gov.in AGMARKNET API.
    Requires DATA_GOV_IN_API_KEY environment configuration.
    """
    stats = market_ingestion_service.fetch_and_ingest_data_gov_in(
        db=db,
        district=district,
        market=market,
        commodity=commodity,
        limit=limit
    )
    return stats


@router.post("/ingest-batch", response_model=IngestionResultResponse)
def ingest_bulletin_batch(
    payload: IngestBatchRequest,
    db: Session = Depends(get_db)
):
    """
    Ingest verified mandi price records directly (e.g. from official daily bulletins or offline sync).
    Idempotent: Duplicate observations are skipped automatically.
    """
    raw_dicts = [r.model_dump() for r in payload.records]
    stats = market_ingestion_service.ingest_records(db, raw_dicts, source_code=payload.source_code)
    stats["timestamp"] = date.today().isoformat()
    stats["source"] = payload.source_code
    return stats


@router.get("/historical-trends", response_model=HistoricalAnalysisResponse)
def get_historical_trends(
    commodity_id: int = Query(1, description="Canonical Commodity ID"),
    market_id: Optional[int] = Query(None, description="Primary APMC Market ID"),
    district: Optional[str] = Query(None, description="District filter (e.g. Pune)"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    window: str = Query("30d", description="Observation window (7d, 30d, 90d, 1y, all)"),
    aggregation: str = Query("daily", description="Time aggregation (daily, weekly, monthly)"),
    comparison_market_id: Optional[int] = Query(None, description="Optional comparison APMC Market ID"),
    trend_threshold: float = Query(2.0, ge=0.5, le=10.0, description="Movement threshold % for trend classification (default 2.0%)"),
    db: Session = Depends(get_db)
):
    """
    Retrieve descriptive historical market price analysis for a commodity and APMC.
    Computes moving statistics, percentage change, volatility (CV %), data-quality metrics,
    and transparent trend classifications without price forecasting.
    """
    s_date = market_ingestion_service.parse_date(start_date) if start_date else None
    e_date = market_ingestion_service.parse_date(end_date) if end_date else None

    # Validate aggregation
    clean_agg = aggregation.lower().strip()
    if clean_agg not in ("daily", "weekly", "monthly"):
        clean_agg = "daily"

    try:
        result = market_analysis_service.get_historical_analysis(
            db=db,
            commodity_id=commodity_id,
            market_id=market_id,
            district_name=district,
            start_date=s_date,
            end_date=e_date,
            window=window,
            aggregation=clean_agg,
            comparison_market_id=comparison_market_id,
            trend_threshold_percent=trend_threshold
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==========================================
# PHASE 6: MARKET PRICE FORECASTING ENDPOINTS
# ==========================================

@router.get("/forecasts", response_model=MarketForecastResponse)
def get_market_price_forecast(
    commodity_id: int = Query(1, description="Target Agricultural Commodity ID"),
    market_id: int = Query(1, description="Primary APMC Market ID"),
    horizon_days: int = Query(30, ge=1, le=180, description="Forecast horizon in days (e.g. 7, 15, 30, 60, 90)"),
    target_date: Optional[str] = Query(None, description="Explicit target harvest/selling date (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Retrieve market price forecast for a commodity and APMC market yard.
    Evaluates historical records using chronological walk-forward backtesting.
    Distinguishes observed prices from forecasts and returns explicit
    'UNAVAILABLE_INSUFFICIENT_DATA' if reliable historical observations are fewer than 15.
    """
    t_date = market_ingestion_service.parse_date(target_date) if target_date else None
    forecasting_engine = MarketForecastingEngine(db)

    try:
        response = forecasting_engine.generate_forecast(
            commodity_id=commodity_id,
            market_id=market_id,
            horizon_days=horizon_days,
            target_date=t_date,
            persist=True
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Forecasting engine evaluation error: {str(e)}"
        )


@router.post("/forecasts/generate", response_model=MarketForecastResponse)
def trigger_forecast_generation(
    payload: GenerateForecastRequest,
    db: Session = Depends(get_db)
):
    """
    Trigger reproducible time-series model fitting and forecast persistence for an APMC commodity.
    Strictly preserves model provenance, training cutoff dates, and walk-forward backtest metrics.
    """
    forecasting_engine = MarketForecastingEngine(db)
    try:
        response = forecasting_engine.generate_forecast(
            commodity_id=payload.commodity_id,
            market_id=payload.market_id,
            horizon_days=payload.horizon_days,
            target_date=payload.target_date,
            persist=True
        )
        return response
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/forecasts/models")
def get_forecasting_models_metadata():
    """
    Returns transparency metadata on available forecasting baselines and time-series algorithms,
    data sufficiency criteria, walk-forward evaluation protocol, and regulatory disclaimers.
    """
    return {
        "engine_version": MarketForecastingEngine.MODEL_VERSION,
        "supported_price_unit": "RS_PER_QUINTAL",
        "minimum_observations_required": MarketForecastingEngine.MIN_OBSERVATIONS_FOR_DEFENSIBLE_FORECAST,
        "evaluation_protocol": "Rolling-Origin Chronological Walk-Forward Backtesting (No Lookahead Bias)",
        "supported_horizons_days": [7, 15, 30, 60, 90, 120, 150],
        "candidate_algorithms": [
            {
                "identifier": "NAIVE_LAST_OBSERVATION",
                "category": "Baseline",
                "formula": "y_{t+h} = y_t",
                "description": "Projects the latest observed market price forward without change. Serves as benchmark.",
            },
            {
                "identifier": "MOVING_AVERAGE",
                "category": "Smoothing Baseline",
                "formula": "y_{t+h} = mean(y_{t-k+1:t})",
                "description": "Simple moving average over recent market transactions (k=7 auction sessions).",
            },
            {
                "identifier": "DRIFT_TREND",
                "category": "Trend Baseline",
                "formula": "y_{t+h} = y_t + h * ((y_t - y_1) / (t - 1))",
                "description": "Linear drift projection based on overall historical trajectory.",
            },
            {
                "identifier": "HOLT_LINEAR_EXPONENTIAL_SMOOTHING",
                "category": "Adaptive Time-Series",
                "formula": "L_t = alpha*y_t + (1-alpha)*(L_{t-1} + b_{t-1}); b_t = beta*(L_t - L_{t-1}) + (1-beta)*b_{t-1}; y_{t+h} = L_t + h*b_t",
                "description": "Double exponential smoothing with level and trend components. Parameter grid-search minimizes in-sample SSE.",
            },
            {
                "identifier": "SEASONAL_NAIVE",
                "category": "Seasonal Baseline",
                "formula": "y_{t+h} = y_{t+h-m}",
                "description": "Seasonal cycle projection. Requires >= 2 full multi-year annual cycles (currently inactive due to historical dataset span).",
            }
        ],
        "selection_rule": "A candidate model is chosen over the Naive baseline if and only if out-of-sample held-out MAE is lower than Naive MAE. Otherwise, the Naive baseline is preserved.",
        "uncertainty_method": "Empirical prediction interval based on out-of-sample backtest residual variance scaled by sqrt(horizon). Truncated at 0 Rs/qtl.",
        "disclaimer": DISCLAIMER_PHASE_6
    }


# ==========================================
# PHASE 7: SMART PLANTING CALENDAR ENDPOINTS
# ==========================================

@router.get("/planting-calendar/next-15-days", response_model=Next15DaysPlanningResponse)
def get_next_15_days_planting_options(
    current_date: Optional[str] = Query(None, description="Authoritative evaluation date (YYYY-MM-DD), defaults to today"),
    district_id: Optional[int] = Query(None, description="Administrative District ID filter"),
    market_id: int = Query(1, description="Reference APMC Market ID for price forecast lookups"),
    field_id: Optional[int] = Query(None, description="Agricultural field / Gat ID to load parcel soil context"),
    db: Session = Depends(get_db)
):
    """
    Retrieve verified agricultural planting windows intersecting the next 15 calendar days.
    Integrates MPKV Rahuri agronomic calendars, duration definitions, indicative harvest periods,
    field parcel context, and Phase 6 market price outlooks.
    """
    eval_d = market_ingestion_service.parse_date(current_date) if current_date else None
    return crop_calendar_service.get_next_15_days_planning(
        db=db,
        current_date=eval_d,
        district_id=district_id,
        market_id=market_id,
        field_id=field_id
    )


@router.get("/planting-calendar/seasonal", response_model=SeasonalPlanningResponse)
def get_seasonal_planting_options(
    season: str = Query("RABI", description="Agricultural season (KHARIF, RABI, ZAID_SUMMER, ANNUAL)"),
    current_date: Optional[str] = Query(None, description="Authoritative evaluation date (YYYY-MM-DD)"),
    district_id: Optional[int] = Query(None, description="Administrative District ID filter"),
    market_id: int = Query(1, description="Reference APMC Market ID"),
    field_id: Optional[int] = Query(None, description="Field / Gat parcel ID"),
    db: Session = Depends(get_db)
):
    """
    Retrieve verified seasonal crop calendars for an upcoming or active season.
    Provides sowing windows, growth duration, harvest window projections, water intensity,
    and university package of practices source attribution.
    """
    eval_d = market_ingestion_service.parse_date(current_date) if current_date else None
    return crop_calendar_service.get_seasonal_planning(
        db=db,
        season=season,
        current_date=eval_d,
        district_id=district_id,
        market_id=market_id,
        field_id=field_id
    )


# ==========================================
# PHASE 8: FIELD SUITABILITY ENDPOINTS
# ==========================================

@router.get("/suitability/field/{field_identifier}", response_model=FieldSuitabilityResponse)
def get_field_crop_suitability(
    field_identifier: str,
    evaluation_date: Optional[str] = Query(None, description="Assessment date (YYYY-MM-DD), defaults to today"),
    season: str = Query("RABI", description="Planning season context (RABI, KHARIF, ZAID_SUMMER, ANNUAL)"),
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db)
):
    """
    Evaluate crop suitability for a selected field parcel using verified agronomic criteria.
    Integrates certified laboratory test reports (primary precedence) and Digital Soil Mapping (DSM)
    GeoTIFF predictions. Discrepancies between sources are explicitly flagged.
    Enforces authorization: authenticated farmers can only assess parcels in their jurisdiction.
    """
    # Authorization verification
    if token:
        payload = auth_service.verify_session_token(token)
        if payload and payload.get("farmer_id"):
            token_farmer_id = payload.get("farmer_id")
            field = crop_suitability_service._find_field(db, field_identifier)
            # If the field belongs to a specific farmer other than the session farmer, and is not a demo field
            if field and field.farmer_id and field.farmer_id != token_farmer_id and not field.is_demo:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You are not authorized to evaluate this agricultural field parcel."
                )

    eval_d = market_ingestion_service.parse_date(evaluation_date) if evaluation_date else None
    return crop_suitability_service.evaluate_field_crop_suitability(
        db=db,
        field_identifier=field_identifier,
        evaluation_date=eval_d,
        planning_season=season
    )


@router.get("/suitability/crops")
def get_authoritative_crop_suitability_criteria():
    """
    Returns the authoritative crop tolerance matrices and university package of practices
    references (MPKV Rahuri, ICAR, VSI) used by the suitability evaluation engine.
    """
    crops_summary = []
    for code, data in AGRONOMIC_CROP_CRITERIA.items():
        crops_summary.append({
            "crop_code": code,
            "crop_name": data["crop_name"],
            "crop_name_mr": data["crop_name_mr"],
            "category": data["category"],
            "season": data.get("season", "RABI"),
            "water_requirement": data.get("water_requirement", "MEDIUM"),
            "sources": data.get("sources", []),
            "criteria_count": len(data.get("criteria", [])),
            "evaluated_parameters": [c["parameter_key"] for c in data.get("criteria", [])],
            "drainage_rule": data.get("drainage_rule", ""),
        })
    return {
        "rule_engine_version": RULE_ENGINE_VERSION,
        "authoritative_institutions": [
            "Mahatma Phule Krishi Vidyapeeth (MPKV), Rahuri",
            "ICAR-Indian Institute of Pulses Research (IIPR), Kanpur",
            "ICAR-Directorate of Onion and Garlic Research (DOGR), Pune",
            "ICAR-Indian Institute of Wheat and Barley Research (IIWBR), Karnal",
            "Vasantdada Sugar Institute (VSI), Pune",
            "ICAR-Central Institute for Cotton Research (CICR), Nagpur",
            "ICAR-Indian Institute of Soybean Research (IISR), Indore",
        ],
        "total_crops": len(crops_summary),
        "crops": crops_summary
    }


# ==========================================
# PHASE 9: CROP DECISION ENGINE & RANKING ENDPOINTS
# ==========================================

@router.get("/decision-engine/field/{field_identifier}", response_model=FieldCropDecisionResponse)
def get_field_crop_decision_plan(
    field_identifier: str,
    planning_date: Optional[str] = Query(None, description="Planning evaluation date (YYYY-MM-DD), defaults to today"),
    horizon: str = Query("IMMEDIATE_15_DAYS", description="Planning horizon: IMMEDIATE_15_DAYS or SEASONAL"),
    season: str = Query("RABI", description="Target agricultural season: RABI, KHARIF, ZAID_SUMMER, ANNUAL"),
    market_id: Optional[int] = Query(None, description="Optional APMC market ID override for price forecasting"),
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db)
):
    """
    Evaluates multi-criteria crop comparison and ranking for the selected field parcel.
    Integrates:
      1. Field Suitability (Phase 8: soil chemistry, physics, and constraints)
      2. Planting Calendar (Phase 7: sowing window and duration)
      3. Harvest Price Forecast (Phase 6: empirical time-series modal forecast)
      4. Cultivation Economics (CACP & MPKV verified cost of cultivation & yield benchmarks)
    Enforces authorization: authenticated farmers can only evaluate parcels in their jurisdiction.
    """
    # Authorization verification
    if token:
        payload = auth_service.verify_session_token(token)
        if payload and payload.get("farmer_id"):
            token_farmer_id = payload.get("farmer_id")
            field = crop_suitability_service._find_field(db, field_identifier)
            if field and field.farmer_id and field.farmer_id != token_farmer_id and not field.is_demo:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You are not authorized to evaluate crop decisions for this agricultural field parcel."
                )

    eval_d = market_ingestion_service.parse_date(planning_date) if planning_date else None
    return crop_decision_service.evaluate_field_crop_decision(
        db=db,
        field_identifier=field_identifier,
        planning_date=eval_d,
        planning_horizon=horizon,
        planning_season=season,
        market_id=market_id,
        exclude_crops={"CHANA", "GRAM", "LEMON", "GROUNDNUT", "WHEAT", "TUR", "COTTON"},
    )


@router.get("/decision-engine/benchmarks")
def get_verified_cost_and_yield_benchmarks():
    """
    Returns verified CACP Comprehensive Scheme and MPKV Rahuri cultivation cost
    and yield benchmarks for Maharashtra agro-climatic zones.
    """
    benchmarks_list = []
    for code, data in VERIFIED_COST_AND_YIELD_BENCHMARKS.items():
        if code.upper() in {"CHANA", "GRAM", "LEMON", "GROUNDNUT"}:
            continue
        benchmarks_list.append({
            "crop_code": code,
            "crop_name": data["crop_name"],
            "season": data["season"],
            "operational_cost_per_ha": data["operational_cost_per_ha"],
            "operational_cost_per_acre": round(data["operational_cost_per_ha"] * 0.404685642, 2),
            "total_cost_per_ha": data["total_cost_per_ha"],
            "total_cost_per_acre": round(data["total_cost_per_ha"] * 0.404685642, 2),
            "yield_min_ha": data["yield_min_ha"],
            "yield_expected_ha": data["yield_expected_ha"],
            "yield_max_ha": data["yield_max_ha"],
            "yield_unit": data.get("yield_unit", "QUINTAL"),
            "source_organization": data["source_org"],
            "source_reference": data["source_ref"],
            "cost_components_count": len(data.get("cost_components", [])),
        })

    return {
        "engine_version": DECISION_ENGINE_VERSION,
        "authoritative_sources": [
            "Commission for Agricultural Costs and Prices (CACP), Ministry of Agriculture & Farmers Welfare, GoI",
            "Comprehensive Scheme for the Study of Cost of Cultivation of Principal Crops in India (Maharashtra Vertisols)",
            "Mahatma Phule Krishi Vidyapeeth (MPKV), Rahuri (Department of Agricultural Economics)",
            "ICAR-Directorate of Onion and Garlic Research (DOGR), Rajgurunagar, Pune",
            "Vasantdada Sugar Institute (VSI), Manjari, Pune",
        ],
        "total_benchmarks": len(benchmarks_list),
        "benchmarks": benchmarks_list,
    }



