"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  Calendar,
  Building2,
  Sparkles,
  Clock,
  CalendarDays,
  MapPin,
} from "lucide-react";
import {
  PlanningFilterState,
  SeasonType,
  CropCategory,
} from "@/types/marketIntelligence";

interface PlanningControlsProps {
  filters: PlanningFilterState;
  onFilterChange: (updated: Partial<PlanningFilterState>) => void;
  availableDistricts?: string[];
  availableTalukas?: string[];
  availableMarkets?: string[];
}

export const PlanningControls: React.FC<PlanningControlsProps> = ({
  filters,
  onFilterChange,
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";

  const cropCategories: { key: CropCategory; labelEn: string; labelMr: string }[] = [
    { key: "all", labelEn: "All Crops", labelMr: "सर्व पिके" },
    { key: "cash_crops", labelEn: "Cash Crops", labelMr: "नगदी पिके" },
    { key: "cereals", labelEn: "Cereals & Millets", labelMr: "धान्य व भरडधान्य" },
    { key: "pulses", labelEn: "Pulses", labelMr: "कडधान्ये" },
    { key: "oilseeds", labelEn: "Oilseeds", labelMr: "गळीत धान्य (तेलबिया)" },
    { key: "vegetables", labelEn: "Vegetables", labelMr: "भाजीपाला" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-surface-border shadow-sm overflow-hidden transition-all">
      {/* Top Bar: Planning Horizon Toggle & Fixed Baramati Scope */}
      <div className="p-4 sm:p-5 border-b border-surface-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-subtle/50">
        {/* Horizon Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-muted rounded-xl border border-surface-border w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onFilterChange({ horizon: "immediate" })}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              filters.horizon === "immediate"
                ? "bg-soil-primary text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-white/60"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isMr ? "पुढील १५ दिवस (तातडीचे नियोजन)" : "Next 15 Days (Immediate)"}</span>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ horizon: "seasonal" })}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              filters.horizon === "seasonal"
                ? "bg-soil-primary text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-white/60"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{isMr ? "हंगामी नियोजन (आगामी हंगाम)" : "Seasonal Planning"}</span>
          </button>
        </div>

        {/* Dedicated Baramati Pilot Badge */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-soil-primaryLight/80 border border-soil-primary/25 text-xs font-semibold text-soil-primary shadow-2xs">
            <Building2 className="w-4 h-4 text-soil-primary shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-soil-primary">
                {isMr ? "बारामती बाजार समिती" : "Baramati APMC"}
              </span>
              <span className="text-soil-primary/60 text-[11px]">•</span>
              <span className="text-text-muted text-[11px]">
                {isMr ? "पुणे, महाराष्ट्र" : "Pune, Maharashtra"}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-soil-primary text-white font-extrabold uppercase tracking-wider ml-1">
              {isMr ? "बारामती विशेष" : "Baramati Only"}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Body: Crop Categories & Seasonal Controls */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Row: Crop Category Filter & Season (when seasonal active) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-text-muted mr-1">
              {isMr ? "पीक वर्ग:" : "Crop Category:"}
            </span>
            {cropCategories.map((cat) => {
              const isActive = filters.cropCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => onFilterChange({ cropCategory: cat.key })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-soil-primary text-white font-semibold shadow-2xs"
                      : "bg-surface-subtle text-text-muted border border-surface-border hover:bg-surface-muted"
                  }`}
                >
                  {isMr ? cat.labelMr : cat.labelEn}
                </button>
              );
            })}
          </div>

          {/* Seasonal Horizon Switcher if seasonal horizon active */}
          {filters.horizon === "seasonal" && (
            <div className="flex items-center gap-1.5 bg-surface-subtle px-3 py-1.5 rounded-xl border border-surface-border text-xs">
              <Calendar className="w-3.5 h-3.5 text-soil-primary" />
              <span className="font-bold text-text-muted">{isMr ? "हंगाम:" : "Season:"}</span>
              <select
                value={filters.season}
                onChange={(e) => onFilterChange({ season: e.target.value as SeasonType })}
                className="bg-transparent text-xs font-bold text-soil-primary focus:outline-none cursor-pointer"
              >
                <option value="kharif">{isMr ? "खरीप (Kharif - पावसाळी)" : "Kharif (Monsoon)"}</option>
                <option value="rabi">{isMr ? "रब्बी (Rabi - हिवाळी)" : "Rabi (Winter)"}</option>
                <option value="zaid">{isMr ? "उन्हाळी (Zaid - Summer)" : "Zaid (Summer)"}</option>
              </select>
            </div>
          )}
        </div>

        {/* Operational integrity notice */}
        <div className="p-2.5 rounded-xl bg-surface-subtle/80 border border-surface-border/80 text-[11px] text-text-muted flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-soil-secondary shrink-0 mt-0.5" />
          <p>
            {isMr
              ? "टीप: बाजार भाव थेट बारामती कृषी उत्पन्न बाजार समिती (Baramati APMC / AGMARKNET) मधून संकलित केले जातात. सध्या ही प्रणाली फक्त बारामती क्षेत्रासाठी कार्यान्वित आहे."
              : "Note: Market rates are ingested directly for Baramati APMC (AGMARKNET / OGD India). Currently configured exclusively for Baramati."}
          </p>
        </div>
      </div>
    </div>
  );
};
