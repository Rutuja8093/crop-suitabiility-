"use client";

import React, { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RecommendationsView } from "@/components/recommendations/RecommendationsView";

export default function RecommendationsPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="max-w-5xl mx-auto py-12 text-center text-sm font-semibold text-stone-500">
            Loading Soil Recommendations...
          </div>
        }
      >
        <RecommendationsView />
      </Suspense>
    </ProtectedRoute>
  );
}
