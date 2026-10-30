"""
SoilPilot Market Intelligence & Crop Planner — Market Price Forecasting Engine
Phase 6: Time-Series Market Price Forecasting & Walk-Forward Backtesting

Defines the mathematical, statistical, and engineering framework to estimate
future commodity modal prices from verified historical APMC observations without
lookahead bias or future-data leakage.
"""

import math
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.market_intelligence import (
    Commodity,
    MarketApmc,
    MarketPriceObservation,
    PriceForecast,
    DataSourceRegistry,
)
from app.schemas.market_intelligence import (
    MarketForecastResponse,
    ModelComparisonItem,
    ForecastDataQuality,
    CommodityResponse,
    MarketResponse,
)

logger = logging.getLogger(__name__)

DISCLAIMER_PHASE_6 = (
    "Agricultural Market Price Forecast Disclaimer: Forecasts are statistical estimates "
    "generated from verified historical APMC auction records using time-series models. They "
    "do not constitute guaranteed prices, official procurement rates, or binding quotations. "
    "Actual market realizations will vary based on seasonal harvest arrivals, weather fluctuations, "
    "pest infestations, interstate trade policy, quality grading, and local mandi trading conditions. "
    "Farmers must exercise independent judgment before making planting or financial decisions."
)


class MarketForecastingEngine:
    """
    Empirical time-series forecasting engine with chronological walk-forward validation.
    Strictly enforces:
      1. Zero lookahead bias / chronological evaluation.
      2. Transparent baseline comparisons (Naive, SMA, Drift vs. Holt's Exp Smoothing).
      3. Out-of-sample error reporting (MAE, RMSE, MAPE, MASE).
      4. Explicit 'UNAVAILABLE_INSUFFICIENT_DATA' when reliable history is insufficient.
    """

    MODEL_VERSION = "v1.0.0"
    MIN_OBSERVATIONS_FOR_DEFENSIBLE_FORECAST = 15
    MIN_OBSERVATIONS_FOR_BACKTEST_WINDOW = 10

    def __init__(self, db: Session):
        self.db = db

    def prepare_dataset(
        self,
        commodity_id: int,
        market_id: int,
        cutoff_date: Optional[date] = None,
    ) -> Tuple[List[MarketPriceObservation], ForecastDataQuality]:
        """
        Extracts, filters, and chronologically orders valid observations.
        Ensures strict time cutoff (no future data leakage).
        """
        query = (
            self.db.query(MarketPriceObservation)
            .filter(
                MarketPriceObservation.commodity_id == commodity_id,
                MarketPriceObservation.market_id == market_id,
                MarketPriceObservation.is_active == True,
                MarketPriceObservation.validation_status.in_(["VERIFIED", "VALID"]),
                MarketPriceObservation.modal_price.isnot(None),
                MarketPriceObservation.modal_price > 0,
            )
        )

        if cutoff_date is not None:
            query = query.filter(MarketPriceObservation.observation_date <= cutoff_date)

        # Chronological ordering ascending (oldest to newest)
        observations = query.order_by(MarketPriceObservation.observation_date.asc()).all()

        # Deduplicate multiple observations on the same date by taking latest retrieval
        unique_by_date: Dict[date, MarketPriceObservation] = {}
        for obs in observations:
            obs_date = obs.observation_date
            if obs_date not in unique_by_date:
                unique_by_date[obs_date] = obs
            else:
                # Keep the one with higher arrival or latest retrieval
                existing = unique_by_date[obs_date]
                if (obs.arrival_quantity or 0) > (existing.arrival_quantity or 0):
                    unique_by_date[obs_date] = obs

        clean_observations = sorted(unique_by_date.values(), key=lambda x: x.observation_date)
        total_count = len(clean_observations)

        earliest = clean_observations[0].observation_date if total_count > 0 else None
        latest = clean_observations[-1].observation_date if total_count > 0 else None
        span_days = (latest - earliest).days + 1 if earliest and latest else 0

        # Gap detection (> 3 calendar days)
        gaps_count = 0
        warnings: List[str] = []

        if total_count > 1:
            for i in range(1, total_count):
                diff = (clean_observations[i].observation_date - clean_observations[i - 1].observation_date).days
                if diff > 3:
                    gaps_count += 1

        is_sufficient = total_count >= self.MIN_OBSERVATIONS_FOR_DEFENSIBLE_FORECAST

        if not is_sufficient:
            warnings.append(
                f"Limited observation sample size (found {total_count} valid records). "
                f"A minimum of {self.MIN_OBSERVATIONS_FOR_DEFENSIBLE_FORECAST} chronological records is "
                "required for reliable out-of-sample backtesting."
            )
        if gaps_count > 0:
            warnings.append(f"Irregular reporting detected: {gaps_count} gap(s) exceeding 3 days between observations.")

        quality = ForecastDataQuality(
            total_observations=total_count,
            training_cutoff_date=latest,
            earliest_observation_date=earliest,
            calendar_days_span=span_days,
            reporting_gaps_count=gaps_count,
            is_sufficient=is_sufficient,
            quality_warnings=warnings,
        )

        return clean_observations, quality

    # -------------------------------------------------------------
    # BASELINE AND TIME-SERIES MODEL IMPLEMENTATIONS
    # -------------------------------------------------------------

    @staticmethod
    def forecast_naive(series: np.ndarray, horizon_steps: int) -> float:
        """Naive Baseline: Last observed value projected forward."""
        if len(series) == 0:
            return 0.0
        return float(series[-1])

    @staticmethod
    def forecast_moving_average(series: np.ndarray, horizon_steps: int, window: int = 7) -> float:
        """Simple Moving Average (SMA) baseline over last k points."""
        if len(series) == 0:
            return 0.0
        k = min(window, len(series))
        return float(np.mean(series[-k:]))

    @staticmethod
    def forecast_drift(series: np.ndarray, horizon_steps: int) -> float:
        """Drift Baseline: Last value plus linear slope between first and last point."""
        n = len(series)
        if n == 0:
            return 0.0
        if n == 1:
            return float(series[0])
        slope = (series[-1] - series[0]) / (n - 1)
        pred = series[-1] + horizon_steps * slope
        return float(max(0.0, pred))

    @staticmethod
    def fit_holt_linear(
        series: np.ndarray,
        alpha: float,
        beta: float,
    ) -> Tuple[float, float, float]:
        """
        Fits Holt's Linear Exponential Smoothing.
        Returns: (Level, Trend, Sum of Squared 1-step In-Sample Errors)
        """
        n = len(series)
        if n < 2:
            return float(series[0]), 0.0, 0.0

        # Initialization
        level = float(series[0])
        trend = float(series[1] - series[0])
        sse = 0.0

        for t in range(1, n):
            actual = series[t]
            pred_1step = level + trend
            sse += (actual - pred_1step) ** 2

            new_level = alpha * actual + (1.0 - alpha) * (level + trend)
            new_trend = beta * (new_level - level) + (1.0 - beta) * trend
            level = new_level
            trend = new_trend

        return level, trend, sse

    @classmethod
    def forecast_holt(
        cls,
        series: np.ndarray,
        horizon_steps: int,
        alpha: Optional[float] = None,
        beta: Optional[float] = None,
    ) -> Tuple[float, float, float]:
        """
        Holt's Linear Exponential Smoothing with automated grid-search optimization.
        Returns: (predicted_modal_price, best_alpha, best_beta)
        """
        n = len(series)
        if n == 0:
            return 0.0, 0.5, 0.1
        if n < 3:
            return float(series[-1]), 0.5, 0.1

        # Grid search over alpha and beta to minimize in-sample SSE
        best_alpha = 0.5
        best_beta = 0.1
        best_sse = float("inf")

        if alpha is not None and beta is not None:
            level, trend, _ = cls.fit_holt_linear(series, alpha, beta)
            pred = level + horizon_steps * trend
            return float(max(0.0, pred)), alpha, beta

        alpha_grid = [0.1, 0.2, 0.3, 0.5, 0.7, 0.9]
        beta_grid = [0.05, 0.1, 0.2, 0.3]

        for a in alpha_grid:
            for b in beta_grid:
                _, _, sse = cls.fit_holt_linear(series, a, b)
                if sse < best_sse:
                    best_sse = sse
                    best_alpha = a
                    best_beta = b

        final_level, final_trend, _ = cls.fit_holt_linear(series, best_alpha, best_beta)
        forecast_val = final_level + horizon_steps * final_trend
        return float(max(0.0, forecast_val)), best_alpha, best_beta

    # -------------------------------------------------------------
    # WALK-FORWARD CHRONOLOGICAL BACKTESTING
    # -------------------------------------------------------------

    def perform_walk_forward_backtest(
        self,
        prices: np.ndarray,
        horizon_steps: int = 1,
    ) -> Dict[str, Dict[str, float]]:
        """
        Performs strict rolling-origin walk-forward backtesting.
        For each origin t in [W_min, N - horizon_steps]:
          1. Model is trained strictly on prices[:t].
          2. Predicts price at t + horizon_steps - 1.
          3. Evaluates error e = pred - actual.
        Returns out-of-sample MAE, RMSE, MAPE, MASE for each candidate model.
        """
        n = len(prices)
        w_min = min(self.MIN_OBSERVATIONS_FOR_BACKTEST_WINDOW, max(3, n // 2))

        if n <= w_min:
            return {}

        errors_naive: List[float] = []
        errors_sma: List[float] = []
        errors_drift: List[float] = []
        errors_holt: List[float] = []
        actuals: List[float] = []

        # Step forward chronologically
        for origin in range(w_min, n - horizon_steps + 1):
            train_subset = prices[:origin]
            actual = prices[origin + horizon_steps - 1]
            actuals.append(actual)

            # 1. Naive
            p_naive = self.forecast_naive(train_subset, horizon_steps)
            errors_naive.append(p_naive - actual)

            # 2. SMA
            p_sma = self.forecast_moving_average(train_subset, horizon_steps, window=7)
            errors_sma.append(p_sma - actual)

            # 3. Drift
            p_drift = self.forecast_drift(train_subset, horizon_steps)
            errors_drift.append(p_drift - actual)

            # 4. Holt
            p_holt, _, _ = self.forecast_holt(train_subset, horizon_steps)
            errors_holt.append(p_holt - actual)

        if not errors_naive:
            return {}

        # Compute Naive in-sample mean absolute difference for MASE scaling
        naive_insample_abs_diff = np.mean(np.abs(np.diff(prices))) if len(prices) > 1 else 1.0
        if naive_insample_abs_diff == 0:
            naive_insample_abs_diff = 1.0

        def compute_metrics(errors: List[float]) -> Dict[str, float]:
            err_arr = np.array(errors)
            act_arr = np.array(actuals)
            mae = float(np.mean(np.abs(err_arr)))
            rmse = float(np.sqrt(np.mean(err_arr ** 2)))
            # Guarded MAPE against zero actuals
            valid_mask = act_arr > 0
            if np.any(valid_mask):
                mape = float(np.mean(np.abs(err_arr[valid_mask]) / act_arr[valid_mask]) * 100.0)
            else:
                mape = 0.0
            mase = float(mae / naive_insample_abs_diff)
            return {
                "mae": round(mae, 2),
                "rmse": round(rmse, 2),
                "mape": round(mape, 2),
                "mase": round(mase, 3),
                "sample_size": len(errors),
            }

        return {
            "NAIVE_LAST_OBSERVATION": compute_metrics(errors_naive),
            "MOVING_AVERAGE": compute_metrics(errors_sma),
            "DRIFT_TREND": compute_metrics(errors_drift),
            "HOLT_LINEAR_EXPONENTIAL_SMOOTHING": compute_metrics(errors_holt),
        }

    # -------------------------------------------------------------
    # FORECAST GENERATION & PERSISTENCE
    # -------------------------------------------------------------

    def generate_forecast(
        self,
        commodity_id: int,
        market_id: int,
        horizon_days: int = 30,
        target_date: Optional[date] = None,
        persist: bool = True,
    ) -> MarketForecastResponse:
        """
        Executes end-to-end dataset preparation, baseline comparison,
        walk-forward evaluation, prediction interval generation, and persistence.
        """
        commodity = self.db.query(Commodity).filter(Commodity.id == commodity_id).first()
        market = self.db.query(MarketApmc).filter(MarketApmc.id == market_id).first()

        if not commodity or not market:
            raise ValueError(f"Commodity (ID={commodity_id}) or Market (ID={market_id}) not found.")

        # Prepare verified dataset
        observations, quality = self.prepare_dataset(commodity_id, market_id)

        # Dates setup
        gen_timestamp = datetime.now(timezone.utc)
        today = date.today()

        if target_date is not None:
            target_start = target_date
            computed_horizon = (target_date - today).days
            if computed_horizon > 0:
                horizon_days = computed_horizon
        else:
            target_start = today + timedelta(days=horizon_days)

        target_end = target_start + timedelta(days=7)  # 1-week target selling window

        # Guard: Check sufficiency
        if not quality.is_sufficient or len(observations) < 3:
            unavailability_msg = (
                f"Forecast unavailable: Found {quality.total_observations} valid historical observations "
                f"for {commodity.name} at {market.name}. A minimum of "
                f"{self.MIN_OBSERVATIONS_FOR_DEFENSIBLE_FORECAST} observations is required for defensible "
                "time-series forecasting and out-of-sample backtesting."
            )
            return MarketForecastResponse(
                commodity=CommodityResponse.model_validate(commodity),
                market=MarketResponse.model_validate(market),
                forecast_horizon_days=horizon_days,
                forecast_generated_at=gen_timestamp,
                target_period_start=target_start,
                target_period_end=target_end,
                predicted_modal_price=None,
                lower_uncertainty_bound=None,
                upper_uncertainty_bound=None,
                currency="INR",
                price_unit="RS_PER_QUINTAL",
                model_identifier="UNAVAILABLE_INSUFFICIENT_DATA",
                model_version=self.MODEL_VERSION,
                training_data_cutoff_date=quality.training_cutoff_date,
                status="UNAVAILABLE_INSUFFICIENT_DATA",
                unavailability_reason=unavailability_msg,
                data_quality=quality,
                evaluation_metrics={},
                baseline_comparison=None,
                candidate_models=[],
                historical_reference_points=[
                    {"date": str(o.observation_date), "modal_price": float(o.modal_price)}
                    for o in observations[-5:]
                ],
                disclaimer=DISCLAIMER_PHASE_6,
            )

        # Sufficient observations available: Prepare array
        prices = np.array([float(o.modal_price) for o in observations], dtype=float)

        # Map calendar horizon to observation steps (~5 auction days per week)
        est_auction_steps = max(1, round(horizon_days * (5.0 / 7.0)))

        # 1. Walk-forward backtesting
        backtest_results = self.perform_walk_forward_backtest(prices, horizon_steps=1)

        candidate_items: List[ModelComparisonItem] = []
        best_model = "NAIVE_LAST_OBSERVATION"
        best_mae = float("inf")
        naive_mae = backtest_results.get("NAIVE_LAST_OBSERVATION", {}).get("mae", 1.0)

        for model_id, metrics in backtest_results.items():
            mae = metrics.get("mae", 0.0)
            reduction = None
            if naive_mae > 0 and model_id != "NAIVE_LAST_OBSERVATION":
                reduction = round(((naive_mae - mae) / naive_mae) * 100.0, 2)

            is_best = False
            if mae < best_mae:
                best_mae = mae
                best_model = model_id

            candidate_items.append(
                ModelComparisonItem(
                    model_identifier=model_id,
                    model_version=self.MODEL_VERSION,
                    is_selected=False,  # Updated below
                    mae=mae,
                    rmse=metrics.get("rmse", 0.0),
                    mape=metrics.get("mape"),
                    mase=metrics.get("mase"),
                    error_reduction_vs_baseline_pct=reduction,
                    evaluation_sample_size=metrics.get("sample_size", 0),
                )
            )

        # Mark selected model
        for c in candidate_items:
            if c.model_identifier == best_model:
                c.is_selected = True

        # 2. Generate final forecast with best model
        if best_model == "HOLT_LINEAR_EXPONENTIAL_SMOOTHING":
            predicted_price, alpha_star, beta_star = self.forecast_holt(prices, est_auction_steps)
        elif best_model == "MOVING_AVERAGE":
            predicted_price = self.forecast_moving_average(prices, est_auction_steps, window=7)
        elif best_model == "DRIFT_TREND":
            predicted_price = self.forecast_drift(prices, est_auction_steps)
        else:
            predicted_price = self.forecast_naive(prices, est_auction_steps)

        predicted_price = round(float(predicted_price), 2)

        # 3. Uncertainty interval estimation
        # Use residual standard error from walk-forward backtest
        best_metrics = backtest_results.get(best_model, {})
        rmse_val = best_metrics.get("rmse", float(np.std(prices)) if len(prices) > 1 else 100.0)
        # Prediction interval scales with sqrt(steps)
        sigma_h = rmse_val * math.sqrt(max(1, est_auction_steps))
        z_score = 1.645  # 90% confidence interval

        lower_bound = max(0.0, round(predicted_price - z_score * sigma_h, 2))
        upper_bound = round(predicted_price + z_score * sigma_h, 2)

        # Model status: PUBLISHED if out-of-sample evaluated, EXPERIMENTAL if marginal
        model_status = "PUBLISHED" if len(observations) >= 30 else "EXPERIMENTAL"

        baseline_comp = {
            "baseline_model": "NAIVE_LAST_OBSERVATION",
            "baseline_mae": naive_mae,
            "selected_model": best_model,
            "selected_mae": best_mae,
            "improvement_pct": round(((naive_mae - best_mae) / naive_mae) * 100.0, 2) if naive_mae > 0 else 0.0,
            "evaluation_method": "Chronological Walk-Forward Backtesting (Rolling Origin)",
        }

        # 4. Persistence to Database
        if persist:
            existing_forecast = (
                self.db.query(PriceForecast)
                .filter(
                    PriceForecast.commodity_id == commodity_id,
                    PriceForecast.market_id == market_id,
                    PriceForecast.target_period_start == target_start,
                )
                .first()
            )

            status_notes_str = (
                f"Generated by {best_model} {self.MODEL_VERSION} on {gen_timestamp.isoformat()}. "
                f"Trained on {len(observations)} records up to {quality.training_cutoff_date}. "
                f"Out-of-sample MAE: {best_mae} Rs/qtl."
            )

            if existing_forecast:
                existing_forecast.forecast_generated_at = gen_timestamp
                existing_forecast.target_period_end = target_end
                existing_forecast.forecast_horizon_days = horizon_days
                existing_forecast.predicted_modal_price = predicted_price
                existing_forecast.lower_uncertainty_bound = lower_bound
                existing_forecast.upper_uncertainty_bound = upper_bound
                existing_forecast.model_identifier = best_model
                existing_forecast.model_version = self.MODEL_VERSION
                existing_forecast.training_data_cutoff_date = quality.training_cutoff_date
                existing_forecast.confidence_metric_name = "MAE"
                existing_forecast.confidence_metric_value = best_mae
                existing_forecast.status = model_status
                existing_forecast.status_notes = status_notes_str
            else:
                new_forecast = PriceForecast(
                    commodity_id=commodity_id,
                    market_id=market_id,
                    forecast_generated_at=gen_timestamp,
                    target_period_start=target_start,
                    target_period_end=target_end,
                    forecast_horizon_days=horizon_days,
                    predicted_modal_price=predicted_price,
                    lower_uncertainty_bound=lower_bound,
                    upper_uncertainty_bound=upper_bound,
                    currency="INR",
                    price_unit="RS_PER_QUINTAL",
                    model_identifier=best_model,
                    model_version=self.MODEL_VERSION,
                    training_data_cutoff_date=quality.training_cutoff_date,
                    confidence_metric_name="MAE",
                    confidence_metric_value=best_mae,
                    status=model_status,
                    status_notes=status_notes_str,
                )
                self.db.add(new_forecast)

            try:
                self.db.commit()
            except Exception as e:
                self.db.rollback()
                logger.error(f"Failed to persist PriceForecast record: {e}")

        # Recent historical reference points for charting alongside forecast
        hist_points = [
            {"date": str(o.observation_date), "modal_price": float(o.modal_price)}
            for o in observations[-15:]
        ]

        return MarketForecastResponse(
            commodity=CommodityResponse.model_validate(commodity),
            market=MarketResponse.model_validate(market),
            forecast_horizon_days=horizon_days,
            forecast_generated_at=gen_timestamp,
            target_period_start=target_start,
            target_period_end=target_end,
            predicted_modal_price=predicted_price,
            lower_uncertainty_bound=lower_bound,
            upper_uncertainty_bound=upper_bound,
            currency="INR",
            price_unit="RS_PER_QUINTAL",
            model_identifier=best_model,
            model_version=self.MODEL_VERSION,
            training_data_cutoff_date=quality.training_cutoff_date,
            status=model_status,
            unavailability_reason=None,
            data_quality=quality,
            evaluation_metrics=best_metrics,
            baseline_comparison=baseline_comp,
            candidate_models=candidate_items,
            historical_reference_points=hist_points,
            disclaimer=DISCLAIMER_PHASE_6,
        )

    def get_latest_forecast(
        self,
        commodity_id: int,
        market_id: int,
        horizon_days: int = 30,
    ) -> Optional[PriceForecast]:
        """Fetches the latest stored PriceForecast from the database."""
        return (
            self.db.query(PriceForecast)
            .filter(
                PriceForecast.commodity_id == commodity_id,
                PriceForecast.market_id == market_id,
                PriceForecast.forecast_horizon_days == horizon_days,
            )
            .order_by(desc(PriceForecast.forecast_generated_at))
            .first()
        )
