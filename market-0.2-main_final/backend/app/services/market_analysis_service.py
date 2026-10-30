"""Service for Historical Market Price Analysis & Trend Detection.
SoilPilot Phase 5: Descriptive price statistics, time-series aggregation,
market comparison, and transparent trend classification.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import math
import statistics
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import select, and_, func
from sqlalchemy.orm import Session

from app.models.market_intelligence import (
    MarketPriceObservation,
    Commodity,
    MarketApmc,
    DataSourceRegistry,
)
from app.services.market_ingestion_service import market_ingestion_service


# Configurable Analytical Thresholds
# Note: These are documented analytical settings to distinguish meaningful price shifts
# from daily mandi auction bid noise, not an official agronomic guarantee.
DEFAULT_TREND_THRESHOLD_PERCENT = 2.0  # Movements > +2% = RISING, < -2% = FALLING
MIN_OBSERVATIONS_FOR_TREND = 3         # Minimum valid records required in window
TRADING_GAP_THRESHOLD_DAYS = 3         # Gaps > 3 days between consecutive sessions flagged


class MarketAnalysisService:
    """Service providing verifiable historical market price analytics without forecasting."""

    def get_historical_analysis(
        self,
        db: Session,
        commodity_id: int,
        market_id: Optional[int] = None,
        district_name: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        window: str = "30d",
        aggregation: str = "daily",
        comparison_market_id: Optional[int] = None,
        trend_threshold_percent: float = DEFAULT_TREND_THRESHOLD_PERCENT
    ) -> Dict[str, Any]:
        """
        Execute comprehensive historical market price analysis for a commodity and APMC.
        Applies mathematical validations, gap detection, and transparent trend classifications.
        """
        market_ingestion_service.ensure_seed_metadata(db)

        # 1. Resolve Commodity
        commodity = db.scalar(select(Commodity).filter_by(id=commodity_id))
        if not commodity:
            # Fallback to first active commodity (e.g. Soybean)
            commodity = db.scalar(select(Commodity).order_by(Commodity.id))
            if not commodity:
                raise ValueError("No commodities registered in database.")

        # 2. Resolve Primary Market
        market = None
        if market_id:
            market = db.scalar(select(MarketApmc).filter_by(id=market_id))
        if not market and district_name:
            from app.models.geography import District
            market = db.scalar(
                select(MarketApmc)
                .join(MarketApmc.district)
                .filter(District.name == district_name)
                .order_by(MarketApmc.id)
            )
        if not market:
            # Fallback to Pune or first available APMC
            market = db.scalar(select(MarketApmc).filter(MarketApmc.name.contains("Pune")).order_by(MarketApmc.id))
            if not market:
                market = db.scalar(select(MarketApmc).order_by(MarketApmc.id))

        if not market:
            raise ValueError("No APMC markets registered in database.")

        # 3. Calculate Date Boundaries
        today = date.today()
        calc_end = end_date or today
        if not start_date:
            w_lower = window.lower().strip()
            if w_lower == "7d":
                calc_start = calc_end - timedelta(days=7)
            elif w_lower == "90d":
                calc_start = calc_end - timedelta(days=90)
            elif w_lower in ("1y", "365d"):
                calc_start = calc_end - timedelta(days=365)
            elif w_lower == "all":
                calc_start = date(2020, 1, 1)
            else:  # default 30d
                calc_start = calc_end - timedelta(days=30)
        else:
            calc_start = start_date

        calendar_days = max(1, (calc_end - calc_start).days + 1)

        # 4. Query Verified Observations for Primary Market
        query = (
            select(MarketPriceObservation)
            .filter(
                and_(
                    MarketPriceObservation.commodity_id == commodity.id,
                    MarketPriceObservation.market_id == market.id,
                    MarketPriceObservation.is_active == True,  # noqa: E712
                    MarketPriceObservation.validation_status == "VERIFIED",
                    MarketPriceObservation.observation_date >= calc_start,
                    MarketPriceObservation.observation_date <= calc_end
                )
            )
            .order_by(MarketPriceObservation.observation_date.asc())
        )
        observations = db.scalars(query).all()

        # 5. Data Quality Assessment
        total_obs = len(observations)
        quality_warnings: List[str] = []
        reporting_gaps_count = 0
        earliest_obs_date: Optional[str] = None
        latest_obs_date: Optional[str] = None

        if total_obs > 0:
            earliest_obs_date = observations[0].observation_date.isoformat()
            latest_obs_date = observations[-1].observation_date.isoformat()

            # Check consecutive observation date gaps
            for i in range(1, total_obs):
                prev_d = observations[i - 1].observation_date
                curr_d = observations[i].observation_date
                gap_days = (curr_d - prev_d).days
                if gap_days > TRADING_GAP_THRESHOLD_DAYS:
                    reporting_gaps_count += 1

            if reporting_gaps_count > 0:
                quality_warnings.append(
                    f"{reporting_gaps_count} trading gap(s) exceeding {TRADING_GAP_THRESHOLD_DAYS} "
                    f"calendar days detected (APMC weekend closures, non-trading days, or reporting delays)."
                )

        if total_obs == 0:
            quality_warnings.append(
                f"No verified market observations recorded for {commodity.name} at {market.name} "
                f"between {calc_start.isoformat()} and {calc_end.isoformat()}."
            )
        elif total_obs < MIN_OBSERVATIONS_FOR_TREND:
            quality_warnings.append(
                f"Sparse observations ({total_obs} valid record{'s' if total_obs != 1 else ''} found, "
                f"minimum {MIN_OBSERVATIONS_FOR_TREND} required) in selected window. Trend direction cannot be reliably determined."
            )

        is_sufficient = total_obs >= MIN_OBSERVATIONS_FOR_TREND

        # 6. Calculate Summary Metrics
        latest_price: Optional[float] = None
        latest_date_str: Optional[str] = None
        previous_price: Optional[float] = None
        previous_date_str: Optional[str] = None
        abs_change: Optional[float] = None
        pct_change: Optional[float] = None
        avg_price: Optional[float] = None
        median_price: Optional[float] = None
        min_obs_price: Optional[float] = None
        max_obs_price: Optional[float] = None
        price_spread: Optional[float] = None
        std_dev: Optional[float] = None
        cv_percent: Optional[float] = None
        trend_direction: str = "INSUFFICIENT_DATA"

        if total_obs > 0:
            latest_rec = observations[-1]
            latest_price = float(latest_rec.modal_price) if latest_rec.modal_price is not None else None
            latest_date_str = latest_rec.observation_date.isoformat()

            if total_obs >= 2:
                prev_rec = observations[-2]
                previous_price = float(prev_rec.modal_price) if prev_rec.modal_price is not None else None
                previous_date_str = prev_rec.observation_date.isoformat()

                if latest_price is not None and previous_price is not None:
                    abs_change = round(latest_price - previous_price, 2)
                    if previous_price > 0:
                        pct_change = round(((latest_price - previous_price) / previous_price) * 100, 2)

            modal_prices = [float(o.modal_price) for o in observations if o.modal_price is not None]
            min_prices = [float(o.min_price) for o in observations if o.min_price is not None]
            max_prices = [float(o.max_price) for o in observations if o.max_price is not None]

            if modal_prices:
                avg_price = round(sum(modal_prices) / len(modal_prices), 2)
                median_price = round(statistics.median(modal_prices), 2)

                if len(modal_prices) >= 2:
                    std_dev = round(statistics.stdev(modal_prices), 2)
                    if avg_price > 0:
                        cv_percent = round((std_dev / avg_price) * 100, 2)

            all_lows = min_prices if min_prices else modal_prices
            all_highs = max_prices if max_prices else modal_prices
            if all_lows:
                min_obs_price = round(min(all_lows), 2)
            if all_highs:
                max_obs_price = round(max(all_highs), 2)

            if min_obs_price is not None and max_obs_price is not None:
                price_spread = round(max_obs_price - min_obs_price, 2)

            # Trend Classification based on percentage change and sufficiency
            if is_sufficient and pct_change is not None:
                if pct_change > trend_threshold_percent:
                    trend_direction = "RISING"
                elif pct_change < -trend_threshold_percent:
                    trend_direction = "FALLING"
                else:
                    trend_direction = "STABLE"
            else:
                trend_direction = "INSUFFICIENT_DATA"

        # 7. Time Series Aggregation
        series_points = self._aggregate_time_series(observations, aggregation)

        # 8. Market Comparison (if requested)
        comparison_market = None
        comparison_series: List[Dict[str, Any]] = []
        if comparison_market_id and comparison_market_id != market.id:
            comp_m = db.scalar(select(MarketApmc).filter_by(id=comparison_market_id))
            if comp_m:
                comparison_market = comp_m
                comp_obs = db.scalars(
                    select(MarketPriceObservation)
                    .filter(
                        and_(
                            MarketPriceObservation.commodity_id == commodity.id,
                            MarketPriceObservation.market_id == comp_m.id,
                            MarketPriceObservation.is_active == True,  # noqa: E712
                            MarketPriceObservation.validation_status == "VERIFIED",
                            MarketPriceObservation.observation_date >= calc_start,
                            MarketPriceObservation.observation_date <= calc_end
                        )
                    )
                    .order_by(MarketPriceObservation.observation_date.asc())
                ).all()

                # Align on common dates
                comp_map = {o.observation_date: float(o.modal_price) for o in comp_obs if o.modal_price is not None}
                for o in observations:
                    if o.modal_price is not None and o.observation_date in comp_map:
                        p_val = float(o.modal_price)
                        c_val = comp_map[o.observation_date]
                        diff = round(p_val - c_val, 2)
                        pct_diff = round((diff / c_val) * 100, 2) if c_val > 0 else None
                        comparison_series.append({
                            "date": o.observation_date.isoformat(),
                            "primary_modal_price": p_val,
                            "comparison_modal_price": c_val,
                            "price_difference": diff,
                            "percentage_difference": pct_diff
                        })

        # 9. Source Information
        source = db.scalar(select(DataSourceRegistry).filter_by(code="AGMARKNET"))
        source_info = {
            "name": source.name if source else "Agmarknet - Agricultural Marketing Information Network",
            "code": source.code if source else "AGMARKNET",
            "official_url": source.official_url if source else "https://agmarknet.gov.in",
            "last_retrieval_timestamp": (
                source.last_successful_retrieval_at.isoformat()
                if source and source.last_successful_retrieval_at
                else None
            ),
            "operational_status": source.operational_status if source else "ACTIVE"
        }

        disclaimer = (
            "Historical Market Analysis Disclaimer: All presented rates reflect verified past auction "
            "transactions recorded by APMC market committees. This analysis does not constitute future "
            "price forecasts or planting advice. Furthermore, higher observed mandi prices alone do not guarantee "
            "higher net farmer profit, as transport haulage costs, grading standards, local mandi cess, and "
            "weighment charges vary across Maharashtra market yards."
        )

        return {
            "commodity": {
                "id": commodity.id,
                "code": commodity.code,
                "name": commodity.name,
                "name_mr": commodity.name_mr,
                "category": commodity.category,
                "standard_unit": commodity.standard_unit
            },
            "market": {
                "id": market.id,
                "market_code": market.market_code,
                "name": market.name,
                "name_mr": market.name_mr,
                "state_id": market.state_id,
                "district_id": market.district_id,
                "district_name": market.district.name if market.district else None,
                "taluka_name": market.taluka.name if market.taluka else None,
                "market_type": market.market_type
            },
            "date_range": {
                "start_date": calc_start.isoformat(),
                "end_date": calc_end.isoformat(),
                "calendar_days": calendar_days,
                "window": window
            },
            "aggregation": aggregation,
            "data_quality": {
                "total_observations": total_obs,
                "earliest_date": earliest_obs_date,
                "latest_date": latest_obs_date,
                "calendar_days": calendar_days,
                "reporting_gaps_count": reporting_gaps_count,
                "is_sufficient": is_sufficient,
                "quality_warnings": quality_warnings
            },
            "summary_metrics": {
                "latest_price": latest_price,
                "latest_date": latest_date_str,
                "previous_price": previous_price,
                "previous_date": previous_date_str,
                "absolute_change": abs_change,
                "percentage_change": pct_change,
                "average_modal_price": avg_price,
                "median_modal_price": median_price,
                "min_observed_price": min_obs_price,
                "max_observed_price": max_obs_price,
                "price_spread": price_spread,
                "volatility_std_dev": std_dev,
                "volatility_cv_percent": cv_percent,
                "trend_direction": trend_direction,
                "trend_threshold_percent": trend_threshold_percent,
                "price_unit": "RS_PER_QUINTAL"
            },
            "series": series_points,
            "comparison_market": (
                {
                    "id": comparison_market.id,
                    "market_code": comparison_market.market_code,
                    "name": comparison_market.name,
                    "name_mr": comparison_market.name_mr,
                    "state_id": comparison_market.state_id,
                    "district_id": comparison_market.district_id,
                    "district_name": comparison_market.district.name if comparison_market.district else None,
                    "market_type": comparison_market.market_type
                }
                if comparison_market
                else None
            ),
            "comparison_series": comparison_series,
            "source_info": source_info,
            "disclaimer": disclaimer
        }

    def _aggregate_time_series(
        self,
        observations: List[MarketPriceObservation],
        aggregation: str
    ) -> List[Dict[str, Any]]:
        """Group observations into daily, weekly, or monthly time series points."""
        if not observations:
            return []

        if aggregation == "weekly":
            # Group by year-week
            buckets: Dict[str, List[MarketPriceObservation]] = {}
            for obs in observations:
                iso_yr, iso_wk, _ = obs.observation_date.isocalendar()
                key = f"{iso_yr}-W{iso_wk:02d}"
                buckets.setdefault(key, []).append(obs)

            points: List[Dict[str, Any]] = []
            for key in sorted(buckets.keys()):
                group = buckets[key]
                modal_vals = [float(o.modal_price) for o in group if o.modal_price is not None]
                min_vals = [float(o.min_price) for o in group if o.min_price is not None]
                max_vals = [float(o.max_price) for o in group if o.max_price is not None]
                arr_vals = [float(o.arrival_quantity) for o in group if o.arrival_quantity is not None]

                avg_modal = round(sum(modal_vals) / len(modal_vals), 2) if modal_vals else 0.0
                low_val = round(min(min_vals), 2) if min_vals else avg_modal
                high_val = round(max(max_vals), 2) if max_vals else avg_modal
                tot_arr = round(sum(arr_vals), 2) if arr_vals else None

                # Representative date: first observation in week
                rep_date = group[0].observation_date.isoformat()
                points.append({
                    "date": rep_date,
                    "modal_price": avg_modal,
                    "min_price": low_val,
                    "max_price": high_val,
                    "arrival_quantity": tot_arr,
                    "arrival_unit": "TONNE",
                    "observation_count": len(group)
                })
            return points

        elif aggregation == "monthly":
            # Group by YYYY-MM
            buckets: Dict[str, List[MarketPriceObservation]] = {}
            for obs in observations:
                key = f"{obs.observation_date.year}-{obs.observation_date.month:02d}"
                buckets.setdefault(key, []).append(obs)

            points: List[Dict[str, Any]] = []
            for key in sorted(buckets.keys()):
                group = buckets[key]
                modal_vals = [float(o.modal_price) for o in group if o.modal_price is not None]
                min_vals = [float(o.min_price) for o in group if o.min_price is not None]
                max_vals = [float(o.max_price) for o in group if o.max_price is not None]
                arr_vals = [float(o.arrival_quantity) for o in group if o.arrival_quantity is not None]

                avg_modal = round(sum(modal_vals) / len(modal_vals), 2) if modal_vals else 0.0
                low_val = round(min(min_vals), 2) if min_vals else avg_modal
                high_val = round(max(max_vals), 2) if max_vals else avg_modal
                tot_arr = round(sum(arr_vals), 2) if arr_vals else None

                rep_date = f"{key}-01"
                points.append({
                    "date": rep_date,
                    "modal_price": avg_modal,
                    "min_price": low_val,
                    "max_price": high_val,
                    "arrival_quantity": tot_arr,
                    "arrival_unit": "TONNE",
                    "observation_count": len(group)
                })
            return points

        else:
            # Daily series (default)
            points: List[Dict[str, Any]] = []
            for obs in observations:
                m_val = float(obs.modal_price) if obs.modal_price is not None else 0.0
                points.append({
                    "date": obs.observation_date.isoformat(),
                    "modal_price": m_val,
                    "min_price": float(obs.min_price) if obs.min_price is not None else m_val,
                    "max_price": float(obs.max_price) if obs.max_price is not None else m_val,
                    "arrival_quantity": float(obs.arrival_quantity) if obs.arrival_quantity is not None else None,
                    "arrival_unit": obs.arrival_unit or "TONNE",
                    "observation_count": 1
                })
            return points


market_analysis_service = MarketAnalysisService()
