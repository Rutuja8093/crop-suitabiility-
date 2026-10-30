"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/useI18n";
import { Lightbulb, FileText, MapPin, Sparkles } from "lucide-react";

import { translateGeoName } from "@/i18n/marathiHelper";

interface RecommendationsHeaderProps {
  village: string;
  gatNo: string;
  area?: number | null;
  areaUnit?: string | null;
  isDemo?: boolean;
}

export const RecommendationsHeader: React.FC<RecommendationsHeaderProps> = ({
  village,
  gatNo,
  area,
  areaUnit = "Ha",
  isDemo = false,
}) => {
  const { t, locale } = useI18n();

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Title & Description */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-soil-primaryLight text-soil-primary flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-text-main tracking-tight">
                {t("recommendations.title")}
              </h1>
              {isDemo && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  {t("common.demoData")}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-text-muted">
              {t("recommendations.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Field Details & Navigation Action */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Field Context Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-subtle border border-surface-border text-xs font-semibold text-text-main">
          <MapPin className="w-3.5 h-3.5 text-soil-primary shrink-0" />
          <span>{locale === "mr" ? translateGeoName(village || "Malegaon") : (village || "Malegaon")}</span>
          <span className="text-surface-borderStrong">•</span>
          <span className="text-soil-primary font-bold">
            {t("recommendations.gat")} {gatNo || "13"}
          </span>
          {area && (
            <>
              <span className="text-surface-borderStrong">•</span>
              <span className="text-text-muted">
                {(areaUnit?.toLowerCase().includes("acre") || areaUnit?.toLowerCase() === "ac"
                  ? area
                  : Number((Number(area) * 2.47105).toFixed(2))
                )} {locale === "mr" ? "एकर" : "acres"}
              </span>
            </>
          )}
        </div>

        {/* View Soil Health Card Action */}
        <Link
          href={`/soil-health-card?gat=${gatNo}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-soil-cream text-soil-primary border border-soil-secondary/40 hover:bg-soil-creamMuted text-xs font-bold transition-all shadow-xs"
        >
          <FileText className="w-3.5 h-3.5 text-soil-primary" />
          <span>{t("recommendations.viewSoilHealthCard")}</span>
        </Link>
      </div>
    </div>
  );
};
