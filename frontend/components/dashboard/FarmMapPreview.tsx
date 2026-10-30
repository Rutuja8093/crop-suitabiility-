"use client";

import React from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/useI18n";
import { FarmMap } from "@/components/map/FarmMap";
import { Map, ArrowRight } from "lucide-react";
import { formatGatLabel } from "@/i18n/marathiHelper";

interface FarmMapPreviewProps {
  gatNo: string;
}

export const FarmMapPreview: React.FC<FarmMapPreviewProps> = ({ gatNo }) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";

  return (
    <section className="bg-white rounded-2xl border border-surface-border p-6 shadow-card flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between border-b border-surface-border pb-3">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-soil-primary" />
          <h2 className="text-sm font-bold text-text-main tracking-wider uppercase">
            {t("dashboard.farmLocation")}
          </h2>
        </div>
        <Link
          href="/my-farm"
          className="inline-flex items-center gap-1 text-xs font-bold text-soil-primary hover:text-soil-primaryHover transition-colors cursor-pointer"
        >
          <span>{t("common.viewDetails")}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Embedded Compact Field Map Preview */}
      <div className="w-full">
        <FarmMap previewMode={true} selectedGat={gatNo} className="h-44 sm:h-48" />
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
        <span>{formatGatLabel(gatNo, isMr)} • {t("myFarm.cadastralBoundary") || (isMr ? "भूमापन सीमा" : "Cadastral Boundary")}</span>
        <Link
          href="/my-farm"
          className="text-soil-primary font-semibold hover:underline cursor-pointer"
        >
          {t("myFarm.title")} →
        </Link>
      </div>
    </section>
  );
};
