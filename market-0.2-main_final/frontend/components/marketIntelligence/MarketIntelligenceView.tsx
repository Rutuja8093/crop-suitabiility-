"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useSelectedFarmer } from "@/context/FarmerContext";
import { useI18n } from "@/i18n/useI18n";
import {
  TrendingUp,
  LayoutDashboard,
  ChevronRight,
  Sprout,
  Coins,
  Calendar,
  CalendarDays,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { PlanningFilterState, CropCategory } from "@/types/marketIntelligence";
import { MarketIntelligenceHeader } from "./MarketIntelligenceHeader";
import { MarketOverviewCards } from "./MarketOverviewCards";
import { Next15DaysSection } from "./Next15DaysSection";
import { SeasonalPlannerSection } from "./SeasonalPlannerSection";
import { FieldSuitabilitySection } from "./FieldSuitabilitySection";
import { CropPlanningComparison } from "./CropPlanningComparison";
import { PriceTrendOutlook } from "./PriceTrendOutlook";
import { DataSourceReliability } from "./DataSourceReliability";

type NavigationTab = "find_crops" | "today_prices" | "plan_planting";

export const MarketIntelligenceView: React.FC = () => {
  const { location, field, farmer } = useAuth();
  const { selectedFarmer } = useSelectedFarmer();
  const { language } = useI18n();
  const isMr = language === "mr";

  // Three primary navigation options (default: Find Crops for My Farm)
  const [activeTab, setActiveTab] = useState<NavigationTab>("find_crops");

  // Planting options toggle within "Plan My Planting"
  const [plantingChoice, setPlantingChoice] = useState<"next15" | "seasonal">("next15");

  // Optional collapsible helper for Field Suitability & Historical Analysis
  const [showFieldSuitability, setShowFieldSuitability] = useState<boolean>(false);
  const [showPriceTrend, setShowPriceTrend] = useState<boolean>(false);

  // Active location context from auth
  const activeState = location?.state || "Maharashtra";
  const activeDistrict = location?.district || "Pune";
  const activeTaluka = location?.taluka || "Baramati";
  const activeVillage = location?.village || "Malegaon Kh";
  const activeGat = selectedFarmer?.gat_no || field?.gat_no || "18";
  const activeArea = field?.area ?? 2.48;

  // Local interactive filter state
  const [filters, setFilters] = useState<PlanningFilterState>({
    state: activeState,
    district: activeDistrict,
    taluka: activeTaluka,
    marketApmc: "Baramati APMC",
    horizon: "immediate",
    season: "rabi",
    cropCategory: "all",
    selectedCropId: "",
  });

  const handleFilterChange = (updated: Partial<PlanningFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
  };

  const cropCategories: { key: CropCategory; labelEn: string; labelMr: string }[] = [
    { key: "all", labelEn: "All Crops", labelMr: "सर्व पिके" },
    { key: "cash_crops", labelEn: "Cash Crops", labelMr: "नगदी पिके" },
    { key: "cereals", labelEn: "Cereals & Millets", labelMr: "धान्य" },
    { key: "oilseeds", labelEn: "Oilseeds", labelMr: "तेलबिया" },
    { key: "vegetables", labelEn: "Vegetables", labelMr: "भाजीपाला" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-semibold text-text-muted">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 hover:text-soil-primary transition-colors"
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-soil-primary" />
          <span>{isMr ? "डॅशबोर्ड" : "Dashboard"}</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-surface-borderStrong" />
        <span className="text-text-main font-bold">
          {isMr ? "बाजार भाव व पीक नियोजन" : "Market Intelligence & Crop Planner"}
        </span>
      </nav>

      {/* Simplified Page Header */}
      <MarketIntelligenceHeader
        state={filters.state}
        district={filters.district}
        taluka={filters.taluka}
        village={activeVillage}
        gatNo={activeGat}
      />

      {/* Exactly Three Main Navigation Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1.5 bg-white rounded-2xl border border-[#E6E9E5] shadow-xs">
        {/* Button 1: Find Crops for My Farm */}
        <button
          type="button"
          onClick={() => setActiveTab("find_crops")}
          className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "find_crops"
              ? "bg-[#176B38] text-white shadow-xs"
              : "text-[#4A6B67] hover:text-[#0B4D2B] hover:bg-[#F5F7F3]"
          }`}
          aria-pressed={activeTab === "find_crops"}
        >
          <Sprout className="w-4 h-4 shrink-0" />
          <span>{isMr ? "माझ्या शेतासाठी पिके शोधा" : "Find Crops for My Farm"}</span>
        </button>

        {/* Button 2: Today's Crop Prices */}
        <button
          type="button"
          onClick={() => setActiveTab("today_prices")}
          className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "today_prices"
              ? "bg-[#176B38] text-white shadow-xs"
              : "text-[#4A6B67] hover:text-[#0B4D2B] hover:bg-[#F5F7F3]"
          }`}
          aria-pressed={activeTab === "today_prices"}
        >
          <Coins className="w-4 h-4 shrink-0" />
          <span>{isMr ? "आजचे बाजार भाव" : "Today's Crop Prices"}</span>
        </button>

        {/* Button 3: Plan My Planting */}
        <button
          type="button"
          onClick={() => setActiveTab("plan_planting")}
          className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "plan_planting"
              ? "bg-[#176B38] text-white shadow-xs"
              : "text-[#4A6B67] hover:text-[#0B4D2B] hover:bg-[#F5F7F3]"
          }`}
          aria-pressed={activeTab === "plan_planting"}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span>{isMr ? "पेरणीचे नियोजन करा" : "Plan My Planting"}</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* SECTION A: FIND CROPS FOR MY FARM (Default) */}
      {/* ============================================================== */}
      <div className={activeTab === "find_crops" ? "space-y-6" : "hidden"}>
        {/* Category Filter Chips for Crops */}
        <div className="bg-white rounded-2xl border border-[#E6E9E5] p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#4A6B67]">
              {isMr ? "पीक वर्ग:" : "Crop Category:"}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {cropCategories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleFilterChange({ cropCategory: cat.key })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filters.cropCategory === cat.key
                      ? "bg-[#176B38] text-white shadow-2xs"
                      : "bg-[#F5F7F3] text-[#4A6B67] hover:text-[#0B4D2B] hover:bg-stone-100 border border-[#E6E9E5]"
                  }`}
                >
                  {isMr ? cat.labelMr : cat.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Collapsible toggle to inspect Soil Test & Cadastral Properties */}
          <button
            type="button"
            onClick={() => setShowFieldSuitability(!showFieldSuitability)}
            className="text-xs font-bold text-[#176B38] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {showFieldSuitability
                ? isMr ? "माती व शेत माहिती लपवा" : "Hide Soil & Parcel Data"
                : isMr ? "शेताची माती व स्थिती पहा" : "Check Soil & Parcel Conditions"}
            </span>
            {showFieldSuitability ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Optional Collapsible Field Suitability */}
        {showFieldSuitability && (
          <div className="animate-in fade-in duration-200">
            <FieldSuitabilitySection
              currentGat={activeGat}
              fieldId={field?.id ?? (selectedFarmer as any)?.field_id}
              farmerName={farmer?.name ?? selectedFarmer?.name}
              currentVillage={activeVillage}
              currentTaluka={activeTaluka}
              currentDistrict={activeDistrict}
              activeSeason={filters.season}
            />
          </div>
        )}

        {/* Main Crop Planning Options Comparison (Card View First) */}
        <CropPlanningComparison
          categoryFilter={filters.cropCategory}
          horizon={filters.horizon}
          season={filters.season}
          fieldAcreage={activeArea}
          currentGat={activeGat}
          fieldId={field?.id ?? (selectedFarmer as any)?.field_id}
          farmerName={farmer?.name ?? selectedFarmer?.name}
          currentVillage={activeVillage}
          currentTaluka={activeTaluka}
          currentDistrict={activeDistrict}
        />
      </div>

      {/* ============================================================== */}
      {/* SECTION B: TODAY'S CROP PRICES */}
      {/* ============================================================== */}
      <div className={activeTab === "today_prices" ? "space-y-6" : "hidden"}>
        {/* Single Clean & Readable Market Prices Table */}
        <MarketOverviewCards
          selectedDistrict={filters.district}
          selectedMarket={filters.marketApmc}
          selectedCommodity={filters.cropCategory !== "all" ? filters.cropCategory : "All Commodities"}
        />

        {/* Secondary Collapsible for Farmers Seeking Historical Price Trends */}
        <div className="bg-white rounded-2xl border border-[#E6E9E5] p-4 shadow-2xs">
          <button
            type="button"
            onClick={() => setShowPriceTrend(!showPriceTrend)}
            className="w-full flex items-center justify-between text-left text-xs font-bold text-[#1A2E22] hover:text-[#0B4D2B] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#176B38]" />
              <span>
                {isMr
                  ? "मागील बाजारभाव कल व स्त्रोत माहिती (ऐच्छिक)"
                  : "View Historical Price Trends & Data Sources (Optional)"}
              </span>
            </div>
            {showPriceTrend ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showPriceTrend && (
            <div className="pt-4 mt-4 border-t border-[#E6E9E5] space-y-6 animate-in fade-in duration-200">
              <PriceTrendOutlook
                selectedMarket={filters.marketApmc}
                selectedCommodity={isMr ? "निवडलेले पीक" : "Target Crop"}
                activeDistrict={filters.district}
              />
              <DataSourceReliability selectedMarket={filters.marketApmc} />
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION C: PLAN MY PLANTING */}
      {/* ============================================================== */}
      <div className={activeTab === "plan_planting" ? "space-y-6" : "hidden"}>
        {/* Two Clear Choices Toggle: Next 15 Days vs Seasonal Planning */}
        <div className="bg-white rounded-2xl border border-[#E6E9E5] p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-[#0B4D2B] tracking-tight">
              {isMr ? "पेरणी नियोजन कालावधी निवडा" : "Choose Planning Horizon"}
            </h3>
            <p className="text-xs text-[#4A6B67] mt-0.5">
              {isMr
                ? "पुढील १५ दिवसांतील तातडीची पेरणी किंवा आगामी हंगामासाठी नियोजन निवडा."
                : "Compare planting opportunities for the next 15 days or the upcoming growing season."}
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 p-1 bg-[#F5F7F3] rounded-xl border border-[#E6E9E5] self-start sm:self-auto">
            {/* Option 1: Next 15 Days */}
            <button
              type="button"
              onClick={() => {
                setPlantingChoice("next15");
                handleFilterChange({ horizon: "immediate" });
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                plantingChoice === "next15"
                  ? "bg-[#176B38] text-white shadow-2xs"
                  : "text-[#4A6B67] hover:text-[#0B4D2B] hover:bg-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isMr ? "पुढील १५ दिवस (तातडीचे)" : "Option 1: Next 15 Days"}</span>
            </button>

            {/* Option 2: Seasonal Planning */}
            <button
              type="button"
              onClick={() => {
                setPlantingChoice("seasonal");
                handleFilterChange({ horizon: "seasonal" });
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                plantingChoice === "seasonal"
                  ? "bg-[#176B38] text-white shadow-2xs"
                  : "text-[#4A6B67] hover:text-[#0B4D2B] hover:bg-white"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{isMr ? "हंगामी नियोजन (आगामी)" : "Option 2: Seasonal Planning"}</span>
            </button>
          </div>
        </div>

        {/* Option 1: Next 15 Days Component */}
        {plantingChoice === "next15" && (
          <Next15DaysSection
            currentVillage={activeVillage}
            currentGat={activeGat}
            fieldId={field?.id ?? (selectedFarmer as any)?.field_id}
          />
        )}

        {/* Option 2: Seasonal Planning Component */}
        {plantingChoice === "seasonal" && (
          <SeasonalPlannerSection
            activeSeason={filters.season}
            onSeasonSelect={(season) => handleFilterChange({ season })}
            gatNo={activeGat}
            fieldAcreage={activeArea}
            fieldId={field?.id ?? (selectedFarmer as any)?.field_id}
          />
        )}
      </div>
    </div>
  );
};
