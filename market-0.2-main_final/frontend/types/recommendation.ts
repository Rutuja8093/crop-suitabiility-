export type RecommendationPriority = 'HIGH PRIORITY' | 'MODERATE' | 'INFORMATION';
export type RecommendationPriorityKey = 'high' | 'moderate' | 'info';

export interface SoilStatusItem {
  key: string;
  name: string;
  name_mr: string;
  value: number | null;
  unit: string;
  status: string;
  status_mr: string;
  is_available: boolean;
}

export interface RecommendationItem {
  parameter_key: string;
  parameter_name: string;
  parameter_name_mr: string;
  category: string;
  value: number;
  unit: string;
  status: string;
  status_mr: string;
  source: string;
  priority: RecommendationPriority;
  priority_key: RecommendationPriorityKey;
  needs_attention: boolean;
  what_observed: string;
  what_observed_mr: string;
  what_it_means: string;
  what_it_means_mr: string;
  action_guidance: string;
  action_guidance_mr: string;
  why_it_matters: string;
  why_it_matters_mr: string;
}

export interface RecommendationSummary {
  parameters_reviewed: number;
  parameters_needing_attention: number;
  high_priority_count: number;
  moderate_count: number;
  info_count: number;
}

export interface RecommendationsResponse {
  field: {
    id: string | number;
    gat_no: string;
    area?: number | null;
    area_unit?: string | null;
    village: string;
    taluka: string;
    district: string;
    state: string;
  };
  farmer: {
    id?: number | string | null;
    name: string;
    code?: string;
  };
  has_data: boolean;
  is_demo: boolean;
  summary: RecommendationSummary;
  soil_overview: SoilStatusItem[];
  recommendations: RecommendationItem[];
  message_en: string;
  message_mr: string;
}
