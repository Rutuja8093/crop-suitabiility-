import { api } from "@/lib/api/client";

export interface VillageBrief {
  id: number;
  name: string;
  taluka_id: number;
  taluka_name?: string | null;
  district_name?: string | null;
  state_name?: string | null;
}

export interface FarmerBrief {
  id: number;
  full_name: string;
  farmer_code: string;
}

export interface FieldResult {
  id: number;
  gat_no: string;
  area: number | null;
  area_unit: string;
  is_demo: boolean;
  is_active: boolean;
  geometry_wkt?: string | null;
  village: VillageBrief | null;
  farmer: FarmerBrief | null;
}

export interface GeoJSONGeometry {
  type: string;
  coordinates: any;
}

export interface AuthorizedFieldResponse {
  id: number;
  gat_no: string;
  area: number | null;
  area_ha?: number | null;
  area_acres?: number | null;
  area_unit: string;
  village: string;
  taluka: string;
  district: string;
  state: string;
  farmer_name: string | null;
  is_demo: boolean;
  geometry: GeoJSONGeometry | null;
}

export interface FieldLookupParams {
  gatNo: string;
  villageId?: number;
  villageName?: string;
  taluka?: string;
}

export const fieldService = {
  /**
   * Fetches the verified field details and boundary geometry for the active authenticated session.
   */
  async getAuthenticatedField(): Promise<AuthorizedFieldResponse> {
    const response = await api.get<AuthorizedFieldResponse>("/fields/me");
    return response.data;
  },

  async getFieldByGat(
    paramsOrVillageId: number | FieldLookupParams,
    optionalGatNo?: string
  ): Promise<FieldResult> {
    const queryParams: Record<string, any> = {};

    if (typeof paramsOrVillageId === "object") {
      queryParams.gat_no = paramsOrVillageId.gatNo.trim();
      if (paramsOrVillageId.villageId) queryParams.village_id = paramsOrVillageId.villageId;
      if (paramsOrVillageId.villageName) queryParams.village = paramsOrVillageId.villageName;
      if (paramsOrVillageId.taluka) queryParams.taluka = paramsOrVillageId.taluka;
    } else {
      queryParams.village_id = paramsOrVillageId;
      queryParams.gat_no = (optionalGatNo || "").trim();
    }

    const response = await api.get<FieldResult>("/fields/by-gat", {
      params: queryParams,
    });
    return response.data;
  },

  /**
   * Fetches the GeoJSON FeatureCollection of all farm plots in a village.
   * Tries backend API first; falls back to static public GeoJSON data.
   */
  async getVillageGeoJSON(params?: {
    villageId?: number;
    villageName?: string;
    taluka?: string;
  }): Promise<any> {
    try {
      const response = await api.get<any>("/fields/geojson", {
        params: {
          village_id: params?.villageId,
          village: params?.villageName,
          taluka: params?.taluka,
        },
      });
      if (response.data && response.data.features && response.data.features.length > 0) {
        return response.data;
      }
    } catch (e) {
      // Fallback to static public GeoJSON
    }

    try {
      const res = await fetch("/data/malegaon_plots.geojson");
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn("Could not load local malegaon_plots.geojson:", err);
    }
    return null;
  },
};

