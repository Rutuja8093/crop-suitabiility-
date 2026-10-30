"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { RecommendationSummary } from "@/types/recommendation";
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

interface RecommendationsSummaryCardsProps {
  summary: RecommendationSummary;
}

export const RecommendationsSummaryCards: React.FC<RecommendationsSummaryCardsProps> = ({ summary }) => {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Parameters Reviewed */}
      <div className="p-4 rounded-xl bg-white border border-surface-border shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-surface-muted text-text-muted flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-soil-primary" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
            {t("recommendations.reviewed")}
          </span>
          <span className="text-xl sm:text-2xl font-black text-text-main">
            {summary.parameters_reviewed}
          </span>
        </div>
      </div>

      {/* Needing Attention */}
      <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
            {t("recommendations.needingAttention")}
          </span>
          <span className="text-xl sm:text-2xl font-black text-amber-900">
            {summary.parameters_needing_attention}
          </span>
        </div>
      </div>

      {/* High Priority */}
      <div className="p-4 rounded-xl bg-white border border-rose-200 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider block">
            {t("recommendations.highPriority")}
          </span>
          <span className="text-xl sm:text-2xl font-black text-rose-900">
            {summary.high_priority_count}
          </span>
        </div>
      </div>

      {/* Information Only */}
      <div className="p-4 rounded-xl bg-white border border-surface-border shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-soil-primaryLight text-soil-primary flex items-center justify-center shrink-0">
          <Info className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
            {t("recommendations.information")}
          </span>
          <span className="text-xl sm:text-2xl font-black text-soil-primary">
            {summary.info_count}
          </span>
        </div>
      </div>
    </div>
  );
};
