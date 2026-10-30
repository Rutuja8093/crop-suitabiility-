import { api } from "@/lib/api/client";

export interface StateItem {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

export interface DistrictItem {
  id: number;
  state_id: number;
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface TalukaItem {
  id: number;
  district_id: number;
  name: string;
  code: string | null;
  is_active: boolean;
}

export interface VillageItem {
  id: number;
  taluka_id: number;
  name: string;
  code: string | null;
  is_active: boolean;
}

export const PUNE_OFFICIAL_TALUKAS = [
  "Haveli",
  "Pune City",
  "Maval",
  "Mulshi",
  "Shirur",
  "Baramati",
  "Daund",
  "Indapur",
  "Bhor",
  "Velha",
  "Purandar",
  "Khed",
  "Junnar",
  "Ambegaon",
  "Pimpri-Chinchwad",
  "Loni Kalbhor",
] as const;

export const geographyService = {
  async getStates(): Promise<StateItem[]> {
    const response = await api.get<StateItem[]>("/geography/states");
    return response.data;
  },

  async getDistricts(stateId: number): Promise<DistrictItem[]> {
    const response = await api.get<DistrictItem[]>("/geography/districts", {
      params: { state_id: stateId },
    });
    return response.data;
  },

  async getTalukas(districtId?: number): Promise<TalukaItem[]> {
    const response = await api.get<TalukaItem[]>("/geography/talukas", {
      params: districtId ? { district_id: districtId } : {},
    });
    return response.data;
  },

  async getVillages(taluka: number | string): Promise<VillageItem[]> {
    const params: Record<string, any> = {};
    if (typeof taluka === "number") {
      params.taluka_id = taluka;
    } else {
      params.taluka = taluka;
    }
    const response = await api.get<VillageItem[]>("/geography/villages", {
      params,
    });
    return response.data;
  },
};
