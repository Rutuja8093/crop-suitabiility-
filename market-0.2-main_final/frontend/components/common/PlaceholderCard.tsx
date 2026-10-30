"use client";

import React, { ReactNode } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/useI18n";
import { ArrowLeft, Clock } from "lucide-react";

interface PlaceholderCardProps {
  title: string;
  description: string;
  phaseNotice: string;
  phaseTag: string;
  icon: ReactNode;
  children?: ReactNode;
}

export const PlaceholderCard: React.FC<PlaceholderCardProps> = ({
  title,
  description,
  phaseNotice,
  phaseTag,
  icon,
  children,
}) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Header breadcrumb / back */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-soil-primary hover:text-soil-primaryHover transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t("common.backToDashboard")}</span>
        </Link>

        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-soil-primaryLight text-soil-primary border border-soil-secondary/30">
          <Clock className="w-3.5 h-3.5" />
          {phaseTag}
        </span>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-surface-border p-6 md:p-8 shadow-card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-soil-primaryLight border border-soil-secondary/40 text-soil-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-main">
              {title}
            </h1>
            <p className="text-text-muted mt-1 text-sm md:text-base">
              {description}
            </p>
          </div>
        </div>

        {/* Phase notice box */}
        <div className="mt-8 rounded-lg bg-surface-subtle border border-surface-border p-5">
          <div className="flex items-start gap-3">
            <span className="px-2 py-0.5 rounded bg-soil-beige text-text-main font-semibold text-xs shrink-0 mt-0.5">
              {phaseTag}
            </span>
            <div className="space-y-2">
              <p className="text-sm md:text-base text-text-main font-medium">
                {phaseNotice}
              </p>
              <p className="text-xs text-text-light">
                {t("common.phase1Status")}
              </p>
            </div>
          </div>
        </div>

        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
};
