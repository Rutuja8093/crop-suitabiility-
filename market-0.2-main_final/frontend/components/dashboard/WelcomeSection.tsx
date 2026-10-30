"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { User, CheckCircle2 } from "lucide-react";
import { translateGeoName, translateFarmerName, formatGatLabel } from "@/i18n/marathiHelper";

interface WelcomeSectionProps {
  farmerName: string;
  gatNo: string;
  village: string;
  taluka: string;
  district: string;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  farmerName,
  gatNo,
  village,
  taluka,
  district,
}) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";

  return (
    <section className="bg-white rounded-2xl border border-[#E6E9E5] p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E9E5] pb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#EAF5EC] text-[#0B4D2B] flex items-center justify-center font-bold shadow-2xs shrink-0">
            <User className="w-6 h-6 text-[#0B4D2B]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#176B38]">
              {isMr ? "पुन्हा स्वागत आहे," : "Welcome back,"}
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B4D2B]">
              {translateFarmerName(farmerName, isMr)}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#4A6B67] mt-1">
              <span className="font-bold text-[#0B4D2B]">
                {formatGatLabel(gatNo, isMr)}
              </span>
              <span>•</span>
              <span>
                {t("geo.village")}: <strong className="text-[#1A2E22]">{translateGeoName(village, isMr)}</strong>
              </span>
              <span>•</span>
              <span>
                {t("geo.taluka")}: <strong className="text-[#1A2E22]">{translateGeoName(taluka, isMr)}</strong>
              </span>
              <span>•</span>
              <span>
                {t("geo.district")}: <strong className="text-[#1A2E22]">{translateGeoName(district, isMr)}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5EC] text-[#0B4D2B] text-xs font-semibold border border-[#CCD3CB] shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#176B38]" />
            <span>{t("dashboard.verifiedFarmerAccess")}</span>
          </span>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-[#4A6B67]">
        {t("dashboard.subtitle")}
      </p>
    </section>
  );
};
