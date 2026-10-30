"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  TrendingUp,
  TrendingDown,
  LineChart,
  Calendar,
  Building2,
  Database,
  Info,
  Clock,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Scale,
} from "lucide-react";
import {
  marketService,
  CommodityItem,
  MarketItem,
  HistoricalAnalysisResponse,
  HistoricalTrendPoint,
} from "@/services/marketService";
import { isAllowedCrop } from "@/i18n/marathiHelper";

interface PriceTrendOutlookProps {
  selectedMarket: string;
  selectedCommodity?: string;
  activeDistrict?: string;
}

export const PriceTrendOutlook: React.FC<PriceTrendOutlookProps> = ({
  selectedMarket,
  selectedCommodity = "Soybean",
  activeDistrict = "Pune",
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";

  // Filter States
  const [commodities, setCommodities] = useState<CommodityItem[]>([]);
  const [markets, setMarkets] = useState<MarketItem[]>([]);
  const [selectedCommodityId, setSelectedCommodityId] = useState<number>(1);
  const [selectedPrimaryMarketId, setSelectedPrimaryMarketId] = useState<number | undefined>(undefined);
  const [selectedComparisonMarketId, setSelectedComparisonMarketId] = useState<number | undefined>(undefined);
  const [timeWindow, setTimeWindow] = useState<string>("30d");
  const [aggregation, setAggregation] = useState<string>("daily");

  // Data & Request State
  const [loading, setLoading] = useState<boolean>(true);
  const [analysisData, setAnalysisData] = useState<HistoricalAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HistoricalTrendPoint | null>(null);

  // 1. Initial Load of Commodities and Markets
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      marketService.getCommodities(),
      marketService.getMarkets({ districtName: activeDistrict }),
    ])
      .then(([commList, mktList]) => {
        if (!isMounted) return;
        const validComms = commList.filter(isAllowedCrop);
        const finalComms = validComms.length > 0 ? validComms : commList;
        setCommodities(finalComms);
        setMarkets(mktList);

        // Match selected commodity by name if possible
        if (finalComms.length > 0) {
          const matchComm = finalComms.find(
            (c) =>
              c.name.toLowerCase().includes(selectedCommodity.toLowerCase()) ||
              selectedCommodity.toLowerCase().includes(c.name.toLowerCase())
          );
          if (matchComm) {
            setSelectedCommodityId(matchComm.id);
          } else {
            setSelectedCommodityId(finalComms[0].id);
          }
        }

        // Match primary market by name
        if (mktList.length > 0) {
          const matchMkt = mktList.find(
            (m) =>
              m.name.toLowerCase().includes(selectedMarket.toLowerCase()) ||
              selectedMarket.toLowerCase().includes(m.name.toLowerCase())
          );
          if (matchMkt) {
            setSelectedPrimaryMarketId(matchMkt.id);
          } else {
            setSelectedPrimaryMarketId(mktList[0].id);
          }
        }
      })
      .catch((e) => console.warn("Failed to load initial metadata for trend outlook:", e));

    return () => {
      isMounted = false;
    };
  }, [selectedCommodity, selectedMarket, activeDistrict]);

  // 2. Fetch Historical Analysis
  const fetchAnalysis = async () => {
    if (!selectedCommodityId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await marketService.getHistoricalAnalysis({
        commodityId: selectedCommodityId,
        marketId: selectedPrimaryMarketId,
        district: activeDistrict,
        window: timeWindow,
        aggregation: aggregation,
        comparisonMarketId: selectedComparisonMarketId,
        trendThreshold: 2.0,
      });
      setAnalysisData(data);
    } catch (err: any) {
      console.warn("getHistoricalAnalysis error:", err);
      setError(err?.response?.data?.detail || err?.message || "Failed to load historical analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [
    selectedCommodityId,
    selectedPrimaryMarketId,
    selectedComparisonMarketId,
    timeWindow,
    aggregation,
  ]);

  // Derived Values
  const metrics = analysisData?.summary_metrics;
  const quality = analysisData?.data_quality;
  const series = analysisData?.series || [];
  const comparisonSeries = analysisData?.comparison_series || [];
  const hasSeries = series.length > 0;

  // Chart Coordinates Computation (SVG Line & Area)
  const chartLayout = useMemo(() => {
    if (!hasSeries) return null;

    const width = 760;
    const height = 240;
    const padLeft = 65;
    const padRight = 30;
    const padTop = 25;
    const padBottom = 40;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    // Determine min/max price bounds
    const allPrices: number[] = [];
    series.forEach((pt) => {
      allPrices.push(pt.modal_price);
      if (pt.min_price != null) allPrices.push(pt.min_price);
      if (pt.max_price != null) allPrices.push(pt.max_price);
    });

    comparisonSeries.forEach((cp) => {
      allPrices.push(cp.comparison_modal_price);
    });

    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);

    // Add 8% vertical padding
    const pMargin = Math.max(50, (maxP - minP) * 0.12);
    const yMin = Math.max(0, Math.floor((minP - pMargin) / 50) * 50);
    const yMax = Math.ceil((maxP + pMargin) / 50) * 50;
    const yRange = yMax - yMin || 1;

    // Helper functions
    const getX = (idx: number, count: number) => {
      if (count <= 1) return padLeft + plotW / 2;
      return padLeft + (idx / (count - 1)) * plotW;
    };

    const getY = (price: number) => {
      const norm = (price - yMin) / yRange;
      return padTop + plotH - norm * plotH;
    };

    // Build Modal Path (Primary Line)
    const points = series.map((pt, idx) => ({
      ...pt,
      x: getX(idx, series.length),
      y: getY(pt.modal_price),
      yLow: getY(pt.min_price != null ? pt.min_price : pt.modal_price),
      yHigh: getY(pt.max_price != null ? pt.max_price : pt.modal_price),
    }));

    let linePath = "";
    if (points.length === 1) {
      linePath = `M ${points[0].x - 10} ${points[0].y} L ${points[0].x + 10} ${points[0].y}`;
    } else {
      linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    }

    // Build Shaded Band between Min and Max
    let areaPath = "";
    if (points.length > 1) {
      const topEdge = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.yHigh.toFixed(1)}`).join(" ");
      const bottomEdge = points
        .slice()
        .reverse()
        .map((p) => `L ${p.x.toFixed(1)} ${p.yLow.toFixed(1)}`)
        .join(" ");
      areaPath = `${topEdge} ${bottomEdge} Z`;
    }

    // Build Comparison Line if present
    let compLinePath = "";
    const compPoints: Array<{ x: number; y: number; price: number; date: string }> = [];
    if (comparisonSeries.length > 0) {
      const dateToXMap = new Map<string, number>();
      points.forEach((p) => dateToXMap.set(p.date, p.x));

      comparisonSeries.forEach((cp) => {
        const matchingX = dateToXMap.get(cp.date);
        if (matchingX !== undefined) {
          const cy = getY(cp.comparison_modal_price);
          compPoints.push({ x: matchingX, y: cy, price: cp.comparison_modal_price, date: cp.date });
        }
      });

      if (compPoints.length > 1) {
        compLinePath = compPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
      }
    }

    // Generate 4 Y-Axis Ticks
    const yTicks: Array<{ val: number; y: number }> = [];
    const tickStep = yRange / 3;
    for (let i = 0; i <= 3; i++) {
      const val = Math.round(yMin + i * tickStep);
      yTicks.push({ val, y: getY(val) });
    }

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      points,
      compPoints,
      linePath,
      areaPath,
      compLinePath,
      yTicks,
      yMin,
      yMax,
    };
  }, [series, comparisonSeries, hasSeries]);

  // Trend Badge Configuration
  const trendDir = metrics?.trend_direction || "INSUFFICIENT_DATA";
  const getTrendBadge = () => {
    switch (trendDir) {
      case "RISING":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-300",
          icon: <ArrowUpRight className="w-4 h-4 text-emerald-600" />,
          labelEn: "Rising Trend",
          labelMr: "वाढता कल (Rising)",
          noteEn: "Prices moved up > +2.0% across comparison window",
          noteMr: "तुलना कालावधीत दरात २% पेक्षा जास्त वाढ नोंदवली गेली",
        };
      case "FALLING":
        return {
          bg: "bg-rose-50 text-rose-800 border-rose-300",
          icon: <ArrowDownRight className="w-4 h-4 text-rose-600" />,
          labelEn: "Falling Trend",
          labelMr: "घसरता कल (Falling)",
          noteEn: "Prices moved down < -2.0% across comparison window",
          noteMr: "तुलना कालावधीत दरात २% पेक्षा जास्त घट नोंदवली गेली",
        };
      case "STABLE":
        return {
          bg: "bg-blue-50 text-blue-800 border-blue-300",
          icon: <Minus className="w-4 h-4 text-blue-600" />,
          labelEn: "Stable Movement",
          labelMr: "स्थिर कल (Stable)",
          noteEn: "Price fluctuations remained within +/-2.0% margin",
          noteMr: "दरातील चढ-उतार +/-२% मर्यादेच्या आत नोंदवले गेले",
        };
      default:
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-300",
          icon: <Info className="w-4 h-4 text-amber-600" />,
          labelEn: "Insufficient Data",
          labelMr: "अपुरी आकडेवारी (Insufficient Data)",
          noteEn: "Minimum 3 verified observations required to classify trend direction",
          noteMr: "कल निश्चित करण्यासाठी किमान ३ पडताळणीकृत नोंदी आवश्यक आहेत",
        };
    }
  };

  const trendBadge = getTrendBadge();

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 sm:p-6 shadow-sm space-y-6">
      {/* Section Header with Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-soil-primaryLight border border-soil-secondary/30 text-soil-primary flex items-center justify-center shrink-0">
            <LineChart className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-text-main tracking-tight">
                {isMr
                  ? "ऐतिहासिक बाजार भाव कल विश्लेषण (Historical Price Trends)"
                  : "Historical Market Price Analysis & Trend Detection"}
              </h2>
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin text-soil-primary" />}
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {isMr
                ? "पडताळणीकृत प्रत्यक्ष लिलाव दर, सरासरी चढ-उतार आणि बाजारपेठ तुलना (कोणताही काल्पनिक अंदाज नाही)"
                : "Verified past auction observations, descriptive movements, and multi-market comparison (No price forecasting)"}
            </p>
          </div>
        </div>

        {/* Time Window Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-muted rounded-xl border border-surface-border self-start lg:self-auto">
          {[
            { key: "7d", label: "7D" },
            { key: "30d", label: "30D" },
            { key: "90d", label: "90D" },
            { key: "1y", label: "1Y" },
            { key: "all", label: "All" },
          ].map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setTimeWindow(w.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                timeWindow === w.key
                  ? "bg-soil-primary text-white shadow-xs"
                  : "text-text-muted hover:text-text-main hover:bg-white/60"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Selection Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-surface-subtle/60 p-3.5 rounded-xl border border-surface-border">
        {/* 1. Commodity Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {isMr ? "कृषी माल (Commodity)" : "Commodity"}
          </label>
          <select
            value={selectedCommodityId}
            onChange={(e) => setSelectedCommodityId(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-surface-border text-xs font-semibold text-text-main focus:outline-none focus:ring-1 focus:ring-soil-primary"
          >
            {commodities.map((c) => (
              <option key={c.id} value={c.id}>
                {isMr ? c.name_mr || c.name : c.name} ({c.category})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Primary Market Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {isMr ? "प्राथमिक बाजार (Primary APMC)" : "Primary Market (APMC)"}
          </label>
          <select
            value={selectedPrimaryMarketId || ""}
            onChange={(e) => setSelectedPrimaryMarketId(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-surface-border text-xs font-semibold text-text-main focus:outline-none focus:ring-1 focus:ring-soil-primary"
          >
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {isMr ? m.name_mr || m.name : m.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Optional Comparison Market */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
            <Scale className="w-3 h-3 text-soil-primary" />
            <span>{isMr ? "तुलना बाजार (Compare APMC)" : "Compare Market (Optional)"}</span>
          </label>
          <select
            value={selectedComparisonMarketId || ""}
            onChange={(e) => setSelectedComparisonMarketId(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-surface-border text-xs font-semibold text-text-main focus:outline-none focus:ring-1 focus:ring-soil-primary"
          >
            <option value="">{isMr ? "— तुलना करू नका —" : "— None (Single Market) —"}</option>
            {markets
              .filter((m) => m.id !== selectedPrimaryMarketId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {isMr ? m.name_mr || m.name : m.name}
                </option>
              ))}
          </select>
        </div>

        {/* 4. Aggregation Step */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {isMr ? "एकत्रीकरण (Aggregation)" : "Aggregation Cadence"}
          </label>
          <select
            value={aggregation}
            onChange={(e) => setAggregation(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-surface-border text-xs font-semibold text-text-main focus:outline-none focus:ring-1 focus:ring-soil-primary"
          >
            <option value="daily">{isMr ? "दैनिक प्रत्यक्ष लिलाव (Daily)" : "Daily Observed Auctions"}</option>
            <option value="weekly">{isMr ? "साप्ताहिक सरासरी (Weekly Avg)" : "Weekly Averages"}</option>
            <option value="monthly">{isMr ? "मासिक सरासरी (Monthly Avg)" : "Monthly Averages"}</option>
          </select>
        </div>
      </div>

      {/* Summary KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Latest Observed Modal Rate */}
        <div className="p-3.5 rounded-xl bg-white border border-surface-border shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            {isMr ? "शेवटचा प्रत्यक्ष दर" : "Latest Observed Rate"}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-text-main">
              {metrics?.latest_price != null ? `₹${metrics.latest_price.toLocaleString("en-IN")}` : "— —"}
            </span>
            <span className="text-[10px] text-text-muted font-semibold">₹/qtl</span>
          </div>
          <span className="text-[10px] text-text-muted block truncate">
            {metrics?.latest_date ? `Date: ${metrics.latest_date}` : "Awaiting records"}
          </span>
        </div>

        {/* Metric 2: Absolute & Percentage Change */}
        <div className="p-3.5 rounded-xl bg-white border border-surface-border shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            {isMr ? "दर बदल (Change)" : "Observed Change"}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-xl font-black ${
                metrics?.absolute_change != null && metrics.absolute_change > 0
                  ? "text-emerald-700"
                  : metrics?.absolute_change != null && metrics.absolute_change < 0
                  ? "text-rose-700"
                  : "text-text-main"
              }`}
            >
              {metrics?.absolute_change != null
                ? `${metrics.absolute_change > 0 ? "+" : ""}${metrics.absolute_change}`
                : "— —"}
            </span>
            <span className="text-xs font-bold text-text-muted">
              {metrics?.percentage_change != null
                ? `(${metrics.percentage_change > 0 ? "+" : ""}${metrics.percentage_change}%)`
                : ""}
            </span>
          </div>
          <span className="text-[10px] text-text-muted block truncate">
            {metrics?.previous_date ? `vs ${metrics.previous_date}` : "No prior point"}
          </span>
        </div>

        {/* Metric 3: Period Average */}
        <div className="p-3.5 rounded-xl bg-white border border-surface-border shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            {isMr ? "कालावधी सरासरी" : "Period Average"}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-text-main">
              {metrics?.average_modal_price != null
                ? `₹${metrics.average_modal_price.toLocaleString("en-IN")}`
                : "— —"}
            </span>
            <span className="text-[10px] text-text-muted font-semibold">₹/qtl</span>
          </div>
          <span className="text-[10px] text-text-muted block truncate">
            {metrics?.median_modal_price != null ? `Median: ₹${metrics.median_modal_price}` : "—"}
          </span>
        </div>

        {/* Metric 4: Observed Spread Range */}
        <div className="p-3.5 rounded-xl bg-white border border-surface-border shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            {isMr ? "नोंदवलेली दर कक्षा" : "Observed Price Range"}
          </span>
          <div className="text-xs font-bold text-text-main truncate">
            {metrics?.min_observed_price != null && metrics?.max_observed_price != null
              ? `₹${metrics.min_observed_price} – ₹${metrics.max_observed_price}`
              : "— —"}
          </div>
          <span className="text-[10px] text-text-muted block truncate">
            {metrics?.price_spread != null ? `Spread: ₹${metrics.price_spread}` : "—"}
          </span>
        </div>

        {/* Metric 5: Price Volatility Index */}
        <div className="p-3.5 rounded-xl bg-white border border-surface-border shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            {isMr ? "दर अस्थिरता निर्देशांक" : "Volatility Index (CV)"}
          </span>
          <div className="text-xl font-black text-text-main">
            {metrics?.volatility_cv_percent != null ? `${metrics.volatility_cv_percent}%` : "— —"}
          </div>
          <span className="text-[10px] text-text-muted block truncate">
            {metrics?.volatility_std_dev != null ? `σ = ±₹${metrics.volatility_std_dev}` : "Need ≥ 2 records"}
          </span>
        </div>

        {/* Metric 6: Trend Classification Badge */}
        <div className={`p-3.5 rounded-xl border shadow-2xs space-y-1 ${trendBadge.bg}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold block">
              {isMr ? "कल वर्गवारी" : "Trend Direction"}
            </span>
            {trendBadge.icon}
          </div>
          <div className="text-sm font-black truncate">{isMr ? trendBadge.labelMr : trendBadge.labelEn}</div>
          <span className="text-[10px] block truncate opacity-85">
            {metrics?.trend_direction !== "INSUFFICIENT_DATA" ? `Threshold: ±${metrics?.trend_threshold_percent}%` : "Data sparse"}
          </span>
        </div>
      </div>

      {/* Main Chart Canvas & Tooltip */}
      <div className="space-y-2">
        {/* Chart Header & Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-text-main">
              {analysisData?.commodity.name} @ {analysisData?.market.name}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-subtle text-text-muted border border-surface-border">
              {aggregation.toUpperCase()} SERIES
            </span>
          </div>

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 bg-soil-primary rounded-full inline-block"></span>
              <span>{isMr ? "प्रत्यक्ष सरासरी लिलाव दर (Modal)" : "Observed Modal Rate"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-soil-primary/20 border border-soil-primary/40 rounded inline-block"></span>
              <span>{isMr ? "किमान-कमाल दर पट्टा (Min-Max Band)" : "Min-Max Spread Band"}</span>
            </div>
            {analysisData?.comparison_market && (
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 border-t-2 border-dashed border-blue-600 inline-block"></span>
                <span>{analysisData.comparison_market.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* SVG Chart Rendering Container */}
        <div className="relative w-full rounded-2xl bg-surface-subtle/50 border border-surface-border p-3 sm:p-4 overflow-hidden">
          {hasSeries && chartLayout ? (
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartLayout.width} ${chartLayout.height}`}
                className="w-full h-auto min-w-[550px] max-h-[290px] select-none"
              >
                {/* Horizontal Grid Lines & Y-Axis Labels */}
                {chartLayout.yTicks.map((tick, i) => (
                  <g key={i}>
                    <line
                      x1={chartLayout.padLeft}
                      y1={tick.y}
                      x2={chartLayout.width - chartLayout.padRight}
                      y2={tick.y}
                      stroke="#e5e9e2"
                      strokeWidth="1"
                      strokeDasharray="4 3"
                    />
                    <text
                      x={chartLayout.padLeft - 8}
                      y={tick.y + 3.5}
                      fontSize="9.5"
                      fontWeight="bold"
                      fill="#7a8c76"
                      textAnchor="end"
                    >
                      ₹{tick.val}
                    </text>
                  </g>
                ))}

                {/* Shaded Min-Max Price Band Area */}
                {chartLayout.areaPath && (
                  <path
                    d={chartLayout.areaPath}
                    fill="#3d663d"
                    fillOpacity="0.12"
                    stroke="none"
                  />
                )}

                {/* Comparison APMC Dashed Line if present */}
                {chartLayout.compLinePath && (
                  <path
                    d={chartLayout.compLinePath}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                )}

                {/* Primary Modal Rate Solid Line */}
                <path
                  d={chartLayout.linePath}
                  fill="none"
                  stroke="#2f5233"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Primary Observation Points */}
                {chartLayout.points.map((pt, idx) => {
                  const isHovered = hoveredPoint?.date === pt.date;
                  return (
                    <g
                      key={idx}
                      className="cursor-pointer transition-transform"
                      onMouseEnter={() => setHoveredPoint(pt)}
                      onMouseLeave={() => setHoveredPoint(null)}
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 6 : 4}
                        fill="#2f5233"
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2.5 : 1.5}
                      />
                    </g>
                  );
                })}

                {/* Comparison Observation Points */}
                {chartLayout.compPoints.map((cp, idx) => (
                  <circle
                    key={`comp-${idx}`}
                    cx={cp.x}
                    cy={cp.y}
                    r={3.5}
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                ))}

                {/* X-Axis Date Labels */}
                {chartLayout.points.map((pt, idx) => {
                  // Display label selectively if series is dense
                  const showLabel =
                    chartLayout.points.length <= 8 ||
                    idx === 0 ||
                    idx === chartLayout.points.length - 1 ||
                    idx % Math.ceil(chartLayout.points.length / 6) === 0;

                  if (!showLabel) return null;

                  // Format as DD MMM (e.g. 14 Oct)
                  const parts = pt.date.split("-");
                  const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : pt.date;

                  return (
                    <text
                      key={`lbl-${idx}`}
                      x={pt.x}
                      y={chartLayout.height - 12}
                      fontSize="9.5"
                      fontWeight="600"
                      fill="#6d7d6a"
                      textAnchor="middle"
                    >
                      {shortDate}
                    </text>
                  );
                })}
              </svg>
            </div>
          ) : (
            /* Empty State Chart Area */
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white border border-surface-border text-soil-primary flex items-center justify-center shadow-xs">
                <LineChart className="w-6 h-6 text-soil-secondary" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-sm font-bold text-text-main">
                  {isMr
                    ? "निवडलेल्या निकषांसाठी प्रत्यक्ष दर उपलब्ध नाहीत"
                    : "No Verified Historical Observations Found"}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  {isMr
                    ? "या कालावधीत निवडलेल्या बाजारपेठेत या पिकासाठी लिलाव नोंदी नाहीत. कृपया दुसरा बाजार किंवा व्यापक कालावधी निवडून पहा."
                    : "No auction records were reported for this commodity in the selected APMC during this time window. Try selecting another market or widening the date range."}
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-surface-border text-[11px] font-semibold text-text-muted">
                <Info className="w-3.5 h-3.5 text-soil-primary" />
                <span>{isMr ? "शून्य बनावट आकडेवारी धोरण" : "Strict Zero-Fabrication Integrity Policy"}</span>
              </div>
            </div>
          )}

          {/* Interactive Tooltip Card */}
          {hoveredPoint && (
            <div className="mt-2 p-3 bg-white border border-surface-border rounded-xl shadow-md text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-soil-primary" />
                <span className="font-bold text-text-main">
                  {isMr ? "तारीख:" : "Date:"} {hoveredPoint.date}
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-subtle text-soil-primary text-[10px] font-bold">
                  {hoveredPoint.observation_count} {hoveredPoint.observation_count === 1 ? "Record" : "Records"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-text-muted mr-1">{isMr ? "सरासरी:" : "Modal:"}</span>
                  <strong className="text-soil-primary text-sm">₹{hoveredPoint.modal_price}</strong>
                </div>
                <div>
                  <span className="text-text-muted mr-1">{isMr ? "कक्षा:" : "Range:"}</span>
                  <span className="font-semibold text-text-main">
                    ₹{hoveredPoint.min_price ?? "—"} – ₹{hoveredPoint.max_price ?? "—"}
                  </span>
                </div>
                {hoveredPoint.arrival_quantity != null && (
                  <div>
                    <span className="text-text-muted mr-1">{isMr ? "आवक:" : "Arrivals:"}</span>
                    <span className="font-semibold text-text-main">
                      {hoveredPoint.arrival_quantity} {hoveredPoint.arrival_unit || "TONNE"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Market Comparison Section (Rendered when comparison market selected) */}
      {analysisData?.comparison_market && (
        <div className="bg-surface-subtle/70 rounded-2xl border border-surface-border p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-soil-primary" />
              <h3 className="text-xs sm:text-sm font-bold text-text-main">
                {isMr
                  ? `बाजार भाव तुलना: ${analysisData.market.name} विरुद्ध ${analysisData.comparison_market.name}`
                  : `Market Comparison: ${analysisData.market.name} vs ${analysisData.comparison_market.name}`}
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
              {comparisonSeries.length} {comparisonSeries.length === 1 ? "Common Date" : "Common Dates"}
            </span>
          </div>

          {comparisonSeries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs bg-white rounded-xl border border-surface-border overflow-hidden">
                <thead className="bg-surface-subtle text-text-muted text-[10px] uppercase font-bold tracking-wider border-b border-surface-border">
                  <tr>
                    <th className="py-2 px-3">{isMr ? "तारीख" : "Date"}</th>
                    <th className="py-2 px-3 text-right">{analysisData.market.name} (₹)</th>
                    <th className="py-2 px-3 text-right">{analysisData.comparison_market.name} (₹)</th>
                    <th className="py-2 px-3 text-right">{isMr ? "किंमत फरक" : "Difference (₹)"}</th>
                    <th className="py-2 px-3 text-right">{isMr ? "टक्केवारी" : "Diff %"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/60">
                  {comparisonSeries.map((row, i) => (
                    <tr key={i} className="hover:bg-surface-subtle/30">
                      <td className="py-2 px-3 font-semibold text-text-main">{row.date}</td>
                      <td className="py-2 px-3 text-right font-bold text-soil-primary">₹{row.primary_modal_price}</td>
                      <td className="py-2 px-3 text-right font-bold text-blue-700">₹{row.comparison_modal_price}</td>
                      <td
                        className={`py-2 px-3 text-right font-black ${
                          row.price_difference > 0 ? "text-emerald-700" : row.price_difference < 0 ? "text-rose-700" : "text-text-main"
                        }`}
                      >
                        {row.price_difference > 0 ? `+₹${row.price_difference}` : `₹${row.price_difference}`}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-text-muted">
                        {row.percentage_difference != null
                          ? `${row.percentage_difference > 0 ? "+" : ""}${row.percentage_difference}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">
              {isMr
                ? "या कालावधीत दोन्ही बाजार समित्यांमध्ये एकाच दिवशी लिलाव झालेल्या समान तारखा आढळल्या नाहीत."
                : "No overlapping trading dates recorded for both APMCs in the selected period."}
            </p>
          )}

          {/* Mandatory Net-Return Transport Disclaimer */}
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <p>
              <strong>{isMr ? "महत्त्वाची वाहतूक व नफा स्पष्टोक्ती:" : "Transportation & Net Profit Note:"}</strong>{" "}
              {isMr
                ? "केवळ अधिक दिसणारा बाजार भाव जास्त नफ्याची हमी देत नाही. वाहतूक खर्च, मालाची प्रतवारी (FAQ), स्थानिक बाजार समिती उपकर आणि तोलाई खर्च यानुसार शेतकऱ्याच्या हातात पडणारा प्रत्यक्ष परतावा बदलू शकतो."
                : "Observed prices alone do not establish which market is most profitable for an individual farmer. Transport haulage costs, produce quality grades, local APMC mandi fees, and weighment charges vary across market yards."}
            </p>
          </div>
        </div>
      )}

      {/* Data Quality & Source Provenance Footprint */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-surface-border">
        {/* Left: Source Provenance */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {isMr ? "माहिती स्त्रोत व पडताळणी" : "Source Provenance & Audit"}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {analysisData?.source_info.operational_status || "VERIFIED"}
            </span>
          </div>
          <p className="font-bold text-text-main">{analysisData?.source_info.name}</p>
          <p className="text-[11px] text-text-muted leading-tight">
            {isMr
              ? "कृषी मंत्रालय, भारत सरकार अधिकृत AGMARKNET दैनिक लिलाव बुलेटिन"
              : "Ministry of Agriculture & Farmers Welfare official daily APMC auction bulletins"}
          </p>
          <div className="text-[10px] text-text-muted pt-1">
            {analysisData?.source_info.last_retrieval_timestamp && (
              <span>
                {isMr ? "सिस्टम संकलन वेळ:" : "Retrieved:"}{" "}
                {new Date(analysisData.source_info.last_retrieval_timestamp).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            )}
          </div>
        </div>

        {/* Right: Data Quality Warnings & Observation Span */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              {isMr ? "डेटा गुणवत्ता व नोंदी मर्यादा" : "Data Quality & Sample Size"}
            </span>
            <span className="font-bold text-text-main">
              {quality?.total_observations ?? 0} {quality?.total_observations === 1 ? "Observation" : "Observations"}
            </span>
          </div>

          <p className="text-[11px] text-text-muted">
            {quality?.earliest_date && quality?.latest_date
              ? `Coverage: ${quality.earliest_date} to ${quality.latest_date} (${quality.calendar_days} calendar days)`
              : "No observation period recorded"}
          </p>

          {quality?.quality_warnings && quality.quality_warnings.length > 0 ? (
            <div className="space-y-1 pt-1">
              {quality.quality_warnings.map((warn, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10.5px] text-amber-800 font-medium">
                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-800 font-medium pt-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{isMr ? "नोंदी सुसंगत व समाधानकारक आहेत." : "Sufficient contiguous observations recorded."}</span>
            </div>
          )}
        </div>
      </div>

      {/* Non-Forecast Analytical Integrity Policy */}
      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 text-xs flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong className="text-stone-900 font-semibold">
            {isMr ? "ऐतिहासिक विश्लेषण धोरण:" : "Descriptive Historical Analysis Policy:"}
          </strong>{" "}
          {analysisData?.disclaimer ||
            "All presented rates reflect verified past auction transactions recorded by APMC market committees. This analysis does not constitute future price forecasts or planting advice."}
        </p>
      </div>
    </div>
  );
};
