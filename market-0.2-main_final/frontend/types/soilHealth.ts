export interface SoilParameter {
  sr_no: number;
  key: string;
  name: string;
  name_mr: string;
  category: 'Chemical' | 'Primary Nutrient' | 'Secondary Nutrient' | 'Micronutrient' | string;
  value: number | string | null;
  unit: string;
  interpretation: string;
  interpretation_mr?: string;
  reference_range: string;
  reference_range_mr?: string;
  recommendation?: string;
  recommendation_mr?: string;
  recommendation_detail?: string;
  recommendation_detail_mr?: string;
  status_category?: 'OPTIMAL' | 'GOOD' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH' | 'CRITICAL' | 'NOT AVAILABLE' | string;
  priority_rank?: number;
  priority_key?: 'high' | 'moderate' | 'info';
  source?: 'LAB OBSERVATION' | 'DSM PREDICTION' | 'IMPORTED DATA' | 'NOT AVAILABLE' | string;
  source_type?: string;
}

export interface KeyRecommendation {
  key?: string;
  name?: string;
  name_mr?: string;
  parameter?: string;
  parameter_key?: string;
  value?: number | null;
  unit?: string;
  status?: string;
  status_category: string;
  severity?: string;
  priority_rank: number;
  priority_key: string;
  recommendation: string;
  recommendation_mr?: string;
  action_guidance?: string;
}

export interface SoilReportFieldInfo {
  id: string | number;
  gat_no: string;
  area?: number | null;
  area_unit?: string | null;
  village: string;
  taluka: string;
  district: string;
  state: string;
}

export interface SoilReportFarmerInfo {
  id?: number | string | null;
  name: string;
  code?: string;
}

export interface SoilReportMetadata {
  id?: number | string | null;
  report_no: string;
  receipt_no: string;
  sample_name: string;
  sample_date: string;
  report_date: string;
  crop_name?: string | null;
  laboratory_name: string;
  organization_name?: string;
  center_name?: string;
  center_location?: string;
  is_demo: boolean;
  status: string;
  observations?: string[];
}

export interface SoilHealthReport {
  field: SoilReportFieldInfo;
  farmer: SoilReportFarmerInfo;
  has_report: boolean;
  is_demo: boolean;
  report: SoilReportMetadata | null;
  parameters: SoilParameter[];
  key_recommendations?: KeyRecommendation[];
  dsm_stats?: any;
  observations?: string[];
}

export interface SoilPrimarySummaryParam {
  name: string;
  name_mr: string;
  value: number | null;
  unit: string;
  interpretation: string;
  interpretation_mr?: string;
  source: string;
}

export interface SoilHealthSummary {
  field_id: string | number;
  has_report: boolean;
  is_demo: boolean;
  report_no?: string;
  report_date?: string;
  status: string;
  primary_parameters?: Record<string, SoilPrimarySummaryParam>;
  ph?: number | null;
  ph_status?: string;
  organic_carbon?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
}
