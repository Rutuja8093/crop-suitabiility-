"""Pydantic v2 schemas for Field Suitability Assessment.
SoilPilot Phase 8 - Digital Soil Mapping & Agronomic Suitability Integration
"""

from datetime import date, datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class EvaluatedParameterSoilData(BaseModel):
    """
    Representation of an individual soil parameter for the selected field.
    Preserves value, unit, whether it's measured/predicted, and data source provenance.
    """
    parameter_key: str
    parameter_name: str
    parameter_name_mr: Optional[str] = None
    category: str = "Soil Chemistry"
    value: Optional[float] = None
    text_value: Optional[str] = None
    unit: str = "—"
    source_type: str  # "LAB OBSERVATION" | "DSM PREDICTION" | "IMPORTED DATA"
    source_label: str
    effective_date: Optional[str] = None
    is_measured: bool = False
    is_predicted: bool = False
    is_available: bool = True
    discrepancy_detected: bool = False
    discrepancy_note: Optional[str] = None
    secondary_source_value: Optional[float] = None
    secondary_source_type: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CriterionEvaluationResult(BaseModel):
    """
    Evaluation result for a specific agronomic criterion (e.g., pH, Salinity/EC, Free Lime, Texture, Bulk Density).
    """
    criterion_name: str
    parameter_key: str
    evaluated_value: Optional[float] = None
    text_value: Optional[str] = None
    unit: str = "—"
    status: str  # "SUITABLE", "MARGINAL", "UNSUITABLE", "UNKNOWN", "NOT_EVALUATED"
    status_label: str
    optimal_range: str
    marginal_range: Optional[str] = None
    unsuitable_threshold: str
    interpretation: str
    agronomic_rationale: str
    source_reference: str
    source_organization: str

    model_config = ConfigDict(from_attributes=True)


class NonSoilFactorsCheck(BaseModel):
    """
    Evaluation of essential non-soil factors (irrigation, field area, drainage, planting calendar).
    Transparently marks unknown factors rather than making unfounded assumptions.
    """
    irrigation_status: str  # "VERIFIED_IRRIGATED", "RAINFED", "UNKNOWN"
    irrigation_status_label: str
    irrigation_source: Optional[str] = None
    field_area_ha: Optional[float] = None
    field_area_acres: Optional[float] = None
    drainage_condition: str
    slope_percent: Optional[float] = None
    planting_season: str
    in_planting_window: bool
    planting_window_status: str  # "OPTIMAL_NOW", "OPENING_SOON", "CLOSING_SOON", "OFF_SEASON", "WINDOW_UNVERIFIED"
    planting_window_label: str

    model_config = ConfigDict(from_attributes=True)


class CropSuitabilityItem(BaseModel):
    """
    Suitability assessment for a single crop against the selected field.
    """
    commodity_id: int
    crop_code: str
    crop_name: str
    crop_name_mr: str
    category: str
    scientific_name: Optional[str] = None
    overall_status: str  # "PRELIMINARY_SUITABLE", "CONDITIONAL_SUITABILITY", "POTENTIAL_CONSTRAINT", "INSUFFICIENT_DATA"
    overall_status_label: str
    summary_explanation: str
    criteria_results: List[CriterionEvaluationResult]
    non_soil_factors: NonSoilFactorsCheck
    missing_parameters: List[str] = Field(default_factory=list)
    identified_constraints: List[str] = Field(default_factory=list)
    agronomic_sources: List[str] = Field(default_factory=list)
    assessment_timestamp: datetime
    rule_version: str

    model_config = ConfigDict(from_attributes=True)


class SelectedFieldSoilSummary(BaseModel):
    """
    Summary of the selected cadastral field and its available soil inventory.
    """
    field_id: Optional[int] = None
    gat_no: str
    farmer_name: Optional[str] = None
    village_name: str
    taluka_name: str
    district_name: str
    state_name: str = "Maharashtra"
    area_ha: Optional[float] = None
    area_acres: Optional[float] = None
    soil_data_freshness_date: Optional[str] = None
    soil_parameters: List[EvaluatedParameterSoilData]
    has_lab_report: bool
    has_dsm_data: bool
    discrepancies_found: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class FieldSuitabilityResponse(BaseModel):
    """
    Root API response for field suitability analysis.
    """
    field_summary: SelectedFieldSoilSummary
    crops: List[CropSuitabilityItem]
    planning_season: str
    evaluation_date: date
    overall_field_readiness: str  # "DATA_AVAILABLE", "PARTIAL_DATA", "INSUFFICIENT_DATA"
    evidence_and_limitations_disclaimer: str

    model_config = ConfigDict(from_attributes=True)
