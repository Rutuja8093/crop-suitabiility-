"""Pydantic v2 schemas for Market Intelligence & Crop Planner API.
SoilPilot Phase 4
"""

from datetime import date, datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class CommodityResponse(BaseModel):
    id: int
    code: str
    name: str
    name_mr: str
    category: str
    standard_unit: str
    crop_duration_min_days: Optional[int] = None
    crop_duration_max_days: Optional[int] = None
    description: Optional[str] = None
    description_mr: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MarketResponse(BaseModel):
    id: int
    market_code: str
    name: str
    name_mr: str
    state_id: int
    district_id: int
    taluka_id: Optional[int] = None
    district_name: Optional[str] = None
    taluka_name: Optional[str] = None
    agmarknet_market_id: Optional[str] = None
    market_type: str

    model_config = ConfigDict(from_attributes=True)


class DataSourceResponse(BaseModel):
    id: int
    code: str
    name: str
    source_type: str
    access_method: str
    operational_status: str
    update_frequency: str
    last_successful_retrieval_at: Optional[str] = None
    last_attempted_retrieval_at: Optional[str] = None
    official_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MarketPriceObservationResponse(BaseModel):
    id: int
    commodity_id: int
    commodity_name: str
    commodity_name_mr: str
    commodity_category: str
    market_id: int
    market_name: str
    market_name_mr: str
    district_name: Optional[str] = None
    source_record_id: Optional[str] = None
    observation_date: str
    retrieval_timestamp: str
    min_price: Optional[float] = None
    modal_price: Optional[float] = None
    max_price: Optional[float] = None
    currency: str = "INR"
    price_unit: str = "RS_PER_QUINTAL"
    arrival_quantity: Optional[float] = None
    arrival_unit: Optional[str] = "TONNE"
    validation_status: str
    source_name: str

    model_config = ConfigDict(from_attributes=True)


class ObservationsListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[MarketPriceObservationResponse]
    latest_observation_date: Optional[str] = None
    source_name: str = "AGMARKNET / OGD India"
    source_status: str
    data_freshness_status: str
    summary_message: Optional[str] = None


class IngestionResultResponse(BaseModel):
    status: str
    source: str
    records_fetched: int
    records_validated: int
    records_inserted: int
    records_updated: int
    records_skipped: int
    records_rejected: int
    errors: List[str] = Field(default_factory=list)
    timestamp: str
    detail: Optional[str] = None


class RawBulletinRecord(BaseModel):
    state: str
    district: str
    market: str
    commodity: str
    variety: Optional[str] = None
    grade: Optional[str] = None
    arrival_date: str
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    modal_price: Optional[float] = None
    arrival_quantity: Optional[float] = None
    arrival_unit: Optional[str] = "TONNE"


class IngestBatchRequest(BaseModel):
    source_code: str = "AGMARKNET"
    records: List[RawBulletinRecord]


# ---------------------------------------------------------------------------
# Phase 5: Historical Price Analysis & Trend Detection Schemas
# ---------------------------------------------------------------------------

class HistoricalTrendPoint(BaseModel):
    date: str
    modal_price: float
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    arrival_quantity: Optional[float] = None
    arrival_unit: Optional[str] = "TONNE"
    observation_count: int = 1


class MarketComparisonItem(BaseModel):
    date: str
    primary_modal_price: float
    comparison_modal_price: float
    price_difference: float
    percentage_difference: Optional[float] = None


class DataQualityReport(BaseModel):
    total_observations: int
    earliest_date: Optional[str] = None
    latest_date: Optional[str] = None
    calendar_days: int
    reporting_gaps_count: int
    is_sufficient: bool
    quality_warnings: List[str] = Field(default_factory=list)


class HistoricalSummaryMetrics(BaseModel):
    latest_price: Optional[float] = None
    latest_date: Optional[str] = None
    previous_price: Optional[float] = None
    previous_date: Optional[str] = None
    absolute_change: Optional[float] = None
    percentage_change: Optional[float] = None
    average_modal_price: Optional[float] = None
    median_modal_price: Optional[float] = None
    min_observed_price: Optional[float] = None
    max_observed_price: Optional[float] = None
    price_spread: Optional[float] = None
    volatility_std_dev: Optional[float] = None
    volatility_cv_percent: Optional[float] = None
    trend_direction: str = "INSUFFICIENT_DATA"  # RISING, FALLING, STABLE, INSUFFICIENT_DATA
    trend_threshold_percent: float = 2.0
    price_unit: str = "RS_PER_QUINTAL"


class HistoricalAnalysisResponse(BaseModel):
    commodity: CommodityResponse
    market: MarketResponse
    date_range: Dict[str, Any]
    aggregation: str = "daily"
    data_quality: DataQualityReport
    summary_metrics: HistoricalSummaryMetrics
    series: List[HistoricalTrendPoint]
    comparison_market: Optional[MarketResponse] = None
    comparison_series: List[MarketComparisonItem] = Field(default_factory=list)
    source_info: Dict[str, Any]
    disclaimer: str


