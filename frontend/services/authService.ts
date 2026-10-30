import { api } from "@/lib/api/client";

export interface FarmerSession {
  id: number;
  name: string;
  farmer_code: string;
  role?: string;
  gat_number?: string;
}

export interface FieldSession {
  id: number;
  gat_no: string;
  area: number | null;
  area_unit: string;
  is_demo?: boolean;
}

export interface LocationSession {
  state: string;
  district: string;
  taluka: string;
  village: string;
}

export interface GatLoginPayload {
  state_id: number;
  district_id: number;
  taluka_id: number;
  village_id: number;
  gat_no: string;
}

export interface RegisterPayload extends GatLoginPayload {
  full_name?: string;
  mobile_number?: string;
  preferred_language?: string;
}

export interface AuthSuccessResponse {
  success: boolean;
  message: string;
  token: string;
  field: FieldSession;
  farmer: FarmerSession | null;
  location: LocationSession;
}

export interface CurrentSessionResponse {
  authenticated: boolean;
  field: FieldSession;
  farmer: FarmerSession | null;
  location: LocationSession;
}

export const authService = {
  /**
   * Register a new farmer and permanently save Gat Number in profile and database.
   */
  async register(payload: RegisterPayload): Promise<AuthSuccessResponse> {
    const response = await api.post<AuthSuccessResponse>("/auth/register", payload);
    if (typeof window !== "undefined" && response.data?.token) {
      sessionStorage.setItem("soilpilot_token", response.data.token);
    }
    return response.data;
  },

  /**
   * Access farm and establish session via administrative hierarchy & Gat Number.
   */
  async gatLogin(payload: GatLoginPayload): Promise<AuthSuccessResponse> {
    const response = await api.post<AuthSuccessResponse>("/auth/gat-login", payload);
    if (typeof window !== "undefined" && response.data?.token) {
      sessionStorage.setItem("soilpilot_token", response.data.token);
    }
    return response.data;
  },

  /**
   * Retrieve active farmer session to restore state after page reload.
   */
  async getCurrentSession(): Promise<CurrentSessionResponse> {
    const response = await api.get<CurrentSessionResponse>("/auth/me");
    return response.data;
  },

  /**
   * Invalidate session on backend and clear client session token.
   */
  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } finally {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("soilpilot_token");
      }
    }
  },
};
