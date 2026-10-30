"use client";

import React, { useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { FileBadge, Gauge, LayoutList, Lightbulb, MapPin, Radar as RadarIcon } from "lucide-react";
import type { GatFeature, GatStats } from "@/types/gat";
import type { DSMRasterLayerId } from "@/types/gis";
import { PARAM_ORDER } from "@/lib/gis/gatStats";
import { formatValue } from "@/lib/gis/format";
import { RadarChart, RadarAxis } from "@/components/gat/RadarChart";
import { classifyParameter } from "@/lib/gis/soilClassification";
import { translateGeoName, translateStatus } from "@/i18n/marathiHelper";

interface GatSoilHealthPanelProps {
  gat?: GatFeature | null;
  stats?: GatStats | null;
  dsmStats?: any;
  fieldInfo?: any;
  loading?: boolean;
  className?: string;
}

/** Normalisation ceilings used only to plot the radar chart on a common 0-100 scale. */
const RADAR_CEIL: Partial<Record<DSMRasterLayerId, number>> = {
  ph: 8.5,
  soc: 2.0,
  nitrogen: 16.0,
  bd: 1.7,
  ndvi: 0.8,
  evi: 0.6,
};
const RADAR_KEYS: DSMRasterLayerId[] = ["ph", "soc", "nitrogen", "bd", "ndvi", "evi"];

/** Short, mutually distinct axis labels for the radar chart (full names collide, e.g. "Soil pH" / "Soil Organic Carbon"). */
const RADAR_LABEL: Partial<Record<DSMRasterLayerId, string>> = {
  ph: "pH",
  soc: "SOC",
  nitrogen: "Nitrogen",
  bd: "Bulk Density",
  ndvi: "NDVI",
  evi: "EVI",
};

const PARAM_UNIT: Partial<Record<DSMRasterLayerId, string>> = {
  ph: "pH",
  soc: "%",
  nitrogen: "mg/kg",
  bd: "g/cm³",
  ndvi: "index",
  evi: "index",
  elevation: "m",
  uncertainty: "% error",
};

type Tab = "matrix" | "variability";

export const GatSoilHealthPanel: React.FC<GatSoilHealthPanelProps> = ({
  gat,
  stats,
  dsmStats,
  fieldInfo,
  loading,
  className = "",
}) => {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("matrix");

  const effectiveGat: GatFeature | null =
    gat ||
    (fieldInfo || dsmStats
      ? {
          type: "Feature",
          id: String(fieldInfo?.gat_no || dsmStats?.gat_no || "12"),
          properties: {
            gat_id: String(fieldInfo?.gat_no || dsmStats?.gat_no || "12"),
            name: String(fieldInfo?.gat_no || dsmStats?.gat_no || "12"),
            description: null,
            area_sqm: dsmStats?.area_sqm || (fieldInfo?.area ? fieldInfo.area * 10000 : 161950.5),
            area_ha: dsmStats?.area_ha || fieldInfo?.area || 16.2,
            area_acres:
              dsmStats?.area_acres ||
              (fieldInfo?.area ? Number((fieldInfo.area * 2.47105).toFixed(2)) : 40.02),
            centroid: [74.58, 18.15],
            bounds: [74.57, 18.14, 74.59, 18.16],
            source: "sample",
            attributes: {
              village: fieldInfo?.village || "Malegaon Kh",
              taluka: fieldInfo?.taluka || "Baramati",
              district: fieldInfo?.district || "Pune",
            },
          },
          geometry: { type: "Polygon", coordinates: [] },
        }
      : null);

  const effectiveStats: GatStats | null =
    stats ||
    (dsmStats
      ? {
          gatId: String(dsmStats.gat_no || "12"),
          confidence: dsmStats.confidence ?? 91.2,
          params: PARAM_ORDER.reduce((acc, id) => {
            const p = dsmStats[id];
            if (p && typeof p === "object") {
              acc[id] = {
                layerId: id,
                mean: p.mean ?? 0,
                median: p.mean ?? 0,
                min: p.min ?? p.mean ?? 0,
                max: p.max ?? p.mean ?? 0,
                std: p.std ?? 0,
                p10: p.min ?? 0,
                p90: p.max ?? 0,
                count: p.count ?? 1720,
                classification: classifyParameter(id, p.mean ?? 0),
              };
            }
            return acc;
          }, {} as GatStats["params"]),
        }
      : null);

  if (!effectiveGat) {
    return (
      <div
        className={`bg-white rounded-2xl border border-surface-border p-6 shadow-card flex flex-col items-center justify-center text-center gap-2.5 min-h-[220px] ${className}`}
      >
        <div className="w-11 h-11 rounded-xl bg-soil-primaryLight flex items-center justify-center text-soil-primary">
          <FileBadge className="w-5 h-5" />
        </div>
        <p className="text-xs text-text-muted max-w-[220px]">{t("gat.card.selectPrompt")}</p>
      </div>
    );
  }

  const params = effectiveStats?.params ?? {};
  const hasAnyStat = Object.keys(params).length > 0;

  const radarAxes: RadarAxis[] = RADAR_KEYS.filter((k) => params[k]).map((k) => {
    const p = params[k]!;
    const ceil = RADAR_CEIL[k] ?? p.mean;
    return { label: RADAR_LABEL[k] ?? k, value: Math.min(100, Math.max(8, (p.mean / ceil) * 100)) };
  });

  return (
    <div className={`bg-white rounded-2xl border border-surface-border shadow-card overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-surface-border/70 bg-gradient-to-br from-soil-primaryLight/40 to-transparent">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-soil-primary uppercase tracking-wide">
              <FileBadge className="w-3 h-3" />
              <span>{t("gat.card.title")}</span>
            </div>
            <h3 className="text-lg font-black text-text-main mt-0.5 truncate">
              {t("geo.gatNo")} {effectiveGat.properties.name}
            </h3>
            <div className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {locale === "mr" ? translateGeoName(effectiveGat.properties.attributes?.village || "Malegaon Kh") : (effectiveGat.properties.attributes?.village || "Malegaon Kh")} &middot;{" "}
                {locale === "mr" ? translateGeoName(effectiveGat.properties.attributes?.taluka || "Baramati") : (effectiveGat.properties.attributes?.taluka || "Baramati")} &middot; {locale === "mr" ? "महाराष्ट्र" : "Maharashtra"}
              </span>
            </div>
          </div>
          {effectiveStats?.confidence !== null && effectiveStats?.confidence !== undefined && (
            <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
              <Gauge className="w-3.5 h-3.5" />
              <span>{effectiveStats.confidence}% {t("gat.card.confidence")}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <StatPill label={`${t("gat.card.area")} (${locale === "mr" ? "एकर" : "Ac"})`} value={String(effectiveGat.properties.area_acres)} />
          <StatPill label={`${t("gat.card.area")} (${locale === "mr" ? "हेक्टर" : "Ha"})`} value={String(effectiveGat.properties.area_ha)} />
          <StatPill label={`${t("gat.card.area")} (${locale === "mr" ? "चौ.मी." : "m²"})`} value={effectiveGat.properties.area_sqm.toLocaleString()} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-border/70 px-2">
        <TabButton active={tab === "matrix"} onClick={() => setTab("matrix")} icon={<LayoutList className="w-3.5 h-3.5" />}>
          {t("gat.card.tabs.matrix")}
        </TabButton>
        <TabButton active={tab === "variability"} onClick={() => setTab("variability")} icon={<RadarIcon className="w-3.5 h-3.5" />}>
          {t("gat.card.tabs.variability")}
        </TabButton>
      </div>

      <div className="p-4">
        {!hasAnyStat && (
          <p className="text-[11px] text-text-muted text-center py-4">
            {loading ? t("gat.kml.parsing") : t("gat.card.noRasterData")}
          </p>
        )}

        {hasAnyStat && tab === "matrix" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PARAM_ORDER.filter((id) => params[id]).map((id) => {
              const p = params[id]!;
              const cls = p.classification;
              const isDark = ["Optimal", "High", "Ideal", "Vigorous"].includes(cls.rating);
              return (
                <div key={id} className="rounded-xl border border-surface-border bg-surface-subtle/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-text-main truncate">{t(`dsm.layers.${id}.name`)}</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: cls.color, color: isDark ? "#052e16" : "#ffffff" }}
                    >
                      {locale === "mr" ? (cls.statusMr || translateStatus(cls.status, true)) : cls.status}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-mono font-extrabold text-text-main">
                      {formatValue(p.mean)} <span className="text-[10px] font-sans font-semibold text-text-muted">{PARAM_UNIT[id]}</span>
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {t("gat.card.range")}: {formatValue(p.min)}&ndash;{formatValue(p.max)}
                    </span>
                  </div>
                  <p className="flex items-start gap-1 text-[10.5px] text-text-muted mt-1.5 leading-snug">
                    <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    <span>{locale === "mr" ? (cls.adviceMr || cls.advice) : cls.advice}</span>
                  </p>
                  <p className="text-[9px] text-text-light mt-1">{t("gat.card.pixelCount", { count: p.count })}</p>
                </div>
              );
            })}
          </div>
        )}

        {hasAnyStat && tab === "variability" && (
          <div>
            <p className="text-[11px] text-text-muted mb-2">{t("gat.card.variabilityNote")}</p>
            {radarAxes.length >= 3 ? (
              <RadarChart axes={radarAxes} ariaLabel={`Gat ${effectiveGat.properties.name} soil fingerprint`} />
            ) : (
              <p className="text-[11px] text-text-muted text-center py-4">{t("gat.card.noRasterData")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const StatPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-white/80 border border-surface-border rounded-lg px-2 py-1.5 text-center">
    <div className="text-[9px] font-bold text-text-muted uppercase tracking-wide">{label}</div>
    <div className="text-xs font-mono font-extrabold text-text-main">{value}</div>
  </div>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }> = ({
  active,
  onClick,
  icon,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold border-b-2 transition-colors ${
      active ? "border-soil-primary text-soil-primary" : "border-transparent text-text-muted hover:text-text-main"
    }`}
  >
    {icon}
    {children}
  </button>
);
