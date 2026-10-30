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
    <section className="bg-white rounded-2xl border border-[#E6E9E5] p-6 shadow-xs flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between border-b border-[#E6E9E5] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#EAF5EC] flex items-center justify-center text-[#0B4D2B]">
            <Map className="w-4 h-4 text-[#0B4D2B]" />
          </div>
          <h2 className="text-sm font-bold text-[#0B4D2B] tracking-wider uppercase">
            {t("dashboard.farmLocation")}
          </h2>
        </div>
        <Link
          href="/my-farm"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#176B38] hover:text-[#0B4D2B] transition-colors cursor-pointer"
        >
          <span>{t("common.viewDetails")}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Embedded Compact Field Map Preview */}
      <div className="w-full">
        <FarmMap previewMode={true} selectedGat={gatNo} className="h-44 sm:h-48" />
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#4A6B67] pt-1">
        <span>{formatGatLabel(gatNo, isMr)} • {t("myFarm.cadastralBoundary") || (isMr ? "भूमापन सीमा" : "Cadastral Boundary")}</span>
        <Link
          href="/my-farm"
          className="text-[#176B38] font-semibold hover:text-[#0B4D2B] hover:underline cursor-pointer"
        >
          {t("myFarm.title")} →
        </Link>
      </div>
    </section>
  );
};
