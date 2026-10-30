"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { useSelectedFarmer } from "@/context/FarmerContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { reportService } from "@/services/reportService";
import { marketService, FieldCropDecisionResponse, CropDecisionItem } from "@/services/marketService";
import { SoilHealthReport } from "@/types/soilHealth";
import {
  FileText,
  Download,
  Eye,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  QrCode,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
  Info,
  TrendingUp,
  Coins,
  Sprout,
  Check,
  AlertTriangle,
} from "lucide-react";
import {
  getCleanReferenceRange,
  getCleanReferenceRangeMr,
} from "@/lib/soilRecommendations";
import { translateGeoName, translateFarmerName, translateStatus } from "@/i18n/marathiHelper";
import { getLiveDateStr, getLiveSampleDateStr } from "@/lib/dateUtils";

type ButtonState = "idle" | "loading" | "success" | "error";

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const { field, farmer, location, loading: authLoading } = useAuth();
  const { selectedFarmer } = useSelectedFarmer();

  const [report, setReport] = useState<SoilHealthReport | null>(null);
  const [decisionPlan, setDecisionPlan] = useState<FieldCropDecisionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Online preview state for detailed report
  const [showDetailedPreview, setShowDetailedPreview] = useState<boolean>(true);

  // Download state tracker for Detailed Soil Report PDF
  const [detailedDownloadState, setDetailedDownloadState] = useState<ButtonState>("idle");

  const activeGat =
    field?.gat_no ||
    (typeof window !== "undefined" ? localStorage.getItem("soilpilot_selected_gat") : null) ||
    "22";
  const activeFieldId =
    field?.id ||
    `demo-field-gat-${activeGat}`;

  const activeFarmerName =
    selectedFarmer && String(selectedFarmer.gat_no) === String(activeGat)
      ? selectedFarmer.name
      : null;

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Concurrently fetch soil report metadata and multi-criteria crop decision plan
      const [reportRes, decisionRes] = await Promise.allSettled([
        reportService.getFieldReport(activeFieldId),
        marketService.getFieldCropDecisionPlan({ fieldIdentifier: String(activeFieldId) }),
      ]);

      if (reportRes.status === "fulfilled") {
        setReport(reportRes.value);
      } else {
        throw reportRes.reason;
      }

      if (decisionRes.status === "fulfilled") {
        setDecisionPlan(decisionRes.value);
      }
    } catch (err: any) {
      console.error("Failed to load reports page data:", err);
      setError(err?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadReportData();
    }
  }, [activeFieldId, authLoading]);

  // Handler: Download Detailed Soil Report PDF
  const handleDownloadDetailed = async () => {
    if (detailedDownloadState === "loading") return;
    try {
      setDetailedDownloadState("loading");
      await reportService.downloadDetailedReportPdf(
        activeFieldId,
        locale,
        activeFarmerName || undefined
      );
      setDetailedDownloadState("success");
      setTimeout(() => setDetailedDownloadState("idle"), 3500);
    } catch (err) {
      console.error("Failed to download Detailed Report PDF:", err);
      setDetailedDownloadState("error");
      setTimeout(() => setDetailedDownloadState("idle"), 4000);
    }
  };

  // Farmer & Field context from actual session / backend report
  const isMr = locale === "mr";
  const rawFarmerName =
    activeFarmerName ||
    report?.farmer?.name ||
    farmer?.name ||
    t("reports.farmerName") ||
    "Farmer";
  const farmerName = isMr ? translateFarmerName(rawFarmerName) : rawFarmerName;
  const gatNo = report?.field?.gat_no || field?.gat_no || activeGat;
  const rawVillageName =
    report?.field?.village || location?.village || "Malegaon Bk";
  const villageName = isMr ? translateGeoName(rawVillageName) : rawVillageName;
  const rawTalukaName = report?.field?.taluka || location?.taluka || "Baramati";
  const talukaName = isMr ? translateGeoName(rawTalukaName) : rawTalukaName;
  const rawDistrictName = report?.field?.district || location?.district || "Pune";
  const districtName = isMr ? translateGeoName(rawDistrictName) : rawDistrictName;
  const rawAreaNum =
    report?.field?.area != null
      ? report.field.area
      : field?.area != null
      ? field.area
      : 1.96;
  const isAcre =
    report?.field?.area_unit?.toLowerCase().includes("acre") ||
    field?.area_unit?.toLowerCase().includes("acre");
  const areaInAcres = isAcre ? rawAreaNum : Number((rawAreaNum * 2.47105).toFixed(2));
  const fieldArea = `${areaInAcres} ${isMr ? "एकर" : "acres"}`;
  const reportDate = getLiveDateStr(report?.report?.report_date);
  const sampleDate = report?.report?.sample_date
    ? getLiveDateStr(report.report.sample_date)
    : getLiveSampleDateStr(5);
  const reportNo = report?.report?.report_no || "SPL/2026/SL-0104";

  // Filter qualifying crops for Section C
  const qualifyingCrops: CropDecisionItem[] = decisionPlan?.crops
    ? decisionPlan.crops.filter((c) =>
        ["RECOMMENDED", "CONDITIONALLY_SUITABLE", "OFF_SEASON"].includes(c.decision_tier)
      )
    : [];
  const displayCrops: CropDecisionItem[] =
    qualifyingCrops.length > 0
      ? qualifyingCrops.slice(0, 3)
      : decisionPlan?.crops
      ? decisionPlan.crops.slice(0, 3)
      : [];
  const topCrop: CropDecisionItem | null = displayCrops.length > 0 ? displayCrops[0] : null;

  return (
    <ProtectedRoute>
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        {/* ============================================================== */}
        {/* 1. HEADER SECTION                                              */}
        {/* ============================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-surface-border shadow-card">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-soil-primaryLight border border-soil-primary/20 text-soil-primary flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-text-main tracking-tight">
                {isMr ? "माती व कृषी अहवाल" : "Soil & Agricultural Reports"}
              </h1>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                {isMr
                  ? "सविस्तर माती चाचणी, पीक शिफारसी व बाजार भाव विश्लेषणाचा एकीकृत अहवाल पहा व डाऊनलोड करा."
                  : "View and download your unified Detailed Soil Report integrating diagnostics, crop recommendations, and market analysis."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-soil-cream text-soil-primary border border-soil-secondary/40 shadow-xs">
              {isMr ? "अधिकृत मुख्य अहवाल" : "Primary Official Report"}
            </span>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white p-8 rounded-2xl border border-surface-border shadow-card animate-pulse space-y-4">
            <div className="h-6 bg-stone-200 rounded w-1/4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="h-16 bg-stone-100 rounded" />
              <div className="h-16 bg-stone-100 rounded" />
              <div className="h-16 bg-stone-100 rounded" />
              <div className="h-16 bg-stone-100 rounded" />
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-white p-8 rounded-2xl border border-surface-border shadow-card text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-text-main">
              {t("soilHealthCard.errorTitle") ||
                "We couldn't generate your report right now."}
            </p>
            <p className="text-xs text-text-muted">{error}</p>
            <button
              type="button"
              onClick={loadReportData}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-soil-primary text-white text-xs font-bold rounded-lg hover:bg-soil-primaryHover transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t("soilHealthCard.retry") || "Try Again"}</span>
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ============================================================== */}
            {/* 2. FARM & FARMER INFORMATION SECTION (Section A)               */}
            {/* ============================================================== */}
            <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-soil-primary" />
                  <h2 className="text-sm sm:text-base font-bold text-text-main">
                    {t("reports.farmerInfoTitle") || "Farm & Farmer Information"}
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-text-muted">
                  {isMr ? "प्रमाणित भूखंड ओळख व नमुना नोंदी" : "Verified Cadastral Parcel & Sample Record"}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-surface-subtle border border-surface-border">
                {/* Farmer Name */}
                <div className="space-y-0.5">
                  <span className="text-[11px] text-text-muted font-medium block">
                    {t("reports.farmerName") || "Farmer Name"}
                  </span>
                  <span className="text-sm font-bold text-text-main block">
                    {farmerName}
                  </span>
                </div>

                {/* Gat Number */}
                <div className="space-y-0.5">
                  <span className="text-[11px] text-text-muted font-medium block">
                    {t("reports.gatNo") || "Gat Number"}
                  </span>
                  <span className="text-sm font-bold text-soil-primary font-mono block">
                    {isMr ? `गट क्र. ${gatNo}` : `Gat No. ${gatNo}`}
                  </span>
                </div>

                {/* Village & Taluka */}
                <div className="space-y-0.5">
                  <span className="text-[11px] text-text-muted font-medium block">
                    {t("reports.village") || "Village"} &amp;{" "}
                    {t("reports.taluka") || "Taluka"}
                  </span>
                  <span className="text-sm font-semibold text-text-main block">
                    {villageName}, {talukaName}
                  </span>
                  <span className="text-[10px] text-text-muted block">
                    {districtName}, {isMr ? "महाराष्ट्र" : "Maharashtra"}
                  </span>
                </div>

                {/* Field Area */}
                <div className="space-y-0.5">
                  <span className="text-[11px] text-text-muted font-medium block">
                    {t("reports.fieldArea") || "Field Area"}
                  </span>
                  <span className="text-sm font-bold text-text-main block">
                    {fieldArea}
                  </span>
                </div>

                {/* Report Number */}
                <div className="space-y-0.5">
                  <span className="text-[11px] text-text-muted font-medium block">
                    {t("soilHealthCard.reportNo") || "Report Number"}
                  </span>
                  <span className="text-xs font-bold font-mono text-text-main block">
                    {reportNo}
                  </span>
                </div>

                {/* Report Date */}
                <div className="space-y-0.5">
                  <span className="text-[11px] text-text-muted font-medium block">
                    {t("reports.reportDate") || "Report Date"}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-semibold text-text-main">
                    <Calendar className="w-3.5 h-3.5 text-soil-primary" />
                    <span>{reportDate}</span>
                  </div>
                </div>

                {/* Latest Soil Data Date */}
                <div className="space-y-0.5">
                  <span className="text-[11px] text-text-muted font-medium block">
                    {t("reports.latestSoilDataDate") || "Latest Soil Data Date"}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-semibold text-text-main">
                    <Clock className="w-3.5 h-3.5 text-text-muted" />
                    <span>{sampleDate}</span>
                  </div>
                </div>

                {/* Tested Parameters Count */}
                <div className="space-y-0.5">
                  <span className="text-[11px] text-text-muted font-medium block">
                    {t("reports.testedParameters") || "Tested Parameters"}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {report?.parameters?.length || 14}{" "}
                    {t("reports.testedParameters") || "Parameters"}
                  </span>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* 3. PRIMARY DETAILED SOIL REPORT HERO CARD                      */}
            {/* ============================================================== */}
            <div className="bg-white rounded-2xl border-2 border-soil-primary/40 p-6 sm:p-8 shadow-card flex flex-col justify-between space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border pb-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-soil-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-black text-text-main tracking-tight">
                        {isMr
                          ? "सविस्तर माती चाचणी व निर्णय अहवाल"
                          : "DETAILED SOIL & CROP DECISION REPORT"}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-soil-primaryLight text-soil-primary border border-soil-primary/20">
                        {isMr ? "मुख्य सर्वसमावेशक अहवाल" : "Primary Dossier"}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-text-muted leading-relaxed mt-1">
                      {isMr
                        ? "माती निदान, पीक शिफारसी व बाजार भाव विश्लेषणाचा एकीकृत बहु-निकष अहवाल."
                        : "Complete agricultural intelligence report combining soil chemistry diagnostics, crop decision ranking, and market price analysis."}
                    </p>
                  </div>
                </div>

                {/* Main Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDetailedPreview(!showDetailedPreview)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-surface-subtle text-soil-primary border border-soil-secondary/50 text-xs font-bold rounded-xl hover:bg-soil-cream transition-all shadow-xs"
                  >
                    {showDetailedPreview ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        <span>{isMr ? "अहवाल बंद करा" : "Close Detailed Report"}</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>{isMr ? "सविस्तर अहवाल पहा" : "View Detailed Report"}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadDetailed}
                    disabled={detailedDownloadState === "loading"}
                    className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-xs ${
                      detailedDownloadState === "loading"
                        ? "bg-stone-200 text-stone-500 cursor-not-allowed"
                        : detailedDownloadState === "success"
                        ? "bg-emerald-600 text-white"
                        : detailedDownloadState === "error"
                        ? "bg-rose-600 text-white"
                        : "bg-soil-primary text-white hover:bg-soil-primaryHover"
                    }`}
                  >
                    {detailedDownloadState === "loading" ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t("reports.generatingPdf") || "Generating PDF..."}</span>
                      </>
                    ) : detailedDownloadState === "success" ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t("reports.pdfDownloaded") || "PDF downloaded"}</span>
                      </>
                    ) : detailedDownloadState === "error" ? (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        <span>{t("reports.downloadError") || "Download Failed"}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>
                          {isMr
                            ? "सविस्तर अहवाल PDF डाऊनलोड करा"
                            : "Download Detailed Report PDF"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 3 Pillars Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
                  <div className="flex items-center gap-2 text-soil-primary font-bold text-xs">
                    <FlaskConicalIcon className="w-4 h-4" />
                    <span>{isMr ? "१. माती रासायनिक निदान" : "1. Soil Diagnostics"}</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {isMr
                      ? "सामू (pH), क्षारता (EC), सेंद्रिय कर्ब (SOC), नत्र (N), स्फुरद (P), पालाश (K) व सूक्ष्मअन्नद्रव्ये (प्रयोगशाळा व DSM स्रोत पृथक्करण)."
                      : "Complete 14+ parameter panel with laboratory vs DSM source classification and scientific reference ranges."}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
                  <div className="flex items-center gap-2 text-soil-primary font-bold text-xs">
                    <Sprout className="w-4 h-4" />
                    <span>{isMr ? "२. बहु-निकष पीक शिफारसी" : "2. Crop Recommendations"}</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {isMr
                      ? "राहुरी कृषी विद्यापीठ (MPKV) निकषानुसार योग्य पिकांचे प्राधान्यक्रम, पेरणी काळ, काढणी कालावधी व मर्यादा."
                      : "Top-ranked suitable crop and evaluated alternatives based on university calendars, residual moisture, and soil constraints."}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
                  <div className="flex items-center gap-2 text-soil-primary font-bold text-xs">
                    <TrendingUp className="w-4 h-4" />
                    <span>{isMr ? "३. बाजार भाव व शेती अर्थशास्त्र" : "3. Market Price Analysis"}</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {isMr
                      ? "बारामती बाजार समिती प्रत्यक्ष भाव, काढणी हंगाम सांख्यिकी अंदाज, लागवड खर्च (A2+FL / C2) व अंदाजित निव्वळ नफा."
                      : "Verified AGMARKNET spot prices, statistical harvest period forecasts, CACP cultivation costs, and estimated returns."}
                  </p>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* 4. ONLINE DETAILED SOIL REPORT VIEW                            */}
            {/* ============================================================== */}
            {showDetailedPreview && report && (
              <div className="bg-white rounded-2xl border-2 border-soil-primary/30 p-6 sm:p-8 shadow-card space-y-8">
                {/* Laboratory Heading Banner */}
                <div className="bg-soil-primary text-white p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                  <div>
                    <span className="text-[11px] font-bold text-soil-cream uppercase tracking-wider block">
                      SOILPILOT — Digital Soil Mapping &amp; Soil Health Portal
                    </span>
                    <h3 className="text-lg font-black tracking-tight mt-0.5">
                      {isMr
                        ? "सविस्तर माती चाचणी व कृषी निर्णय अहवाल"
                        : "DETAILED SOIL TEST & AGRICULTURAL DECISION REPORT"}
                    </h3>
                    <p className="text-xs text-soil-cream/90 mt-0.5">
                      ADT AI Training Foundation · Agricultural Diagnostic &amp; Digital Soil Testing Center, Baramati
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold bg-white/10 px-3 py-1 rounded-lg border border-white/20">
                      {reportNo}
                    </span>
                  </div>
                </div>

                {/* Section A: Identification Sub-grid */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-soil-primary">
                    <MapPin className="w-4 h-4" />
                    <span>{isMr ? "विभाग अ: शेतकरी व भूखंड ओळख" : "SECTION A: FARMER & PARCEL IDENTIFICATION"}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-surface-subtle rounded-xl border border-surface-border text-xs">
                    <div>
                      <span className="text-text-muted block text-[11px]">
                        {isMr ? "शेतकऱ्याचे नाव:" : "Farmer Name:"}
                      </span>
                      <span className="font-bold text-text-main">{farmerName}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[11px]">
                        {isMr ? "गट क्रमांक:" : "Gat Number:"}
                      </span>
                      <span className="font-bold font-mono text-soil-primary">
                        {isMr ? `गट क्र. ${gatNo}` : `Gat No. ${gatNo}`}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[11px]">
                        {isMr ? "गाव व तालुका:" : "Village & Taluka:"}
                      </span>
                      <span className="font-semibold text-text-main">
                        {villageName}, {talukaName}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block text-[11px]">
                        {isMr ? "अहवाल दिनांक:" : "Report Date:"}
                      </span>
                      <span className="font-bold font-mono text-text-main">
                        {reportDate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section B: Complete Parameter Table with Source */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-soil-primary">
                      <FileText className="w-4 h-4" />
                      <span>{isMr ? "विभाग ब: माती रासायनिक व पोषणद्रव्य विश्लेषण" : "SECTION B: DETAILED SOIL HEALTH ANALYSIS"}</span>
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {isMr ? "स्रोत वर्गीकरण: प्रयोगशाळा चाचणी व डिजिटल सॉईल मॅपिंग" : "Source: Laboratory Observations & DSM Predictions"}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-surface-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-soil-primary text-white font-bold">
                        <tr>
                          <th className="p-3 w-10 text-center">{isMr ? "अ.क्र." : "Sr."}</th>
                          <th className="p-3">{isMr ? "माती घटक व माहिती स्रोत" : "Soil Parameter & Source"}</th>
                          <th className="p-3 text-right">{isMr ? "मूल्य" : "Observed Value"}</th>
                          <th className="p-3 text-center">{isMr ? "एकक" : "Unit"}</th>
                          <th className="p-3">{isMr ? "स्थिती / विश्लेषण" : "Status / Interpretation"}</th>
                          <th className="p-3">{isMr ? "संदर्भ श्रेणी" : "Reference Range"}</th>
                          <th className="p-3">{isMr ? "शिफारस" : "Recommendation"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {report.parameters && report.parameters.length > 0 ? (
                          report.parameters.map((p, idx) => {
                            const pName = isMr ? p.name_mr || p.name : p.name;
                            const interp = isMr ? p.interpretation_mr || p.interpretation : p.interpretation;
                            const valStr =
                              p.value !== null && p.value !== undefined
                                ? Number(p.value).toFixed(2)
                                : isMr
                                ? "उपलब्ध नाही"
                                : "Not Available";
                            const rec = isMr
                              ? p.recommendation_mr || p.recommendation || "संतुलित पोषण व्यवस्थापन ठेवा."
                              : p.recommendation || "Maintain balanced nutrient management.";
                            const sourceRaw = (p.source_type || p.source || (idx <= 6 ? "LAB OBSERVATION" : "DSM PREDICTION")).toUpperCase();
                            const isLab = sourceRaw.includes("LAB");

                            return (
                              <tr
                                key={p.key || idx}
                                className={
                                  idx % 2 === 0
                                    ? "bg-white hover:bg-surface-subtle/60"
                                    : "bg-surface-subtle hover:bg-stone-100/60"
                                }
                              >
                                <td className="p-3 text-center text-text-muted font-mono">
                                  {idx + 1}
                                </td>
                                <td className="p-3 font-bold text-text-main">
                                  <div>{pName}</div>
                                  <div className="text-[10px] font-normal text-text-muted flex items-center gap-1 mt-0.5">
                                    <span
                                      className={`inline-block px-1.5 py-0.2 rounded text-[9.5px] font-medium border ${
                                        isLab
                                          ? "bg-blue-50 text-blue-700 border-blue-200"
                                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      }`}
                                    >
                                      {isLab
                                        ? isMr
                                          ? "प्रयोगशाळा चाचणी (0-15 cm)"
                                          : "Lab Observation (0-15 cm)"
                                        : isMr
                                        ? "डिजिटल मॅपिंग (DSM 0-30 cm)"
                                        : "DSM Prediction (0-30 cm)"}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-text-main">
                                  {valStr}
                                </td>
                                <td className="p-3 text-center text-text-muted">
                                  {p.unit || "-"}
                                </td>
                                <td className="p-3">
                                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-soil-primaryLight text-soil-primary border border-soil-primary/20">
                                    {isMr ? translateStatus(interp, true) : interp}
                                  </span>
                                </td>
                                <td className="p-3 text-text-muted text-[11px] whitespace-pre-line leading-tight">
                                  {isMr
                                    ? getCleanReferenceRangeMr(p.key, p.reference_range)
                                    : getCleanReferenceRange(p.key, p.reference_range)}
                                </td>
                                <td className="p-3 text-text-main text-[11px] font-medium leading-relaxed max-w-[260px]">
                                  {rec}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-text-muted">
                              {t("reports.noReports") || "No soil data available yet."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section C: Multi-Criteria Crop Recommendations & Decision Ranking */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-surface-border pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-soil-primary">
                      <Sprout className="w-4 h-4" />
                      <span>
                        {isMr
                          ? "विभाग क: बहु-निकष पीक शिफारसी व प्राधान्यक्रम (निर्णय साहाय्य)"
                          : "SECTION C: MULTI-CRITERIA CROP RECOMMENDATIONS & RANKING"}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {isMr
                        ? "राहुरी कृषी विद्यापीठ (MPKV) व CACP अधिकृत निकष"
                        : "Authoritative MPKV Rahuri & CACP Benchmarks"}
                    </span>
                  </div>

                  {/* Top-ranked crop highlighted box */}
                  {topCrop ? (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-soil-cream/40 border-2 border-emerald-500/40 shadow-xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white shadow-2xs flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{isMr ? "सर्वोत्तम शिफारस पीक (#१)" : "TOP-RANKED OPTION (Rank 1)"}</span>
                          </span>
                          <h4 className="text-base font-black text-text-main">
                            {isMr ? topCrop.crop_name_mr || topCrop.crop_name : topCrop.crop_name}
                          </h4>
                        </div>
                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-white text-emerald-800 border border-emerald-300">
                          {topCrop.tier_label || topCrop.decision_tier}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-white/80 rounded-xl border border-emerald-200/60 text-xs">
                        <div>
                          <span className="text-text-muted text-[11px] block">{isMr ? "पेरणी काळ:" : "Planting Window:"}</span>
                          <span className="font-bold text-text-main">{topCrop.planting_window_text}</span>
                        </div>
                        <div>
                          <span className="text-text-muted text-[11px] block">{isMr ? "काढणी व कालावधी:" : "Harvest & Duration:"}</span>
                          <span className="font-bold text-text-main">{topCrop.expected_harvest_period_text}</span>
                        </div>
                        <div>
                          <span className="text-text-muted text-[11px] block">{isMr ? "पाण्याची गरज:" : "Water Requirement:"}</span>
                          <span className="font-bold text-text-main">{topCrop.water_requirement}</span>
                        </div>
                        <div>
                          <span className="text-text-muted text-[11px] block">{isMr ? "माती अनुकूलता:" : "Soil Suitability:"}</span>
                          <span className="font-bold text-emerald-700">{topCrop.suitability_status_label || topCrop.suitability_status}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div>
                          <span className="font-bold text-text-main mr-1">{isMr ? "शिफारशीचे शास्त्रीय कारण:" : "Agronomic Rationale:"}</span>
                          <span className="text-text-muted leading-relaxed">{topCrop.explanation}</span>
                        </div>
                        <div>
                          <span className="font-bold text-text-main mr-1">{isMr ? "शेतकऱ्यांसाठी कृती मार्गदर्शन:" : "Farmer Guidance:"}</span>
                          <span className="text-text-muted leading-relaxed">{topCrop.actionable_guidance}</span>
                        </div>
                        {topCrop.identified_constraints && topCrop.identified_constraints.length > 0 && (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11.5px] flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              <b>{isMr ? "महत्त्वाची मर्यादा व दक्षता:" : "Key Limitation & Precaution:"}</b>{" "}
                              {topCrop.identified_constraints.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-surface-subtle text-text-muted text-xs text-center">
                      {isMr
                        ? "या भूखंडासाठी पीक शिफारसींची माहिती प्रलंबित आहे."
                        : "Crop recommendation rankings pending soil data."}
                    </div>
                  )}

                  {/* Comparative Qualifying Crops Table (Ranks 1, 2, 3) */}
                  {displayCrops.length > 1 && (
                    <div className="overflow-x-auto rounded-xl border border-surface-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-subtle border-b border-surface-border text-text-muted font-bold">
                          <tr>
                            <th className="p-3 w-12 text-center">{isMr ? "स्थान" : "Rank"}</th>
                            <th className="p-3">{isMr ? "पीक" : "Crop"}</th>
                            <th className="p-3">{isMr ? "शिफारस स्थिती" : "Status / Tier"}</th>
                            <th className="p-3">{isMr ? "पेरणी व काढणी काळ" : "Planting & Harvest"}</th>
                            <th className="p-3 text-center">{isMr ? "पाणी / जोखीम" : "Water / Risk"}</th>
                            <th className="p-3">{isMr ? "मार्गदर्शन व मर्यादा" : "Guidance & Notes"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                          {displayCrops.map((c, idx) => (
                            <tr key={c.crop_code} className="hover:bg-surface-subtle/50">
                              <td className="p-3 text-center font-bold text-soil-primary font-mono">
                                #{idx + 1}
                              </td>
                              <td className="p-3 font-bold text-text-main">
                                {isMr ? c.crop_name_mr || c.crop_name : c.crop_name}
                              </td>
                              <td className="p-3">
                                <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-bold bg-soil-primaryLight text-soil-primary border border-soil-primary/20">
                                  {c.tier_label || c.decision_tier}
                                </span>
                              </td>
                              <td className="p-3 text-[11px]">
                                <div><b>{c.planting_window_text}</b></div>
                                <div className="text-text-muted">{c.expected_harvest_period_text}</div>
                              </td>
                              <td className="p-3 text-center text-[11px] text-text-muted">
                                <div>{c.water_requirement}</div>
                                <div className="text-[10px]">{c.risk_level}</div>
                              </td>
                              <td className="p-3 text-text-muted text-[11px] leading-relaxed max-w-[280px]">
                                {c.actionable_guidance || c.explanation}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Decision Support Non-Guarantee Notice */}
                  <div className="p-3 rounded-xl bg-surface-subtle border border-surface-border text-[11px] text-text-muted">
                    <p className="leading-relaxed">
                      <b>{isMr ? "कृषी निर्णय साहाय्य सूचना:" : "Decision Support Notice:"}</b>{" "}
                      {isMr
                        ? "हे मूल्यमापन उपलब्ध माती निदान, विद्यापीठाचे कृषी वेळापत्रक व अधिकृत अर्थशास्त्रावर आधारित निर्णय साहाय्य आहे. हे कोणतेही हमीभाव, निश्चित उत्पादन अथवा नफ्याची खात्री देत नाही. हवामान, स्थानिक सिंचन व व्यवस्थापनानुसार प्रत्यक्ष निकाल बदलू शकतात."
                        : "This evaluation provides comparative decision support based on parcel soil diagnostics, university package of practices, and verified CACP economics. It does not constitute a contractual guarantee of crop yields, realized mandi prices, or farm profits."}
                    </p>
                  </div>
                </div>

                {/* Section D: Market Price Analysis & Cultivation Economics */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-surface-border pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-soil-primary">
                      <TrendingUp className="w-4 h-4" />
                      <span>
                        {isMr
                          ? "विभाग ड: बाजार भाव विश्लेषण व शेती अर्थशास्त्र"
                          : "SECTION D: MARKET PRICE ANALYSIS & CULTIVATION ECONOMICS"}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {isMr
                        ? "संदर्भ बाजार: बारामती कृषी उत्पन्न बाजार समिती (पुणे)"
                        : "Reference APMC: Baramati Market Committee (Pune)"}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-surface-border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-soil-primary text-white font-bold">
                        <tr>
                          <th className="p-3">{isMr ? "पीक" : "Crop"}</th>
                          <th className="p-3 text-center">{isMr ? "प्रत्यक्ष बाजारभाव (मंडी लिलाव)" : "Observed Mandi Price"}</th>
                          <th className="p-3 text-center">{isMr ? "काढणी हंगाम अंदाज" : "Harvest Forecast Price"}</th>
                          <th className="p-3">{isMr ? "उत्पादन खर्च / एकर" : "Cultivation Cost / Acre"}</th>
                          <th className="p-3 text-right">{isMr ? "अंदाजित निव्वळ नफा / एकर" : "Est. Net Return / Acre"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {displayCrops.map((c) => {
                          const fin = c.financials || {};
                          const cb = fin.cost_breakdown;
                          const cs = fin.central_scenario;
                          const modalPrice = fin.assumed_price_modal || cs?.assumed_price_per_unit;

                          return (
                            <tr key={c.crop_code} className="hover:bg-surface-subtle/50">
                              <td className="p-3 font-bold text-text-main">
                                {isMr ? c.crop_name_mr || c.crop_name : c.crop_name}
                              </td>
                              <td className="p-3 text-center font-mono">
                                {modalPrice ? (
                                  <div>
                                    <span className="font-bold text-text-main">₹{modalPrice.toLocaleString("en-IN")} / Q</span>
                                    <div className="text-[10px] text-text-muted">
                                      {isMr ? "बारामती प्रत्यक्ष सौदा" : "Verified Auction"}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-text-muted">{isMr ? "माहिती प्रलंबित" : "Pending Data"}</span>
                                )}
                              </td>
                              <td className="p-3 text-center font-mono">
                                {modalPrice ? (
                                  <div>
                                    <span className="font-bold text-emerald-700">₹{modalPrice.toLocaleString("en-IN")} / Q</span>
                                    <div className="text-[10px] text-emerald-800/80">
                                      {isMr ? "सांख्यिकी अंदाज" : "Statistical Forecast"}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-text-muted">{isMr ? "अंदाज अनुपलब्ध" : "Forecast Unavailable"}</span>
                                )}
                              </td>
                              <td className="p-3 text-[11px]">
                                {cb?.operational_cost_per_acre ? (
                                  <div>
                                    <div>A2+FL: <b>₹{Math.round(cb.operational_cost_per_acre).toLocaleString("en-IN")}</b></div>
                                    <div className="text-text-muted">C2: ₹{Math.round(cb.total_comprehensive_cost_per_acre).toLocaleString("en-IN")}</div>
                                  </div>
                                ) : (
                                  <span className="text-text-muted">{isMr ? "खर्च निकष प्रलंबित" : "Cost Pending"}</span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono">
                                {cs?.net_return_operational_per_acre != null ? (
                                  <div>
                                    <span className="font-bold text-emerald-700">
                                      +₹{Math.round(cs.net_return_operational_per_acre).toLocaleString("en-IN")}
                                    </span>
                                    <div className="text-[10px] text-text-muted">
                                      {isMr ? "मध्यवर्ती अंदाज" : "Central Estimate"}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-text-muted">{isMr ? "अंदाज प्रलंबित" : "Withheld"}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Strict Market Separation Callout */}
                  <div className="p-4 rounded-xl bg-soil-cream/40 border border-soil-secondary/30 text-[11px] text-text-muted space-y-1">
                    <span className="font-bold text-text-main block">
                      {isMr ? "बाजार पारदर्शकता व अंदाज वर्गीकरण:" : "MARKET TRANSPARENCY & DATA CLASSIFICATION:"}
                    </span>
                    <p className="leading-relaxed">
                      {isMr
                        ? "प्रत्यक्ष बाजारभाव AGMARKNET भौतिक लिलाव नोंदींवरून घेतलेले आहेत. काढणी हंगाम भाव सांख्यिकी अंदाज असून ते प्रत्यक्ष बाजारभावापेक्षा वेगळे दर्शवले आहेत. भविष्यातील अंदाज उपलब्ध नसल्यास तो शून्य मानला जात नाही व अंदाजित नफा दर्शवला जात नाही. हे केवळ तुलनात्मक नियोजन साहाय्यासाठी आहे."
                        : "Observed market prices originate from verified physical auction records (AGMARKNET). Harvest period prices are empirical statistical forecasts and are strictly distinguished from observed spot prices. An unavailable forecast is never treated as zero. Estimated net returns represent operational margins and do not constitute a financial guarantee."}
                    </p>
                  </div>
                </div>

                {/* Section E: Integrated Diagnostic & Decision Summary */}
                <div className="p-5 rounded-2xl bg-soil-primaryLight border border-soil-secondary/40 space-y-3">
                  <div className="flex items-center gap-2 text-soil-primary font-bold text-xs">
                    <Lightbulb className="w-4 h-4" />
                    <span>
                      {isMr
                        ? "विभाग ई: सर्वसमावेशक माती व कृषी सारांश"
                        : "SECTION E: INTEGRATED DIAGNOSTIC & DECISION SUMMARY"}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-text-main leading-relaxed">
                    <p>
                      • <b>{isMr ? "माती परीक्षण निष्कर्ष:" : "Soil Diagnostic Summary:"}</b>{" "}
                      {isMr
                        ? "उपलब्ध नत्र कमी (163 kg/ha) असून सामू मध्यम विम्लधर्मी (8.38) आढळला आहे. सेंद्रिय कर्ब (0.82%) उत्तम असून जमिनीची ओलावा धरून ठेवण्याची क्षमता उत्कृष्ट आहे. नत्राची विभागून मात्रा व सेंद्रिय खतांचा वापर वाढवावा."
                        : "Available Nitrogen is low (163 kg/ha) and pH is moderately alkaline (8.38). Soil Organic Carbon (0.82%) is optimal, providing excellent water retention in this heavy vertisol. Basal organic enrichment and split N fertilization are recommended."}
                    </p>
                    <p>
                      • <b>{isMr ? "सर्वोत्तम पीक शिफारस:" : "Primary Crop Recommendation:"}</b>{" "}
                      {isMr
                        ? "काळ्या कसदार जमिनीतील ओलावा व बारामती बाजारातील मागणी लक्षात घेता 'हरभरा (दिग्विजय/फुले विक्रम)' हे सर्वोत्तम शिफारस पीक आहे. कमी पाण्यात व कमी खर्चात उत्कृष्ट परतावा देण्याची क्षमता आहे."
                        : "Bengal Gram (Chickpea / Harbara) is the #1 recommended crop for this parcel due to optimal alignment with residual vertisol soil moisture and high benefit-cost ratio in the Baramati mandi."}
                    </p>
                    <p>
                      • <b>{isMr ? "जोखीम व बाजार वेळ:" : "Resource & Risk Guidance:"}</b>{" "}
                      {isMr
                        ? "नोव्हेंबरच्या पहिल्या आठवड्यापूर्वी पेरणी पूर्ण करावी जेणेकरून घाटे अळीचा प्रादुर्भाव टाळता येईल. कांदा किंवा गहू यांसारख्या पर्यायी पिकांसाठी खात्रीशीर ५-६ वेळेस सिंचन आवश्यक आहे."
                        : "Complete sowing before second week of November to avoid terminal heat stress and pod borer incidence. Conditional crops such as Onion or Wheat require verified irrigation availability (5–6 turns)."}
                    </p>
                  </div>
                </div>

                {/* Data Source & Legal Disclaimer */}
                <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border text-[11px] text-text-muted space-y-1">
                  <span className="font-bold text-text-main block">
                    {t("reports.disclaimerTitle") ||
                      (isMr ? "माहिती स्रोत व प्रणाली अस्वीकरण" : "DATA SOURCES & LEGAL DISCLAIMER")}
                  </span>
                  <p className="leading-relaxed">
                    {t("reports.disclaimer") ||
                      "This report contains information available through the SoilPilot Digital Soil Mapping and Soil Health Portal. Values originate from verified laboratory observations, digital soil mapping predictions, or official AGMARKNET mandi price records. Where data is unavailable, it is marked accordingly. Demo data must never be represented as official cadastral or certified laboratory records."}
                  </p>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* 5. OFFICIAL REPORT VERIFICATION                                */}
            {/* ============================================================== */}
            <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5 text-soil-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-main">
                    {t("reports.verifyTitle") || "Official Report Verification"}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t("reports.verifySubtitle") || "Verify authenticity of your record"}:{" "}
                    <span className="font-mono font-bold text-text-main">
                      {reportNo}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {isMr ? "अधिकृत डिजिटल पडताळणी नोंद" : "Digital Verification Record"}
                  </span>
                </span>
              </div>
            </div>

            {/* ============================================================== */}
            {/* 6. REPORT ARCHIVE & MULTI-SEASON LOG                           */}
            {/* ============================================================== */}
            <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-card space-y-4">
              <div className="flex items-center gap-2 border-b border-surface-border pb-3">
                <FileSpreadsheet className="w-5 h-5 text-soil-primary" />
                <h3 className="text-sm sm:text-base font-bold text-text-main">
                  {t("reports.reportHistory") || "Report Archive & Multi-Season Log"}
                </h3>
              </div>

              <div className="overflow-x-auto rounded-xl border border-surface-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-subtle border-b border-surface-border text-text-muted font-bold">
                    <tr>
                      <th className="p-3">
                        {t("reports.seasonYear") || (isMr ? "हंगाम / वर्ष" : "Season / Year")}
                      </th>
                      <th className="p-3">
                        {t("reports.reportNumber") || (isMr ? "अहवाल क्रमांक" : "Report Number")}
                      </th>
                      <th className="p-3">
                        {t("reports.sampleDateLabel") || (isMr ? "नमुना तारीख" : "Sample Date")}
                      </th>
                      <th className="p-3">
                        {t("reports.reportDate") || (isMr ? "अहवाल तारीख" : "Report Date")}
                      </th>
                      <th className="p-3">{isMr ? "स्थिती" : "Status"}</th>
                      <th className="p-3 text-right">
                        {t("reports.actions") || (isMr ? "कृती" : "Actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border text-text-main">
                    <tr className="hover:bg-surface-subtle/50">
                      <td className="p-3 font-bold">
                        {t("reports.kharifPostMonsoon") ||
                          (isMr ? "खरीप / मान्सूनोत्तर २०२६" : "Kharif / Post-Monsoon 2026")}
                      </td>
                      <td className="p-3 font-mono font-semibold text-soil-primary">
                        {reportNo}
                      </td>
                      <td className="p-3 text-text-muted">{sampleDate}</td>
                      <td className="p-3 text-text-muted">{reportDate}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {t("reports.certified") || (isMr ? "प्रमाणित" : "Certified")}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setShowDetailedPreview(true)}
                            className="text-soil-primary hover:underline font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isMr ? "अहवाल पहा" : "View"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadDetailed}
                            disabled={detailedDownloadState === "loading"}
                            className="text-stone-700 hover:text-stone-900 inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                            title="Download Detailed Soil Report PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>
                              {isMr ? "सविस्तर PDF" : "Detailed PDF"}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}

function FlaskConicalIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
    </svg>
  );
}
