"use client";

import React, { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MarketIntelligenceView } from "@/components/marketIntelligence/MarketIntelligenceView";

export default function MarketIntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto py-16 text-center text-sm font-semibold text-text-muted animate-pulse">
          Loading Market Intelligence & Crop Planner...
        </div>
      }
    >
      <ProtectedRoute>
        <MarketIntelligenceView />
      </ProtectedRoute>
    </Suspense>
  );
}
