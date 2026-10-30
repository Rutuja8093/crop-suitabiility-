"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { Tractor, MapPin } from "lucide-react";
import { translateGeoName, formatGatLabel } from "@/i18n/marathiHelper";

interface FarmSummaryCardProps {
  gatNo: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  area: number | null;
  areaUnit?: string;
  isDemo?: boolean;
}

export const FarmSummaryCard: React.FC<FarmSummaryCardProps> = ({
  gatNo,
  village,
  taluka,
  district,
  state,
  area,
  areaUnit = "hectare",
  isDemo = false,
}) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";

  const isAcreUnit = areaUnit?.toLowerCase().includes("acre") || areaUnit?.toLowerCase() === "ac";
  const areaInAcres =
    area !== null && area !== undefined && area > 0
      ? (isAcreUnit ? area : Number((area * 2.47105).toFixed(2)))
      : null;

  const formattedArea =
    areaInAcres !== null
      ? `${areaInAcres} ${isMr ? "एकर" : "acres"}`
      : t("dashboard.notAvailable");

  return (
    <section className="bg-white rounded-2xl border border-[#E6E9E5] p-6 shadow-xs space-y-4 flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#E6E9E5] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#EAF5EC] flex items-center justify-center text-[#0B4D2B]">
            <Tractor className="w-4 h-4 text-[#0B4D2B]" />
          </div>
          <h2 className="text-sm font-bold text-[#0B4D2B] tracking-wider uppercase">
            {t("dashboard.yourFarm")}
          </h2>
        </div>

        {isDemo && (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#FFF8CF] text-[#856404] border border-[#FFEBAA]">
            {t("common.demoData")}
          </span>
        )}
      </div>

      {/* Cadastral Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-[#F5F7F3] rounded-xl border border-[#E6E9E5] space-y-1">
          <span className="text-[#4A6B67] block font-medium">{t("geo.gatNo")}</span>
          <span className="text-base font-bold text-[#0B4D2B] block">
            {formatGatLabel(gatNo, isMr) || t("dashboard.notAvailable")}
          </span>
        </div>

        <div className="p-3 bg-[#F5F7F3] rounded-xl border border-[#E6E9E5] space-y-1">
          <span className="text-[#4A6B67] block font-medium">{t("dashboard.fieldArea")}</span>
          <span className="text-base font-bold text-[#1A2E22] block">
            {formattedArea}
          </span>
        </div>

        <div className="p-3 bg-[#F5F7F3] rounded-xl border border-[#E6E9E5] space-y-1">
          <span className="text-[#4A6B67] block font-medium">{t("geo.village")}</span>
          <span className="text-sm font-bold text-[#1A2E22] block truncate" title={village}>
            {translateGeoName(village, isMr) || t("dashboard.notAvailable")}
          </span>
        </div>

        <div className="p-3 bg-[#F5F7F3] rounded-xl border border-[#E6E9E5] space-y-1">
          <span className="text-[#4A6B67] block font-medium">{t("geo.taluka")}</span>
          <span className="text-sm font-bold text-[#1A2E22] block truncate" title={taluka}>
            {translateGeoName(taluka, isMr) || t("dashboard.notAvailable")}
          </span>
        </div>
      </div>

      {/* Administrative Hierarchy summary bar */}
      <div className="p-3 bg-[#F5F7F3] rounded-xl border border-[#E6E9E5] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-[#4A6B67]">
          <MapPin className="w-3.5 h-3.5 text-[#176B38]" />
          <span>{t("geo.district")} & {t("geo.state")}</span>
        </div>
        <span className="font-semibold text-[#1A2E22]">
          {translateGeoName(district || "Pune", isMr)}, {translateGeoName(state || "Maharashtra", isMr)}
        </span>
      </div>
    </section>
  );
};
