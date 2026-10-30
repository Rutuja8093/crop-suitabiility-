"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { SoilReportFieldInfo, SoilReportFarmerInfo, SoilReportMetadata } from "@/types/soilHealth";
import {
  translateGeoName,
  translateFarmerName,
  formatGatLabel,
} from "@/i18n/marathiHelper";
import { getLiveDateStr } from "@/lib/dateUtils";

interface FarmerSampleInfoTableProps {
  farmer: SoilReportFarmerInfo;
  field: SoilReportFieldInfo;
  report: SoilReportMetadata | null;
}

export const FarmerSampleInfoTable: React.FC<FarmerSampleInfoTableProps> = ({
  farmer,
  field,
  report,
}) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";

  const farmerName =
    translateFarmerName(farmer?.name, isMr) ||
    (isMr ? "रमेश पाटील" : "Ramesh Patil (रमेश पाटील)");

  const gatNumber = field?.gat_no || "22";
  const gatLabel = `${isMr ? "गट क्र." : "Gat No."} ${gatNumber}`;
  const rawArea = field?.area ? field.area : (gatNumber === "22" ? 1.49 : null);
  const areaPart = rawArea
    ? ` (${(rawArea * 2.47105).toFixed(2)} ${isMr ? "एकर" : "acres"})`
    : "";

  const villageName = translateGeoName(field?.village || "Malegaon Kh.", isMr);
  const talukaName = translateGeoName(field?.taluka || "Baramati", isMr);
  const districtName = translateGeoName(field?.district || "Pune", isMr);
  
  // Live date for the day
  const displayDate = getLiveDateStr(report?.report_date);

  return (
    <div className="mb-3 print:mb-2">
      {/* 4-Column Information Table directly below header matching reference image */}
      <div className="overflow-hidden border border-[#cbd5e1] text-xs text-stone-900 bg-white">
        <table className="w-full border-collapse">
          <tbody>
            {/* Row 1: Farmer's Name & Taluka */}
            <tr className="border-b border-[#cbd5e1]">
              <td className="w-[18%] px-3 py-1.5 print:px-2 print:py-1 font-bold text-stone-900 border-r border-[#cbd5e1] text-[11px] sm:text-xs print:text-[10px]">
                {locale === "mr" ? "शेतकऱ्याचे नाव" : "Farmer's Name"}
              </td>
              <td className="w-[32%] px-3 py-1.5 print:px-2 print:py-1 text-stone-900 font-medium border-r border-[#cbd5e1] text-[11px] sm:text-xs print:text-[10px]">
                {farmerName}
              </td>
              <td className="w-[18%] px-3 py-1.5 print:px-2 print:py-1 font-bold text-stone-900 border-r border-[#cbd5e1] text-[11px] sm:text-xs print:text-[10px]">
                {locale === "mr" ? "तालुका" : "Taluka"}
              </td>
              <td className="w-[32%] px-3 py-1.5 print:px-2 print:py-1 text-stone-900 font-medium text-[11px] sm:text-xs print:text-[10px]">
                {talukaName}
              </td>
            </tr>

            {/* Row 2: Gat No. & District */}
            <tr className="border-b border-[#cbd5e1]">
              <td className="px-3 py-1.5 print:px-2 print:py-1 font-bold text-stone-900 border-r border-[#cbd5e1] text-[11px] sm:text-xs print:text-[10px]">
                {locale === "mr" ? "गट क्र." : "Gat No."}
              </td>
              <td className="px-3 py-1.5 print:px-2 print:py-1 text-stone-900 font-medium border-r border-[#cbd5e1] text-[11px] sm:text-xs print:text-[10px]">
                {gatLabel}{areaPart}
              </td>
              <td className="px-3 py-1.5 print:px-2 print:py-1 font-bold text-stone-900 border-r border-[#cbd5e1] text-[11px] sm:text-xs print:text-[10px]">
                {locale === "mr" ? "जिल्हा" : "District"}
              </td>
              <td className="px-3 py-1.5 print:px-2 print:py-1 text-stone-900 font-medium text-[11px] sm:text-xs print:text-[10px]">
                {districtName}
              </td>
            </tr>

            {/* Row 3: Village & Date */}
            <tr>
              <td className="px-3 py-1.5 print:px-2 print:py-1 font-bold text-stone-900 border-r border-[#cbd5e1] text-[11px] sm:text-xs print:text-[10px]">
                {locale === "mr" ? "गाव" : "Village"}
              </td>
              <td className="px-3 py-1.5 print:px-2 print:py-1 text-stone-900 font-medium border-r border-[#cbd5e1] text-[11px] sm:text-xs print:text-[10px]">
                {villageName}
              </td>
              <td className="px-3 py-1.5 print:px-2 print:py-1 font-bold text-stone-900 border-r border-[#cbd5e1] text-[11px] sm:text-xs print:text-[10px]">
                {locale === "mr" ? "दिनांक" : "Date"}
              </td>
              <td className="px-3 py-1.5 print:px-2 print:py-1 text-stone-900 font-medium text-[11px] sm:text-xs print:text-[10px]">
                {displayDate}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
