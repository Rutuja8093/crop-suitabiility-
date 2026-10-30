"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";

interface SoilReportHeaderProps {
  isDemo?: boolean;
}

export const SoilReportHeader: React.FC<SoilReportHeaderProps> = () => {
  const { locale } = useI18n();

  return (
    <div className="mb-3 text-center pt-0 print:pt-0">
      {/* 1. ADT AI TRAINING FOUNDATION, BARAMATI - Bold Dark Green Title */}
      <h1 className="text-xl sm:text-[23px] font-black text-[#214F3F] uppercase tracking-wide print:text-lg">
        {locale === "mr" ? "एडीटी एआय ट्रेनिंग फाउंडेशन, बारामती" : "ADT AI TRAINING FOUNDATION, BARAMATI"}
      </h1>

      {/* 2. Pune, Maharashtra - Subheader */}
      <p className="text-xs sm:text-sm font-semibold text-[#334155] mt-0.5 print:text-[11px]">
        {locale === "mr" ? "पुणे, महाराष्ट्र" : "Pune, Maharashtra"}
      </p>

      {/* 3. SOIL TEST REPORT - Centered green bold heading */}
      <h2 className="text-base sm:text-lg font-black text-[#214F3F] uppercase tracking-wider mt-1.5 mb-3 print:text-base print:mb-2">
        {locale === "mr" ? "मृदा चाचणी अहवाल" : "SOIL TEST REPORT"}
      </h2>
    </div>
  );
};
