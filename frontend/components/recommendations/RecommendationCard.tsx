"use client";

import React, { useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { RecommendationItem } from "@/types/recommendation";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Sprout,
  Leaf,
  Activity,
  Flame,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface RecommendationCardProps {
  item: RecommendationItem;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({ item }) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";
  const [showWhyItMatters, setShowWhyItMatters] = useState<boolean>(true);

  const title = isMr ? item.parameter_name_mr || item.parameter_name : item.parameter_name;
  const status = isMr ? item.status_mr || item.status : item.status;
  const observed = isMr ? item.what_observed_mr || item.what_observed : item.what_observed;
  const means = isMr ? item.what_it_means_mr || item.what_it_means : item.what_it_means;
  const action = isMr ? item.action_guidance_mr || item.action_guidance : item.action_guidance;
  const whyItMatters = isMr ? item.why_it_matters_mr || item.why_it_matters : item.why_it_matters;

  // Icon mapping
  const getIcon = () => {
    switch (item.parameter_key) {
      case "ph":
        return <FlaskConical className="w-5 h-5 text-soil-primary" />;
      case "organic_carbon":
        return <Leaf className="w-5 h-5 text-emerald-600" />;
      case "available_nitrogen":
        return <Sprout className="w-5 h-5 text-lime-600" />;
      case "available_phosphorus":
        return <Flame className="w-5 h-5 text-amber-600" />;
      case "available_potassium":
        return <Activity className="w-5 h-5 text-violet-600" />;
      default:
        return <FlaskConical className="w-5 h-5 text-soil-primary" />;
    }
  };

  // Priority badge styling — only display action-requiring priorities; remove "more info" tag
  const renderPriorityBadge = () => {
    if (item.priority_key === "high") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertCircle className="w-3.5 h-3.5" />
          {t("recommendations.priorityHigh")}
        </span>
      );
    }
    if (item.priority_key === "moderate") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          {t("recommendations.priorityModerate")}
        </span>
      );
    }
    // "more info" tag removed as requested
    return null;
  };

  // Source badge
  const renderSourceBadge = () => {
    let sourceText = item.source || "LAB OBSERVATION";
    if (sourceText.includes("LAB")) sourceText = t("recommendations.sourceLab");
    else if (sourceText.includes("DSM")) sourceText = t("recommendations.sourceDsm");
    else if (sourceText.includes("IMPORTED")) sourceText = t("recommendations.sourceImported");

    return (
      <span className="px-2 py-0.5 text-[10px] font-semibold text-text-muted bg-surface-muted border border-surface-border rounded-md">
        {sourceText}
      </span>
    );
  };

  const getStatusBadgeColor = () => {
    const s = item.status.toLowerCase();
    if (s.includes("low") || s.includes("deficient") || s.includes("acidic")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (s.includes("alkaline") || s.includes("saline") || s.includes("critical")) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    if (s.includes("very high")) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
    if (s.includes("medium")) {
      return "bg-sky-50 text-sky-700 border-sky-200";
    }
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  };

  return (
    <div
      className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-sm space-y-4 transition-all hover:shadow-hover ${
        item.priority_key === "high"
          ? "border-rose-200 hover:border-rose-300"
          : item.priority_key === "moderate"
          ? "border-amber-200 hover:border-amber-300"
          : "border-surface-border hover:border-soil-secondary/50"
      }`}
    >
      {/* Top Header: Icon, Title, Value, Priority, and Source */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-center shrink-0">
            {getIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-text-main">
                {title}
              </h3>
              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${getStatusBadgeColor()}`}>
                {status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
              <span>
                {item.value} {item.unit}
              </span>
              <span className="text-surface-borderStrong">•</span>
              {renderSourceBadge()}
            </div>
          </div>
        </div>

        {/* Priority Badge */}
        {renderPriorityBadge() && (
          <div className="shrink-0 flex items-center gap-2">
            {renderPriorityBadge()}
          </div>
        )}
      </div>

      {/* Observation & Meaning */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* What was observed */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-soil-primary block">
            {t("recommendations.whatObserved")}
          </span>
          <p className="text-xs font-semibold text-text-main leading-relaxed">
            {observed}
          </p>
        </div>

        {/* What it means */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
            {t("recommendations.whatItMeans")}
          </span>
          <p className="text-xs text-text-muted leading-relaxed">
            {means}
          </p>
        </div>
      </div>

      {/* Action Guidance: What You Can Consider */}
      <div className="p-4 rounded-xl bg-soil-cream/40 border border-soil-secondary/30 space-y-1.5">
        <div className="flex items-center gap-1.5 text-soil-primary font-bold text-xs">
          <Sprout className="w-4 h-4 text-soil-primary" />
          <span>{t("recommendations.whatYouCanConsider")}</span>
        </div>
        <p className="text-xs sm:text-sm font-medium text-text-main leading-relaxed">
          {action}
        </p>
      </div>

      {/* Why This Matters (Collapsible / Informational) */}
      {whyItMatters && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowWhyItMatters(!showWhyItMatters)}
            className="flex items-center justify-between w-full text-left text-xs font-semibold text-text-muted hover:text-soil-primary transition-colors py-1"
          >
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-soil-primary" />
              <span>{t("recommendations.whyThisMatters")}</span>
            </div>
            {showWhyItMatters ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showWhyItMatters && (
            <p className="text-xs text-text-muted leading-relaxed mt-1.5 pl-5 border-l-2 border-soil-primary/40 italic">
              {whyItMatters}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
