"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  Activity,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import {
  marketService,
  MarketForecastResponse,
  CommodityItem,
  MarketItem,
} from "@/services/marketService";

interface FuturePriceOutlookProps {
  selectedMarket?: string;
  selectedCommodity?: string;
  selectedCommodityId?: number;
  selectedMarketId?: number;
}

export const FuturePriceOutlook: React.FC<FuturePriceOutlookProps> = ({
  selectedMarket = "Baramati APMC",
  selectedCommodity = "Soybean",
  selectedCommodityId,
  selectedMarketId,
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";

  // Filter State
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [activeCommodityId, setActiveCommodityId] = useState<number>(selectedCommodityId || 1);
  const [activeMarketId, setActiveMarketId] = useState<number>(selectedMarketId || 1);
  const [commoditiesList, setCommoditiesList] = useState<CommodityItem[]>([]);
  const [marketsList, setMarketsList] = useState<MarketItem[]>([]);

  // Forecast Response & UI State
  const [forecastData, setForecastData] = useState<MarketForecastResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showModelDetails, setShowModelDetails] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  // Load commodities and markets metadata on mount
  useEffect(() => {
    let isMounted = true;
    async function loadMeta() {
      try {
        const [comms, mkts] = await Promise.all([
          marketService.getCommodities(),
          marketService.getMarkets(),
        ]);
        if (isMounted) {
          setCommoditiesList(comms);
          setMarketsList(mkts);
          if (!selectedCommodityId && comms.length > 0) {
            setActiveCommodityId(comms[0].id);
          }
          if (!selectedMarketId && mkts.length > 0) {
            setActiveMarketId(mkts[0].id);
          }
        }
      } catch (err) {
        console.warn("Could not load commodities/markets for forecast:", err);
      }
    }
    loadMeta();
    return () => {
      isMounted = false;
    };
  }, [selectedCommodityId, selectedMarketId]);

  // Sync external props if provided
  useEffect(() => {
    if (selectedCommodityId) setActiveCommodityId(selectedCommodityId);
  }, [selectedCommodityId]);

  useEffect(() => {
    if (selectedMarketId) setActiveMarketId(selectedMarketId);
  }, [selectedMarketId]);

  // Fetch forecast data whenever commodity, market, or horizon changes
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchForecast() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const data = await marketService.getMarketForecast(
          {
            commodityId: activeCommodityId,
            marketId: activeMarketId,
            horizonDays: horizonDays,
          },
          controller.signal
        );
        if (isMounted) {
          setForecastData(data);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (err.name === "AbortError" || err.name === "CanceledError") return;
        if (isMounted) {
          setErrorMsg(err.message || "Failed to load market forecast.");
          setIsLoading(false);
        }
      }
    }

    fetchForecast();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [activeCommodityId, activeMarketId, horizonDays]);

  const HORIZON_OPTIONS = [
    { label: isMr ? "७ दिवस" : "7 Days", value: 7 },
    { label: isMr ? "१५ दिवस" : "15 Days", value: 15 },
    { label: isMr ? "३० दिवस (१ महिना)" : "30 Days (1 Mo)", value: 30 },
    { label: isMr ? "६० दिवस (२ महिने)" : "60 Days (2 Mo)", value: 60 },
    { label: isMr ? "९० दिवस (हंगाम)" : "90 Days (Harvest)", value: 90 },
    { label: isMr ? "१२० दिवस" : "120 Days", value: 120 },
  ];

  const formatPrice = (p?: number | null) =>
    p != null ? `₹${p.toLocaleString("en-IN")}` : "—";

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(isMr ? "mr-IN" : "en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const isUnavailable =
    forecastData?.status === "UNAVAILABLE_INSUFFICIENT_DATA" ||
    forecastData?.predicted_modal_price == null;

  // Chart Coordinates Calculation
  const histPoints = forecastData?.historical_reference_points || [];
  const predPrice = forecastData?.predicted_modal_price;
  const lowerBound = forecastData?.lower_uncertainty_bound;
  const upperBound = forecastData?.upper_uncertainty_bound;
  const targetDateStr = forecastData?.target_period_start;

  // Combine for chart bounding
  const allPrices: number[] = [
    ...histPoints.map((p) => p.modal_price),
    ...(predPrice != null ? [predPrice] : []),
    ...(lowerBound != null ? [lowerBound] : []),
    ...(upperBound != null ? [upperBound] : []),
  ];

  const minChartVal = allPrices.length > 0 ? Math.floor(Math.min(...allPrices) * 0.96) : 3500;
  const maxChartVal = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) * 1.04) : 5500;
  const priceRange = Math.max(maxChartVal - minChartVal, 100);

  const chartWidth = 720;
  const chartHeight = 260;
  const padLeft = 60;
  const padRight = 80;
  const padTop = 25;
  const padBottom = 40;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;

  // Total points count on x-axis: historical + 1 forecast point
  const totalXPoints = Math.max(histPoints.length + (predPrice != null ? 1 : 0), 2);
  const getX = (idx: number) => padLeft + (idx / (totalXPoints - 1)) * plotWidth;
  const getY = (price: number) =>
    padTop + plotHeight - ((price - minChartVal) / priceRange) * plotHeight;

  // Build SVG Paths
  let histPath = "";
  if (histPoints.length > 0) {
    histPath = histPoints
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(pt.modal_price).toFixed(1)}`)
      .join(" ");
  }

  // Projection Line (Dashed) connecting last historical point to forecast point
  let projPath = "";
  let intervalPoly = "";
  if (histPoints.length > 0 && predPrice != null && lowerBound != null && upperBound != null) {
    const lastHistIdx = histPoints.length - 1;
    const lastX = getX(lastHistIdx);
    const lastY = getY(histPoints[lastHistIdx].modal_price);

    const fcIdx = histPoints.length;
    const fcX = getX(fcIdx);
    const fcY = getY(predPrice);
    const fcLowerY = getY(lowerBound);
    const fcUpperY = getY(upperBound);

    projPath = `M ${lastX.toFixed(1)} ${lastY.toFixed(1)} L ${fcX.toFixed(1)} ${fcY.toFixed(1)}`;

    // Polygon for uncertainty interval cone
    intervalPoly = `M ${lastX.toFixed(1)} ${lastY.toFixed(1)} L ${fcX.toFixed(1)} ${fcUpperY.toFixed(1)} L ${fcX.toFixed(1)} ${fcLowerY.toFixed(1)} Z`;
  }

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 sm:p-6 shadow-sm space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-text-main tracking-tight">
                {isMr
                  ? "भविष्यातील बाजार भाव अंदाज (हंगामी अंदाज)"
                  : "Future Price Outlook: Harvest-Time Forecast Engine"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                Phase 6 Engine
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {isMr
                ? "मागील बाजार नोंदींवर आधारित वेळ-मालिका (Time-Series) सांख्यिकीय अंदाज"
                : "Statistical time-series projections derived from verified APMC observations without lookahead bias"}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isLoading ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-muted text-text-muted border border-surface-border animate-pulse">
              <Activity className="w-3.5 h-3.5 animate-spin" />
              {isMr ? "अंदाज गणना चालू..." : "Evaluating Time-Series..."}
            </span>
          ) : isUnavailable ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              {isMr ? "अंदाज अनुपलब्ध — अपुरा डेटा" : "Forecast Unavailable — Insufficient Data"}
            </span>
          ) : forecastData?.status === "PUBLISHED" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {isMr ? "प्रमाणित अंदाज (Backtested)" : "Validated Backtested Model"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-300">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              {isMr ? "प्रायोगिक मॉडेल (Experimental)" : "Experimental Model"}
            </span>
          )}
        </div>
      </div>

      {/* FILTER BAR: COMMODITY, MARKET & HORIZON SELECTOR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-surface-ground rounded-xl border border-surface-border">
        {/* Commodity Selector */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
            {isMr ? "पीक / शेतमाल" : "Commodity"}
          </label>
          <select
            value={activeCommodityId}
            onChange={(e) => setActiveCommodityId(Number(e.target.value))}
            className="w-full text-xs font-semibold bg-white border border-surface-border rounded-lg px-2.5 py-1.5 text-text-main focus:outline-none focus:ring-1 focus:ring-soil-primary"
          >
            {commoditiesList.map((c) => (
              <option key={c.id} value={c.id}>
                {isMr ? c.name_mr || c.name : c.name} ({c.category})
              </option>
            ))}
          </select>
        </div>

        {/* Primary Market Selector */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
            {isMr ? "बाजार समिती (APMC Yard)" : "Market / APMC Yard"}
          </label>
          <select
            value={activeMarketId}
            onChange={(e) => setActiveMarketId(Number(e.target.value))}
            className="w-full text-xs font-semibold bg-white border border-surface-border rounded-lg px-2.5 py-1.5 text-text-main focus:outline-none focus:ring-1 focus:ring-soil-primary"
          >
            {marketsList.map((m) => (
              <option key={m.id} value={m.id}>
                {isMr ? m.name_mr || m.name : m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Forecast Horizon Selector */}
        <div>
          <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
            {isMr ? "अंदाज कालावधी (Horizon)" : "Forecast Lead Time"}
          </label>
          <div className="flex flex-wrap gap-1">
            {HORIZON_OPTIONS.map((h) => (
              <button
                key={h.value}
                onClick={() => setHorizonDays(h.value)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${
                  horizonDays === h.value
                    ? "bg-soil-primary text-white shadow-xs"
                    : "bg-white text-text-muted border border-surface-border hover:bg-surface-muted"
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CARD 1: Estimated Modal Price */}
        <div className="p-4 rounded-xl border border-surface-border bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted font-semibold">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-soil-primary" />
              {isMr ? "अंदाजित बाजार भाव (Modal Rate)" : "Estimated Modal Price"}
            </span>
            <span className="text-[10px] uppercase font-bold text-text-muted">
              {forecastData?.price_unit ? "₹ / Quintal" : "₹ / Qtl"}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-text-main">
              {isLoading ? "..." : isUnavailable ? "Unavailable" : formatPrice(predPrice)}
            </span>
          </div>

          <div className="text-[11px] text-text-muted flex items-center justify-between pt-1 border-t border-surface-border">
            <span>{isMr ? "लक्ष्य विक्री काळ:" : "Target Selling Window:"}</span>
            <span className="font-bold text-text-main">
              {formatDate(forecastData?.target_period_start)} –{" "}
              {formatDate(forecastData?.target_period_end)}
            </span>
          </div>
        </div>

        {/* CARD 2: Estimated Uncertainty Range */}
        <div className="p-4 rounded-xl border border-surface-border bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted font-semibold">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-600" />
              {isMr ? "अंदाजित किंमत पट्टा (Range)" : "Estimated Prediction Interval"}
            </span>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
              90% CI (±1.645σ)
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-extrabold text-text-main">
              {isLoading
                ? "..."
                : isUnavailable
                ? "—"
                : `${formatPrice(lowerBound)} – ${formatPrice(upperBound)}`}
            </span>
          </div>

          <p className="text-[10px] text-text-muted leading-tight pt-1 border-t border-surface-border">
            {isMr
              ? "सांख्यिकीय त्रुटी पट्टा. ही हमीभाव किंवा निश्चित किंमत मर्यादा नाही."
              : "Statistical residual spread. Not a guaranteed minimum or maximum price band."}
          </p>
        </div>

        {/* CARD 3: Model & Backtest Performance */}
        <div className="p-4 rounded-xl border border-surface-border bg-white shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-text-muted font-semibold">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              {isMr ? "मॉडेल व मूल्यांकन (Backtest)" : "Algorithm & Backtest Accuracy"}
            </span>
            <span className="text-[10px] font-bold text-text-muted">
              {forecastData?.model_version || "v1.0.0"}
            </span>
          </div>

          <div>
            <div className="text-sm font-bold text-text-main truncate">
              {forecastData?.model_identifier || "NAIVE_LAST_OBSERVATION"}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
              <span>
                MAE:{" "}
                <strong className="text-text-main">
                  {forecastData?.evaluation_metrics?.mae != null
                    ? `₹${forecastData.evaluation_metrics.mae}/qtl`
                    : "N/A"}
                </strong>
              </span>
              <span>•</span>
              <span>
                RMSE:{" "}
                <strong className="text-text-main">
                  {forecastData?.evaluation_metrics?.rmse != null
                    ? `₹${forecastData.evaluation_metrics.rmse}`
                    : "N/A"}
                </strong>
              </span>
            </div>
          </div>

          <div className="text-[11px] text-emerald-700 font-semibold pt-1 border-t border-surface-border flex items-center justify-between">
            <span>
              {forecastData?.baseline_comparison?.improvement_pct != null &&
              forecastData.baseline_comparison.improvement_pct > 0
                ? `${forecastData.baseline_comparison.improvement_pct}% better than Naive`
                : "Benchmark Baseline"}
            </span>
            <span className="text-[10px] text-text-muted font-normal">
              Cutoff: {formatDate(forecastData?.training_data_cutoff_date)}
            </span>
          </div>
        </div>
      </div>

      {/* CHART SECTION */}
      <div className="border border-surface-border rounded-xl p-4 bg-surface-ground">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-surface-border">
          <div className="text-xs font-bold text-text-main flex items-center gap-2">
            <span>{isMr ? "किंमत आलेख (Historical vs Forecast)" : "Market Price Trajectory & Harvest Horizon"}</span>
            <span className="text-[11px] font-normal text-text-muted">
              ({forecastData?.commodity?.name} @ {forecastData?.market?.name})
            </span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-soil-primary inline-block"></span>
              {isMr ? "प्रत्यक्ष नोंदवले भाव (Observed)" : "Historical Actual"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-600 inline-block"></span>
              {isMr ? "अंदाजित भाव (Forecast)" : "Estimated Forecast"}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-amber-200/50 border border-amber-400 inline-block rounded-xs"></span>
              {isMr ? "अंदाज पट्टा (CI)" : "Prediction Interval"}
            </span>
          </div>
        </div>

        {/* SVG Visualization or Insufficient Data Alert */}
        {isUnavailable ? (
          <div className="py-12 px-4 text-center max-w-lg mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-text-main">
              {isMr ? "या शेतमालासाठी अंदाज उपलब्ध नाही" : "Price Forecast Currently Unavailable"}
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              {forecastData?.unavailability_reason ||
                "Insufficient chronological observations recorded in the official database. SoilPilot enforces strict time-series criteria (minimum 15 verified records) to ensure model validity and prevent deceptive predictions."}
            </p>
            <div className="text-[11px] font-semibold text-text-muted bg-white p-2.5 rounded-lg border border-surface-border inline-block">
              {isMr ? "उपलब्ध नोंदी संख्या:" : "Current Available Records:"}{" "}
              <strong className="text-text-main">
                {forecastData?.data_quality?.total_observations ?? 0}
              </strong>{" "}
              / Min Required: <strong className="text-soil-primary">15</strong>
            </div>
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto min-w-[580px] select-none"
            >
              <defs>
                <linearGradient id="intervalGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.6" />
                </linearGradient>
              </defs>

              {/* Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                const yVal = minChartVal + frac * priceRange;
                const yPos = getY(yVal);
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={yPos}
                      x2={chartWidth - padRight + 20}
                      y2={yPos}
                      stroke="#e5e7eb"
                      strokeDasharray="3,3"
                    />
                    <text
                      x={padLeft - 8}
                      y={yPos + 3}
                      textAnchor="end"
                      fontSize="9"
                      fill="#6b7280"
                      fontWeight="bold"
                    >
                      ₹{Math.round(yVal)}
                    </text>
                  </g>
                );
              })}

              {/* Shaded Uncertainty Cone */}
              {intervalPoly && (
                <polygon
                  points={intervalPoly.replace(/[MLZ]/g, "").trim()}
                  fill="url(#intervalGrad)"
                  stroke="#fbbf24"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              )}

              {/* Historical Trend Line (Solid Green) */}
              {histPath && (
                <path
                  d={histPath}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Forecast Projection Line (Dashed Amber) */}
              {projPath && (
                <path
                  d={projPath}
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="2.5"
                  strokeDasharray="5,4"
                  strokeLinecap="round"
                />
              )}

              {/* Historical Data Points */}
              {histPoints.map((pt, i) => {
                const cx = getX(i);
                const cy = getY(pt.modal_price);
                return (
                  <g
                    key={i}
                    className="cursor-pointer group"
                    onMouseEnter={() =>
                      setHoveredPoint({
                        date: pt.date,
                        price: pt.modal_price,
                        type: "Actual Observed (APMC)",
                      })
                    }
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r="4"
                      fill="#16a34a"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      className="group-hover:r-5 transition-all"
                    />
                    {/* Date label on horizontal axis */}
                    <text
                      x={cx}
                      y={chartHeight - 12}
                      textAnchor="middle"
                      fontSize="8.5"
                      fill="#6b7280"
                    >
                      {pt.date.slice(5)}
                    </text>
                  </g>
                );
              })}

              {/* Forecast Estimated Data Point (Diamond Star) */}
              {predPrice != null && (
                <g
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setHoveredPoint({
                      date: targetDateStr,
                      price: predPrice,
                      lower: lowerBound,
                      upper: upperBound,
                      type: `Forecast Projection (${forecastData?.model_identifier})`,
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <circle
                    cx={getX(histPoints.length)}
                    cy={getY(predPrice)}
                    r="6.5"
                    fill="#d97706"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  {/* Vertical error bar line between lower and upper bounds */}
                  {lowerBound != null && upperBound != null && (
                    <line
                      x1={getX(histPoints.length)}
                      y1={getY(lowerBound)}
                      x2={getX(histPoints.length)}
                      y2={getY(upperBound)}
                      stroke="#d97706"
                      strokeWidth="2"
                    />
                  )}
                  {/* Forecast date on axis */}
                  <text
                    x={getX(histPoints.length)}
                    y={chartHeight - 12}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill="#d97706"
                    fontWeight="bold"
                  >
                    {targetDateStr ? targetDateStr.slice(5) : `+${horizonDays}d`}
                  </text>
                </g>
              )}
            </svg>

            {/* Tooltip Overlay */}
            {hoveredPoint && (
              <div className="absolute top-2 right-4 bg-gray-900/90 text-white p-2.5 rounded-lg text-xs shadow-lg space-y-1 pointer-events-none">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                  {hoveredPoint.type}
                </div>
                <div className="font-bold text-sm">
                  ₹{hoveredPoint.price.toLocaleString("en-IN")}{" "}
                  <span className="text-[10px] text-gray-300 font-normal">/ Quintal</span>
                </div>
                <div className="text-[10px] text-gray-300">Date: {hoveredPoint.date}</div>
                {hoveredPoint.lower != null && (
                  <div className="text-[10px] text-amber-300">
                    Est. Range: ₹{hoveredPoint.lower} – ₹{hoveredPoint.upper}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CANDIDATE MODELS EVALUATION MATRIX (TRANSPARENCY ACCORDION) */}
      <div className="border border-surface-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowModelDetails(!showModelDetails)}
          className="w-full p-3.5 bg-surface-ground hover:bg-surface-muted flex items-center justify-between text-xs font-bold text-text-main transition-colors"
        >
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-soil-primary" />
            {isMr
              ? "मॉडेल तुलना आणि सांख्यिकीय अचूकता तपशील"
              : "Algorithm Comparison & Out-of-Sample Backtest Matrix"}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-text-muted">
            {showModelDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showModelDetails && (
          <div className="p-4 space-y-3 bg-white border-t border-surface-border">
            <p className="text-xs text-text-muted leading-relaxed">
              SoilPilot evaluates candidate models chronologically across rolling origins. Future observations are strictly sequestered during each evaluation step. The model demonstrating the lowest out-of-sample MAE is selected as the primary projection.
            </p>

            {forecastData?.candidate_models && forecastData.candidate_models.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-surface-border rounded-lg">
                  <thead className="bg-surface-ground text-text-muted font-bold text-[11px] border-b border-surface-border">
                    <tr>
                      <th className="p-2.5">Algorithm</th>
                      <th className="p-2.5">MAE (₹/qtl)</th>
                      <th className="p-2.5">RMSE (₹)</th>
                      <th className="p-2.5">MAPE (%)</th>
                      <th className="p-2.5">MASE</th>
                      <th className="p-2.5">vs Naive</th>
                      <th className="p-2.5">Selection Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {forecastData.candidate_models.map((m, idx) => (
                      <tr
                        key={idx}
                        className={m.is_selected ? "bg-emerald-50/60 font-semibold" : "hover:bg-surface-ground/50"}
                      >
                        <td className="p-2.5 font-bold text-text-main">{m.model_identifier}</td>
                        <td className="p-2.5">₹{m.mae}</td>
                        <td className="p-2.5">₹{m.rmse}</td>
                        <td className="p-2.5">{m.mape != null ? `${m.mape}%` : "—"}</td>
                        <td className="p-2.5">{m.mase ?? "—"}</td>
                        <td className="p-2.5">
                          {m.error_reduction_vs_baseline_pct != null ? (
                            <span
                              className={
                                m.error_reduction_vs_baseline_pct > 0
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }
                            >
                              {m.error_reduction_vs_baseline_pct > 0 ? "-" : "+"}
                              {Math.abs(m.error_reduction_vs_baseline_pct)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-2.5">
                          {m.is_selected ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              Selected Primary
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-muted">Alternative</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-text-muted italic bg-surface-ground p-3 rounded-lg">
                Backtest comparison matrix unavailable when observations are insufficient (N &lt; 15).
              </div>
            )}
          </div>
        )}
      </div>

      {/* MANDATORY REGULATORY & ACCURACY DISCLAIMER */}
      <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900/90 leading-relaxed">
          <strong>{isMr ? "महत्त्वाची सूचना (Forecast Disclaimer):" : "Official Agricultural Price Disclaimer:"}</strong>{" "}
          {forecastData?.disclaimer ||
            "Forecasts are estimates based on historical APMC auction data, not guaranteed market prices. Actual prices will differ due to supply, harvest arrivals, weather fluctuations, quality grading, and transport costs. SoilPilot does not guarantee market realizations."}
        </p>
      </div>
    </div>
  );
};
