"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { recommendationService } from "@/services/recommendationService";
import { soilHealthService } from "@/services/soilHealthService";
import { RecommendationsResponse, RecommendationItem } from "@/types/recommendation";
import { KML_AVAILABLE_GATS } from "@/types/gat";
import { RecommendationsHeader } from "./RecommendationsHeader";
import { SoilStatusOverview } from "./SoilStatusOverview";
import { RecommendationsSummaryCards } from "./RecommendationsSummaryCards";
import { RecommendationCard } from "./RecommendationCard";
import {
  AlertCircle,
  RefreshCw,
  FileText,
  Map as MapIcon,
  ShieldCheck,
  Filter,
  BookOpen,
} from "lucide-react";
import { SoilReferenceStandardsTable } from "@/components/soil/SoilReferenceStandardsTable";
import { getConciseParameterRecommendation, getRankedKeyRecommendations } from "@/lib/soilRecommendations";

interface RecommendationsViewProps {
  fieldIdOverride?: string | number;
}

/** Build a RecommendationsResponse-shaped object from a SoilHealthReport
 *  when the dedicated /recommendations endpoint is unavailable. */
function buildRecommendationsFromSoilReport(report: any): RecommendationsResponse {
  const parameters: any[] = report.parameters || [];
  const field = report.field || {};
  const farmer = report.farmer || {};

  // Build soil_overview for key nutrients
  const keyKeys = ["ph", "organic_carbon", "available_nitrogen", "available_phosphorus", "available_potassium"];
  const keyNames: Record<string, { name: string; name_mr: string; unit: string }> = {
    ph: { name: "Soil pH", name_mr: "मातीचा सामू (pH)", unit: "" },
    organic_carbon: { name: "Organic Carbon", name_mr: "सेंद्रिय कर्ब", unit: "%" },
    available_nitrogen: { name: "Nitrogen", name_mr: "उपलब्ध नत्र (N)", unit: "kg/ha" },
    available_phosphorus: { name: "Phosphorus", name_mr: "उपलब्ध स्फुरद (P)", unit: "kg/ha" },
    available_potassium: { name: "Potassium", name_mr: "उपलब्ध पालाश (K)", unit: "kg/ha" },
  };
  const paramDict: Record<string, any> = {};
  for (const p of parameters) {
    paramDict[p.key || p.parameter_key] = p;
  }
  const soil_overview = keyKeys.map((k) => {
    const p = paramDict[k];
    const meta = keyNames[k];
    return p
      ? {
          key: k,
          name: meta.name,
          name_mr: meta.name_mr,
          value: p.value,
          unit: p.unit || meta.unit,
          status: p.interpretation || "Recorded",
          status_mr: p.interpretation_mr || "नोंदणीकृत",
          is_available: true,
        }
      : {
          key: k,
          name: meta.name,
          name_mr: meta.name_mr,
          value: null,
          unit: meta.unit,
          status: "Not Available",
          status_mr: "उपलब्ध नाही",
          is_available: false,
        };
  });

  // Build RecommendationItem list from parameters
  const recommendations: RecommendationItem[] = parameters.map((p) => {
    const key = p.key || p.parameter_key || "";
    const rec = getConciseParameterRecommendation(
      key,
      p.value,
      p.interpretation || p.interpretation_en || "",
      p.interpretation_mr || "",
    );
    const backendRec = p.recommendation || "";
    const backendRecMr = p.recommendation_mr || "";
    return {
      parameter_key: key,
      parameter_name: p.name || p.parameter_name || key,
      parameter_name_mr: p.name_mr || p.parameter_name_mr || key,
      category: p.category || "General",
      value: p.value ?? 0,
      unit: p.unit || "",
      status: p.interpretation || p.status_category || rec.status_category,
      status_mr: p.interpretation_mr || rec.status_category,
      source: p.source || "DSM PREDICTION",
      priority: rec.priority_key === "high" ? "HIGH PRIORITY" : rec.priority_key === "moderate" ? "MODERATE" : "INFORMATION",
      priority_key: rec.priority_key,
      needs_attention: rec.priority_key === "high" || rec.priority_key === "moderate",
      what_observed:
        `${p.name || key}: ${p.value !== null && p.value !== undefined ? p.value : "N/A"} ${p.unit || ""}`.trim(),
      what_observed_mr:
        `${p.name_mr || key}: ${p.value !== null && p.value !== undefined ? p.value : "N/A"} ${p.unit || ""}`.trim(),
      what_it_means: p.interpretation || rec.status_category,
      what_it_means_mr: p.interpretation_mr || rec.status_category,
      action_guidance: backendRec || rec.recommendation,
      action_guidance_mr: backendRecMr || rec.recommendation_mr,
      why_it_matters: `${p.name || key} is a key soil health indicator that affects crop productivity and soil fertility.`,
      why_it_matters_mr: `${p.name_mr || key} हा माती आरोग्याचा महत्त्वाचा निर्देशक आहे.`,
    };
  });

  // Sort by priority
  recommendations.sort((a, b) => {
    const rank = { "HIGH PRIORITY": 1, MODERATE: 2, INFORMATION: 3 };
    return (rank[a.priority] || 3) - (rank[b.priority] || 3);
  });

  const highCount = recommendations.filter((r) => r.priority_key === "high").length;
  const modCount = recommendations.filter((r) => r.priority_key === "moderate").length;
  const infoCount = recommendations.filter((r) => r.priority_key === "info").length;
  const attentionCount = recommendations.filter((r) => r.needs_attention).length;

  return {
    field,
    farmer,
    has_data: parameters.length > 0,
    is_demo: report.is_demo ?? true,
    summary: {
      parameters_reviewed: recommendations.length,
      parameters_needing_attention: attentionCount,
      high_priority_count: highCount,
      moderate_count: modCount,
      info_count: infoCount,
    },
    soil_overview,
    recommendations,
    message_en:
      "Soil-test-based recommendations generated from field soil observations.",
    message_mr:
      "माती परीक्षण निरीक्षणांवर आधारित शेत-विशिष्ट शिफारसी तयार केल्या आहेत.",
  };
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({ fieldIdOverride }) => {
  const { t, locale } = useI18n();
  const { field, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const urlGat = searchParams?.get("gat");

  const [selectedGat, setSelectedGat] = useState<string>(() => {
    const validGats: string[] = [...KML_AVAILABLE_GATS];
    if (urlGat && validGats.includes(urlGat.replace(/[^\d]/g, ""))) return urlGat.replace(/[^\d]/g, "");
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("soilpilot_selected_gat");
      if (stored && validGats.includes(stored.replace(/[^\d]/g, ""))) return stored.replace(/[^\d]/g, "");
    }
    const fieldGat = field?.gat_no?.replace(/[^\d]/g, "");
    if (fieldGat && validGats.includes(fieldGat)) return fieldGat;
    return "15";
  });

  useEffect(() => {
    if (urlGat) {
      setSelectedGat(urlGat);
      if (typeof window !== "undefined") {
        localStorage.setItem("soilpilot_selected_gat", urlGat);
      }
    } else if (field?.gat_no) {
      setSelectedGat(field.gat_no);
      if (typeof window !== "undefined") {
        localStorage.setItem("soilpilot_selected_gat", field.gat_no);
      }
    }
  }, [urlGat, field?.gat_no]);

  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "high" | "attention" | "info" | "standards">("all");

  const activeFieldId =
    fieldIdOverride ||
    (selectedGat ? `demo-field-gat-${selectedGat}` : field?.id || (field?.gat_no ? `demo-field-gat-${field.gat_no}` : "demo-field-gat-15"));

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await recommendationService.getFieldRecommendations(activeFieldId);
      setData(res);
    } catch (primaryErr: any) {
      // Primary recommendations endpoint failed — fall back to soil health report
      // and compute recommendations client-side using the shared engine.
      console.warn("Recommendations API unavailable; falling back to soil health report:", primaryErr?.message);
      try {
        const soilReport = await soilHealthService.getFieldReport(activeFieldId);
        const fallbackData = buildRecommendationsFromSoilReport(soilReport);
        setData(fallbackData);
        setError(null);
      } catch (fallbackErr: any) {
        console.error("Soil health report fallback also failed:", fallbackErr?.message);
        setError(
          "Unable to load recommendations. Please check your connection and try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchRecommendations();
    }
  }, [activeFieldId, authLoading]);

  // Loading Skeleton
  if (loading || authLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 py-6 animate-pulse">
        <div className="h-20 bg-stone-200 rounded-2xl w-full" />
        <div className="h-44 bg-stone-100 rounded-2xl w-full" />
        <div className="h-24 bg-stone-100 rounded-2xl w-full" />
        <div className="h-64 bg-stone-100 rounded-2xl w-full" />
      </div>
    );
  }

  // Error State — friendly, never shows raw API errors
  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-surface-border shadow-sm text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-text-main">
          {t("recommendations.errorTitle")}
        </h2>
        <p className="text-xs text-text-muted">
          {t("recommendations.errorDesc")}
        </p>
        <button
          type="button"
          onClick={fetchRecommendations}
          className="inline-flex items-center gap-2 px-4 py-2 bg-soil-primary text-white font-medium text-xs rounded-xl hover:bg-soil-primaryHover transition-colors shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t("recommendations.retry")}</span>
        </button>
      </div>
    );
  }

  // Empty State: No soil data available yet
  if (!data.has_data || data.recommendations.length === 0) {
    return (
      <div className="max-w-3xl mx-auto my-10 space-y-6">
        <RecommendationsHeader
          village={data.field.village}
          gatNo={data.field.gat_no}
          area={data.field.area}
          areaUnit={data.field.area_unit || "Ha"}
          isDemo={data.is_demo}
        />

        <div className="p-8 sm:p-12 bg-white rounded-2xl border border-surface-border shadow-sm text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-lg sm:text-xl font-bold text-text-main">
              {t("recommendations.noDataTitle")}
            </h2>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              {t("recommendations.noDataDesc")}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/soil-health-card"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-soil-primary text-white text-xs font-bold hover:bg-soil-primaryHover transition-all shadow-xs"
            >
              <FileText className="w-4 h-4" />
              <span>{t("recommendations.noDataAction")}</span>
            </Link>
            <Link
              href="/soil-map"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-subtle text-text-main border border-surface-border text-xs font-semibold hover:bg-surface-muted transition-all"
            >
              <MapIcon className="w-4 h-4 text-soil-primary" />
              <span>{t("recommendations.noDataSecondary")}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filter recommendations based on tab
  const filteredRecs = data.recommendations.filter((rec: RecommendationItem) => {
    if (activeTab === "high") return rec.priority_key === "high";
    if (activeTab === "attention") return rec.needs_attention;
    if (activeTab === "info") return rec.priority_key === "info";
    return true; // "all"
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-4 sm:py-6">

      {/* Clean Navigation & Parcel Identity Header */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/90 rounded-lg text-xs font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {data?.field?.village || "Malegaon Kh"} &bull; {t("geo.gatNo") || "Gat No."} {selectedGat}
              {data?.field?.area ? ` (${data.field.area} Ha)` : ""}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold">
            🌱 {locale === "mr" ? "माती नकाशानुसार खत शिफारसी" : "Soil Test-Based Recommendations"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/soil-map?gat=${selectedGat}`}
            className="text-xs font-bold text-soil-primary hover:text-soil-primaryHover flex items-center gap-1.5 transition-colors bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg border border-stone-200"
          >
            <MapIcon className="w-3.5 h-3.5 text-soil-primary" />
            <span>{locale === "mr" ? `माती नकाशा पहा` : `View Soil Map`}</span>
          </Link>
          <Link
            href={`/soil-health-card?gat=${selectedGat}`}
            className="text-xs font-bold text-white bg-soil-primary hover:bg-soil-primaryHover px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{locale === "mr" ? `सॉईल हेल्थ कार्ड` : `Soil Health Card`}</span>
          </Link>
        </div>
      </div>

      {/* 1. Header with Field Meta and Link to Soil Health Card */}
      <RecommendationsHeader
        village={data.field.village}
        gatNo={data.field.gat_no}
        area={data.field.area}
        areaUnit={data.field.area_unit || "Ha"}
        isDemo={data.is_demo}
      />

      {/* 2. Your Soil Status Overview */}
      {data.soil_overview && data.soil_overview.length > 0 && (
        <SoilStatusOverview items={data.soil_overview} />
      )}

      {/* 3. Summary Metric Cards */}
      <RecommendationsSummaryCards summary={data.summary} />

      {/* 4. Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "all"
              ? "bg-soil-primary text-white shadow-xs"
              : "bg-surface-subtle text-text-muted hover:text-text-main hover:bg-surface-muted border border-surface-border"
          }`}
        >
          {t("recommendations.filterAll")} ({data.summary.parameters_reviewed})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("high")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "high"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-surface-subtle text-rose-700 hover:bg-rose-50 border border-rose-200"
          }`}
        >
          {t("recommendations.filterHigh")} ({data.summary.high_priority_count})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("attention")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "attention"
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-surface-subtle text-amber-800 hover:bg-amber-50 border border-amber-200"
          }`}
        >
          {t("recommendations.filterAttention")} ({data.summary.parameters_needing_attention})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("info")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === "info"
              ? "bg-emerald-700 text-white shadow-xs"
              : "bg-surface-subtle text-text-muted hover:text-text-main hover:bg-surface-muted border border-surface-border"
          }`}
        >
          {t("recommendations.filterInfo")} ({data.summary.info_count})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("standards")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "standards"
              ? "bg-soil-primary text-white shadow-xs"
              : "bg-surface-subtle text-soil-primary hover:bg-soil-primaryLight/40 border border-soil-secondary/40"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>{locale === "mr" ? "शिफारस व संदर्भ मानके" : "Reference Standards & Norms"}</span>
        </button>
      </div>

      {/* 5. Recommendation Cards List or Standards Table */}
      {activeTab === "standards" ? (
        <SoilReferenceStandardsTable />
      ) : (
        <div className="space-y-4">
          {filteredRecs.map((rec: RecommendationItem) => (
            <RecommendationCard key={rec.parameter_key} item={rec} />
          ))}
        </div>
      )}

      {/* 6. Scientific Safety & Advisory Notice */}
      <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border flex items-start gap-3 text-xs text-text-muted leading-relaxed">
        <ShieldCheck className="w-5 h-5 text-soil-primary shrink-0 mt-0.5" />
        <p>{t("recommendations.disclaimer")}</p>
      </div>
    </div>
  );
};
