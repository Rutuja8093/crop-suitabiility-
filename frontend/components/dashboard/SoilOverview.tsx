"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { soilHealthService } from "@/services/soilHealthService";
import { SoilHealthSummary } from "@/types/soilHealth";
import { FlaskConical, ArrowRight, ShieldCheck, Clock, CheckCircle2, Layers } from "lucide-react";
import { translateStatus } from "@/i18n/marathiHelper";
import { getLiveDateStr } from "@/lib/dateUtils";

export const SoilOverview: React.FC = () => {
  const { t, locale } = useI18n();
  const { field } = useAuth();

  const [summary, setSummary] = useState<SoilHealthSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const storedGat = typeof window !== "undefined" ? localStorage.getItem("soilpilot_selected_gat") : null;
  const activeGat = field?.gat_no || storedGat || "15";
  const fieldId = field?.id ? String(field.id) : `demo-field-gat-${activeGat}`;

  useEffect(() => {
    let isMounted = true;
    async function loadSummary() {
      try {
        setLoading(true);
        const data = await soilHealthService.getFieldSummary(fieldId);
        if (isMounted) {
          setSummary(data);
        }
      } catch (err) {
        console.error("Failed to load dashboard soil summary:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadSummary();
    return () => {
      isMounted = false;
    };
  }, [fieldId]);

  const hasReport = summary?.has_report ?? false;
  const isMr = locale === "mr";

  const metrics = [
    {
      label: isMr ? "मातीचा सामू (pH)" : "Soil pH",
      value: hasReport && summary?.ph !== undefined && summary?.ph !== null ? summary.ph : t("dashboard.notAvailable"),
      unit: "pH",
      status: hasReport ? (isMr ? translateStatus(summary?.ph_status || "Alkaline", true) : (summary?.ph_status || "Alkaline")) : t("dashboard.pending"),
      statusColor: "text-amber-800 bg-amber-100 border-amber-300",
    },
    {
      label: isMr ? "सेंद्रिय कर्ब (OC)" : "Organic Carbon",
      value: hasReport && summary?.organic_carbon !== undefined && summary?.organic_carbon !== null ? `${summary.organic_carbon}%` : t("dashboard.notAvailable"),
      unit: "% SOC",
      status: hasReport ? (isMr ? "अति जास्त" : "Very High") : t("dashboard.pending"),
      statusColor: "text-emerald-800 bg-emerald-100 border-emerald-300",
    },
    {
      label: isMr ? "उपलब्ध नत्र (N)" : "Available Nitrogen",
      value: hasReport && summary?.nitrogen !== undefined && summary?.nitrogen !== null ? `${summary.nitrogen}` : t("dashboard.notAvailable"),
      unit: "kg/ha",
      status: hasReport ? (isMr ? "कमी" : "Low") : t("dashboard.pending"),
      statusColor: "text-rose-800 bg-rose-100 border-rose-300",
    },
    {
      label: isMr ? "उपलब्ध स्फुरद (P)" : "Available Phosphorus",
      value: hasReport && summary?.phosphorus !== undefined && summary?.phosphorus !== null ? `${summary.phosphorus}` : t("dashboard.notAvailable"),
      unit: "kg/ha",
      status: hasReport ? (isMr ? "मध्यम" : "Medium") : t("dashboard.pending"),
      statusColor: "text-amber-800 bg-amber-100 border-amber-300",
    },
    {
      label: isMr ? "उपलब्ध पालाश (K)" : "Available Potassium",
      value: hasReport && summary?.potassium !== undefined && summary?.potassium !== null ? `${summary.potassium}` : t("dashboard.notAvailable"),
      unit: "kg/ha",
      status: hasReport ? (isMr ? "अति जास्त" : "Very High") : t("dashboard.pending"),
      statusColor: "text-emerald-800 bg-emerald-100 border-emerald-300",
    },
  ];

  return (
    <section className="bg-white rounded-2xl border border-surface-border p-6 shadow-card space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-soil-primary" />
          <h3 className="text-base font-bold text-text-main">
            {isMr ? "मृदा आरोग्य सारांश" : "Soil Health Summary"}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {summary?.is_demo && (
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
              {t("common.demoData")}
            </span>
          )}
          <Link
            href="/soil-texture"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-soil-primary bg-soil-primaryLight rounded-lg border border-soil-primary/20 hover:bg-soil-primary hover:text-white transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isMr ? "मृदा पोत त्रिकोण" : "Texture Triangle"}</span>
          </Link>
          <Link
            href={field?.id ? `/soil-health-card/${field.id}` : "/soil-health-card"}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-soil-primary hover:text-soil-primaryHover hover:underline"
          >
            <span>{isMr ? "संपूर्ण पत्रिका पहा" : "View Full Card"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Notice / Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-text-muted">
        <p>
          {hasReport
            ? (isMr
                ? "आपल्या शेताच्या माती परीक्षणाचे नवीनतम प्रमाणित निष्कर्ष."
                : "Latest certified laboratory soil test diagnostic indicators for your field parcel.")
            : t("dashboard.soilOverviewNotice")}
        </p>
        {hasReport && summary?.report_no && (
          <span className="font-mono text-[11px] text-stone-500 font-medium">
            {isMr ? "संदर्भ:" : "Ref:"} {summary.report_no} ({getLiveDateStr(summary.report_date)})
          </span>
        )}
      </div>

      {/* Primary Metrics Grid (pH, OC, N, P, K) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
        {metrics.map((metric, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-1.5 flex flex-col justify-between transition-shadow hover:shadow-xs"
          >
            <div>
              <span className="text-xs text-text-muted font-medium block truncate">
                {metric.label}
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-lg font-black text-text-main font-mono">
                  {loading ? "..." : metric.value}
                </span>
                <span className="text-[11px] text-text-light font-mono">
                  {metric.unit}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between text-[11px]">
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                  hasReport ? metric.statusColor : "text-amber-700 bg-amber-50 border-amber-200"
                }`}
              >
                {loading ? "..." : metric.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