# ==========================================
# PHASE 6: MARKET PRICE FORECASTING SCHEMAS
# ==========================================

class ModelComparisonItem(BaseModel):
    model_identifier: str
    model_version: str
    is_selected: bool
    mae: float
    rmse: float
    mape: Optional[float] = None
    mase: Optional[float] = None
    error_reduction_vs_baseline_pct: Optional[float] = None
    evaluation_sample_size: int


class ForecastDataQuality(BaseModel):
    total_observations: int
    training_cutoff_date: Optional[date] = None
    earliest_observation_date: Optional[date] = None
    calendar_days_span: int = 0
    reporting_gaps_count: int = 0
    is_sufficient: bool = False
    quality_warnings: List[str] = Field(default_factory=list)


class MarketForecastResponse(BaseModel):
    commodity: CommodityResponse
    market: MarketResponse
    forecast_horizon_days: int
    forecast_generated_at: datetime
    target_period_start: date
    target_period_end: date
    predicted_modal_price: Optional[float] = None
    lower_uncertainty_bound: Optional[float] = None
    upper_uncertainty_bound: Optional[float] = None
    currency: str = "INR"
    price_unit: str = "RS_PER_QUINTAL"
    model_identifier: str
    model_version: str
    training_data_cutoff_date: Optional[date] = None
    status: str  # PUBLISHED, EXPERIMENTAL, UNAVAILABLE_INSUFFICIENT_DATA
    unavailability_reason: Optional[str] = None
    data_quality: ForecastDataQuality
    evaluation_metrics: Dict[str, Optional[float]] = Field(default_factory=dict)
    baseline_comparison: Optional[Dict[str, Any]] = None
    candidate_models: List[ModelComparisonItem] = Field(default_factory=list)
    historical_reference_points: List[Dict[str, Any]] = Field(default_factory=list)
    disclaimer: str


class GenerateForecastRequest(BaseModel):
    commodity_id: int
    market_id: int
    horizon_days: int = Field(default=30, ge=1, le=180)
    target_date: Optional[date] = None
    force_recalculate: bool = False


# ==========================================
# PHASE 7: SMART PLANTING CALENDAR SCHEMAS
# ==========================================

class HarvestPriceOutlook(BaseModel):
    status: str  # AVAILABLE, UNAVAILABLE_INSUFFICIENT_DATA, NO_MODEL_REGISTERED
    predicted_modal_price: Optional[float] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    price_unit: str = "RS_PER_QUINTAL"
    model_identifier: Optional[str] = None
    target_period_start: Optional[date] = None
    target_period_end: Optional[date] = None
    unavailability_reason: Optional[str] = None
    disclaimer: str


class FieldSoilContext(BaseModel):
    gat_no: Optional[str] = None
    area_acreage: Optional[float] = None
    village_name: Optional[str] = None
    taluka_name: Optional[str] = None
    district_name: Optional[str] = None
    has_soil_test: bool = False
    soil_texture: Optional[str] = None
    soil_ph: Optional[float] = None
    organic_carbon_percent: Optional[float] = None
    prerequisite_notes: List[str] = Field(default_factory=list)


class PlantingOptionItem(BaseModel):
    crop_id: int
    crop_code: str
    crop_name: str
    crop_name_mr: str
    category: str
    season: str

    # Planting window
    planting_window_start: str  # Month-Day formatted e.g. "10-15"
    planting_window_end: str    # Month-Day formatted e.g. "11-30"
    current_year_window_start: date
    current_year_window_end: date
    window_status: str  # OPTIMAL_NOW, OPENING_SOON, CLOSING_SOON, INACTIVE
    days_until_window_opens: Optional[int] = None
    days_until_window_closes: Optional[int] = None

    # Growth & Harvest
    duration_min_days: int
    duration_max_days: int
    duration_definition: str
    estimated_harvest_window_start: date
    estimated_harvest_window_end: date

    # Agronomy & Resources
    water_requirement: str  # LOW, MEDIUM, HIGH, VERY_HIGH
    labor_intensity: str    # LOW, MODERATE, INTENSIVE
    agronomic_prerequisites: List[str] = Field(default_factory=list)
    soil_suitability_notes: Optional[str] = None

    # Source Provenance
    source_reference: str
    source_publication_year: Optional[int] = None
    verification_status: str

    # Harvest-Time Price Outlook (Phase 6 link)
    price_outlook: HarvestPriceOutlook


class Next15DaysPlanningResponse(BaseModel):
    evaluation_date: date
    next_15_days_start: date
    next_15_days_end: date
    total_options_count: int
    field_context: Optional[FieldSoilContext] = None
    options: List[PlantingOptionItem]
    disclaimer: str


class SeasonalPlanningResponse(BaseModel):
    selected_season: str
    evaluation_date: date
    applicable_region: str
    total_crops_count: int
    field_context: Optional[FieldSoilContext] = None
    options: List[PlantingOptionItem]
    disclaimer: str



