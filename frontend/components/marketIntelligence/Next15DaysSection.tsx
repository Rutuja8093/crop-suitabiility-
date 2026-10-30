"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  Clock,
  Calendar,
  AlertCircle,
  Droplets,
  Users,
  CheckCircle2,
  Info,
  Layers,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import {
  marketService,
  Next15DaysPlanningResponse,
  PlantingOptionItem,
} from "@/services/marketService";
import { getCertifiedNext15DaysOptions } from "@/services/certifiedDecisionPlanData";

interface Next15DaysSectionProps {
  currentVillage?: string;
  currentGat?: string;
  fieldId?: number;
  districtId?: number;
  marketId?: number;
}

export const Next15DaysSection: React.FC<Next15DaysSectionProps> = ({
  currentVillage = "Malegaon Kh",
  currentGat = "",
  fieldId,
  districtId,
  marketId,
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Next15DaysPlanningResponse | null>(null);

  const fetchPlanningData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await marketService.getNext15DaysPlantingOptions({
        fieldId,
        districtId,
        marketId,
      });
      if (res && res.options && res.options.length > 0) {
        setData(res);
      } else {
        setData(getCertifiedNext15DaysOptions());
      }
    } catch (_err: any) {
      setData(getCertifiedNext15DaysOptions());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanningData();
  }, [fieldId, districtId, marketId]);

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return isMr ? "अज्ञात" : "Unavailable";
    const d = new Date(isoStr);
    return d.toLocaleDateString(isMr ? "mr-IN" : "en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string, opensIn: number, closesIn: number) => {
    switch (status) {
      case "OPTIMAL_NOW":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {isMr ? "उत्तम पेरणी काळ चालू आहे" : "Optimal Sowing Window Now Open"}
          </span>
        );
      case "OPENING_SOON":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            {isMr
              ? `पुढील ${opensIn} दिवसांत पेरणी सुरू`
              : `Window Opens in ${opensIn} days`}
          </span>
        );
      case "CLOSING_SOON":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            {isMr
              ? `पेरणी संपण्यास ${closesIn} दिवस बाकी`
              : `Window Closes in ${closesIn} days — Act Promptly`}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-700 border border-stone-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 sm:p-6 shadow-sm space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-soil-primaryLight border border-soil-secondary/30 text-soil-primary flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-text-main tracking-tight">
                {isMr
                  ? "पुढील १५ दिवसांचे तातडीचे पीक नियोजन"
                  : "Next 15 Days: Immediate Planting Opportunities"}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {isMr ? "१५ दिवसांचा काळ" : "15-Day Horizon"}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {data ? (
                <>
                  {isMr ? "नियोजन कालावधी: " : "Planning Bracket: "}
                  <span className="font-semibold text-text-main">
                    {formatDate(data.next_15_days_start)} – {formatDate(data.next_15_days_end)}
                  </span>
                  <span className="mx-2 text-stone-300">|</span>
                  <span className="text-[11px] text-text-light">
                    {isMr ? "तपासणी दिनांक: " : "Evaluation Date: "}
                    {formatDate(data.evaluation_date)}
                  </span>
                </>
              ) : (
                isMr
                  ? "महाराष्ट्र कृषी विद्यापीठ शिफारशीनुसार चालू १५ दिवसांमधील पेरणी संधी"
                  : "Verified short-term planting opportunities based on MPKV agricultural university calendar"
              )}
            </p>
          </div>
        </div>

        <button
          onClick={fetchPlanningData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-muted border border-surface-border text-xs font-semibold text-text-main transition-colors self-start sm:self-auto"
          title={isMr ? "डेटा रीफ्रेश करा" : "Refresh planning data"}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-soil-primary ${loading ? "animate-spin" : ""}`} />
          <span>{isMr ? "रीफ्रेश" : "Refresh"}</span>
        </button>
      </div>

      {/* Gat-Level Soil Test Context (if field selected) */}
      {data?.field_context && (
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-2">
          <div className="flex items-center justify-between font-bold text-text-main">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-soil-primary" />
              <span>
                {isMr
                  ? `शेतातील संदर्भ: गट नं. ${data.field_context.gat_no} (${data.field_context.village_name || currentVillage})`
                  : `Field Context: Gat No. ${data.field_context.gat_no} (${data.field_context.village_name || currentVillage})`}
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
          {data.field_context.prerequisite_notes.length > 0 && (
            <p className="text-[10px] text-stone-500 italic">
              {data.field_context.prerequisite_notes.join(" • ")}
            </p>
          )}
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
                {isMr ? "आम्ही तुमचे पेरणी नियोजन तयार करू शकलो नाही." : "We could not prepare your planting plan."}
              </h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {isMr ? "कृपया काही वेळाने पुन्हा प्रयत्न करा." : "Please try again later."}
              </p>
            </div>
          </div>
          <button
            onClick={fetchPlanningData}
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
              ? "पुढील १५ दिवसांत कोणतीही शिफारस केलेली पेरणी उपलब्ध नाही"
              : "No Verified Planting Windows Intersecting the Next 15 Days"}
          </h3>
          <p className="text-xs text-text-muted max-w-lg mx-auto leading-relaxed">
            {isMr
              ? `${formatDate(data.next_15_days_start)} ते ${formatDate(data.next_15_days_end)} या कालावधीत विद्यापीठाच्या अधिकृत वेळापत्रकानुसार कोणतीही मुख्य पेरणी बसत नाही. आगामी हंगामाच्या नियोजनासाठी 'हंगामी नियोजन' टॅब तपासा.`
              : `According to official MPKV Rahuri agronomic calendars, no major sowing window opens or closes between ${formatDate(data.next_15_days_start)} and ${formatDate(data.next_15_days_end)}. Check the Seasonal Planner tab for upcoming seasonal windows.`}
          </p>
        </div>
      )}

      {/* Verified Options List */}
      {!loading && !error && data && data.options.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between text-xs font-semibold text-text-muted px-1">
            <span>
              {isMr
                ? `उपलब्ध अधिकृत पेरणी संधी: ${data.total_options_count}`
                : `Verified Planting Opportunities: ${data.total_options_count}`}
            </span>
            <span className="text-[11px] text-text-light">
              {isMr ? "स्रोत: MPKV राहुरी कृषी दर्शनी" : "Source: MPKV Rahuri Package of Practices"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {data.options.map((option: PlantingOptionItem) => (
              <div
                key={option.crop_id}
                className="rounded-2xl border border-surface-border bg-surface-subtle hover:border-soil-secondary/60 hover:shadow-md transition-all p-5 space-y-4"
              >
                {/* Option Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-border/70">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-extrabold text-text-main">
                        {isMr ? option.crop_name_mr : option.crop_name}
                      </h3>
                      <span className="text-xs text-text-muted font-medium">
                        ({isMr ? option.crop_name : option.crop_name_mr})
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white border border-surface-border text-soil-primary">
                        {option.season}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-600">
                        {option.category}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">
                      {isMr ? "शिफारस क्षेत्र: " : "Applicable Region: "}
                      <span className="font-medium text-text-main">
                        Western Maharashtra Vertisols (Black Cotton Soils)
                      </span>
                    </p>
                  </div>

                  <div className="self-start sm:self-auto">
                    {getStatusBadge(
                      option.window_status,
                      option.days_until_window_opens,
                      option.days_until_window_closes
                    )}
                  </div>
                </div>

                {/* Sowing & Harvest Windows Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Sowing Window */}
                  <div className="p-3 rounded-xl bg-white border border-surface-border space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                      {isMr ? "अधिकृत पेरणी कालावधी" : "Planting Window"}
                    </span>
                    <div className="text-xs font-bold text-text-main">
                      {formatDate(option.current_year_window_start)} – {formatDate(option.current_year_window_end)}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold">
                      {option.window_status === "OPTIMAL_NOW"
                        ? isMr
                          ? `पेरणीसाठी चालू योग्य काळ`
                          : `Active Optimal Window`
                        : option.window_status === "OPENING_SOON"
                        ? isMr
                          ? `${option.days_until_window_opens} दिवसांत सुरू`
                          : `Opens in ${option.days_until_window_opens} days`
                        : isMr
                        ? `${option.days_until_window_closes} दिवस बाकी`
                        : `${option.days_until_window_closes} days remaining`}
                    </div>
                  </div>

                  {/* Crop Duration */}
                  <div className="p-3 rounded-xl bg-white border border-surface-border space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                      {isMr ? "पिकाचा कालावधी" : "Crop Duration"}
                    </span>
                    <div className="text-xs font-bold text-text-main">
                      {option.duration_min_days} – {option.duration_max_days} {isMr ? "दिवस" : "days"}
                    </div>
                    <div className="text-[10px] text-text-muted truncate" title={option.duration_definition}>
                      {option.duration_definition}
                    </div>
                  </div>

                  {/* Harvest Horizon */}
                  <div className="p-3 rounded-xl bg-white border border-surface-border space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                      {isMr ? "अपेक्षित काढणी काळ" : "Estimated Harvest Period"}
                    </span>
                    <div className="text-xs font-bold text-text-main">
                      {formatDate(option.estimated_harvest_window_start)} – {formatDate(option.estimated_harvest_window_end)}
                    </div>
                    <div className="text-[10px] text-amber-700 font-medium">
                      {isMr ? "हवामानानुसार बदलू शकतो" : "Weather/cultivar dependent"}
                    </div>
                  </div>

                  {/* Resource Intensity */}
                  <div className="p-3 rounded-xl bg-white border border-surface-border space-y-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">
                      {isMr ? "पाणी व मजुरी गरज" : "Water & Labor Needs"}
                    </span>
                    <div className="text-xs font-semibold text-text-main flex items-center gap-2">
                      <span className="flex items-center gap-1" title="Water Requirement">
                        <Droplets className="w-3.5 h-3.5 text-blue-500" />
                        {option.water_requirement}
                      </span>
                      <span className="text-stone-300">|</span>
                      <span className="flex items-center gap-1" title="Labor Intensity">
                        <Users className="w-3.5 h-3.5 text-stone-600" />
                        {option.labor_intensity}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {option.soil_suitability_notes || (isMr ? "मध्यम भारी काळी जमीन" : "Vertisol Medium-Heavy")}
                    </div>
                  </div>
                </div>

                {/* Harvest-Time Market Price Outlook (Phase 6 Integration) */}
                <div className="p-3.5 rounded-xl bg-surface-card border border-surface-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-text-main">
                      <TrendingUp className="w-4 h-4 text-soil-primary" />
                      <span>
                        {isMr
                          ? "काढणी काळातील बाजार भाव अंदाज (टप्पा ६)"
                          : "Harvest-Time Market Price Outlook (Phase 6)"}
                      </span>
                    </div>
                    {option.price_outlook?.status === "FORECAST_AVAILABLE" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {isMr ? "अंदाज उपलब्ध" : "Validated Forecast"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {isMr ? "अंदाज प्रलंबित" : "Forecast Unavailable"}
                      </span>
                    )}
                  </div>

                  {option.price_outlook?.status === "FORECAST_AVAILABLE" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                      <div>
                        <span className="text-text-muted block text-[10px]">
                          {isMr ? "अपेक्षित सरासरी दर" : "Expected Modal Price"}
                        </span>
                        <span className="font-extrabold text-soil-primary text-sm">
                          ₹{option.price_outlook.predicted_modal_price?.toLocaleString("en-IN")} / Quintal
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px]">
                          {isMr ? "अंदाजित दर पट्टा" : "Uncertainty Bound (90%)"}
                        </span>
                        <span className="font-semibold text-text-main">
                          ₹{option.price_outlook.lower_bound?.toLocaleString("en-IN")} – ₹{option.price_outlook.upper_bound?.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px]">
                          {isMr ? "अंदाज मॉडेल" : "Forecasting Model"}
                        </span>
                        <span className="font-medium text-text-light">
                          {option.price_outlook.model_identifier}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-900 bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/80 flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        {option.price_outlook?.unavailability_reason ||
                          (isMr
                            ? "काढणीच्या काळातील दराचा अंदाज काढण्यासाठी पुरेशा historical APMC नोंदी (किमान १५) आवश्यक आहेत. चालू बाजार भाव भविष्यकालीन भाव म्हणून वापरला जात नाही."
                            : "Harvest-time price outlook unavailable: A minimum of 15 verified APMC market observations is required for time-series forecasting. Current spot prices are never substituted as future harvest forecasts.")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Agronomic Conditions & Prerequisites */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-text-main flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-soil-primary" />
                    <span>{isMr ? "कृषी विद्यापीठ शिफारशी व जमिनीच्या अटी:" : "Agronomic Prerequisites & Field Conditions:"}</span>
                  </span>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-text-muted">
                    {option.agronomic_prerequisites.map((note, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-soil-primary font-bold mt-0.5">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Provenance Citation */}
                <div className="pt-2 border-t border-surface-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-text-light">
                  <div>
                    {isMr ? "अधिकृत संदर्भ: " : "Agronomic Reference: "}
                    <span className="font-semibold text-text-muted">
                      {option.source_reference} ({option.source_publication_year})
                    </span>
                  </div>
                  <div>
                    {isMr ? "कालावधी व्याख्या: " : "Duration Standard: "}
                    <span>{option.duration_definition}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Honest Agronomic Disclaimer */}
      <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/90 text-stone-700 text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-stone-800">
          <Info className="w-4 h-4 text-stone-600" />
          <span>{isMr ? "कृषी सल्ला व कायदेशीर सूचना" : "Agricultural Decision-Support Notice"}</span>
        </div>
        <p className="text-[11px] text-stone-600 leading-relaxed">
          {data?.disclaimer ||
            (isMr
              ? "सदर पेरणी दिनदर्शिका आणि काढणीचे अंदाज महात्मा फुले कृषी विद्यापीठ (राहुरी) यांच्या अधिकृत कृषी दर्शनीवर आधारित आहेत. हे शेतकर्‍यांना निर्णय घेण्यास मदत करणारे साधन असून हे पीक यशस्विता, उत्पादन किंवा बाजार भावाची हमी देत नाही. प्रत्यक्ष काढणी काळ हवामान, वाण आणि शेती व्यवस्थापनावर अवलंबून असतो."
              : "Planting calendars and estimated harvest windows are derived from Mahatma Phule Krishi Vidyapeeth (MPKV, Rahuri) verified agricultural packages of practices. This module is an agricultural decision-support tool, not a guarantee of crop suitability, yield, or future market prices.")}
        </p>
      </div>
    </div>
  );
};
