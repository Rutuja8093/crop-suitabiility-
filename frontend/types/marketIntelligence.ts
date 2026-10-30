/**
 * Market Intelligence & Crop Planner TypeScript Type Definitions
 * SoilPilot Phase 2: UI Design and Page Structure
 */

export type PlanningHorizon = "immediate" | "seasonal";

export type SeasonType = "kharif" | "rabi" | "zaid";

export type CropCategory = "all" | "cereals" | "pulses" | "oilseeds" | "cash_crops" | "vegetables";

export interface PlanningFilterState {
  state: string;
  district: string;
  taluka: string;
  marketApmc: string;
  horizon: PlanningHorizon;
  season: SeasonType;
  cropCategory: CropCategory;
  selectedCropId: string;
}

export interface MarketIndicatorSlot {
  key: string;
  labelKey: string;
  labelEn: string;
  labelMr: string;
  value: string | number | null;
  unit?: string;
  descriptionEn: string;
  descriptionMr: string;
  status: "connected" | "pending_integration";
}

export interface CropPlanningCardData {
  id: string;
  cropCode: string;
  nameEn: string;
  nameMr: string;
  category: CropCategory;
  categoryNameEn: string;
  categoryNameMr: string;
  suggestedSowingWindowEn: string;
  suggestedSowingWindowMr: string;
  expectedHarvestPeriodEn: string;
  expectedHarvestPeriodMr: string;
  durationDaysRange: string;
  expectedHarvestPriceRange: string;
  estimatedCultivationCost: string;
  estimatedGrossRevenue: string;
  estimatedNetReturn: string;
  waterRequirement: "Low" | "Medium" | "High" | "Pending Data Integration";
  laborRequirement: "Low" | "Moderate" | "Intensive" | "Pending Data Integration";
  riskLevel: "Low" | "Moderate" | "High" | "Pending Data Integration";
  fieldSuitability: "Suitable" | "Moderately Suitable" | "Not Recommended" | "Pending Data Integration";
  confidenceLevel: string;
  dataSource: string;
  isPlaceholder: boolean;
}

export interface DataReliabilityInfo {
  sourceName: string;
  sourceOwner: string;
  targetMarket: string;
  commoditySpec: string;
  observationDate: string | null;
  retrievalTimestamp: string | null;
  forecastTimestamp: string | null;
  feedStatus: "connected" | "pending_integration" | "delayed";
  statusNoticeEn: string;
  statusNoticeMr: string;
}
