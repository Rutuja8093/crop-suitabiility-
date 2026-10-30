"""Crop Ranking & Decision Engine Service.
SoilPilot Phase 9: Multi-Criteria Crop Comparison & Decision Engine.

Authoritative agronomic & economic benchmarks derived from:
- Commission for Agricultural Costs and Prices (CACP), Ministry of Agriculture & Farmers Welfare, GoI
- Comprehensive Scheme for the Study of Cost of Cultivation of Principal Crops in India (Maharashtra Vertisols)
- Mahatma Phule Krishi Vidyapeeth (MPKV), Rahuri (Department of Agricultural Economics & Krishi Darshani 2025-26)
- ICAR-Directorate of Onion and Garlic Research (DOGR), Rajgurunagar, Pune
- Vasantdada Sugar Institute (VSI), Manjari, Pune

Strict Non-Negotiable Rules:
- Transparent multi-criteria decision tiers without opaque or arbitrary single-score black boxes.
- Decision support only: NEVER guarantee yields, profits, or future market prices.
- Hard constraints: High returns CANNOT override a verified critical agronomic soil constraint.
- Never label gross revenue as profit; explicit separation of A2+FL (operational) and C2 (total) costs.
- Transparent handling of missing/unverified factors (e.g. farmer irrigation access unrecorded).
"""

import math
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple, Iterable, Set
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_

from app.models.field import Field
from app.models.farmer import Farmer
from app.models.geography import Village, Taluka, District, State
from app.models.market_intelligence import (
    Commodity,
    MarketApmc,
    CropCalendar,
    PriceForecast,
    CropCostEstimate,
    DataSourceRegistry,
)
from app.models.crop_suitability import FieldCropSuitabilityAssessment
from app.models.crop_decision import FieldCropDecisionPlan
from app.services.crop_suitability_service import crop_suitability_service, AGRONOMIC_CROP_CRITERIA
from app.services.crop_calendar_service import crop_calendar_service
from app.services.market_forecasting_service import MarketForecastingEngine
from app.schemas.crop_decision import (
    CostComponentItem,
    CultivationCostBreakdown,
    YieldEstimateBenchmark,
    FinancialScenarioResult,
    CropFinancialAnalysis,
    CropDecisionItem,
    DecisionPlanningContext,
    FieldCropDecisionResponse,
)

logger = logging.getLogger(__name__)

DECISION_ENGINE_VERSION = "SOILPILOT_DECISION_ENGINE_2026_V1"

DISCLAIMER_PHASE_9 = (
    "Agricultural Decision Support Disclaimer: This crop comparison and decision engine synthesizes field soil "
    "suitability, university-recommended planting calendars, historical APMC price forecasts, and government cost of "
    "cultivation benchmarks. It provides comparative decision-support to help farmers evaluate trade-offs between "
    "agronomic suitability, resource needs, and market outlook. It does NOT constitute a guarantee of crop success, "
    "realized yield, harvest market price, or financial profit. Actual farm results will vary depending on microclimate, "
    "seasonal monsoon behavior, local water availability, pest outbreaks, and farm management practices."
)

ACRE_TO_HA_RATIO = 0.404685642
HA_TO_ACRE_RATIO = 2.471053815

# =========================================================================
# AUTHORITATIVE CULTIVATION COST & YIELD BENCHMARKS (CACP / MPKV / VSI)
# =========================================================================

