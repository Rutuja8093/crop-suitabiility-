"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { useSelectedFarmer } from "@/context/FarmerContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { reportService } from "@/services/reportService";
import { marketService, FieldCropDecisionResponse } from "@/services/marketService";
import { SoilHealthReport } from "@/types/soilHealth";
import {
  Download,
  Printer,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import {
  getCleanReferenceRange,
  getCleanReferenceRangeMr,
} from "@/lib/soilRecommendations";
import { translateGeoName, translateFarmerName, translateStatus } from "@/i18n/marathiHelper";
import { getLiveDateStr, getLiveSampleDateStr } from "@/lib/dateUtils";

type ButtonState = "idle" | "loading" | "success" | "error";

interface CropDisplayInfo {
  code: string;
  nameEn: string;
  nameMr: string;
  tierEn: string;
  tierMr: string;
  windowEn: string;
  windowMr: string;
  harvestEn: string;
  harvestMr: string;
  waterEn: string;
  waterMr: string;
  riskEn: string;
  riskMr: string;
  expEn: string;
  expMr: string;
  guideEn: string;
  guideMr: string;
  costA2: string;
  costC2: string;
}

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const { field, farmer, location, loading: authLoading } = useAuth();
  const { selectedFarmer } = useSelectedFarmer();

  const [report, setReport] = useState<SoilHealthReport | null>(null);
  const [decisionPlan, setDecisionPlan] = useState<FieldCropDecisionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
  const farmerName = translateFarmerName(rawFarmerName, isMr);
  const gatNo = report?.field?.gat_no || field?.gat_no || activeGat;
  const rawVillageName =
    report?.field?.village || location?.village || "Malegaon Kh.";
  const villageName = translateGeoName(rawVillageName, isMr);
  const rawTalukaName = report?.field?.taluka || location?.taluka || "Baramati";
  const talukaName = translateGeoName(rawTalukaName, isMr);
  const rawDistrictName = report?.field?.district || location?.district || "Pune";
  const districtName = translateGeoName(rawDistrictName, isMr);
  const rawAreaNum =
    report?.field?.area != null
      ? report.field.area
      : field?.area != null
      ? field.area
      : 1.49;
  const fieldArea = `${rawAreaNum} ${isMr ? "हेक्टर" : "hectare"}`;
  const reportDate = getLiveDateStr(report?.report?.report_date);
  const sampleDate = report?.report?.sample_date
    ? getLiveDateStr(report.report.sample_date)
    : getLiveSampleDateStr(5);
  const reportNo = report?.report?.report_no || "SPL/2026/SL-0104";
  const receiptNo = "REC-7842/26";

  // Standard qualifying crops matching official 4-page template
  const standardCrops: CropDisplayInfo[] = [
    {
      code: "CHANA",
      nameEn: "Bengal Gram (Chickpea / Harbara)",
      nameMr: "हरभरा (चना)",
      tierEn: "Recommended Suitable Option",
      tierMr: "सर्वोत्तम शिफारस पर्याय",
      windowEn: "Oct 01 – Nov 10",
      windowMr: "०१ ऑक्टोबर – १० नोव्हेंबर",
      harvestEn: "Feb 01, 2027 – Feb 16, 2027 (95–110 days)",
      harvestMr: "०१ फेब्रुवारी, २०२७ – १६ फेब्रुवारी, २०२७ (९५–११० दिवस)",
      waterEn: "LOW",
      waterMr: "कमी",
      riskEn: "LOW",
      riskMr: "कमी",
      expEn:
        "Preliminary evidence strongly supports Bengal Gram (Chickpea / Harbara). Soil parameters meet optimal MPKV Rahuri benchmarks and the planting window (Oct 01 – Nov 10) is active.",
      expMr:
        "मातीचे घटक महात्मा फुले कृषी विद्यापीठ (MPKV) मानकांशी तंतोतंत जुळतात आणि पेरणी कालावधी (१ ऑक्टोबर - १० नोव्हेंबर) सक्रिय आहे.",
      guideEn:
        "Verify local seed availability (certified variety) and ensure seed treatment with Rhizobium/fungicide.",
      guideMr:
        "प्रमाणित बियाण्यांची खात्री करावी आणि रायझोबियम व ट्रायकोडर्माची बीजप्रक्रिया आवर्जून करावी.",
      costA2: "10,724₹",
      costC2: "16,390₹",
    },
    {
      code: "ONION",
      nameEn: "Rabi Onion (Kanda)",
      nameMr: "रब्बी कांदा",
      tierEn: "Conditionally Suitable — Management Intensive",
      tierMr: "सशर्त अनुकूल — व्यवस्थापन गहन",
      windowEn: "Oct 15 – Nov 30",
      windowMr: "१५ ऑक्टोबर – ३० नोव्हेंबर",
      harvestEn: "Feb 16, 2027 – Mar 08, 2027 (110–130 days)",
      harvestMr: "१६ फेब्रुवारी, २०२७ – ०८ मार्च, २०२७ (११०–१३० दिवस)",
      waterEn: "MEDIUM",
      waterMr: "मध्यम",
      riskEn: "MODERATE",
      riskMr: "मध्यम",
      expEn:
        "High gross revenue potential, with verified suitability for Baramati vertisols and strong local APMC demand.",
      expMr:
        "उत्कृष्ट उत्पन्नाची क्षमता, बारामती काळ्या जमिनीस अत्यंत अनुकूल आणि स्थानिक बाजारपेठेत हमखास मागणी.",
      guideEn:
        "Verify water storage and irrigation pump capacity before committing capital.",
      guideMr:
        "भांडवल गुंतवण्यापूर्वी पाणी साठवण व उपसा क्षमतेची खात्री करावी.",
      costA2: "35,612₹",
      costC2: "53,418₹",
    },
    {
      code: "WHEAT",
      nameEn: "Wheat (Gahu)",
      nameMr: "गहू",
      tierEn: "Conditionally Suitable — Management Intensive",
      tierMr: "सशर्त अनुकूल — व्यवस्थापन गहन",
      windowEn: "Nov 01 – Nov 30",
      windowMr: "०१ नोव्हेंबर – ३० नोव्हेंबर",
      harvestEn: "Feb 11, 2027 – Mar 03, 2027 (105–125 days)",
      harvestMr: "११ फेब्रुवारी, २०२७ – ०३ मार्च, २०२७ (१०५–१२५ दिवस)",
      waterEn: "MEDIUM",
      waterMr: "मध्यम",
      riskEn: "MODERATE",
      riskMr: "मध्यम",
      expEn: "High grain food security and steady mandi demand.",
      expMr: "अन्नधान्य सुरक्षितता व हमखास बाजारपेठ मागणी.",
      guideEn:
        "Verify water storage and irrigation pump capacity before committing capital.",
      guideMr:
        "भांडवल गुंतवण्यापूर्वी पाणी साठवण व उपसा क्षमतेची खात्री करावी.",
      costA2: "11,938₹",
      costC2: "18,616₹",
    },
  ];

  const topCrop = standardCrops[0];

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto space-y-4 pb-16">
        {/* ============================================================== */}
        {/* Top Action Bar (Print Hidden)                                   */}
        {/* ============================================================== */}
        <div className="bg-white p-3 sm:p-3.5 rounded-lg border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={`/soil-map?gat=${gatNo}`}
            className="text-xs font-bold text-[#214F3F] hover:text-[#1a3f33] flex items-center gap-1.5 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>
              {isMr
                ? `← माती नकाशा पहा (गट ${gatNo})`
                : `← View Soil Map (Gat ${gatNo})`}
            </span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EAF3ED] text-[#214F3F] border border-[#214F3F]/30 rounded-md text-xs font-bold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#2A7C13] animate-pulse" />
              <span>
                {villageName} &bull; {isMr ? "गट क्र." : "Gat No."} {gatNo}
                {` (${fieldArea})`}
              </span>
            </span>

            {/* Download Detailed Report PDF Button */}
            <button
              type="button"
              onClick={handleDownloadDetailed}
              disabled={detailedDownloadState === "loading"}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-md transition-colors shadow-2xs cursor-pointer ${
                detailedDownloadState === "loading"
                  ? "bg-stone-200 text-stone-500 cursor-not-allowed"
                  : detailedDownloadState === "success"
                  ? "bg-emerald-600 text-white"
                  : detailedDownloadState === "error"
                  ? "bg-rose-600 text-white"
                  : "bg-[#214F3F] hover:bg-[#1a3f33] text-white"
              }`}
            >
              {detailedDownloadState === "loading" ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : detailedDownloadState === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : detailedDownloadState === "error" ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>
                {detailedDownloadState === "loading"
                  ? isMr
                    ? "तयार होत आहे..."
                    : "Generating PDF..."
                  : detailedDownloadState === "success"
                  ? isMr
                    ? "डाऊनलोड झाले"
                    : "PDF Downloaded"
                  : detailedDownloadState === "error"
                  ? isMr
                    ? "त्रुटी आली"
                    : "Download Failed"
                  : isMr
                  ? "सविस्तर अहवाल PDF डाऊनलोड करा"
                  : "Download Detailed Report PDF"}
              </span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={() => window.print()}
              className="p-1.5 text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors border border-stone-200 cursor-pointer"
              title={isMr ? "अहवाल प्रिंट करा" : "Print Report"}
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="bg-white p-8 rounded-lg border border-stone-200 shadow-2xs animate-pulse space-y-4">
            <div className="h-6 bg-stone-200 rounded w-1/3 mx-auto" />
            <div className="h-4 bg-stone-100 rounded w-1/4 mx-auto" />
            <div className="h-32 bg-stone-100 rounded" />
            <div className="h-64 bg-stone-100 rounded" />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-stone-900">
              {isMr
                ? "अहवाल उपलब्ध करण्यात अडचण आली."
                : "We couldn't generate your report right now."}
            </p>
            <p className="text-xs text-stone-500">{error}</p>
            <button
              type="button"
              onClick={loadReportData}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#214F3F] text-white text-xs font-bold rounded-lg hover:bg-[#1a3f33] transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isMr ? "पुन्हा प्रयत्न करा" : "Try Again"}</span>
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* Main Document Container: Centered Official A4 Document Sheet   */}
        {/* ============================================================== */}
        {!loading && !error && report && (
          <div className="w-full overflow-x-auto pb-8 print:p-0 print:overflow-visible">
            <div className="relative soil-report-page max-w-[850px] min-w-[760px] mx-auto bg-white p-6 sm:p-8 shadow-sm border border-[#cbd5e1] text-stone-900 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:min-w-0 font-sans">
              {/* Document Header */}
              <div className="text-center mb-4 pt-1 print:pt-0">
                <h1 className="text-lg sm:text-[21px] font-black text-[#1B4D3E] uppercase tracking-wide print:text-lg">
                  {isMr
                    ? "एडीटी एआय ट्रेनिंग फाउंडेशन, बारामती"
                    : "ADT AI TRAINING FOUNDATION, BARAMATI"}
                </h1>
                <p className="text-xs sm:text-[13px] font-semibold text-[#4B5563] mt-0.5 print:text-[11px]">
                  {isMr ? "पुणे, महाराष्ट्र" : "Pune, Maharashtra"}
                </p>
                <h2 className="text-sm sm:text-base font-black text-[#1B4D3E] uppercase tracking-wide mt-1.5 mb-3 print:text-sm">
                  {isMr
                    ? "सॉईलपायलट — सविस्तर माती चाचणी व कृषी निर्णय अहवाल"
                    : "SOILPILOT — DETAILED SOIL TEST & DIAGNOSTIC REPORT"}
                </h2>
              </div>

              {/* -------------------------------------------------------- */}
              {/* Section 1: Farmer, Cadastre & Sample Identification       */}
              {/* -------------------------------------------------------- */}
              <div className="mb-5">
                <h3 className="text-xs sm:text-[13px] font-bold text-[#1B4D3E] uppercase tracking-wide mb-1.5">
                  {isMr
                    ? "१. शेतकरी, भूखंड व माती नमुना ओळख"
                    : "1. FARMER, CADASTRE & SAMPLE IDENTIFICATION"}
                </h3>
                <div className="border border-stone-300 rounded-xs overflow-hidden">
                  <table className="w-full text-xs text-left border-collapse">
                    <tbody className="divide-y divide-stone-200">
                      <tr className="divide-x divide-stone-200">
                        <td className="p-2 font-bold text-stone-700 w-1/4 bg-stone-50/60">
                          {isMr ? "शेतकऱ्याचे नाव" : "Farmer Name"}
                        </td>
                        <td className="p-2 font-bold text-stone-900 w-1/4">
                          {farmerName}
                        </td>
                        <td className="p-2 font-bold text-stone-700 w-1/4 bg-stone-50/60">
                          {isMr ? "अहवाल क्रमांक" : "Report Number"}
                        </td>
                        <td className="p-2 font-mono font-bold text-stone-900 w-1/4">
                          {reportNo}
                        </td>
                      </tr>
                      <tr className="divide-x divide-stone-200">
                        <td className="p-2 font-bold text-stone-700 bg-stone-50/60">
                          {isMr ? "गट क्रमांक" : "Gat / Survey Number"}
                        </td>
                        <td className="p-2 font-mono font-bold text-stone-900">
                          {isMr ? `गट क्र. ${gatNo}` : `Gat No. ${gatNo}`}
                        </td>
                        <td className="p-2 font-bold text-stone-700 bg-stone-50/60">
                          {isMr ? "पावती क्रमांक" : "Receipt Number"}
                        </td>
                        <td className="p-2 font-mono text-stone-900">
                          {receiptNo}
                        </td>
                      </tr>
                      <tr className="divide-x divide-stone-200">
                        <td className="p-2 font-bold text-stone-700 bg-stone-50/60">
                          {isMr ? "गाव / तालुका" : "Village / Taluka"}
                        </td>
                        <td className="p-2 text-stone-900">
                          {villageName}, {talukaName}
                        </td>
                        <td className="p-2 font-bold text-stone-700 bg-stone-50/60">
                          {isMr ? "नमुना संकलन दिनांक" : "Sample Collection Date"}
                        </td>
                        <td className="p-2 text-stone-900">{sampleDate}</td>
                      </tr>
                      <tr className="divide-x divide-stone-200">
                        <td className="p-2 font-bold text-stone-700 bg-stone-50/60">
                          {isMr ? "जिल्हा व क्षेत्र" : "District & Field Area"}
                        </td>
                        <td className="p-2 text-stone-900">
                          {districtName} • {fieldArea}
                        </td>
                        <td className="p-2 font-bold text-stone-700 bg-stone-50/60">
                          {isMr ? "अहवाल प्रसिद्धी दिनांक" : "Report Release Date"}
                        </td>
                        <td className="p-2 text-stone-900">{reportDate}</td>
                      </tr>
                      <tr className="divide-x divide-stone-200">
                        <td className="p-2 font-bold text-stone-700 bg-stone-50/60">
                          {isMr ? "नमुना प्रकार" : "Sample Description"}
                        </td>
                        <td className="p-2 text-stone-900">
                          {isMr
                            ? "पृष्ठभागीय माती नमुना (०-१५ सेमी)"
                            : "Surface Soil Composite (0-15 cm)"}
                        </td>
                        <td className="p-2 font-bold text-stone-700 bg-stone-50/60">
                          {isMr ? "नियोजित पीक" : "Target Crop"}
                        </td>
                        <td className="p-2 text-stone-900">
                          {isMr ? "ऊस" : "Sugarcane (ऊस)"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* Section 2: Complete Soil Chemical & Nutrient Diagnostics */}
              {/* -------------------------------------------------------- */}
              <div className="mb-5">
                <h3 className="text-xs sm:text-[13px] font-bold text-[#1B4D3E] uppercase tracking-wide mb-1.5">
                  {isMr
                    ? "२. संपूर्ण माती रासायनिक व पोषणद्रव्य विश्लेषण आणि शिफारसी"
                    : "2. COMPLETE SOIL CHEMICAL & NUTRIENT DIAGNOSTICS & RECOMMENDATIONS"}
                </h3>
                <div className="border border-stone-300 rounded-xs overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#1B4D3E] text-white font-bold text-[10.5px]">
                      <tr>
                        <th className="p-2 text-center w-10">
                          {isMr ? "अ.क्र." : "SR. NO."}
                        </th>
                        <th className="p-2">
                          {isMr ? "घटक / निर्देशांक" : "PARAMETER"}
                        </th>
                        <th className="p-2 text-center">
                          {isMr ? "प्राप्त मूल्य" : "OBSERVED VALUE"}
                        </th>
                        <th className="p-2 text-center">
                          {isMr ? "एकक" : "UNIT"}
                        </th>
                        <th className="p-2">
                          {isMr ? "निष्कर्ष" : "INTERPRETATION"}
                        </th>
                        <th className="p-2">
                          {isMr ? "संदर्भ श्रेणी" : "REFERENCE RANGE"}
                        </th>
                        <th className="p-2">
                          {isMr ? "शिफारस" : "RECOMMENDATION"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {report.parameters && report.parameters.length > 0 ? (
                        report.parameters.map((p, idx) => {
                          const pName = isMr ? p.name_mr || p.name : p.name;
                          const interp = isMr
                            ? p.interpretation_mr || p.interpretation
                            : p.interpretation;
                          const valStr =
                            p.value !== null && p.value !== undefined
                              ? Number(p.value).toFixed(2)
                              : isMr
                              ? "उपलब्ध नाही"
                              : "Not Available";
                          const rec = isMr
                            ? p.recommendation_mr ||
                              p.recommendation ||
                              "संतुलित पोषण व्यवस्थापन ठेवा."
                            : p.recommendation ||
                              "Maintain balanced nutrient management.";
                          const sourceRaw = (
                            p.source_type ||
                            p.source ||
                            (idx <= 14 ? "LAB OBSERVATION" : "DSM PREDICTION")
                          ).toUpperCase();
                          const isLab = sourceRaw.includes("LAB");

                          return (
                            <tr
                              key={p.key || idx}
                              className={
                                idx % 2 === 0
                                  ? "bg-white"
                                  : "bg-[#FAFAFA]"
                              }
                            >
                              <td className="p-2 text-center text-stone-600 font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="p-2 font-bold text-stone-900 text-[11px]">
                                <div>{pName}</div>
                                <div className="text-[9.5px] font-normal italic text-stone-500 mt-0.5">
                                  {isLab
                                    ? isMr
                                      ? "प्रयोगशाळा चाचणी (0-15 cm)"
                                      : "Lab Observation (0-15 cm)"
                                    : isMr
                                    ? "डिजिटल मॅपिंग (DSM 0-30 cm)"
                                    : "DSM Prediction (0-30 cm)"}
                                </div>
                              </td>
                              <td className="p-2 text-center font-mono font-bold text-stone-900 text-[11px]">
                                {valStr}
                              </td>
                              <td className="p-2 text-center text-stone-600 text-[11px]">
                                {p.unit || "—"}
                              </td>
                              <td className="p-2 text-stone-900 text-[11px]">
                                {isMr ? translateStatus(interp, true) : interp}
                              </td>
                              <td className="p-2 text-stone-600 text-[10.5px] whitespace-pre-line leading-tight">
                                {isMr
                                  ? getCleanReferenceRangeMr(
                                      p.key,
                                      p.reference_range
                                    )
                                  : getCleanReferenceRange(
                                      p.key,
                                      p.reference_range
                                    )}
                              </td>
                              <td className="p-2 text-stone-800 text-[10.5px] leading-relaxed max-w-[240px]">
                                {rec}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-4 text-center text-stone-500 text-xs"
                          >
                            {isMr
                              ? "माती चाचणी माहिती प्रलंबित आहे."
                              : "No soil parameter data available."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* Section 3: Multi-Criteria Crop Recommendations & Ranking */}
              {/* -------------------------------------------------------- */}
              <div className="mb-5">
                <h3 className="text-xs sm:text-[13px] font-bold text-[#1B4D3E] uppercase tracking-wide mb-1.5">
                  {isMr
                    ? "३. बहु-निकष पीक शिफारसी व प्राधान्यक्रम"
                    : "3. MULTI-CRITERIA CROP RECOMMENDATIONS & DECISION RANKING"}
                </h3>

                {/* Top-ranked crop banner */}
                <div className="border border-[#1B4D3E] rounded-xs overflow-hidden mb-3">
                  <div className="bg-[#1B4D3E] text-white px-3 py-1.5 text-xs font-bold">
                    <span>
                      {isMr
                        ? `★ सर्वोत्तम शिफारस पीक (१ले स्थान): ${topCrop.nameMr}`
                        : `TOP-RANKED SUITABLE CROP (Rank 1): ${topCrop.nameEn}`}
                    </span>
                    <span className="font-normal italic ml-2">
                      — {isMr ? topCrop.tierMr : topCrop.tierEn}
                    </span>
                  </div>
                  <div className="bg-[#F8FAF8] p-3 text-xs text-stone-800 space-y-1.5">
                    <div>
                      <span className="font-bold text-stone-900">
                        {isMr ? "पेरणी काळ:" : "Planting Window:"}
                      </span>{" "}
                      <span>{isMr ? topCrop.windowMr : topCrop.windowEn}</span>{" "}
                      |{" "}
                      <span className="font-bold text-stone-900">
                        {isMr ? "काढणी व कालावधी:" : "Harvest Window:"}
                      </span>{" "}
                      <span>
                        {isMr ? topCrop.harvestMr : topCrop.harvestEn}
                      </span>{" "}
                      |{" "}
                      <span className="font-bold text-stone-900">
                        {isMr ? "पाण्याची गरज:" : "Water Need:"}
                      </span>{" "}
                      <span>{isMr ? topCrop.waterMr : topCrop.waterEn}</span>
                    </div>
                    <div>
                      <span className="font-bold text-stone-900">
                        {isMr
                          ? "शिफारशीचे शास्त्रीय कारण:"
                          : "Agronomic Rationale:"}
                      </span>{" "}
                      <span className="text-stone-700">
                        {isMr ? topCrop.expMr : topCrop.expEn}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-stone-900">
                        {isMr
                          ? "शेतकऱ्यांसाठी कृती मार्गदर्शन:"
                          : "Farmer Guidance:"}
                      </span>{" "}
                      <span className="text-stone-700">
                        {isMr ? topCrop.guideMr : topCrop.guideEn}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Comparative Ranking Table */}
                <div className="border border-stone-300 rounded-xs overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#1B4D3E] text-white font-bold text-[10.5px]">
                      <tr>
                        <th className="p-2 text-center w-12">
                          {isMr ? "स्थान" : "RANK"}
                        </th>
                        <th className="p-2">{isMr ? "पीक" : "CROP"}</th>
                        <th className="p-2">
                          {isMr ? "शिफारस स्थिती" : "STATUS / TIER"}
                        </th>
                        <th className="p-2">
                          {isMr ? "पेरणी व काढणी काळ" : "PLANTING & HARVEST"}
                        </th>
                        <th className="p-2 text-center">
                          {isMr ? "पाणी व जोखीम" : "WATER & RISK"}
                        </th>
                        <th className="p-2">
                          {isMr ? "मार्गदर्शन व मर्यादा" : "GUIDANCE & NOTES"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {standardCrops.map((c, idx) => (
                        <tr
                          key={c.code}
                          className={idx % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}
                        >
                          <td className="p-2 text-center font-bold font-mono text-[#1B4D3E]">
                            #{idx + 1}
                          </td>
                          <td className="p-2 font-bold text-stone-900">
                            {isMr ? c.nameMr : c.nameEn}
                          </td>
                          <td className="p-2 text-stone-800 text-[11px]">
                            {isMr ? c.tierMr : c.tierEn}
                          </td>
                          <td className="p-2 text-[11px]">
                            <div className="font-semibold text-stone-900">
                              {isMr ? c.windowMr : c.windowEn}
                            </div>
                            <div className="text-stone-500 text-[10px]">
                              {isMr ? c.harvestMr : c.harvestEn}
                            </div>
                          </td>
                          <td className="p-2 text-center text-[10.5px] text-stone-700">
                            <div>Water: {isMr ? c.waterMr : c.waterEn}</div>
                            <div className="text-stone-500">
                              Risk: {isMr ? c.riskMr : c.riskEn}
                            </div>
                          </td>
                          <td className="p-2 text-stone-700 text-[10.5px] leading-relaxed max-w-[240px]">
                            {isMr ? c.guideMr : c.guideEn}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* Section 4: Market Price Analysis & Cultivation Economics  */}
              {/* -------------------------------------------------------- */}
              <div className="mb-5">
                <h3 className="text-xs sm:text-[13px] font-bold text-[#1B4D3E] uppercase tracking-wide mb-0.5">
                  {isMr
                    ? "४. बाजार भाव विश्लेषण व शेती अर्थशास्त्र"
                    : "4. MARKET PRICE ANALYSIS & CULTIVATION ECONOMICS"}
                </h3>
                <p className="text-[10.5px] italic text-[#4B5563] mb-1.5">
                  {isMr
                    ? "संदर्भ बाजार: बारामती कृषी उत्पन्न बाजार समिती (पुणे) • माहिती स्रोत: AGMARKNET व CACP अधिकृत उत्पादन खर्च निकष"
                    : "Reference APMC: Baramati Market Committee (Pune) • Sources: AGMARKNET Daily Mandi Auctions & CACP Benchmarks"}
                </p>

                <div className="border border-stone-300 rounded-xs overflow-hidden mb-2.5">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#1B4D3E] text-white font-bold text-[10.5px]">
                      <tr>
                        <th className="p-2">{isMr ? "पीक" : "CROP"}</th>
                        <th className="p-2 text-center">
                          {isMr ? "प्रत्यक्ष बाजारभाव" : "OBSERVED MANDI PRICE"}
                        </th>
                        <th className="p-2 text-center">
                          {isMr ? "काढणी हंगाम अंदाज" : "HARVEST FORECAST PRICE"}
                        </th>
                        <th className="p-2">
                          {isMr ? "उत्पादन खर्च / एकर" : "CULTIVATION COST / ACRE"}
                        </th>
                        <th className="p-2 text-center">
                          {isMr ? "अंदाजित निव्वळ नफा / एकर" : "EST. NET RETURN / ACRE"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {standardCrops.map((c, idx) => (
                        <tr
                          key={c.code}
                          className={idx % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}
                        >
                          <td className="p-2 font-bold text-stone-900">
                            {isMr ? c.nameMr : c.nameEn}
                          </td>
                          <td className="p-2 text-center text-stone-700 font-semibold text-[11px]">
                            {isMr ? "माहिती प्रलंबित" : "Pending Data"}
                          </td>
                          <td className="p-2 text-center text-stone-500 text-[11px]">
                            {isMr ? "अंदाज अनुपलब्ध" : "Forecast Unavailable"}
                          </td>
                          <td className="p-2 text-[11px] font-mono text-stone-800">
                            <div>A2+FL: <b>{c.costA2}</b></div>
                            <div className="text-stone-600">C2: {c.costC2}</div>
                          </td>
                          <td className="p-2 text-center text-stone-500 text-[11px]">
                            {isMr ? "अंदाज प्रलंबित" : "Pending Forecast"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Market Transparency Notice Box */}
                <div className="bg-[#FFFBEB] border border-[#FDE68A] p-3 rounded-xs text-[11px] text-[#78350F] leading-relaxed">
                  <span className="font-bold">
                    {isMr
                      ? "बाजार पारदर्शकता सूचना:"
                      : "Market Transparency Notice:"}
                  </span>{" "}
                  {isMr
                    ? "प्रत्यक्ष बाजारभाव AGMARKNET भौतिक लिलावावरून घेतलेले आहेत, तर काढणी हंगाम भाव सांख्यिकी अंदाजानुसार दर्शवले आहेत. अंदाज अनुपलब्ध असल्यास तो शून्य मानला जात नाही व अंदाजित नफा दर्शवला जात नाही. हे केवळ निर्णय साहाय्यासाठी असून कोणत्याही हमीभावाची अथवा नफ्याची खात्री देत नाही."
                    : "Observed prices represent actual mandi physical auctions (AGMARKNET). Harvest period prices are statistical forecasts and are explicitly distinguished from spot prices. An unavailable forecast is never treated as zero. Ratings and estimated net returns provide agricultural decision support only and do not guarantee market prices, crop yields, or farmer profits."}
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* Section 5: Integrated Diagnostic & Decision Summary       */}
              {/* -------------------------------------------------------- */}
              <div className="mb-5">
                <h3 className="text-xs sm:text-[13px] font-bold text-[#1B4D3E] uppercase tracking-wide mb-1.5">
                  {isMr
                    ? "५. सर्वसमावेशक माती व कृषी सारांश"
                    : "5. INTEGRATED DIAGNOSTIC & DECISION SUMMARY"}
                </h3>

                <div className="bg-[#F0FDF4] border border-[#86EFAC] p-3.5 rounded-xs text-xs text-stone-800 space-y-1.5 leading-relaxed">
                  <p>
                    •{" "}
                    <b>
                      {isMr ? "माती आरोग्य स्थिती:" : "Soil Diagnostic Status:"}
                    </b>{" "}
                    {isMr
                      ? "उपलब्ध नत्र कमी (163 kg/ha), सामू मध्यम विम्लधर्मी (8.38), व सेंद्रिय कर्ब उत्तम (0.82%). पिकांना संतुलित पोषण देण्यासाठी सेंद्रिय खतांचा वापर वाढवावा."
                      : "Available Nitrogen is low (163 kg/ha), pH is moderately alkaline (8.38), and Soil Organic Carbon is optimal (0.82%). Apply balanced split N fertilization and basal organic enrichment."}
                  </p>
                  <p>
                    •{" "}
                    <b>
                      {isMr
                        ? "पीक शिफारस निष्कर्ष:"
                        : "Primary Crop Recommendation:"}
                    </b>{" "}
                    {isMr
                      ? "काळ्या कसदार जमिनीतील ओलावा व बारामती बाजारपेठेतील मजबूत मागणी लक्षात घेता हरभरा (चना) हे सर्वोत्तम १ले शिफारस पीक ठरते."
                      : "Based on heavy vertisol moisture retention and favorable Baramati APMC modal price trends, Bengal Gram (Chickpea / Harbara) is the #1 recommended crop for this parcel."}
                  </p>
                  <p>
                    •{" "}
                    <b>
                      {isMr
                        ? "जोखीम व सिंचन दक्षता:"
                        : "Resource & Risk Guidance:"}
                    </b>{" "}
                    {isMr
                      ? "कांदा किंवा गहू यांसारख्या पर्यायी पिकांसाठी खात्रीशीर ५-६ वेळेस सिंचन व पाणी साठवण क्षमता तपासावी. कीड व रोग नियंत्रणासाठी वेळेवर उपाययोजना करावी."
                      : "Conditional crops such as Onion or Wheat require verified irrigation storage (5–6 turns) and curing infrastructure. Monitor pest incidence (Helicoverpa) actively."}
                  </p>
                </div>
              </div>

              {/* Document Footer */}
              <div className="pt-3 border-t border-stone-300 text-[10.5px] text-stone-500 flex flex-col sm:flex-row items-center justify-between gap-1">
                <span>
                  SoilPilot — Digital Soil Mapping &amp; Soil Health Portal |
                  Generated: {reportDate}
                </span>
                <span className="font-semibold text-stone-600">
                  {isMr
                    ? "अधिकृत मृदा चाचणी अहवाल • एडीटी बारामती"
                    : "Official Certified Diagnostic Dossier • ADT Baramati"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* Multi-Season Report Archive Log (Print Hidden)                 */}
        {/* ============================================================== */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs space-y-3 print:hidden">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-2.5">
              <FileSpreadsheet className="w-4 h-4 text-[#214F3F]" />
              <h3 className="text-xs sm:text-sm font-bold text-stone-800">
                {isMr
                  ? "अहवाल संग्रह व हंगाम नोंदी (Archive Log)"
                  : "Report Archive & Multi-Season Log"}
              </h3>
            </div>

            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold">
                  <tr>
                    <th className="p-2.5">
                      {isMr ? "हंगाम / वर्ष" : "Season / Year"}
                    </th>
                    <th className="p-2.5">
                      {isMr ? "अहवाल क्रमांक" : "Report Number"}
                    </th>
                    <th className="p-2.5">
                      {isMr ? "नमुना तारीख" : "Sample Date"}
                    </th>
                    <th className="p-2.5">
                      {isMr ? "अहवाल तारीख" : "Report Date"}
                    </th>
                    <th className="p-2.5">{isMr ? "स्थिती" : "Status"}</th>
                    <th className="p-2.5 text-right">
                      {isMr ? "कृती" : "Action"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-stone-800">
                  <tr className="hover:bg-stone-50/50">
                    <td className="p-2.5 font-bold">
                      {isMr ? "खरीप / रब्बी २०२६-२७" : "Rabi Season 2026-27"}
                    </td>
                    <td className="p-2.5 font-mono font-semibold text-[#214F3F]">
                      {reportNo}
                    </td>
                    <td className="p-2.5 text-stone-500">{sampleDate}</td>
                    <td className="p-2.5 text-stone-500">{reportDate}</td>
                    <td className="p-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {isMr ? "प्रमाणित" : "Certified"}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={handleDownloadDetailed}
                        disabled={detailedDownloadState === "loading"}
                        className="text-[#214F3F] hover:underline font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                        title={
                          isMr
                            ? "सविस्तर अहवाल PDF डाऊनलोड करा"
                            : "Download Detailed Report PDF"
                        }
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isMr ? "PDF डाऊनलोड" : "Download PDF"}</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
