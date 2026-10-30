"""Database models for SoilPilot Phase 2.

Entities:
- State
- District
- Taluka
- Village
- Farmer
- Field
"""

from app.db.base import Base
from app.models.geography import State, District, Taluka, Village
from app.models.farmer import Farmer
from app.models.field import Field
from app.models.soil_health import SoilReport, SoilParameterValue
from app.models.gat_farmer import GatFarmer
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
from app.models.crop_suitability import FieldCropSuitabilityAssessment
from app.models.crop_decision import FieldCropDecisionPlan

__all__ = [
    "Base",
    "State",
    "District",
    "Taluka",
    "Village",
    "Farmer",
    "Field",
    "SoilReport",
    "SoilParameterValue",
    "GatFarmer",
    "DataSourceRegistry",
    "Commodity",
    "MarketApmc",
    "CommodityMarketMapping",
    "MarketPriceObservation",
    "CropCalendar",
    "PriceForecast",
    "CropCostEstimate",
    "FieldCropSuitabilityAssessment",
    "FieldCropDecisionPlan",
]
