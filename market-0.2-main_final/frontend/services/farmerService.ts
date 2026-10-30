import { api } from "@/lib/api/client";
import {
  AssociatedFarmerItem,
  GatFarmersResponse,
  GatOptionItem,
  VillageGatsResponse,
} from "@/types/farmer";

export interface GatFarmerLookupParams {
  gatNo: string;
  village?: string;
  villageId?: number;
  taluka?: string;
}

interface StaticGatFarmersPayload {
  total_records: number;
  total_gats: number;
  by_gat: Record<string, Array<{ id: number | string; name: string; gat_no: string; village: string }>>;
}

let cachedGatFarmersData: StaticGatFarmersPayload | null = null;

async function loadStaticGatFarmers(): Promise<StaticGatFarmersPayload | null> {
  if (cachedGatFarmersData) return cachedGatFarmersData;
  try {
    const res = await fetch("/data/gat_farmers.json");
    if (res.ok) {
      cachedGatFarmersData = (await res.json()) as StaticGatFarmersPayload;
      return cachedGatFarmersData;
    }
  } catch (err) {
    console.warn("Could not load /data/gat_farmers.json fallback:", err);
  }
  return null;
}

export const farmerService = {
  /**
   * Fetches all registered farmer names for a specific Gat number in a given village.
   * Handles Marathi Unicode characters, integer/string Gat formats, and strict village filtering.
   * Uses backend API with automatic client-side static dataset fallback if backend is offline.
   */
  async getFarmersByGat(
    paramsOrGat: string | GatFarmerLookupParams,
    optionalVillage?: string,
    signal?: AbortSignal
  ): Promise<GatFarmersResponse> {
    const queryParams: Record<string, any> = {};

    if (typeof paramsOrGat === "object") {
      queryParams.gat_no = paramsOrGat.gatNo.trim();
      if (paramsOrGat.village) queryParams.village = paramsOrGat.village.trim();
      if (paramsOrGat.villageId) queryParams.village_id = paramsOrGat.villageId;
      if (paramsOrGat.taluka) queryParams.taluka = paramsOrGat.taluka.trim();
    } else {
      queryParams.gat_no = (paramsOrGat || "").trim();
      if (optionalVillage) queryParams.village = optionalVillage.trim();
    }

    try {
      const response = await api.get<GatFarmersResponse>("/farmers/by-gat", {
        params: queryParams,
        signal,
      });
      return response.data;
    } catch (apiErr: any) {
      if (apiErr?.name === "CanceledError" || apiErr?.name === "AbortError") {
        throw apiErr;
      }

      // Robust fallback to official static gat_farmers.json
      try {
        const data = await loadStaticGatFarmers();
        if (data && data.by_gat) {
          const rawGat = String(queryParams.gat_no || "");
          const cleanNum = rawGat.replace(/[^\d]/g, "") || rawGat;
          const rawList =
            data.by_gat[cleanNum] ||
            data.by_gat[rawGat] ||
            data.by_gat[`Gat ${cleanNum}`] ||
            [];

          const farmers: AssociatedFarmerItem[] = rawList.map((f) => ({
            id: f.id,
            name: f.name,
          }));

          return {
            village: queryParams.village || "Malegaon Khurd",
            village_id: queryParams.village_id || 87,
            gat_no: queryParams.gat_no,
            total: farmers.length,
            farmers,
          };
        }
      } catch (fallbackErr) {
        console.warn("Static Gat farmers fallback failed:", fallbackErr);
      }

      throw apiErr;
    }
  },

  /**
   * Fetches the complete list of available Gat numbers and farmer counts for a village.
   * Useful for autocomplete, selectors, and quick navigation.
   */
  async getAvailableGats(
    village: string = "Malegaon Khurd",
    villageId?: number
  ): Promise<VillageGatsResponse> {
    const queryParams: Record<string, any> = {};
    if (village) queryParams.village = village.trim();
    if (villageId) queryParams.village_id = villageId;

    try {
      const response = await api.get<VillageGatsResponse>("/farmers/gats", {
        params: queryParams,
      });
      return response.data;
    } catch (apiErr) {
      // Robust fallback to official static gat_farmers.json
      try {
        const data = await loadStaticGatFarmers();
        if (data && data.by_gat) {
          const gats: GatOptionItem[] = Object.keys(data.by_gat)
            .sort((a, b) => {
              const numA = parseInt(a.replace(/[^\d]/g, ""), 10) || 0;
              const numB = parseInt(b.replace(/[^\d]/g, ""), 10) || 0;
              return numA - numB;
            })
            .map((gat_no) => ({
              gat_no,
              farmer_count: data.by_gat[gat_no]?.length || 0,
            }));

          return {
            village: village || "Malegaon Khurd",
            village_id: villageId || 87,
            total_gats: gats.length,
            total_farmers: data.total_records || 0,
            gats,
          };
        }
      } catch (fallbackErr) {
        console.warn("Static Gat list fallback failed:", fallbackErr);
      }

      throw apiErr;
    }
  },
};
