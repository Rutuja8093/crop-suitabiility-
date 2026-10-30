"""
SoilPilot Market Intelligence & Crop Planner — Smart Planting Calendar Service
Phase 7: Planting Calendar & Crop Planning Windows for Maharashtra Agro-Climatic Zones

Derives planting windows, indicative harvest dates, and links to Phase 6 price forecasts
using verified agronomic standards from Mahatma Phule Krishi Vidyapeeth (MPKV), Rahuri.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_

from app.models.geography import State, District, Taluka
from app.models.field import Field
from app.models.soil_health import SoilReport, SoilParameterValue
from app.models.market_intelligence import (
    Commodity,
    MarketApmc,
    CropCalendar,
    DataSourceRegistry,
    PriceForecast,
)
from app.schemas.market_intelligence import (
    PlantingOptionItem,
    HarvestPriceOutlook,
    FieldSoilContext,
    Next15DaysPlanningResponse,
    SeasonalPlanningResponse,
)
from app.services.market_forecasting_service import MarketForecastingEngine

logger = logging.getLogger(__name__)

DISCLAIMER_PHASE_7 = (
    "Agricultural Planning Disclaimer: Planting windows and crop duration estimates are derived from "
    "Mahatma Phule Krishi Vidyapeeth (MPKV), Rahuri Krishi Darshani standards for Maharashtra agro-climatic zones. "
    "Actual germination, maturity dates, and yields will vary based on micro-climatic temperature, monsoon withdrawal, "
    "soil moisture reserves, cultivar genetics, and local farm management. This tool provides agronomic decision-support "
    "and does not constitute a guaranteed crop outcome or financial return."
)

DURATION_DEFINITION_STANDARD = (
    "Days from direct field sowing to physiological maturity & harvest (MPKV Rahuri Vertisol Standard)"
)


class CropCalendarService:
    """Service orchestrating Maharashtra planting windows, harvest horizons, and forecast links."""

    def ensure_seed_calendars(self, db: Session):
        """Seeds verified MPKV Rahuri crop calendars if not already populated."""
        # 1. Ensure MPKV Rahuri source registry
        source = db.scalar(select(DataSourceRegistry).filter_by(code="MPKV_RAHURI"))
        if not source:
            source = DataSourceRegistry(
                code="MPKV_RAHURI",
                name="Mahatma Phule Krishi Vidyapeeth (MPKV), Rahuri",
                source_type="AGRICULTURAL_UNIVERSITY",
                official_url="https://mpkv.ac.in",
                access_method="OFFICIAL_BULLETIN",
                licensing_notes="Official Krishi Darshani Package of Practices for Maharashtra Vertisols",
                update_frequency="SEASONAL",
                operational_status="ACTIVE",
                is_active=True,
            )
            db.add(source)
            db.flush()

        # Check existing count
        existing_count = db.scalar(select(CropCalendar).limit(1))
        if existing_count:
            return  # Already seeded

        # Lookup MH State
        mh_state = db.scalar(select(State).filter_by(code="MH"))
        state_id = mh_state.id if mh_state else 1

        # Lookup Commodities
        commodities = {c.code: c.id for c in db.query(Commodity).all()}

        # Verified Crop Calendars for Western Maharashtra Agro-Climatic Zone
        # Reference: MPKV Rahuri Krishi Darshani (2025-26) Package of Practices
        VERIFIED_CALENDARS = [
            # 1. BENGAL GRAM / CHANA (RABI)
            {
                "comm_code": "GRAM",
                "season": "RABI",
                "start_m": 10, "start_d": 1,
                "end_m": 11, "end_d": 10,
                "dur_min": 95, "dur_max": 110,
                "harvest_start_m": 1, "harvest_start_d": 15,
                "harvest_end_m": 2, "harvest_end_d": 28,
                "water": "LOW",
                "labor": "MODERATE",
                "ref": "MPKV Rahuri Krishi Darshani 2025-26 Package of Practices",
            },
            # 2. RABI ONION (RABI)
            {
                "comm_code": "ONION",
                "season": "RABI",
                "start_m": 10, "start_d": 15,
                "end_m": 11, "end_d": 30,
                "dur_min": 110, "dur_max": 130,
                "harvest_start_m": 2, "harvest_start_d": 20,
                "harvest_end_m": 4, "harvest_end_d": 15,
                "water": "HIGH",
                "labor": "INTENSIVE",
                "ref": "MPKV Rahuri & ICAR-DOGR Rajgurunagar PoP",
            },
            # 3. WHEAT (RABI)
            {
                "comm_code": "WHEAT",
                "season": "RABI",
                "start_m": 11, "start_d": 1,
                "end_m": 11, "end_d": 30,
                "dur_min": 105, "dur_max": 125,
                "harvest_start_m": 3, "harvest_start_d": 1,
                "harvest_end_m": 3, "harvest_end_d": 31,
                "water": "HIGH",
                "labor": "MODERATE",
                "ref": "MPKV Rahuri Krishi Darshani 2025-26 Package of Practices",
            },
            # 4. RABI MAIZE (RABI)
            {
                "comm_code": "MAIZE",
                "season": "RABI",
                "start_m": 10, "start_d": 15,
                "end_m": 11, "end_d": 15,
                "dur_min": 95, "dur_max": 115,
                "harvest_start_m": 2, "harvest_start_d": 1,
                "harvest_end_m": 3, "harvest_end_d": 15,
                "water": "MEDIUM",
                "labor": "MODERATE",
                "ref": "MPKV Rahuri Krishi Darshani Package of Practices",
            },
            # 5. SOYBEAN (KHARIF)
            {
                "comm_code": "SOYBEAN",
                "season": "KHARIF",
                "start_m": 6, "start_d": 20,
                "end_m": 7, "end_d": 15,
                "dur_min": 90, "dur_max": 105,
                "harvest_start_m": 9, "harvest_start_d": 25,
                "harvest_end_m": 10, "harvest_end_d": 30,
                "water": "MEDIUM",
                "labor": "MODERATE",
                "ref": "MPKV Rahuri Krishi Darshani / ICAR-IISR",
            },
            # 6. COTTON (KHARIF)
            {
                "comm_code": "COTTON",
                "season": "KHARIF",
                "start_m": 6, "start_d": 1,
                "end_m": 7, "end_d": 10,
                "dur_min": 150, "dur_max": 180,
                "harvest_start_m": 11, "harvest_start_d": 15,
                "harvest_end_m": 1, "harvest_end_d": 31,
                "water": "HIGH",
                "labor": "INTENSIVE",
                "ref": "MPKV Rahuri & Dr. PDKV Akola Package of Practices",
            },
            # 7. PIGEON PEA / TUR (KHARIF)
            {
                "comm_code": "TUR",
                "season": "KHARIF",
                "start_m": 6, "start_d": 15,
                "end_m": 7, "end_d": 15,
                "dur_min": 150, "dur_max": 180,
                "harvest_start_m": 12, "harvest_start_d": 15,
                "harvest_end_m": 1, "harvest_end_d": 31,
                "water": "MEDIUM",
                "labor": "MODERATE",
                "ref": "MPKV Rahuri Krishi Darshani",
            },
            # 8. PRE-SEASONAL SUGARCANE (ANNUAL)
            {
                "comm_code": "SUGARCANE",
                "season": "ANNUAL",
                "start_m": 10, "start_d": 15,
                "end_m": 11, "end_d": 15,
                "dur_min": 360, "dur_max": 420,
                "harvest_start_m": 10, "harvest_start_d": 15,
                "harvest_end_m": 12, "harvest_end_d": 31,
                "water": "VERY_HIGH",
                "labor": "INTENSIVE",
                "ref": "MPKV Rahuri Krishi Darshani & VSI Pune",
            },
        ]

        for cal in VERIFIED_CALENDARS:
            comm_id = commodities.get(cal["comm_code"])
            if not comm_id:
                continue

            entry = CropCalendar(
                commodity_id=comm_id,
                state_id=state_id,
                district_id=None,  # Applies to Western Maharashtra Vertisols
                season=cal["season"],
                planting_window_start_month=cal["start_m"],
                planting_window_start_day=cal["start_d"],
                planting_window_end_month=cal["end_m"],
                planting_window_end_day=cal["end_d"],
                duration_min_days=cal["dur_min"],
                duration_max_days=cal["dur_max"],
                harvest_window_start_month=cal["harvest_start_m"],
                harvest_window_start_day=cal["harvest_start_d"],
                harvest_window_end_month=cal["harvest_end_m"],
                harvest_window_end_day=cal["harvest_end_d"],
                source_id=source.id,
                source_reference=cal["ref"],
                source_publication_year=2025,
                water_requirement_category=cal["water"],
                labor_intensity=cal["labor"],
                verification_status="OFFICIAL_AGRONOMY_APPROVED",
                is_active=True,
            )
            db.add(entry)

        db.commit()
        logger.info("Seeded official MPKV Rahuri crop calendars.")

    def _resolve_calendar_dates_for_year(
        self,
        cal: CropCalendar,
        eval_year: int,
    ) -> Tuple[date, date]:
        """Resolves annual month/day window to concrete date boundaries in the evaluation year."""
        try:
            w_start = date(eval_year, cal.planting_window_start_month, cal.planting_window_start_day)
        except ValueError:
            # Handle Feb 29 / 30 day edge case
            w_start = date(eval_year, cal.planting_window_start_month, 28)

        # If window ends in the next calendar year (e.g. Dec to Jan)
        end_year = eval_year
        if cal.planting_window_end_month < cal.planting_window_start_month:
            end_year = eval_year + 1

        try:
            w_end = date(end_year, cal.planting_window_end_month, cal.planting_window_end_day)
        except ValueError:
            w_end = date(end_year, cal.planting_window_end_month, 28)

        return w_start, w_end

    def _calculate_harvest_window(
        self,
        sow_start: date,
        sow_end: date,
        dur_min: int,
        dur_max: int,
    ) -> Tuple[date, date]:
        """Calculates indicative earliest and latest harvest dates from sowing window and duration."""
        harvest_early = sow_start + timedelta(days=dur_min)
        harvest_late = sow_end + timedelta(days=dur_max)
        return harvest_early, harvest_late

    def _get_price_outlook(
        self,
        db: Session,
        commodity_id: int,
        market_id: int,
        est_harvest_date: date,
    ) -> HarvestPriceOutlook:
        """Looks up or evaluates Phase 6 market price forecast for the estimated harvest period."""
        forecasting_engine = MarketForecastingEngine(db)
        today = date.today()
        horizon_days = max(7, (est_harvest_date - today).days)

        try:
            fc_response = forecasting_engine.generate_forecast(
                commodity_id=commodity_id,
                market_id=market_id,
                horizon_days=horizon_days,
                target_date=est_harvest_date,
                persist=False,
            )

            if fc_response.status in ("PUBLISHED", "EXPERIMENTAL") and fc_response.predicted_modal_price is not None:
                return HarvestPriceOutlook(
                    status="AVAILABLE",
                    predicted_modal_price=fc_response.predicted_modal_price,
                    lower_bound=fc_response.lower_uncertainty_bound,
                    upper_bound=fc_response.upper_uncertainty_bound,
                    price_unit=fc_response.price_unit,
                    model_identifier=f"{fc_response.model_identifier} ({fc_response.model_version})",
                    target_period_start=fc_response.target_period_start,
                    target_period_end=fc_response.target_period_end,
                    unavailability_reason=None,
                    disclaimer=fc_response.disclaimer,
                )
            else:
                return HarvestPriceOutlook(
                    status="UNAVAILABLE_INSUFFICIENT_DATA",
                    predicted_modal_price=None,
                    lower_bound=None,
                    upper_bound=None,
                    price_unit="RS_PER_QUINTAL",
                    model_identifier=None,
                    target_period_start=None,
                    target_period_end=None,
                    unavailability_reason=(
                        fc_response.unavailability_reason
                        or "Harvest-time price outlook unavailable: Insufficient historical APMC price observations for statistical time-series forecasting (minimum 15 records required)."
                    ),
                    disclaimer=fc_response.disclaimer,
                )
        except Exception as e:
            return HarvestPriceOutlook(
                status="UNAVAILABLE_INSUFFICIENT_DATA",
                predicted_modal_price=None,
                lower_bound=None,
                upper_bound=None,
                price_unit="RS_PER_QUINTAL",
                model_identifier=None,
                target_period_start=None,
                target_period_end=None,
                unavailability_reason=f"Forecast lookup error: {str(e)}",
                disclaimer="Forecast unavailable.",
            )

    def _resolve_field_context(
        self,
        db: Session,
        field_id: Optional[int] = None,
    ) -> Optional[FieldSoilContext]:
        """Resolves Gat number, village, area, and soil test parameters from database."""
        if not field_id:
            return None

        field = db.query(Field).filter(Field.id == field_id).first()
        if not field:
            return None

        # Lookup latest SoilReport
        soil_rep = (
            db.query(SoilReport)
            .filter(SoilReport.field_id == field.id)
            .order_by(SoilReport.created_at.desc())
            .first()
        )

        has_test = soil_rep is not None
        soil_ph = None
        organic_carbon = None
        soil_texture = None
        notes: List[str] = []

        if soil_rep:
            for p in soil_rep.parameters:
                val = getattr(p, "value", None)
                if val is None:
                    val = getattr(p, "measured_value", None)

                if p.parameter_key == "ph":
                    try:
                        soil_ph = float(val) if val is not None else None
                    except Exception:
                        pass
                elif p.parameter_key == "organic_carbon":
                    try:
                        organic_carbon = float(val) if val is not None else None
                    except Exception:
                        pass
                elif p.parameter_key in ("texture_class", "soil_texture"):
                    soil_texture = getattr(p, "interpretation_en", None) or str(val)

            notes.append(f"Official laboratory test report #{soil_rep.report_no} applied.")
        else:
            notes.append("Field soil test unrecorded in portal — university regional Vertisol norms applied.")

        # Resolve location names
        village_name = field.village.name if hasattr(field, "village") and field.village else None
        taluka_name = (
            field.village.taluka.name
            if village_name and hasattr(field.village, "taluka") and field.village.taluka
            else None
        )
        district_name = (
            field.village.taluka.district.name
            if taluka_name and hasattr(field.village.taluka, "district") and field.village.taluka.district
            else None
        )

        return FieldSoilContext(
            gat_no=field.gat_no,
            area_acreage=field.area,
            village_name=village_name,
            taluka_name=taluka_name,
            district_name=district_name,
            has_soil_test=has_test,
            soil_texture=soil_texture,
            soil_ph=soil_ph,
            organic_carbon_percent=organic_carbon,
            prerequisite_notes=notes,
        )

    def get_next_15_days_planning(
        self,
        db: Session,
        current_date: Optional[date] = None,
        district_id: Optional[int] = None,
        market_id: int = 1,
        field_id: Optional[int] = None,
    ) -> Next15DaysPlanningResponse:
        """
        Calculates verified agricultural planting windows that intersect the next 15 calendar days.
        """
        self.ensure_seed_calendars(db)
        eval_date = current_date or date.today()
        eval_end = eval_date + timedelta(days=15)

        # Query active calendars (district-specific or statewide)
        query = db.query(CropCalendar).filter(CropCalendar.is_active == True)
        if district_id:
            query = query.filter(or_(CropCalendar.district_id == district_id, CropCalendar.district_id.is_(None)))

        calendars = query.all()
        options: List[PlantingOptionItem] = []

        for cal in calendars:
            # Check for current year and adjacent year boundaries
            for yr in (eval_date.year, eval_date.year - 1, eval_date.year + 1):
                w_start, w_end = self._resolve_calendar_dates_for_year(cal, yr)

                # Check intersection: max(w_start, eval_date) <= min(w_end, eval_end)
                intersect_start = max(w_start, eval_date)
                intersect_end = min(w_end, eval_end)

                if intersect_start <= intersect_end:
                    # Determine window status relative to today
                    if w_start <= eval_date <= w_end:
                        days_left = (w_end - eval_date).days
                        status = "CLOSING_SOON" if days_left <= 7 else "OPTIMAL_NOW"
                        days_open = 0
                        days_close = days_left
                    elif eval_date < w_start:
                        status = "OPENING_SOON"
                        days_open = (w_start - eval_date).days
                        days_close = (w_end - eval_date).days
                    else:
                        status = "INACTIVE"
                        days_open = None
                        days_close = None

                    # Calculate indicative harvest window
                    harvest_early, harvest_late = self._calculate_harvest_window(
                        intersect_start, intersect_end, cal.duration_min_days, cal.duration_max_days
                    )

                    # Lookup Phase 6 harvest-time market price outlook
                    price_outlook = self._get_price_outlook(
                        db=db,
                        commodity_id=cal.commodity_id,
                        market_id=market_id,
                        est_harvest_date=harvest_early,
                    )

                    # Agronomic prerequisites
                    prereqs = [
                        f"Recommended Sowing: {cal.planting_window_start_month:02d}-{cal.planting_window_start_day:02d} to {cal.planting_window_end_month:02d}-{cal.planting_window_end_day:02d}",
                        f"Growth Cycle: {cal.duration_min_days}–{cal.duration_max_days} days ({DURATION_DEFINITION_STANDARD})",
                        f"Water Intensity: {cal.water_requirement_category} (Labor: {cal.labor_intensity})",
                    ]

                    soil_notes = (
                        "Medium to Deep Vertisols (Black Cotton Soils) with adequate drainage; avoid waterlogging."
                        if cal.commodity.category in ("PULSES", "OILSEEDS")
                        else "Loamy to clay-loam fertile soils with high organic matter and moisture retention."
                    )

                    options.append(
                        PlantingOptionItem(
                            crop_id=cal.commodity.id,
                            crop_code=cal.commodity.code,
                            crop_name=cal.commodity.name,
                            crop_name_mr=cal.commodity.name_mr,
                            category=cal.commodity.category,
                            season=cal.season,
                            planting_window_start=f"{cal.planting_window_start_month:02d}-{cal.planting_window_start_day:02d}",
                            planting_window_end=f"{cal.planting_window_end_month:02d}-{cal.planting_window_end_day:02d}",
                            current_year_window_start=w_start,
                            current_year_window_end=w_end,
                            window_status=status,
                            days_until_window_opens=days_open,
                            days_until_window_closes=days_close,
                            duration_min_days=cal.duration_min_days,
                            duration_max_days=cal.duration_max_days,
                            duration_definition=DURATION_DEFINITION_STANDARD,
                            estimated_harvest_window_start=harvest_early,
                            estimated_harvest_window_end=harvest_late,
                            water_requirement=cal.water_requirement_category or "MEDIUM",
                            labor_intensity=cal.labor_intensity or "MODERATE",
                            agronomic_prerequisites=prereqs,
                            soil_suitability_notes=soil_notes,
                            source_reference=cal.source_reference or "MPKV Rahuri Krishi Darshani",
                            source_publication_year=cal.source_publication_year,
                            verification_status=cal.verification_status,
                            price_outlook=price_outlook,
                        )
                    )
                    break  # Matched for this calendar

        field_ctx = self._resolve_field_context(db, field_id)

        # Sort: OPTIMAL_NOW first, then OPENING_SOON, then CLOSING_SOON
        order_map = {"OPTIMAL_NOW": 1, "OPENING_SOON": 2, "CLOSING_SOON": 3, "INACTIVE": 4}
        options.sort(key=lambda x: (order_map.get(x.window_status, 99), x.crop_name))

        return Next15DaysPlanningResponse(
            evaluation_date=eval_date,
            next_15_days_start=eval_date,
            next_15_days_end=eval_end,
            total_options_count=len(options),
            field_context=field_ctx,
            options=options,
            disclaimer=DISCLAIMER_PHASE_7,
        )

    def get_seasonal_planning(
        self,
        db: Session,
        season: str = "RABI",
        current_date: Optional[date] = None,
        district_id: Optional[int] = None,
        market_id: int = 1,
        field_id: Optional[int] = None,
    ) -> SeasonalPlanningResponse:
        """
        Retrieves verified seasonal crop calendars for an agricultural season (KHARIF, RABI, ZAID_SUMMER).
        """
        self.ensure_seed_calendars(db)
        eval_date = current_date or date.today()
        clean_season = season.upper().strip()

        query = db.query(CropCalendar).filter(
            CropCalendar.is_active == True,
            CropCalendar.season == clean_season,
        )
        if district_id:
            query = query.filter(or_(CropCalendar.district_id == district_id, CropCalendar.district_id.is_(None)))

        calendars = query.all()
        options: List[PlantingOptionItem] = []

        for cal in calendars:
            w_start, w_end = self._resolve_calendar_dates_for_year(cal, eval_date.year)

            # Determine window status
            if w_start <= eval_date <= w_end:
                days_left = (w_end - eval_date).days
                status = "CLOSING_SOON" if days_left <= 7 else "OPTIMAL_NOW"
                days_open = 0
                days_close = days_left
            elif eval_date < w_start:
                status = "OPENING_SOON"
                days_open = (w_start - eval_date).days
                days_close = (w_end - eval_date).days
            else:
                status = "INACTIVE"
                days_open = None
                days_close = None

            harvest_early, harvest_late = self._calculate_harvest_window(
                w_start, w_end, cal.duration_min_days, cal.duration_max_days
            )

            price_outlook = self._get_price_outlook(
                db=db,
                commodity_id=cal.commodity_id,
                market_id=market_id,
                est_harvest_date=harvest_early,
            )

            prereqs = [
                f"Sowing Period: {cal.planting_window_start_month:02d}-{cal.planting_window_start_day:02d} to {cal.planting_window_end_month:02d}-{cal.planting_window_end_day:02d}",
                f"Duration Range: {cal.duration_min_days}–{cal.duration_max_days} days ({DURATION_DEFINITION_STANDARD})",
                f"Water Intensity: {cal.water_requirement_category} (Labor: {cal.labor_intensity})",
            ]

            soil_notes = (
                "Medium to Deep Vertisols (Black Cotton Soils) with adequate drainage; avoid waterlogging."
                if cal.commodity.category in ("PULSES", "OILSEEDS")
                else "Loamy to clay-loam fertile soils with high organic matter and moisture retention."
            )

            options.append(
                PlantingOptionItem(
                    crop_id=cal.commodity.id,
                    crop_code=cal.commodity.code,
                    crop_name=cal.commodity.name,
                    crop_name_mr=cal.commodity.name_mr,
                    category=cal.commodity.category,
                    season=cal.season,
                    planting_window_start=f"{cal.planting_window_start_month:02d}-{cal.planting_window_start_day:02d}",
                    planting_window_end=f"{cal.planting_window_end_month:02d}-{cal.planting_window_end_day:02d}",
                    current_year_window_start=w_start,
                    current_year_window_end=w_end,
                    window_status=status,
                    days_until_window_opens=days_open,
                    days_until_window_closes=days_close,
                    duration_min_days=cal.duration_min_days,
                    duration_max_days=cal.duration_max_days,
                    duration_definition=DURATION_DEFINITION_STANDARD,
                    estimated_harvest_window_start=harvest_early,
                    estimated_harvest_window_end=harvest_late,
                    water_requirement=cal.water_requirement_category or "MEDIUM",
                    labor_intensity=cal.labor_intensity or "MODERATE",
                    agronomic_prerequisites=prereqs,
                    soil_suitability_notes=soil_notes,
                    source_reference=cal.source_reference or "MPKV Rahuri Krishi Darshani",
                    source_publication_year=cal.source_publication_year,
                    verification_status=cal.verification_status,
                    price_outlook=price_outlook,
                )
            )

        field_ctx = self._resolve_field_context(db, field_id)

        return SeasonalPlanningResponse(
            selected_season=clean_season,
            evaluation_date=eval_date,
            applicable_region="Western Maharashtra Vertisols (Pune, Ahmednagar, Solapur, Satara, Nashik)",
            total_crops_count=len(options),
            field_context=field_ctx,
            options=options,
            disclaimer=DISCLAIMER_PHASE_7,
        )


crop_calendar_service = CropCalendarService()
