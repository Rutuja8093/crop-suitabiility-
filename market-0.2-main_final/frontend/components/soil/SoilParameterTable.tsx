"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { SoilParameter } from "@/types/soilHealth";
import {
  getConciseParameterRecommendation,
  getCleanReferenceRange,
  getCleanReferenceRangeMr,
} from "@/lib/soilRecommendations";
import { translateParamName, translateStatus } from "@/i18n/marathiHelper";

interface SoilParameterTableProps {
  parameters: SoilParameter[];
  startIndex?: number;
  showTitle?: boolean;
  showNote?: boolean;
}

export const SoilParameterTable: React.FC<SoilParameterTableProps> = ({
  parameters,
  startIndex = 0,
  showTitle = true,
  showNote = true,
}) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";

  const renderInterpretationText = (interpretation: string, statusCategory?: string) => {
    const lower = (interpretation || statusCategory || "").toLowerCase();

    // High -> Vibrant Blue
    if (lower.includes("high") || lower.includes("जास्त")) {
      return (
        <span className="font-bold text-[#1565c0]">
          {interpretation}
        </span>
      );
    }

    // Deficient / Critical -> Red / Crimson
    if (
      lower.includes("deficient") ||
      lower.includes("critical") ||
      lower.includes("कमतरता")
    ) {
      return (
        <span className="font-bold text-[#dc2626]">
          {interpretation}
        </span>
      );
    }

    // Low / Marginal -> Amber / Orange
    if (
      lower.includes("low") ||
      lower.includes("marginal") ||
      lower.includes("कमी") ||
      lower.includes("सीमांत")
    ) {
      return (
        <span className="font-bold text-[#c2410c]">
          {interpretation}
        </span>
      );
    }

    // Suitable, Non-saline, Normal, Medium, Sufficient, Moderate Density -> Bold Dark
    return (
      <span className="font-bold text-stone-900">
        {interpretation || "—"}
      </span>
    );
  };

  const formatObservedValue = (val: any) => {
    if (val === null || val === undefined) return "—";
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return num.toFixed(2);
  };

  const renderObservedValue = (param: SoilParameter) => {
    if (
      param.key === "soil_texture" ||
      param.key === "texture" ||
      String(param.value).toLowerCase().includes("clay vertisol")
    ) {
      return (
        <div className="leading-tight text-[10.5px]">
          <div>Clay</div>
          <div>Vertisol</div>
        </div>
      );
    }
    return formatObservedValue(param.value);
  };

  const renderUnit = (param: SoilParameter) => {
    if (param.key === "cec" || (param.unit && param.unit.includes("cmol(c)/kg"))) {
      return (
        <div className="leading-tight text-[10px]">
          <div>cmol(c)/</div>
          <div>kg</div>
        </div>
      );
    }
    return param.unit || "—";
  };

  if (!parameters || parameters.length === 0) {
    return (
      <div className="p-8 text-center bg-stone-50 border border-stone-300 rounded-md my-4">
        <p className="text-sm font-semibold text-stone-600">
          {t("soilHealthCard.noReportDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-2">
      {/* Main Table directly below Farmer Info Table matching reference image */}
      <div className="overflow-x-auto border border-[#cbd5e1] bg-white">
        <table className="w-full text-left text-xs border-collapse min-w-[720px] print:min-w-0 print:text-[9.5px]">
          <thead className="bg-[#214F3F] text-white uppercase text-[10.5px] print:text-[9px] tracking-wider font-sans font-bold">
            <tr>
              <th className="py-1.5 px-2 print:py-0.5 print:px-1 border-r border-[#2d6a4f] w-12 text-center">
                {isMr ? "अ.क्र." : "SR. NO."}
              </th>
              <th className="py-1.5 px-2.5 print:py-0.5 print:px-1.5 border-r border-[#2d6a4f] w-48">
                {isMr ? "घटक / निर्देशांक" : "PARAMETER"}
              </th>
              <th className="py-1.5 px-2 print:py-0.5 print:px-1 border-r border-[#2d6a4f] text-center w-26">
                {isMr ? "निरीक्षित मूल्य" : "OBSERVED VALUE"}
              </th>
              <th className="py-1.5 px-2 print:py-0.5 print:px-1 border-r border-[#2d6a4f] text-center w-18">
                {isMr ? "एकक" : "UNIT"}
              </th>
              <th className="py-1.5 px-2.5 print:py-0.5 print:px-1.5 border-r border-[#2d6a4f] w-32">
                {isMr ? "निष्कर्ष" : "INTERPRETATION"}
              </th>
              <th className="py-1.5 px-2.5 print:py-0.5 print:px-1.5 border-r border-[#2d6a4f] w-40">
                {isMr ? "संदर्भ श्रेणी" : "REFERENCE RANGE"}
              </th>
              <th className="py-1.5 px-2.5 print:py-0.5 print:px-1.5">
                {isMr ? "शिफारस" : "RECOMMENDATION"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#cbd5e1] font-sans">
            {parameters.map((param, index) => {
              const displayName =
                isMr
                  ? param.name_mr || translateParamName(param.key || param.name, true)
                  : param.name;
              const rawInterp = isMr && param.interpretation_mr ? param.interpretation_mr : param.interpretation;
              const displayInterp = isMr ? translateStatus(rawInterp, true) : (rawInterp?.includes("Clayey") ? "Clayey" : rawInterp);
              
              const numVal =
                typeof param.value === "number"
                  ? param.value
                  : param.value !== null && param.value !== undefined && !isNaN(Number(param.value))
                  ? Number(param.value)
                  : null;

              const fallbackRec = getConciseParameterRecommendation(
                param.key,
                numVal,
                param.interpretation,
                param.interpretation_mr,
              );
              const recText =
                isMr && param.recommendation_mr
                  ? param.recommendation_mr
                  : param.recommendation || (isMr ? fallbackRec.recommendation_mr : fallbackRec.recommendation);

              const rowNumber = param.sr_no || startIndex + index + 1;

              return (
                <tr
                  key={param.key || rowNumber}
                  className="bg-white hover:bg-stone-50/60 print:break-inside-avoid"
                >
                  <td className="py-1 px-2 print:py-0.5 print:px-1 border-r border-[#cbd5e1] text-center font-mono font-medium text-stone-700 text-[10.5px] print:text-[9px]">
                    {rowNumber}
                  </td>
                  <td className="py-1 px-2.5 print:py-0.5 print:px-1.5 border-r border-[#cbd5e1] text-stone-900 font-medium text-[10.5px] sm:text-[11px] print:text-[9.5px]">
                    {displayName}
                  </td>
                  <td className="py-1 px-2 print:py-0.5 print:px-1 border-r border-[#cbd5e1] text-center font-mono font-bold text-stone-950 text-[11px] print:text-[9.5px]">
                    {renderObservedValue(param)}
                  </td>
                  <td className="py-1 px-2 print:py-0.5 print:px-1 border-r border-[#cbd5e1] text-center text-stone-700 font-medium text-[10.5px] print:text-[9px]">
                    {renderUnit(param)}
                  </td>
                  <td className="py-1 px-2.5 print:py-0.5 print:px-1.5 border-r border-[#cbd5e1] text-[10.5px] sm:text-[11px] print:text-[9.5px]">
                    {param.value !== null && param.value !== undefined
                      ? renderInterpretationText(displayInterp, param.status_category)
                      : <span className="text-stone-400 italic">—</span>}
                  </td>
                  <td className="py-1 px-2.5 print:py-0.5 print:px-1.5 border-r border-[#cbd5e1] text-stone-800 text-[10.5px] sm:text-[11px] font-medium whitespace-pre-line leading-tight print:text-[9px]">
                    {isMr
                      ? getCleanReferenceRangeMr(param.key, param.reference_range)
                      : getCleanReferenceRange(param.key, param.reference_range)}
                  </td>
                  <td className="py-1 px-2.5 print:py-0.5 print:px-1.5 text-stone-800 leading-snug text-[10.5px] sm:text-[11px] print:text-[9px] print:leading-tight">
                    <span className="font-normal">{recText}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Prominent Bold Note below table matching reference image */}
      {showNote && (
        <p className="text-[#d32f2f] font-bold text-xs sm:text-[13px] mt-2.5 mb-1 print:mt-1.5 print:text-[10px] print:text-[#d32f2f]">
          {isMr
            ? "टीप: या अहवालातील मातीचे गुणधर्म व निष्कर्ष ०–३० सें.मी. मुळांच्या कार्यक्षेत्रातील खोलीवर आधारित आहेत."
            : "Note: Soil properties and interpretations in this report are based on the 0–30 cm root-zone soil depth."}
        </p>
      )}
    </div>
  );
};
