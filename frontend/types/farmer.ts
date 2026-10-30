export interface AssociatedFarmerItem {
  id: number | string;
  name: string;
  source_row?: number;
}

export interface GatFarmersResponse {
  village: string;
  village_id?: number;
  gat_no: string;
  total: number;
  farmers: AssociatedFarmerItem[];
  message?: string;
}

export interface GatOptionItem {
  gat_no: string;
  farmer_count: number;
}

export interface VillageGatsResponse {
  village: string;
  village_id: number;
  total_gats: number;
  total_farmers: number;
  gats: GatOptionItem[];
}
