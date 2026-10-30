import { api } from "@/lib/api/client";

export interface CropItem {
  crop_code: string;
  crop_name: string;
  crop_name_mr: string;
  tolerance: string;
  category: string;
  parameters_count: number;
}

export interface LimitingFactor {
  parameter: string;
  class: "S1" | "S2" | "S3" | "N";
  value: any;
  unit: string;
  explanation: string;
}

export interface EvaluatedCriterion {
  parameter_key: string;
  parameter_name: string;
  unit: string;
  weight: number;
  value: any;
  suitability_class: "S1" | "S2" | "S3" | "N" | "UNCERTAIN";
  score: number | null;
  is_limiting: boolean;
  status: string;
  explanation: string;
  source: string;
}

export interface CropEvaluation {
  gat_no: string;
  field_id?: number | null;
  crop_code: string;
  crop_name: string;
  crop_name_mr: string;
  tolerance: string;
  category: string;
  final_suitability_class: "S1" | "S2" | "S3" | "N" | "UNCERTAIN";
  class_title: string;
  class_title_mr?: string;
  suitability_score: number;
  limiting_factors: LimitingFactor[];
  missing_inputs: string[];
  data_quality: {
    total_criteria: number;
    evaluated_criteria_count: number;
    missing_criteria_count: number;
    completeness_pct: number;
  };
  evaluated_criteria: EvaluatedCriterion[];
  rule_version: string;
}

export interface GatSuitabilityResponse {
  gat_no: string;
  village: string;
  area_ha?: number;
  area_acres?: number;
  centroid?: [number, number];
  bounds?: [number, number, number, number];
  soil_indicators: Record<string, any>;
  weather_indicators: Record<string, any>;
  evaluations: CropEvaluation[];
  timestamp: string;
}

export interface ClassSummaryItem {
  count: number;
  percentage_gats: number;
  area_ha: number;
  area_acres: number;
}

export interface CropAllGatsResponse {
  crop_code: string;
  crop_name: string;
  crop_name_mr: string;
  tolerance: string;
  category: string;
  total_gats: number;
  total_area_ha: number;
  total_area_acres: number;
  class_summary: {
    S1: ClassSummaryItem;
    S2: ClassSummaryItem;
    S3: ClassSummaryItem;
    N: ClassSummaryItem;
    UNCERTAIN: ClassSummaryItem;
  };
  gats: Array<{
    gat_no: string;
    area_ha: number;
    area_acres: number;
    centroid?: [number, number];
    bounds?: [number, number, number, number];
    final_suitability_class: "S1" | "S2" | "S3" | "N" | "UNCERTAIN";
    suitability_score: number;
    limiting_factors: LimitingFactor[];
    missing_inputs: string[];
  }>;
}

export interface WeatherSummaryResponse {
  metadata: Record<string, any>;
  baseline_period: string;
  historical_30yr: {
    annual_rainfall_mm: number;
    annual_rainfall_min_mm: number;
    annual_rainfall_max_mm: number;
    annual_rainfall_std_mm: number;
    kharif_rainfall_mm: number;
    rabi_rainfall_mm: number;
    mean_temperature_c: number;
    mean_max_temperature_c: number;
    mean_min_temperature_c: number;
    relative_humidity_pct: number;
    reference_et0_annual_mm: number;
    vpd_mean_kpa: number;
    mean_rainy_days_count: number;
  };
  recent_period_2016_2025: {
    annual_rainfall_mm: number;
    annual_rainfall_min_mm: number;
    annual_rainfall_max_mm: number;
    mean_temperature_c: number;
  };
  quality_reports: Record<string, any>;
}

export const cropSuitabilityService = {
  async getCrops(): Promise<CropItem[]> {
    const res = await api.get<CropItem[]>("/crop-suitability/crops");
    return res.data;
  },

  async getCropRules(cropCode: string): Promise<any> {
    const res = await api.get(`/crop-suitability/crops/${cropCode}`);
    return res.data;
  },

  async getWeatherSummary(): Promise<WeatherSummaryResponse> {
    const res = await api.get<WeatherSummaryResponse>("/crop-suitability/weather-summary");
    return res.data;
  },

  async getGatSuitability(gatNo: string, irrigationAvailable: boolean = true): Promise<GatSuitabilityResponse> {
    const res = await api.get<GatSuitabilityResponse>(`/crop-suitability/gat/${gatNo}`, {
      params: { irrigation_available: irrigationAvailable },
    });
    return res.data;
  },

  async getCropAllGats(cropCode: string, irrigationAvailable: boolean = true): Promise<CropAllGatsResponse> {
    const res = await api.get<CropAllGatsResponse>(`/crop-suitability/crop/${cropCode}`, {
      params: { irrigation_available: irrigationAvailable },
    });
    return res.data;
  },

  async getCropGeoJSON(cropCode: string, irrigationAvailable: boolean = true): Promise<any> {
    const res = await api.get(`/crop-suitability/crop/${cropCode}/geojson`, {
      params: { irrigation_available: irrigationAvailable },
    });
    return res.data;
  },

  getExportCsvUrl(cropCode?: string, gatNo?: string): string {
    const base = (api.defaults.baseURL || "/api/v1").replace(/\/$/, "");
    const params = new URLSearchParams();
    if (cropCode) params.set("crop_code", cropCode);
    if (gatNo) params.set("gat_no", gatNo);
    return `${base}/crop-suitability/export/csv?${params.toString()}`;
  },

  async refreshCache(): Promise<any> {
    const res = await api.post("/crop-suitability/refresh");
    return res.data;
  },
};
