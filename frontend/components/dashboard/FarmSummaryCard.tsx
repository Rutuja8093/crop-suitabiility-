"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { Tractor, Info, MapPin } from "lucide-react";
import { translateGeoName, translateUnit, formatGatLabel } from "@/i18n/marathiHelper";

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
    <section className="bg-white rounded-2xl border border-surface-border p-6 shadow-card space-y-4 flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-surface-border pb-3">
        <div className="flex items-center gap-2">
          <Tractor className="w-5 h-5 text-soil-primary" />
          <h2 className="text-sm font-bold text-text-main tracking-wider uppercase">
            {t("dashboard.yourFarm")}
          </h2>
        </div>

        {isDemo && (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-soil-cream text-soil-primary border border-soil-secondary/40 shadow-xs">
            {t("common.demoData")}
          </span>
        )}
      </div>

      {/* Cadastral Details Grid */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border space-y-1">
          <span className="text-text-muted block font-medium">{t("geo.gatNo")}</span>
          <span className="text-base font-bold text-text-main block">
            {formatGatLabel(gatNo, isMr) || t("dashboard.notAvailable")}
          </span>
        </div>

        <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border space-y-1">
          <span className="text-text-muted block font-medium">{t("dashboard.fieldArea")}</span>
          <span className="text-base font-bold text-text-main block">
            {formattedArea}
          </span>
        </div>

        <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border space-y-1">
          <span className="text-text-muted block font-medium">{t("geo.village")}</span>
          <span className="text-sm font-bold text-text-main block truncate" title={village}>
            {translateGeoName(village, isMr) || t("dashboard.notAvailable")}
          </span>
        </div>

        <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border space-y-1">
          <span className="text-text-muted block font-medium">{t("geo.taluka")}</span>
          <span className="text-sm font-bold text-text-main block truncate" title={taluka}>
            {translateGeoName(taluka, isMr) || t("dashboard.notAvailable")}
          </span>
        </div>
      </div>

      {/* Administrative Hierarchy summary bar */}
      <div className="p-3 bg-surface-muted rounded-xl border border-surface-border flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-text-muted">
          <MapPin className="w-3.5 h-3.5 text-soil-primary" />
          <span>{t("geo.district")} & {t("geo.state")}</span>
        </div>
        <span className="font-semibold text-text-main">
          {translateGeoName(district || "Pune", isMr)}, {translateGeoName(state || "Maharashtra", isMr)}
        </span>
      </div>
    </section>
  );
};