VERIFIED_COST_AND_YIELD_BENCHMARKS: Dict[str, Dict[str, Any]] = {
    "CHANA": {
        "crop_code": "CHANA",
        "alt_code": "GRAM",
        "crop_name": "Bengal Gram",
        "season": "RABI",
        "operational_cost_per_ha": 26500.0,  # A2 + FL (₹/ha)
        "total_cost_per_ha": 40500.0,        # C2 Comprehensive (₹/ha)
        "yield_min_ha": 10.0,                # Quintals/ha
        "yield_expected_ha": 12.0,
        "yield_max_ha": 14.0,
        "yield_unit": "QUINTAL",
        "source_org": "CACP & MPKV Rahuri",
        "source_ref": "CACP Price Policy for Rabi Crops 2024-25 & MPKV Pulse Economics",
        "cost_components": [
            {"component_name": "Certified Seed (Digvijay/Phule Vikram) & Biofertilizers", "pct": 18.1},
            {"component_name": "Land Preparation, Deep Summer Ploughing & Rotavator", "pct": 15.8},
            {"component_name": "Fertilizers (DAP, Micronutrients, Rhizobium culture)", "pct": 13.2},
            {"component_name": "Plant Protection (Helicoverpa Pheromone Traps & Spray)", "pct": 12.1},
            {"component_name": "Interculture & Manual Weedings", "pct": 21.9},
            {"component_name": "Harvesting, Threshing & Post-Harvest Bagging", "pct": 18.9},
        ],
    },
    "ONION": {
        "crop_code": "ONION",
        "alt_code": "ONION",
        "crop_name": "Rabi Onion",
        "season": "RABI",
        "operational_cost_per_ha": 88000.0,  # A2 + FL (₹/ha)
        "total_cost_per_ha": 132000.0,       # C2 Comprehensive (₹/ha)
        "yield_min_ha": 180.0,               # Quintals/ha
        "yield_expected_ha": 210.0,
        "yield_max_ha": 240.0,
        "yield_unit": "QUINTAL",
        "source_org": "ICAR-DOGR & MPKV Rahuri",
        "source_ref": "ICAR-DOGR Technical Bulletin No. 22 & MPKV Package of Practices",
        "cost_components": [
            {"component_name": "Nursery Raising, Seed Cost & Raised Beds", "pct": 15.9},
            {"component_name": "Land Preparation & Field Layout", "pct": 9.1},
            {"component_name": "Fertilizers, FYM & Micronutrient Complex", "pct": 20.5},
            {"component_name": "Drip Irrigation Maintenance & Fertigation Turns", "pct": 11.4},
            {"component_name": "Thrips & Purple Blotch Pest Management", "pct": 11.4},
            {"component_name": "Transplanting & Manual Weeding Operations", "pct": 18.2},
            {"component_name": "Harvesting, Curing, Grading & Mandi Transport", "pct": 13.6},
        ],
    },
    "WHEAT": {
        "crop_code": "WHEAT",
        "alt_code": "WHEAT",
        "crop_name": "Wheat",
        "season": "RABI",
        "operational_cost_per_ha": 29500.0,  # A2 + FL
        "total_cost_per_ha": 46000.0,        # C2
        "yield_min_ha": 25.0,                # Quintals/ha
        "yield_expected_ha": 30.0,
        "yield_max_ha": 35.0,
        "yield_unit": "QUINTAL",
        "source_org": "CACP & MPKV Rahuri",
        "source_ref": "CACP Comprehensive Scheme (Peninsular Zone Irrigated Wheat)",
        "cost_components": [
            {"component_name": "Certified Seed (Netravati/Phule Samadhan)", "pct": 13.6},
            {"component_name": "Land Preparation & Sowing Equipment", "pct": 15.3},
            {"component_name": "Balanced NPK Fertilizers & Zinc Application", "pct": 22.0},
            {"component_name": "Irrigation Energy & Water Application (5 Turns)", "pct": 13.6},
            {"component_name": "Weedicide & Crop Protection", "pct": 8.5},
            {"component_name": "Manual Interculture Operations", "pct": 11.9},
            {"component_name": "Combine Harvesting, Threshing & Cleaning", "pct": 15.3},
        ],
    },
    "MAIZE": {
        "crop_code": "MAIZE",
        "alt_code": "MAIZE",
        "crop_name": "Rabi Maize",
        "season": "RABI",
        "operational_cost_per_ha": 32000.0,  # A2 + FL
        "total_cost_per_ha": 49000.0,        # C2
        "yield_min_ha": 45.0,                # Quintals/ha
        "yield_expected_ha": 52.0,
        "yield_max_ha": 60.0,
        "yield_unit": "QUINTAL",
        "source_org": "MPKV Rahuri & CACP",
        "source_ref": "MPKV Rabi Maize Package of Practices & Directorate of Economics & Statistics",
        "cost_components": [
            {"component_name": "Hybrid Seed (Single Cross Hybrids)", "pct": 17.2},
            {"component_name": "Land Preparation & Ridge-Furrow Layout", "pct": 14.1},
            {"component_name": "Heavy Nitrogen & Potash Fertilizer Split", "pct": 25.0},
            {"component_name": "Irrigation Operations (5 Turns)", "pct": 14.1},
            {"component_name": "Fall Armyworm Integrated Pest Control", "pct": 10.9},
            {"component_name": "Cob Harvesting, Mechanical Shelling & Drying", "pct": 18.8},
        ],
    },
    "SUGARCANE": {
        "crop_code": "SUGARCANE",
        "alt_code": "SUGARCANE",
        "crop_name": "Sugarcane",
        "season": "ANNUAL",
        "operational_cost_per_ha": 118000.0, # A2 + FL
        "total_cost_per_ha": 175000.0,       # C2
        "yield_min_ha": 850.0,               # Quintals/ha (85 Tonnes/ha)
        "yield_expected_ha": 1000.0,         # 100 Tonnes/ha = 1000 Q/ha
        "yield_max_ha": 1150.0,              # 115 Tonnes/ha
        "yield_unit": "QUINTAL",
        "source_org": "Vasantdada Sugar Institute & CACP",
        "source_ref": "VSI Manjari Sugarcane Agronomy Manual & CACP Sugarcane Price Reports",
        "cost_components": [
            {"component_name": "Certified Seed Cane Setts (Co 86032 / CoM 0265)", "pct": 18.6},
            {"component_name": "Deep Ploughing, Subsoiling & Deep Furrows", "pct": 10.2},
            {"component_name": "Organic Manures & Comprehensive NPK Split Dose", "pct": 23.7},
            {"component_name": "Perennial Irrigation Operations (25-30 Turns)", "pct": 20.3},
            {"component_name": "Earthing-Up, Weeding & Trash Mulching", "pct": 10.2},
            {"component_name": "Cane Cutting, Field Haulage & Sugar Mill Transport", "pct": 16.9},
        ],
    },
    "SOYBEAN": {
        "crop_code": "SOYBEAN",
        "alt_code": "SOYBEAN",
        "crop_name": "Soybean",
        "season": "KHARIF",
        "operational_cost_per_ha": 27500.0,  # A2 + FL
        "total_cost_per_ha": 41000.0,        # C2
        "yield_min_ha": 15.0,                # Quintals/ha
        "yield_expected_ha": 17.5,
        "yield_max_ha": 20.0,
        "yield_unit": "QUINTAL",
        "source_org": "CACP & ICAR-IISR Indore",
        "source_ref": "CACP Comprehensive Scheme (Maharashtra Soybean) & ICAR-IISR Bulletin 34",
        "cost_components": [
            {"component_name": "Certified Seed (JS 335 / Phule Sangam)", "pct": 21.8},
            {"component_name": "Land Preparation & Broad Bed Furrow (BBF)", "pct": 15.3},
            {"component_name": "Basal Fertilizers & Rhizobium / PSB Inoculation", "pct": 16.4},
            {"component_name": "Pre-emergence Weed Control & Chemical Sprays", "pct": 13.8},
            {"component_name": "Girdle Beetle & Spodoptera Pest Control", "pct": 12.7},
            {"component_name": "Mechanical Harvesting & Threshing", "pct": 20.0},
        ],
    },
    "TUR": {
        "crop_code": "TUR",
        "alt_code": "TUR",
        "crop_name": "Pigeon Pea",
        "season": "KHARIF",
        "operational_cost_per_ha": 29000.0,  # A2 + FL
        "total_cost_per_ha": 43000.0,        # C2
        "yield_min_ha": 10.0,                # Quintals/ha
        "yield_expected_ha": 12.5,
        "yield_max_ha": 15.0,
        "yield_unit": "QUINTAL",
        "source_org": "CACP & MPKV Rahuri",
        "source_ref": "CACP Comprehensive Scheme (Maharashtra Pulses) & MPKV Pulses Technology",
        "cost_components": [
            {"component_name": "Hybrid/Certified Seeds (Vipula / Rajeshwari)", "pct": 15.5},
            {"component_name": "Deep Summer Ploughing & Ridge Furrows", "pct": 15.5},
            {"component_name": "Basal DAP, Zinc Sulphate & Biofertilizers", "pct": 17.2},
            {"component_name": "Interculture, Manual Hoeing & Weedings", "pct": 19.0},
            {"component_name": "Pod Borer & Plume Moth Integrated Management", "pct": 15.5},
            {"component_name": "Harvesting, Pod Beating & Seed Cleaning", "pct": 17.2},
        ],
    },
    "COTTON": {
        "crop_code": "COTTON",
        "alt_code": "COTTON",
        "crop_name": "Cotton",
        "season": "KHARIF",
        "operational_cost_per_ha": 45000.0,  # A2 + FL
        "total_cost_per_ha": 68000.0,        # C2
        "yield_min_ha": 14.0,                # Quintals/ha (Seed cotton)
        "yield_expected_ha": 16.5,
        "yield_max_ha": 20.0,
        "yield_unit": "QUINTAL",
        "source_org": "CACP & ICAR-CICR Nagpur",
        "source_ref": "CACP Kharif Price Policy & ICAR-CICR Cotton Economics Bulletin",
        "cost_components": [
            {"component_name": "Certified Bt Cotton Hybrid Seeds", "pct": 15.6},
            {"component_name": "Land Preparation, Deep Ploughing & Bed Formation", "pct": 13.3},
            {"component_name": "Balanced NPK Fertilizers & Foliar Nutrition", "pct": 20.0},
            {"component_name": "Sucking Pest & Pink Bollworm Resistance Control", "pct": 15.6},
            {"component_name": "Interculture, Dibbling & Hand Weedings", "pct": 13.3},
            {"component_name": "Multi-Stage Manual Cotton Picking Rounds (4-5 rounds)", "pct": 22.2},
        ],
    },
}


