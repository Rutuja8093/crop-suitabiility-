"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/useI18n";
import { TrendingUp, MapPin, Radio, ShieldAlert } from "lucide-react";
import { translateGeoName, formatGatLabel } from "@/i18n/marathiHelper";

interface MarketIntelligenceHeaderProps {
  state?: string;
  district?: string;
  taluka?: string;
  village?: string;
  gatNo?: string;
}

export const MarketIntelligenceHeader: React.FC<MarketIntelligenceHeaderProps> = ({
  state = "Maharashtra",
  district = "Pune",
  taluka = "Baramati",
  village = "Malegaon Kh",
  gatNo = "",
}) => {
  const { t, language } = useI18n();
  const isMr = language === "mr";

  return (
    <div className="bg-white rounded-2xl border border-[#E6E9E5] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Title & Subtitle */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-[#EAF5EC] text-[#0B4D2B] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-[#0B4D2B]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B4D2B] tracking-tight">
              {isMr ? "बाजार भाव व पीक नियोजन" : "Market Intelligence & Crop Planner"}
            </h1>
            <p className="text-xs sm:text-sm text-[#4A6B67] mt-0.5">
              {isMr
                ? "बाजार भाव तपासा, संभाव्य नफ्याची तुलना करा आणि शेतात काय पिकवायचे याचे नियोजन करा."
                : "Check crop prices, compare possible profits, and plan what to grow on your farm."}
            </p>
          </div>
        </div>
      </div>

      {/* Location Context Pill */}
      <div className="flex items-center gap-2.5">
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F5F7F3] border border-[#E6E9E5] text-xs font-semibold text-[#1A2E22] shadow-2xs">
          <MapPin className="w-3.5 h-3.5 text-[#176B38] shrink-0" />
          <span>{translateGeoName(village, isMr)}</span>
          <span className="text-[#CCD3CB]">•</span>
          <span className="text-[#4A6B67]">{translateGeoName(taluka, isMr)}</span>
          {gatNo && (
            <>
              <span className="text-[#CCD3CB]">•</span>
              <span className="px-2 py-0.5 rounded-full bg-[#EAF5EC] text-[#0B4D2B] font-bold text-[11px] border border-[#CCD3CB]">
                {formatGatLabel(gatNo, isMr)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
