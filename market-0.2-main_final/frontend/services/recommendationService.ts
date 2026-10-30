import { api } from "@/lib/api/client";
import { RecommendationsResponse } from "@/types/recommendation";

export const recommendationService = {
  /**
   * Fetch structured rule-based recommendations for a specific field.
   * Uses the backend /recommendations/field/{fieldId} endpoint.
   * The RecommendationsView component has a secondary client-side fallback
   * using the soil health service + shared soilRecommendations engine.
   */
  async getFieldRecommendations(fieldId: string | number): Promise<RecommendationsResponse> {
    const cleanId =
      typeof fieldId === "string" && fieldId.includes("gat-")
        ? fieldId
        : `demo-field-gat-${String(fieldId).replace(/[^\d]/g, "") || "15"}`;

    const response = await api.get<RecommendationsResponse>(`/recommendations/field/${cleanId}`);
    return response.data;
  },
};