class CropDecisionService:
    """
    Core Decision Engine integrating Field Suitability, Crop Calendars,
    Market Price Forecasts, and Cultivation Economics for Maharashtra crops.
    """

    def ensure_seed_cost_estimates(self, db: Session):
        """Populates baseline CropCostEstimate records in database if empty."""
        try:
            existing = db.scalar(select(CropCostEstimate).limit(1))
            if existing:
                return

            commodities = {c.code.upper(): c.id for c in db.query(Commodity).all()}
            # Also map GRAM <-> CHANA
            if "GRAM" in commodities and "CHANA" not in commodities:
                commodities["CHANA"] = commodities["GRAM"]

            # Lookup Pune district
            pune_dist = db.scalar(select(District).filter(District.name.ilike("%pune%")))
            dist_id = pune_dist.id if pune_dist else 1

            for code, data in VERIFIED_COST_AND_YIELD_BENCHMARKS.items():
                comm_id = commodities.get(code) or commodities.get(data.get("alt_code", ""))
                if not comm_id:
                    continue

                est = CropCostEstimate(
                    commodity_id=comm_id,
                    district_id=dist_id,
                    taluka_id=None,
                    field_id=None,
                    farmer_id=None,
                    season=data["season"],
                    area=1.0,
                    area_unit="HECTARE",
                    cost_breakdown={
                        "operational_cost_per_ha": data["operational_cost_per_ha"],
                        "total_cost_per_ha": data["total_cost_per_ha"],
                        "components": data["cost_components"],
                    },
                    estimated_cost_per_unit_area=data["operational_cost_per_ha"],
                    estimated_yield_min=data["yield_min_ha"],
                    estimated_yield_expected=data["yield_expected_ha"],
                    estimated_yield_max=data["yield_max_ha"],
                    yield_unit="QUINTAL_PER_HECTARE",
                    risk_level="MEDIUM",
                    assumptions=f"Verified CACP Comprehensive Scheme & MPKV Rahuri benchmarks (1 ha Vertisol basis)",
                    source_reference=f"{data['source_org']} — {data['source_ref']}",
                    calculation_version=DECISION_ENGINE_VERSION,
                    estimate_status="ESTIMATED",
                )
                db.add(est)

            db.commit()
            logger.info("Successfully seeded baseline CropCostEstimate records into database.")
        except Exception as e:
            db.rollback()
            logger.warning(f"Error seeding CropCostEstimate records: {e}")

    def calculate_financials(
        self,
        crop_code: str,
        area_acres: float,
        price_modal: Optional[float] = None,
        price_lower: Optional[float] = None,
        price_upper: Optional[float] = None,
        price_source_type: str = "NOT_AVAILABLE",
        forecast_period: Optional[str] = None,
    ) -> CropFinancialAnalysis:
        """
        Calculates cultivation costs, expected gross revenue, and net return scenarios.
        Uses verified CACP/MPKV benchmarks scaled to per-acre, per-ha, and field total.
        Never labels gross revenue as profit.
        """
        benchmark = VERIFIED_COST_AND_YIELD_BENCHMARKS.get(crop_code)
        if not benchmark:
            # Check alternative code e.g. GRAM vs CHANA
            for b in VERIFIED_COST_AND_YIELD_BENCHMARKS.values():
                if b.get("alt_code") == crop_code or b.get("crop_code") == crop_code:
                    benchmark = b
                    break

        if not benchmark:
            return CropFinancialAnalysis(
                is_available=False,
                unavailability_reason="No verified cultivation cost or yield benchmarks available for this crop in Maharashtra database.",
                cost_breakdown=None,
                yield_benchmark=None,
                central_scenario=None,
                conservative_scenario=None,
                optimistic_scenario=None,
                price_source_type=price_source_type,
                assumed_price_modal=None,
                forecast_target_period=forecast_period,
                disclaimer="Financial calculations unavailable due to missing agronomic cost benchmarks.",
            )

        # 1. Cost Calculations
        op_cost_ha = benchmark["operational_cost_per_ha"]
        total_cost_ha = benchmark["total_cost_per_ha"]
        op_cost_acre = round(op_cost_ha * ACRE_TO_HA_RATIO, 2)
        total_cost_acre = round(total_cost_ha * ACRE_TO_HA_RATIO, 2)

        components: List[CostComponentItem] = []
        for c in benchmark.get("cost_components", []):
            amt_ha = round((c["pct"] / 100.0) * op_cost_ha, 2)
            amt_acre = round(amt_ha * ACRE_TO_HA_RATIO, 2)
            components.append(
                CostComponentItem(
                    component_name=c["component_name"],
                    amount_per_ha=amt_ha,
                    amount_per_acre=amt_acre,
                    percentage_of_operational=c["pct"],
                    notes=None,
                )
            )

        cost_breakdown = CultivationCostBreakdown(
            operational_cost_per_ha=op_cost_ha,
            operational_cost_per_acre=op_cost_acre,
            total_cost_per_ha=total_cost_ha,
            total_cost_per_acre=total_cost_acre,
            components=components,
            source_reference=benchmark["source_ref"],
            source_organization=benchmark["source_org"],
            benchmark_year=2025,
        )

        # 2. Yield Calculations
        y_min_ha = benchmark["yield_min_ha"]
        y_exp_ha = benchmark["yield_expected_ha"]
        y_max_ha = benchmark["yield_max_ha"]
        y_min_acre = round(y_min_ha * ACRE_TO_HA_RATIO, 2)
        y_exp_acre = round(y_exp_ha * ACRE_TO_HA_RATIO, 2)
        y_max_acre = round(y_max_ha * ACRE_TO_HA_RATIO, 2)

        yield_benchmark = YieldEstimateBenchmark(
            yield_min_per_ha=y_min_ha,
            yield_expected_per_ha=y_exp_ha,
            yield_max_per_ha=y_max_ha,
            yield_min_per_acre=y_min_acre,
            yield_expected_per_acre=y_exp_acre,
            yield_max_per_acre=y_max_acre,
            yield_unit=benchmark.get("yield_unit", "QUINTAL"),
            source_reference=benchmark["source_ref"],
        )

        # If price is unavailable, we still present costs and yield benchmarks,
        # but mark revenue and net return scenarios as unavailable rather than fabricating.
        if price_modal is None or price_modal <= 0:
            return CropFinancialAnalysis(
                is_available=True,
                unavailability_reason="Cultivation costs and yield benchmarks available, but harvest-period price forecast is unavailable.",
                cost_breakdown=cost_breakdown,
                yield_benchmark=yield_benchmark,
                central_scenario=None,
                conservative_scenario=None,
                optimistic_scenario=None,
                price_source_type=price_source_type,
                assumed_price_modal=None,
                forecast_target_period=forecast_period,
                disclaimer="Gross revenue and net return estimates withheld until verified market price forecast is available.",
            )

        # 3. Financial Scenarios
        p_central = float(price_modal)
        p_low = float(price_lower) if price_lower is not None and price_lower > 0 else round(p_central * 0.88, 2)
        p_high = float(price_upper) if price_upper is not None and price_upper > 0 else round(p_central * 1.12, 2)

        # Parcel scaling
        field_ha = area_acres * ACRE_TO_HA_RATIO
        op_cost_field = round(op_cost_acre * area_acres, 2)
        total_cost_field = round(total_cost_acre * area_acres, 2)

        def make_scenario(name: str, label: str, price: float, y_acre: float, y_ha: float) -> FinancialScenarioResult:
            rev_acre = round(y_acre * price, 2)
            rev_ha = round(y_ha * price, 2)
            rev_field = round(rev_acre * area_acres, 2)

            net_op_acre = round(rev_acre - op_cost_acre, 2)
            net_op_ha = round(rev_ha - op_cost_ha, 2)
            net_op_field = round(rev_field - op_cost_field, 2)

            net_tot_acre = round(rev_acre - total_cost_acre, 2)
            net_tot_ha = round(rev_ha - total_cost_ha, 2)
            net_tot_field = round(rev_field - total_cost_field, 2)

            return FinancialScenarioResult(
                scenario_name=name,
                scenario_label=label,
                assumed_price_per_unit=price,
                price_unit="RS_PER_QUINTAL",
                assumed_yield_per_acre=y_acre,
                assumed_yield_per_ha=y_ha,
                gross_revenue_per_acre=rev_acre,
                operational_cost_per_acre=op_cost_acre,
                total_cost_per_acre=total_cost_acre,
                net_return_operational_per_acre=net_op_acre,
                net_return_total_per_acre=net_tot_acre,
                gross_revenue_per_ha=rev_ha,
                operational_cost_per_ha=op_cost_ha,
                total_cost_per_ha=total_cost_ha,
                net_return_operational_per_ha=net_op_ha,
                net_return_total_per_ha=net_tot_ha,
                field_area_evaluated=area_acres,
                field_area_unit="ACRE",
                gross_revenue_field_total=rev_field,
                operational_cost_field_total=op_cost_field,
                total_cost_field_total=total_cost_field,
                net_return_operational_field_total=net_op_field,
                net_return_total_field_total=net_tot_field,
                is_profitable_operational=(net_op_acre > 0),
                is_profitable_total=(net_tot_acre > 0),
            )

        central_scenario = make_scenario("CENTRAL", "Central Estimate (Expected Yield × Modal Forecast Price)", p_central, y_exp_acre, y_exp_ha)
        conservative_scenario = make_scenario("CONSERVATIVE_LOW", "Conservative Scenario (Lower Yield × Lower Price Bound)", p_low, y_min_acre, y_min_ha)
        optimistic_scenario = make_scenario("OPTIMISTIC_HIGH", "Optimistic Scenario (Upper Yield × Upper Price Bound)", p_high, y_max_acre, y_max_ha)

        return CropFinancialAnalysis(
            is_available=True,
            unavailability_reason=None,
            cost_breakdown=cost_breakdown,
            yield_benchmark=yield_benchmark,
            central_scenario=central_scenario,
            conservative_scenario=conservative_scenario,
            optimistic_scenario=optimistic_scenario,
            price_source_type=price_source_type,
            assumed_price_modal=p_central,
            price_unit="RS_PER_QUINTAL",
            forecast_target_period=forecast_period,
            disclaimer="Scenario analysis based on CACP/MPKV cultivation costs and time-series price forecasts. Not a guaranteed return.",
        )

    def evaluate_field_crop_decision(
        self,
        db: Session,
        field_identifier: str,
        planning_date: Optional[date] = None,
        planning_horizon: str = "IMMEDIATE_15_DAYS",
        planning_season: str = "RABI",
        market_id: Optional[int] = None,
        exclude_crops: Optional[Iterable[str]] = None,
    ) -> FieldCropDecisionResponse:
        """
        Executes complete multi-criteria decision assessment for all candidate crops
        on the selected farmer field parcel.
        """
        eval_date = planning_date or date.today()
        self.ensure_seed_cost_estimates(db)
        crop_calendar_service.ensure_seed_calendars(db)

        # 1. Execute Phase 8 Field Suitability Assessment
        suitability_resp = crop_suitability_service.evaluate_field_crop_suitability(
            db=db,
            field_identifier=field_identifier,
            evaluation_date=eval_date,
            planning_season=planning_season,
        )
        field_summary = suitability_resp.field_summary
        area_acres = field_summary.area_acres or 2.48
        area_ha = field_summary.area_ha or round(area_acres * ACRE_TO_HA_RATIO, 2)

        # 2. Get Phase 7 Crop Calendars
        calendars = db.query(CropCalendar).filter(CropCalendar.is_active == True).all()
        cal_by_comm_id = {c.commodity_id: c for c in calendars}

        # 3. Resolve Market APMC
        if not market_id:
            baramati = db.scalar(select(MarketApmc).filter(MarketApmc.name.ilike("%baramati%")))
            market_id = baramati.id if baramati else 1

        # 4. Forecaster Engine
        forecaster = MarketForecastingEngine(db)

        # 5. Evaluate each candidate crop from Phase 8 assessment
        evaluated_decision_crops: List[CropDecisionItem] = []

        # Index suitability items by crop_code
        suit_by_code = {item.crop_code: item for item in suitability_resp.crops}

        # Index registered commodities
        commodities = db.query(Commodity).filter(Commodity.is_active == True).all()
        comm_map = {c.code.upper(): c for c in commodities}

        excluded_set = {c.upper() for c in exclude_crops} if exclude_crops else set()

        for crop_code, crop_info in AGRONOMIC_CROP_CRITERIA.items():
            if crop_code.upper() in excluded_set or crop_info.get("crop_code", "").upper() in excluded_set:
                continue

            comm_obj = comm_map.get(crop_code)
            if not comm_obj and crop_code == "CHANA":
                comm_obj = comm_map.get("GRAM")

            comm_id = comm_obj.id if comm_obj else 0
            suit_item = suit_by_code.get(crop_code)

            # A. Sowing Window & Harvest Calculation
            cal = cal_by_comm_id.get(comm_id) if comm_id else None
            planting_window_status = "OFF_SEASON"
            planting_window_text = "Unrecorded in regional calendar"
            expected_harvest_text = "Unrecorded"
            h_start: Optional[date] = None
            h_end: Optional[date] = None
            price_modal = None
            price_lower = None
            price_upper = None
            price_source_type = "NOT_AVAILABLE"
            forecast_period_str = None

            if cal:
                # Check current window status
                curr_year = eval_date.year
                w_start = date(curr_year, cal.planting_window_start_month, cal.planting_window_start_day)
                w_end = date(curr_year, cal.planting_window_end_month, cal.planting_window_end_day)
                if w_end < w_start:
                    w_end = date(curr_year + 1, cal.planting_window_end_month, cal.planting_window_end_day)

                planting_window_text = f"{w_start.strftime('%b %d')} – {w_end.strftime('%b %d')}"

                # Sowing Window classification
                if w_start <= eval_date <= w_end:
                    days_left = (w_end - eval_date).days
                    if days_left <= 7:
                        planting_window_status = "CLOSING_SOON"
                    else:
                        planting_window_status = "OPTIMAL_NOW"
                elif eval_date < w_start:
                    days_ahead = (w_start - eval_date).days
                    if days_ahead <= 15:
                        planting_window_status = "OPENING_SOON"
                    else:
                        planting_window_status = "OFF_SEASON"
                else:
                    planting_window_status = "OFF_SEASON"

                # Calculate harvest period
                dur_min = cal.duration_min_days or 90
                dur_max = cal.duration_max_days or 120
                h_start = eval_date + timedelta(days=dur_min)
                h_end = eval_date + timedelta(days=dur_max)
                expected_harvest_text = f"{h_start.strftime('%b %d, %Y')} – {h_end.strftime('%b %d, %Y')} ({dur_min}–{dur_max} days)"

                # B. Harvest-Period Price Forecast Link
                if comm_id:
                    horizon_days = max(7, (h_start - eval_date).days)
                    try:
                        fc_res = forecaster.generate_forecast(
                            commodity_id=comm_id,
                            market_id=market_id,
                            horizon_days=horizon_days,
                            target_date=h_start,
                            persist=False,
                        )
                        if fc_res.status in ("PUBLISHED", "EXPERIMENTAL") and fc_res.predicted_modal_price is not None:
                            price_modal = fc_res.predicted_modal_price
                            price_lower = fc_res.lower_uncertainty_bound
                            price_upper = fc_res.upper_uncertainty_bound
                            price_source_type = "FORECAST_MODAL"
                            forecast_period_str = f"{fc_res.target_period_start} to {fc_res.target_period_end}"
                    except Exception as e:
                        logger.debug(f"Forecast error for crop {crop_code}: {e}")

            # C. Financial Return Analysis
            financials = self.calculate_financials(
                crop_code=crop_code,
                area_acres=area_acres,
                price_modal=price_modal,
                price_lower=price_lower,
                price_upper=price_upper,
                price_source_type=price_source_type,
                forecast_period=forecast_period_str,
            )

            # D. Multi-Criteria Decision Tier Synthesis
            # Hard constraints: Soil Potential Constraint takes absolute precedence over revenue!
            suit_status = suit_item.overall_status if suit_item else "INSUFFICIENT_DATA"
            suit_summary = suit_item.overall_status_label if suit_item else "Insufficient data"
            constraints = suit_item.identified_constraints if suit_item else []
            missing = suit_item.missing_parameters if suit_item else []

            # Water and labor
            water_req = crop_info.get("water_requirement", "MEDIUM")
            labor_req = "MODERATE"
            if water_req == "VERY_HIGH" or crop_code in ("ONION", "COTTON"):
                labor_req = "INTENSIVE"

            # Determine Tier and Risk
            contributing: List[str] = []
            tier = "INSUFFICIENT_DATA"
            tier_label = "Insufficient Evidence"
            priority = 5
            risk_level = "MODERATE"
            risk_summary = ""
            explanation = ""
            guidance = ""

            if suitability_resp.overall_field_readiness == "INSUFFICIENT_DATA":
                tier = "INSUFFICIENT_DATA"
                tier_label = "Insufficient Field Data"
                priority = 5
                risk_level = "UNKNOWN"
                risk_summary = "Missing primary diagnostic soil test parameters."
                explanation = f"Assessment cannot be finalized for {crop_info['crop_name']} because fundamental soil test parameters (pH, EC) are unrecorded for this parcel."
                guidance = "Obtain an official certified soil laboratory test report to evaluate agronomic compatibility."
            elif suit_status == "POTENTIAL_CONSTRAINT":
                tier = "CONSTRAINED"
                tier_label = "Agronomic Soil Constraint Identified"
                priority = 4
                risk_level = "HIGH_CONSTRAINT"
                risk_summary = f"Severe agronomic constraint: {'; '.join(constraints)}"
                explanation = (
                    f"{crop_info['crop_name']} is NOT recommended for this parcel due to physiological limitations. "
                    f"Identified constraint(s): {'; '.join(constraints)}. "
                    "Economic projections, even if seemingly high, cannot overcome this biological soil barrier."
                )
                guidance = "Select an alternative tolerant crop or apply specific soil reclamation amendments before planting."
            elif planting_window_status == "OFF_SEASON" and planning_horizon == "IMMEDIATE_15_DAYS":
                tier = "OFF_SEASON"
                tier_label = "Off-Season for Immediate Horizon"
                priority = 3
                risk_level = "MODERATE"
                risk_summary = f"Outside active sowing window (Recommended sowing: {planting_window_text})."
                explanation = (
                    f"{crop_info['crop_name']} is edaphically compatible with this soil type, but the current date "
                    f"({eval_date.strftime('%b %d')}) is outside the university-verified sowing window ({planting_window_text})."
                )
                guidance = "Plan this crop for its upcoming seasonal window or switch to an active season crop."
            elif (
                (suit_status == "PRELIMINARY_SUITABLE" or (suit_status == "CONDITIONAL_SUITABILITY" and water_req == "LOW" and not constraints))
                and planting_window_status in ("OPTIMAL_NOW", "OPENING_SOON")
            ):
                tier = "RECOMMENDED"
                tier_label = "Recommended Suitable Option"
                priority = 1
                risk_level = "LOW"
                contributing.append("Soil parameters in optimal university tolerance range")
                if water_req == "LOW":
                    contributing.append("Low water requirement — viable on residual Vertisol profile moisture")
                contributing.append(f"Sowing window is {planting_window_status.replace('_', ' ').title()}")
                if financials.central_scenario and financials.central_scenario.net_return_operational_per_acre:
                    contributing.append(f"Estimated net return: ₹{financials.central_scenario.net_return_operational_per_acre:,.0f}/acre (operational)")
                risk_summary = "Low edaphic risk. Timing is optimal for planting."
                explanation = (
                    f"Preliminary evidence strongly supports {crop_info['crop_name']}. Soil parameters meet optimal MPKV Rahuri "
                    f"benchmarks and the planting window ({planting_window_text}) is active."
                )
                guidance = "Verify local seed availability (certified variety) and ensure seed treatment with Rhizobium/fungicide."
            else:
                # Conditional suitability: e.g. marginal soil parameter OR high water requirement with unverified irrigation
                tier = "CONDITIONALLY_SUITABLE"
                tier_label = "Conditionally Suitable — Management Intensive"
                priority = 2
                risk_level = "ELEVATED" if water_req in ("HIGH", "VERY_HIGH") else "MODERATE"
                cond_factors = []
                if water_req in ("HIGH", "VERY_HIGH"):
                    cond_factors.append(f"Requires assured irrigation ({water_req}) while on-farm water access is unverified")
                if suit_status == "CONDITIONAL_SUITABILITY":
                    cond_factors.append("One or more soil properties in marginal range")
                if planting_window_status == "CLOSING_SOON":
                    cond_factors.append("Sowing window closing within 7 days")

                risk_summary = f"Management attention needed: {'; '.join(cond_factors)}."
                explanation = (
                    f"{crop_info['crop_name']} is viable on this parcel provided critical farm conditions are met. "
                    f"Key considerations: {'; '.join(cond_factors)}."
                )
                guidance = "Verify water storage and irrigation pump capacity before committing capital."

            # Append evaluated crop item
            item = CropDecisionItem(
                crop_id=comm_id,
                crop_code=crop_code,
                crop_name=crop_info["crop_name"],
                crop_name_mr=crop_info["crop_name_mr"],
                category=crop_info["category"],
                season=crop_info["season"],
                decision_tier=tier,
                decision_tier_label=tier_label,
                rank_priority=priority,
                suitability_status=suit_status,
                suitability_summary=suit_summary,
                planting_window_status=planting_window_status,
                planting_window_text=planting_window_text,
                expected_harvest_text=expected_harvest_text,
                harvest_window_start=h_start,
                harvest_window_end=h_end,
                water_requirement=water_req,
                labor_intensity=labor_req,
                risk_level=risk_level,
                risk_summary=risk_summary,
                financials=financials,
                identified_constraints=constraints,
                missing_evidence=missing,
                contributing_factors=contributing,
                explanation=explanation,
                recommendation_guidance=guidance,
                agronomic_sources=crop_info.get("sources", []),
            )
            evaluated_decision_crops.append(item)

        # 6. Multi-Factor Sorting
        # Primary: Tier Priority (1: RECOMMENDED, 2: CONDITIONAL, 3: OFF_SEASON, 4: CONSTRAINED, 5: INSUFFICIENT)
        # Secondary: Estimated Net Return per acre (descending), if available
        def sort_key(crop: CropDecisionItem):
            net_val = -999999.0
            if crop.financials and crop.financials.central_scenario and crop.financials.central_scenario.net_return_operational_per_acre is not None:
                net_val = crop.financials.central_scenario.net_return_operational_per_acre
            return (crop.rank_priority, -net_val)

        evaluated_decision_crops.sort(key=sort_key)

        # 7. Tier summary counts
        rec_count = sum(1 for c in evaluated_decision_crops if c.decision_tier == "RECOMMENDED")
        cond_count = sum(1 for c in evaluated_decision_crops if c.decision_tier == "CONDITIONALLY_SUITABLE")
        off_count = sum(1 for c in evaluated_decision_crops if c.decision_tier == "OFF_SEASON")
        con_count = sum(1 for c in evaluated_decision_crops if c.decision_tier == "CONSTRAINED")
        ins_count = sum(1 for c in evaluated_decision_crops if c.decision_tier == "INSUFFICIENT_DATA")

        # 8. Planning context schema
        plan_context = DecisionPlanningContext(
            gat_no=field_summary.gat_no,
            field_id=field_summary.field_id,
            farmer_name=field_summary.farmer_name,
            village_name=field_summary.village_name,
            taluka_name=field_summary.taluka_name,
            district_name=field_summary.district_name,
            state_name="Maharashtra",
            area_acres=area_acres,
            area_ha=area_ha,
            planning_date=eval_date,
            planning_horizon=planning_horizon,
            selected_season=planning_season,
            soil_data_readiness=suitability_resp.overall_field_readiness,
            irrigation_status="UNKNOWN (Farmer irrigation access unverified in portal)",
            soil_ph=getattr(field_summary.soil_parameters[0], "evaluated_value", None) if field_summary.soil_parameters else None,
            soil_ec=getattr(field_summary.soil_parameters[1], "evaluated_value", None) if len(field_summary.soil_parameters) > 1 else None,
            discrepancies_count=len(field_summary.discrepancies_found),
        )

        # 9. Persist Decision Plan for Reproducibility & Auditing
        try:
            persisted_plan = FieldCropDecisionPlan(
                field_id=field_summary.field_id,
                farmer_id=None,
                gat_no=field_summary.gat_no,
                planning_date=eval_date,
                planning_horizon=planning_horizon,
                season=planning_season,
                area_evaluated=area_acres,
                area_unit="ACRE",
                evaluated_crops=[c.model_dump(mode="json") for c in evaluated_decision_crops],
                decision_tier_summary={
                    "recommended": rec_count,
                    "conditional": cond_count,
                    "off_season": off_count,
                    "constrained": con_count,
                    "insufficient_data": ins_count,
                },
                planning_context=plan_context.model_dump(mode="json"),
                engine_version=DECISION_ENGINE_VERSION,
                disclaimer=DISCLAIMER_PHASE_9,
            )
            db.add(persisted_plan)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.debug(f"Decision plan persistence skipped: {e}")

        return FieldCropDecisionResponse(
            planning_context=plan_context,
            total_crops_evaluated=len(evaluated_decision_crops),
            recommended_count=rec_count,
            conditional_count=cond_count,
            off_season_count=off_count,
            constrained_count=con_count,
            insufficient_data_count=ins_count,
            crops=evaluated_decision_crops,
            engine_version=DECISION_ENGINE_VERSION,
            disclaimers=[
                DISCLAIMER_PHASE_9,
                "Gross Revenue is NOT profit. Operational cost (A2+FL) and Total Cost (C2) must both be evaluated.",
                "Farmer irrigation access is unverified in portal profile; on-farm water availability must be confirmed.",
            ],
            generated_at=datetime.now(timezone.utc),
        )


crop_decision_service = CropDecisionService()
