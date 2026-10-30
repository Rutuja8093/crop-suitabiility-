"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { getLiveDateStr } from "@/lib/dateUtils";

interface SoilReportFooterProps {
  isDemo?: boolean;
  reportDate?: string;
  reportNo?: string;
  observations?: string[];
}

export const SoilReportFooter: React.FC<SoilReportFooterProps> = ({
  reportDate,
  reportNo,
}) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";

  const displayRef = reportNo || "SPL/2026/SL-0104";
  const displayDate = getLiveDateStr(reportDate);

  return (
    <div className="pt-1 print:pt-0.5 break-inside-avoid page-break-inside-avoid">
      {/* Thin Divider Line */}
      <div className="w-full border-t border-[#214F3F] mb-2.5 print:mb-1.5" />

      {/* Report Info & Chemist Sign-Off (2-Column Balanced Layout) */}
      <div className="flex flex-row items-start justify-between gap-4 text-xs text-stone-800">
        <div className="space-y-0.5">
          <p className="font-bold text-stone-900 text-xs">
            {isMr ? "एडीटी एआय ट्रेनिंग फाउंडेशन, बारामती" : "ADT AI TRAINING FOUNDATION, BARAMATI"}
          </p>
          <p className="text-stone-600 text-[11px] print:text-[9.5px]">
            {isMr
              ? "कृषी निदान व डिजिटल मृदा परीक्षण केंद्र, बारामती / पुणे, महाराष्ट्र"
              : "Agricultural Diagnostic & Digital Soil Testing Center, Baramati / Pune, Maharashtra"}
          </p>
          <p className="text-stone-600 text-[11px] print:text-[9.5px]">
            {isMr ? "अहवाल संदर्भ" : "Report Ref"}: {displayRef} &bull; {isMr ? "दिनांक" : "Date"}: {displayDate}
          </p>
        </div>

        <div className="text-right space-y-0.5">
          <p className="font-bold text-stone-900 text-xs">
            {isMr ? "ए.बी.सी (मुख्य रसायनशास्त्रज्ञ)" : "A.B.C (Chief Chemist)"}
          </p>
          <p className="font-bold uppercase text-[10.5px] print:text-[9.5px] text-stone-900 tracking-wider">
            {isMr ? "अधिकृत मृदा परीक्षण रसायनशास्त्रज्ञ" : "AUTHORIZED SOIL TESTING CHEMIST"}
          </p>
          <p className="text-[10.5px] print:text-[9.5px] text-stone-600">
            {isMr ? "मृदा निदान व विश्लेषणात्मक रसायनशास्त्र विभाग" : "Soil Diagnostics & Analytical Chemistry Division"}
          </p>
        </div>
      </div>
    </div>
  );
};
