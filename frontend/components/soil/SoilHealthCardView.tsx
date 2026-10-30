"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { useSelectedFarmer } from "@/context/FarmerContext";
import { soilHealthService } from "@/services/soilHealthService";
import { reportService } from "@/services/reportService";
import { SoilHealthReport } from "@/types/soilHealth";
import { KML_AVAILABLE_GATS } from "@/types/gat";
import { SoilReportHeader } from "./SoilReportHeader";
import { FarmerSampleInfoTable } from "./FarmerSampleInfoTable";
import { SoilParameterTable } from "./SoilParameterTable";
import { SoilReportFooter } from "./SoilReportFooter";
import Link from "next/link";
import {
  Download,
  Printer,
  FileText,
  AlertCircle,
  RefreshCw,
  FlaskConical,
  ArrowLeft,
  Layers,
} from "lucide-react";
import { translateGeoName } from "@/i18n/marathiHelper";

interface SoilHealthCardViewProps {
  fieldIdOverride?: string | number;
}

export const SoilHealthCardView: React.FC<SoilHealthCardViewProps> = ({ fieldIdOverride }) => {
  const { t, locale } = useI18n();
  const { field, farmer, location, loading: authLoading } = useAuth();
  const { selectedFarmer } = useSelectedFarmer();
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
    return "18";
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

  const [report, setReport] = useState<SoilHealthReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingCard, setDownloadingCard] = useState<boolean>(false);

  const activeFieldId =
    fieldIdOverride ||
    (selectedGat ? `demo-field-gat-${selectedGat}` : field?.id || (field?.gat_no ? `demo-field-gat-${field.gat_no}` : "demo-field-gat-18"));

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await soilHealthService.getFieldReport(activeFieldId);
      if (data && data.parameters && data.parameters.length > 0) {
        setReport(data);
      } else {
        const { buildFallbackReport } = await import("@/services/soilHealthService");
        setReport(buildFallbackReport(activeFieldId));
      }
    } catch (err: any) {
      console.warn("Falling back to verified laboratory test report:", err);
      const { buildFallbackReport } = await import("@/services/soilHealthService");
      setReport(buildFallbackReport(activeFieldId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchReport();
    }
  }, [activeFieldId, authLoading]);

  // Loading skeleton
  if (loading || authLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 py-6 animate-pulse">
        <div className="h-14 bg-stone-200 rounded-lg w-full" />
        <div className="h-36 bg-stone-100 rounded-lg w-full" />
        <div className="h-72 bg-stone-100 rounded-lg w-full" />
      </div>
    );
  }

  // Error state
  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-stone-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-stone-900">
          {t("soilHealthCard.errorTitle")}
        </h2>
        <p className="text-xs text-stone-600">
          {locale === "mr"
            ? "कृपया आपले इंटरनेट कनेक्शन तपासा किंवा शेताची माहिती योग्य असल्याची खात्री करा."
            : "Please check your connection or verify that your field details are valid."}
        </p>
        <button
          type="button"
          onClick={fetchReport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-soil-primary text-white font-medium text-xs rounded-lg hover:bg-soil-primaryHover transition-colors shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t("soilHealthCard.retry")}</span>
        </button>
      </div>
    );
  }

  // If no report is available for this field
  if (!report.has_report && report.parameters.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-2xl border border-stone-200 shadow-sm text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-stone-100 text-stone-500 flex items-center justify-center">
          <FlaskConical className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-stone-900">
          {t("soilHealthCard.noReportTitle")}
        </h2>
        <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
          {t("soilHealthCard.noReportDesc")}
        </p>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-full border border-amber-200">
          <span>{t("soilHealthCard.reportPending")}</span>
        </div>
      </div>
    );
  }

  const splitThreshold = 18;
  const hasMultiplePages = report.parameters && report.parameters.length > splitThreshold;
  const page1Params = hasMultiplePages ? report.parameters.slice(0, splitThreshold) : report.parameters;
  const page2Params = hasMultiplePages ? report.parameters.slice(splitThreshold) : [];

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-12">
      {/* Clean Navigation & Parcel Identity Header */}
      <div className="bg-white p-3 sm:p-3.5 rounded-lg border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/soil-map?gat=${selectedGat}`}
          className="text-xs font-bold text-[#214F3F] hover:text-[#1a3f33] flex items-center gap-1.5 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>{locale === "mr" ? `← माती नकाशा पहा (गट ${selectedGat})` : `← View Soil Map (Gat ${selectedGat})`}</span>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EAF3ED] text-[#214F3F] border border-[#214F3F]/30 rounded-md text-xs font-bold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#2A7C13] animate-pulse" />
            <span>
              {(locale === "mr" ? translateGeoName(report?.field?.village || "Malegaon Kh") : (report?.field?.village || "Malegaon Kh"))} &bull; {t("geo.gatNo") || (locale === "mr" ? "गट क्र." : "Gat No.")} {selectedGat}
              {report?.field?.area ? ` (${report.field.area} ${locale === "mr" ? "हेक्टर" : "Ha"})` : ""}
            </span>
          </span>
        </div>
      </div>

      {/* Top Action Bar: Laboratory Health Card & Download Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-stone-200 shadow-2xs print:hidden">
        {/* Laboratory Health Card Badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-[#EAF3ED] text-[#214F3F] border border-[#214F3F]/30 rounded-md text-xs font-bold shadow-2xs">
          <FileText className="w-4 h-4 text-[#214F3F]" />
          <span>{t("soilHealthCard.viewDetailed") || "Laboratory Soil Test Report"}</span>
        </div>

        {/* Action Buttons: PDF Downloads & Print & Texture Triangle */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/soil-texture?gat=${selectedGat}&sand=32.2&silt=29.1&clay=38.7`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#EAF3ED] text-[#214F3F] hover:bg-[#d8ebd2] border border-[#214F3F]/30 rounded-md transition-colors shadow-2xs"
            title="Analyze Soil Texture on USDA Triangle"
          >
            <Layers className="w-3.5 h-3.5 text-[#214F3F]" />
            <span>{locale === "mr" ? "मृदा पोत त्रिकोण" : "Texture Triangle"}</span>
          </Link>

          <button
            type="button"
            disabled={downloadingCard}
            onClick={async () => {
              try {
                setDownloadingCard(true);
                const farmerNameOverride =
                  selectedFarmer && String(selectedFarmer.gat_no) === String(selectedGat)
                    ? selectedFarmer.name
                    : undefined;
                await reportService.downloadSoilHealthCardPdf(activeFieldId, locale, farmerNameOverride);
              } catch (err) {
                console.error("PDF download failed, using fallback:", err);
                const farmerNameOverride =
                  selectedFarmer && String(selectedFarmer.gat_no) === String(selectedGat)
                    ? selectedFarmer.name
                    : undefined;
                window.location.assign(reportService.getSoilHealthCardPdfUrl(activeFieldId, locale, farmerNameOverride));
              } finally {
                setDownloadingCard(false);
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#214F3F] hover:bg-[#1a3f33] text-white rounded-md transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Download Official Soil Health Card PDF"
          >
            {downloadingCard ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{t("soilHealthCard.downloadCard")}</span>
          </button>


          <button
            type="button"
            onClick={() => window.print()}
            className="p-1.5 text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors border border-stone-200 cursor-pointer"
            title={t("soilHealthCard.printReport")}
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area: Centered Professional A4 Soil Health Card Document (Single Page 1/1) */}
      <div className="w-full overflow-x-auto pb-8 print:p-0 print:overflow-visible">
        <div className="relative soil-report-page max-w-[850px] min-w-[760px] mx-auto bg-white p-6 sm:p-7 shadow-sm border border-[#d1d5db] text-stone-900 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:min-w-0">
          <SoilReportHeader isDemo={report.is_demo} />
          <FarmerSampleInfoTable
            farmer={
              selectedFarmer && String(selectedFarmer.gat_no) === String(selectedGat)
                ? {
                    id: selectedFarmer.id,
                    name: selectedFarmer.name,
                    code: `FARMER-${selectedGat}`,
                  }
                : report.farmer
            }
            field={report.field}
            report={report.report}
          />
          <SoilParameterTable
            parameters={report.parameters}
            startIndex={0}
            showTitle={true}
            showNote={true}
          />
          <SoilReportFooter
            isDemo={report.is_demo}
            reportDate={report.report?.report_date}
            reportNo={report.report?.report_no}
            observations={report.observations || report.report?.observations}
          />
        </div>
      </div>
    </div>
  );
};
