"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { User, CheckCircle2 } from "lucide-react";
import { translateGeoName, translateFarmerName, formatGatLabel } from "@/i18n/marathiHelper";

interface WelcomeSectionProps {
  farmerName: string;
  gatNo: string;
  village: string;
  taluka: string;
  district: string;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  farmerName,
  gatNo,
  village,
  taluka,
  district,
}) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";

  return (
    <section className="bg-white rounded-2xl border border-surface-border p-6 shadow-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-soil-primaryLight border border-soil-secondary/30 text-soil-primary flex items-center justify-center font-bold shadow-xs">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-text-main">
              {t("dashboard.welcomeBack").replace("{name}", translateFarmerName(farmerName, isMr))}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted mt-1">
              <span className="font-bold text-soil-primary">
                {formatGatLabel(gatNo, isMr)}
              </span>
              <span>•</span>
              <span>
                {t("geo.village")}: <strong className="text-text-main">{translateGeoName(village, isMr)}</strong>
              </span>
              <span>•</span>
              <span>
                {t("geo.taluka")}: <strong className="text-text-main">{translateGeoName(taluka, isMr)}</strong>
              </span>
              <span>•</span>
              <span>
                {t("geo.district")}: <strong className="text-text-main">{translateGeoName(district, isMr)}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-soil-primaryLight text-soil-primary text-xs font-semibold border border-soil-secondary/30">
            <CheckCircle2 className="w-4 h-4" />
            <span>{t("dashboard.verifiedFarmerAccess")}</span>
          </span>
        </div>
      </div>

      <p className="text-xs sm:text-sm text-text-muted">
        {t("dashboard.subtitle")}
      </p>
    </section>
  );
};
