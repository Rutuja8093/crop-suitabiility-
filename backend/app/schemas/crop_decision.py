"""Pydantic schemas for Field Crop Decision Engine and Multi-Criteria Comparisons.
SoilPilot Phase 9 - Crop Ranking & Decision Engine
"""

from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class CostComponentItem(BaseModel):
    component_name: str
    amount_per_ha: float
    amount_per_acre: float
    percentage_of_operational: float
    notes: Optional[str] = None


class CultivationCostBreakdown(BaseModel):
    operational_cost_per_ha: float  # A2 + FL (Paid out + family labour)
    operational_cost_per_acre: float
    total_cost_per_ha: float        # C2 (Comprehensive: inputs + rental value of land + interest)
    total_cost_per_acre: float
    components: List[CostComponentItem] = Field(default_factory=list)
    source_reference: str
    source_organization: str
    benchmark_year: Optional[int] = 2025


class YieldEstimateBenchmark(BaseModel):
    yield_min_per_ha: float
    yield_expected_per_ha: float
    yield_max_per_ha: float
    yield_min_per_acre: float
    yield_expected_per_acre: float
    yield_max_per_acre: float
    yield_unit: str = "QUINTAL"  # or TONNE
    source_reference: str


class FinancialScenarioResult(BaseModel):
    scenario_name: str  # CENTRAL, CONSERVATIVE_LOW, OPTIMISTIC_HIGH
    scenario_label: str
    assumed_price_per_unit: Optional[float] = None
    price_unit: str = "RS_PER_QUINTAL"
    assumed_yield_per_acre: float
    assumed_yield_per_ha: float

    # Per Acre
    gross_revenue_per_acre: Optional[float] = None
    operational_cost_per_acre: float
    total_cost_per_acre: float
    net_return_operational_per_acre: Optional[float] = None  # Gross Revenue - A2+FL
    net_return_total_per_acre: Optional[float] = None        # Gross Revenue - C2

    # Per Hectare
    gross_revenue_per_ha: Optional[float] = None
    operational_cost_per_ha: float
    total_cost_per_ha: float
    net_return_operational_per_ha: Optional[float] = None
    net_return_total_per_ha: Optional[float] = None

    # Scaled to actual parcel field area
    field_area_evaluated: float
    field_area_unit: str = "ACRE"
    gross_revenue_field_total: Optional[float] = None
    operational_cost_field_total: float
    total_cost_field_total: float
    net_return_operational_field_total: Optional[float] = None
    net_return_total_field_total: Optional[float] = None

    is_profitable_operational: Optional[bool] = None
    is_profitable_total: Optional[bool] = None


class CropFinancialAnalysis(BaseModel):
    is_available: bool
    unavailability_reason: Optional[str] = None
    cost_breakdown: Optional[CultivationCostBreakdown] = None
    yield_benchmark: Optional[YieldEstimateBenchmark] = None
    central_scenario: Optional[FinancialScenarioResult] = None
    conservative_scenario: Optional[FinancialScenarioResult] = None
    optimistic_scenario: Optional[FinancialScenarioResult] = None
    price_source_type: str  # FORECAST_MODAL, HISTORICAL_BASELINE, NOT_AVAILABLE
    assumed_price_modal: Optional[float] = None
    price_unit: str = "RS_PER_QUINTAL"
    forecast_target_period: Optional[str] = None
    disclaimer: str


class CropDecisionItem(BaseModel):
    crop_id: int
    crop_code: str
    crop_name: str
    crop_name_mr: str
    category: str
    season: str

    # Decision Tier & Priority
    decision_tier: str  # RECOMMENDED, CONDITIONALLY_SUITABLE, OFF_SEASON, CONSTRAINED, INSUFFICIENT_DATA
    decision_tier_label: str
    rank_priority: int  # 1, 2, 3...

    # Agronomic & Sowing Window Alignment
    suitability_status: str  # PRELIMINARY_SUITABLE, CONDITIONAL_SUITABILITY, POTENTIAL_CONSTRAINT, INSUFFICIENT_DATA
    suitability_summary: str
    planting_window_status: str  # OPTIMAL_NOW, OPENING_SOON, CLOSING_SOON, OFF_SEASON
    planting_window_text: str
    expected_harvest_text: str
    harvest_window_start: Optional[date] = None
    harvest_window_end: Optional[date] = None

    # Resource & Risk Metrics
    water_requirement: str  # LOW, MEDIUM, HIGH, VERY_HIGH
    labor_intensity: str    # LOW, MODERATE, INTENSIVE
    risk_level: str         # LOW, MODERATE, ELEVATED, HIGH_CONSTRAINT, UNKNOWN
    risk_summary: str

    # Financial Return Analysis
    financials: CropFinancialAnalysis

    # Evidence & Transparent Reasoning
    identified_constraints: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    contributing_factors: List[str] = Field(default_factory=list)
    explanation: str
    recommendation_guidance: str
    agronomic_sources: List[str] = Field(default_factory=list)


class DecisionPlanningContext(BaseModel):
    gat_no: str
    field_id: Optional[int] = None
    farmer_name: Optional[str] = None
    village_name: str
    taluka_name: str
    district_name: str
    state_name: str = "Maharashtra"
    area_acres: float
    area_ha: float
    planning_date: date
    planning_horizon: str  # IMMEDIATE_15_DAYS or SEASONAL
    selected_season: str   # RABI, KHARIF, ZAID_SUMMER, ANNUAL
    soil_data_readiness: str  # DATA_AVAILABLE, PARTIAL_DATA, INSUFFICIENT_DATA
    irrigation_status: str    # UNKNOWN (Farmer irrigation access unverified in portal)
    soil_ph: Optional[float] = None
    soil_ec: Optional[float] = None
    soil_texture: Optional[str] = None
    discrepancies_count: int = 0


class FieldCropDecisionResponse(BaseModel):
    planning_context: DecisionPlanningContext
    total_crops_evaluated: int
    recommended_count: int
    conditional_count: int
    off_season_count: int
    constrained_count: int
    insufficient_data_count: int
    crops: List[CropDecisionItem]
    engine_version: str
    disclaimers: List[str]
    generated_at: datetime
