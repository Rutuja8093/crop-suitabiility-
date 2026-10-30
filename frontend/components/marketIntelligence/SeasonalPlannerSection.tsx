"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  CalendarDays,
  Sun,
  CloudRain,
  Snowflake,
  Droplets,
  Users,
  ShieldAlert,
  Info,
  Layers,
  TrendingUp,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { SeasonType } from "@/types/marketIntelligence";
import {
  marketService,
  SeasonalPlanningResponse,
  PlantingOptionItem,
} from "@/services/marketService";
import { getCertifiedSeasonalOptions } from "@/services/certifiedDecisionPlanData";

interface SeasonalPlannerSectionProps {
  activeSeason: SeasonType;
  onSeasonSelect: (season: SeasonType) => void;
  gatNo?: string;
  fieldAcreage?: number | null;
  fieldId?: number;
  districtId?: number;
  marketId?: number;
}

export const SeasonalPlannerSection: React.FC<SeasonalPlannerSectionProps> = ({
  activeSeason,
  onSeasonSelect,
  gatNo = "",
  fieldAcreage,
  fieldId,
  districtId,
  marketId,
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SeasonalPlanningResponse | null>(null);

  const seasonsList: {
    key: SeasonType;
    apiKey: string;
    labelEn: string;
    labelMr: string;
    periodEn: string;
    periodMr: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      key: "rabi",
      apiKey: "RABI",
      labelEn: "Rabi Season (Winter)",
      labelMr: "रब्बी हंगाम (हिवाळी)",
      periodEn: "October – February",
      periodMr: "ऑक्टोबर – फेब्रुवारी",
      icon: Snowflake,
    },
    {
      key: "kharif",
      apiKey: "KHARIF",
      labelEn: "Kharif Season (Monsoon)",
      labelMr: "खरीप हंगाम (पावसाळी)",
      periodEn: "June – October",
      periodMr: "जून – ऑक्टोबर",
      icon: CloudRain,
    },
    {
      key: "zaid",
      apiKey: "ZAID_SUMMER",
      labelEn: "Zaid / Summer Season",
      labelMr: "उन्हाळी हंगाम (झायद)",
      periodEn: "February – May",
      periodMr: "फेब्रुवारी – मे",
      icon: Sun,
    },
  ];

  const currentSeasonConfig =
    seasonsList.find((s) => s.key === activeSeason) || seasonsList[0];

  const fetchSeasonalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await marketService.getSeasonalPlantingOptions({
        season: currentSeasonConfig.apiKey,
        fieldId,
        districtId,
        marketId,
      });
      if (res && res.options && res.options.length > 0) {
        setData(res);
      } else {
        setData(getCertifiedSeasonalOptions(currentSeasonConfig.apiKey));
      }
    } catch (_err: any) {
      setData(getCertifiedSeasonalOptions(currentSeasonConfig.apiKey));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeasonalData();
  }, [activeSeason, fieldId, districtId, marketId]);

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return isMr ? "अज्ञात" : "Unavailable";
    const d = new Date(isoStr);
    return d.toLocaleDateString(isMr ? "mr-IN" : "en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 sm:p-6 shadow-sm space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-soil-primaryLight border border-soil-secondary/30 text-soil-primary flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text-main tracking-tight">
              {isMr ? "हंगामनिहाय धोरणात्मक पीक नियोजन" : "Seasonal Crop Planning Framework"}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {isMr
                ? "पावसाचे अंदाज, सिंचन उपलब्धता आणि बाजारातील मागणी यानुसार आगामी हंगामाचे नियोजन"
                : "Strategic multi-crop planning based on monsoon forecasting, water budgeting, and market seasonality"}
            </p>
          </div>
        </div>

        {/* Season Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-muted rounded-xl border border-surface-border self-start sm:self-auto">
          {seasonsList.map((s) => {
            const Icon = s.icon;
            const isSelected = activeSeason === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onSeasonSelect(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-soil-primary text-white shadow-xs"
                    : "text-text-muted hover:text-text-main hover:bg-white/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{isMr ? s.labelMr.split(" ")[0] : s.labelEn.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Season Characteristics Banner */}
      <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold text-soil-primary uppercase tracking-wider block">
            {isMr ? "निवडलेला हंगाम" : "Selected Planning Season"}
          </span>
          <h3 className="text-sm sm:text-base font-extrabold text-text-main">
            {isMr ? currentSeasonConfig.labelMr : currentSeasonConfig.labelEn}
          </h3>
          <p className="text-xs text-text-muted">
            {isMr
              ? `कालावधी: ${currentSeasonConfig.periodMr} | अधिकृत कृषी दिनदर्शिका`
              : `Typical Cycle: ${currentSeasonConfig.periodEn} | Verified Agronomic Calendar`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-surface-border text-text-muted">
            {isMr ? "कॅलेंडर संदर्भ: MPKV Rahuri" : "Calendar: MPKV Rahuri (2025-26)"}
          </span>
          <button
            onClick={fetchSeasonalData}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white border border-surface-border hover:bg-surface-muted text-text-muted transition-colors"
            title={isMr ? "रीफ्रेश" : "Refresh"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Field Soil Context (if field selected) */}
      {data?.field_context && (
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-text-main">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-soil-primary" />
              <span>
                {isMr
                  ? `शेतातील संदर्भ: गट नं. ${data.field_context.gat_no}`
                  : `Field Context: Gat No. ${data.field_context.gat_no}`}
              </span>
            </span>
            <span className="text-text-muted font-semibold">
              {data.field_context.area_acreage} {data.field_context.area_unit || "Acres"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-text-muted pt-1">
            <div>
              <span>pH (सामू): </span>
              <strong className="text-text-main">
                {data.field_context.soil_ph ?? (isMr ? "नोंद नाही" : "Unrecorded")}
              </strong>
            </div>
            <div>
              <span>{isMr ? "सेंद्रिय कर्ब: " : "Organic Carbon: "}</span>
              <strong className="text-text-main">
                {data.field_context.organic_carbon ? `${data.field_context.organic_carbon}%` : (isMr ? "नोंद नाही" : "Unrecorded")}
              </strong>
            </div>
            <div>
              <span>{isMr ? "माती पोत: " : "Soil Texture: "}</span>
              <strong className="text-text-main">
                {data.field_context.soil_texture || (isMr ? "मध्यम काळी" : "Vertisol Medium-Heavy")}
              </strong>
            </div>
            <div>
              <span>{isMr ? "प्रयोगशाळा अहवाल: " : "Lab Report: "}</span>
              <span className="text-stone-700 font-medium">
                {data.field_context.has_soil_test
                  ? isMr ? "चाचणी उपलब्ध" : "Lab Test On File"
                  : isMr ? "नोंद नाही (विद्यापीठ निकष)" : "Regional Norms"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border animate-pulse space-y-3">
            <div className="h-5 bg-stone-200 rounded w-1/3"></div>
            <div className="h-4 bg-stone-200 rounded w-2/3"></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="h-16 bg-stone-100 rounded"></div>
              <div className="h-16 bg-stone-100 rounded"></div>
              <div className="h-16 bg-stone-100 rounded"></div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                {isMr ? "आम्ही तुमचे हंगामी नियोजन तयार करू शकलो नाही." : "We could not prepare your seasonal planning."}
              </h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {isMr ? "कृपया काही वेळाने पुन्हा प्रयत्न करा." : "Please try again later."}
              </p>
            </div>
          </div>
          <button
            onClick={fetchSeasonalData}
            className="px-3.5 py-1.5 bg-[#2A7C13] text-white rounded-lg text-xs font-bold hover:bg-[#2A7C13]/90 transition-colors shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isMr ? "पुन्हा प्रयत्न करा" : "Try Again"}</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && data && data.options.length === 0 && (
        <div className="p-6 rounded-2xl bg-surface-subtle border border-surface-border text-center space-y-3">
          <Calendar className="w-10 h-10 text-stone-400 mx-auto" />
          <h3 className="text-sm font-bold text-text-main">
            {isMr
              ? "या हंगामासाठी कोणतीही अधिकृत पेरणी नोंद उपलब्ध नाही"
              : `No Verified Crop Calendars Available for ${currentSeasonConfig.labelEn}`}
          </h3>
          <p className="text-xs text-text-muted max-w-lg mx-auto leading-relaxed">
            {isMr
              ? "या हंगामासाठी विद्यापीठाच्या पॅकेज ऑफ प्रॅक्टिसनुसार अधिकृत दिनदर्शिका अद्याप जोडलेली नाही. इतर हंगामांचे पर्याय तपासा."
              : "No verified agronomic crop calendars have been approved for this season yet. Please switch to Kharif or Rabi for university-approved options."}
          </p>
        </div>
      )}

      {/* Seasonal Options List */}
      {!loading && !error && data && data.options.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted px-1">
            <span>
              {isMr
                ? `या हंगामातील अधिकृत पिके: ${data.total_crops_count}`
                : `Verified Seasonal Crop Options: ${data.total_crops_count}`}
            </span>
            <span className="text-[11px] text-text-light">
              {isMr ? "क्षेत्र: पश्चिम महाराष्ट्र काळी जमीन" : "Zone: Western Maharashtra Vertisols"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.options.map((option: PlantingOptionItem) => (
              <div
                key={option.crop_id}
                className="rounded-2xl border border-surface-border bg-surface-subtle hover:border-soil-secondary/60 hover:shadow-md transition-all p-4 space-y-3"
              >
                {/* Crop Header */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-surface-border/70">
                  <div>
                    <h4 className="text-base font-extrabold text-text-main">
                      {isMr ? option.crop_name_mr : option.crop_name}
                    </h4>
                    <span className="text-xs text-text-muted">
                      {isMr ? option.crop_name : option.crop_name_mr} • {option.category}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-surface-border text-soil-primary shrink-0">
                    {option.season}
                  </span>
                </div>

                {/* Sowing & Duration Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-surface-border space-y-0.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                      {isMr ? "पेरणी कालावधी" : "Planting Window"}
                    </span>
                    <span className="font-bold text-text-main block">
                      {formatDate(option.current_year_window_start)} – {formatDate(option.current_year_window_end)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-surface-border space-y-0.5">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                      {isMr ? "कालावधी व काढणी" : "Duration & Harvest"}
                    </span>
                    <span className="font-bold text-text-main block">
                      {option.duration_min_days}–{option.duration_max_days} {isMr ? "दिवस" : "days"}
                    </span>
                    <span className="text-[10px] text-amber-700 block">
                      {formatDate(option.estimated_harvest_window_start)} – {formatDate(option.estimated_harvest_window_end)}
                    </span>
                  </div>
                </div>

                {/* Duration Standard */}
                <div className="text-[10px] text-text-muted bg-white/60 p-2 rounded-lg border border-surface-border/60">
                  <span className="font-semibold">{isMr ? "व्याख्या: " : "Duration Standard: "}</span>
                  <span>{option.duration_definition}</span>
                </div>

                {/* Harvest-Time Market Outlook */}
                <div className="p-2.5 rounded-lg bg-surface-card border border-surface-border space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-text-main">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-soil-primary" />
                      <span>{isMr ? "काढणी बाजार भाव अंदाज" : "Harvest-Time Price Outlook"}</span>
                    </span>
                    {option.price_outlook?.status === "FORECAST_AVAILABLE" ? (
                      <span className="text-[10px] font-bold text-emerald-700">
                        ₹{option.price_outlook.predicted_modal_price?.toLocaleString("en-IN")}/Q
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-800">
                        {isMr ? "अंदाज प्रलंबित" : "Forecast Unavailable"}
                      </span>
                    )}
                  </div>

                  {option.price_outlook?.status === "FORECAST_AVAILABLE" ? (
                    <p className="text-[11px] text-text-muted">
                      {isMr ? "अपेक्षित दर पट्टा: " : "Expected Interval: "}
                      <strong>₹{option.price_outlook.lower_bound} – ₹{option.price_outlook.upper_bound}</strong> / Q ({option.price_outlook.model_identifier})
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-900/90 leading-snug">
                      {option.price_outlook?.unavailability_reason ||
                        (isMr
                          ? "काढणी काळातील दराचा अंदाज काढण्यासाठी पुरेशा APMC नोंदी (किमान १५) आवश्यक आहेत."
                          : "Harvest price outlook unavailable: Minimum 15 historical market records required.")}
                    </p>
                  )}
                </div>

                {/* Agronomic Conditions */}
                <div className="text-xs space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                    {isMr ? "जमिनीच्या अटी व शिफारसी" : "Agronomic Conditions & Notes"}
                  </span>
                  <ul className="space-y-1 text-[11px] text-text-muted">
                    {option.agronomic_prerequisites.slice(0, 3).map((note, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-soil-primary font-bold">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Source Citation */}
                <div className="text-[10px] text-text-light pt-2 border-t border-surface-border/60 flex items-center justify-between">
                  <span>{option.source_reference}</span>
                  <span>{option.source_publication_year}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Pillars of Seasonal Decision Matrix */}
      <div className="pt-2">
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
          {isMr ? "धोरणात्मक हंगामी नियोजन निकष" : "Seasonal Crop Planning Evaluation Pillars"}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Pillar 1: Water Budget */}
          <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span>{isMr ? "पाणी गरज व सिंचन" : "Water & Irrigation"}</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {isMr
                ? "पिकाच्या संपूर्ण कालावधीसाठी पाण्याची गरज (हेक्टर-सेंमी) आणि उपलब्ध सिंचन (विहीर/कॅनॉल/पाऊस) ताळमेळ."
                : "Crop water requirement (ha-cm) mapped against rainfed or canal/borewell irrigation availability."}
            </p>
          </div>

          {/* Pillar 2: Labor Intensity */}
          <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
              <Users className="w-4 h-4 text-stone-600" />
              <span>{isMr ? "मजुरी व यांत्रिकीकरण" : "Labor & Harvesting"}</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {isMr
                ? "खुरपणी, फवारणी व काढणीच्या वेळेस लागणारे मनुष्यबळ आणि हार्वेस्टरची उपलब्धता निकष."
                : "Peak weeding and harvesting labor requirements compared against local farm machinery availability."}
            </p>
          </div>

          {/* Pillar 3: Downside Risk Assessment */}
          <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>{isMr ? "दर चढ-उतार जोखीम" : "Price Volatility Risk"}</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {isMr
                ? "काढणीच्या काळात बाजारात दर कोसळण्याची संभाव्यता आणि किमान आधारभूत किंमत (MSP/FRP) संरक्षण."
                : "Downside price risk evaluated through historical standard deviation and minimum support price (MSP/FRP) safety."}
            </p>
          </div>

          {/* Pillar 4: Field Soil Suitability Match */}
          <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
              <Layers className="w-4 h-4 text-soil-primary" />
              <span>{isMr ? "जमिनीचा पोत व सामू" : "Gat Soil Compatibility"}</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {isMr
                ? "तुमच्या गट नंबरच्या मातीचा सामू (pH), सेंद्रिय कर्ब आणि चिकणमाती प्रमाणाशी पिकाची सुसंगतता."
                : "Crop physiological tolerance evaluated directly against your Gat's soil pH, organic carbon, and clay percentage."}
            </p>
          </div>
        </div>
      </div>

      {/* Honest Agronomic Disclaimer */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/90 text-stone-700 text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-stone-800">
          <Info className="w-4 h-4 text-stone-600" />
          <span>{isMr ? "कृषी सल्ला व कायदेशीर सूचना" : "Agricultural Decision-Support Notice"}</span>
        </div>
        <p className="text-[11px] text-stone-600 leading-relaxed">
          {data?.disclaimer ||
            (isMr
              ? "सदर पेरणी दिनदर्शिका आणि काढणीचे अंदाज महात्मा फुले कृषी विद्यापीठ (राहुरी) यांच्या अधिकृत कृषी दर्शनीवर आधारित आहेत. हे शेतकर्‍यांना निर्णय घेण्यास मदत करणारे साधन असून हे पीक यशस्विता, उत्पादन किंवा बाजार भावाची हमी देत नाही."
              : "Planting calendars and estimated harvest windows are derived from Mahatma Phule Krishi Vidyapeeth (MPKV, Rahuri) verified agricultural packages of practices. This module is an agricultural decision-support tool, not a guarantee of crop suitability, yield, or future market prices.")}
        </p>
      </div>
    </div>
  );
};
