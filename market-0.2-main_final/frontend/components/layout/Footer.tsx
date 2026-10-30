"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { Sprout, MapPin, Award } from "lucide-react";

export const Footer: React.FC = () => {
  const { t } = useI18n();

  return (
    <footer className="w-full bg-white border-t border-surface-border mt-auto pt-10 pb-8 px-4 sm:px-6 lg:px-8 text-xs text-text-muted mb-16 md:mb-0">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          {/* LEFT: SoilPilot Brand & Short Description */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-soil-primary text-white flex items-center justify-center shrink-0">
                <Sprout className="w-5 h-5" />
              </div>
              <span className="text-base font-bold text-text-main">
                {t("brand.name")}
              </span>
            </div>
            <p className="font-medium text-soil-primary text-xs">
              {t("brand.subtitle")}
            </p>
            <p className="text-xs text-text-muted leading-relaxed max-w-sm">
              {t("footer.description") ||
                "Access digital soil mapping, nutrient diagnostics, and field-level soil health intelligence tailored to your land."}
            </p>
          </div>

          {/* CENTER: PILOT COVERAGE */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-text-main font-bold text-xs uppercase tracking-wider">
              <MapPin className="w-4 h-4 text-soil-primary shrink-0" />
              <span>{t("footer.coverageTitle")}</span>
            </div>
            <ul className="space-y-1.5 text-xs text-text-muted">
              <li>{t("footer.district")}</li>
              <li>{t("footer.taluka")}</li>
              <li>{t("footer.village")}</li>
              <li className="pt-1 text-[11px] text-soil-primary font-medium">
                {t("footer.expansion")}
              </li>
            </ul>
          </div>

          {/* RIGHT: SCIENTIFIC STANDARDS */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-text-main font-bold text-xs uppercase tracking-wider">
              <Award className="w-4 h-4 text-soil-primary shrink-0" />
              <span>{t("footer.standardsTitle")}</span>
            </div>
            <ul className="space-y-1.5 text-xs text-text-muted">
              <li>{t("footer.taxonomy")}</li>
              <li>{t("footer.testRules")}</li>
              <li>{t("footer.dsmModels")}</li>
            </ul>
          </div>
        </div>

        {/* BOTTOM: Copyright & Demo Disclaimer */}
        <div className="pt-6 border-t border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-text-light text-center sm:text-left">
          <p>{t("footer.copyright")}</p>
          <p className="text-text-muted font-medium">
            {t("footer.precision")}
          </p>
        </div>
      </div>
    </footer>
  );
};
