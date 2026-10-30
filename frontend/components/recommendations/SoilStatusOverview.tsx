"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { SoilStatusItem } from "@/types/recommendation";
import { Activity, FlaskConical, Leaf, Sprout, Flame } from "lucide-react";

interface SoilStatusOverviewProps {
  items: SoilStatusItem[];
}

export const SoilStatusOverview: React.FC<SoilStatusOverviewProps> = ({ items }) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("low") || s.includes("deficient") || s.includes("acidic") || s.includes("कमी")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (s.includes("alkaline") || s.includes("saline") || s.includes("विम्लधर्मी") || s.includes("धोकादायक")) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    if (s.includes("very high") || s.includes("अति जास्त")) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
    if (s.includes("medium") || s.includes("मध्यम")) {
      return "bg-sky-50 text-sky-700 border-sky-200";
    }
    if (s.includes("neutral") || s.includes("optimal") || s.includes("safe") || s.includes("normal") || s.includes("उदासीन") || s.includes("सुरक्षित")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    return "bg-stone-50 text-stone-700 border-stone-200";
  };

  const getIcon = (key: string) => {
    switch (key) {
      case "ph":
        return <FlaskConical className="w-4 h-4 text-soil-primary" />;
      case "organic_carbon":
        return <Leaf className="w-4 h-4 text-emerald-600" />;
      case "available_nitrogen":
        return <Sprout className="w-4 h-4 text-lime-600" />;
      case "available_phosphorus":
        return <Flame className="w-4 h-4 text-amber-600" />;
      case "available_potassium":
        return <Activity className="w-4 h-4 text-violet-600" />;
      default:
        return <FlaskConical className="w-4 h-4 text-soil-primary" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 sm:p-6 shadow-sm space-y-4">
      <div className="border-b border-surface-border pb-3">
        <h2 className="text-xs font-bold tracking-wider uppercase text-soil-primary">
          {t("recommendations.soilStatusOverview")}
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          {t("recommendations.soilStatusSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {items.map((item) => {
          const title = isMr ? item.name_mr || item.name : item.name;
          const statusText = isMr ? item.status_mr || item.status : item.status;
          const colorClass = getStatusColor(item.status);

          return (
            <div
              key={item.key}
              className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border flex flex-col justify-between space-y-2 hover:border-soil-secondary/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-text-muted truncate" title={title}>
                  {title}
                </span>
                <div className="w-6 h-6 rounded-md bg-white border border-surface-border flex items-center justify-center shrink-0">
                  {getIcon(item.key)}
                </div>
              </div>

              <div>
                {item.value !== null && item.value !== undefined ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-black text-text-main tracking-tight">
                      {item.value}
                    </span>
                    {item.unit && (
                      <span className="text-[11px] font-medium text-text-muted">
                        {item.unit}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-base font-bold text-text-light">
                    {t("recommendations.notAvailable")}
                  </div>
                )}
              </div>

              <div>
                <span
                  className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-md border ${colorClass}`}
                >
                  {statusText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
