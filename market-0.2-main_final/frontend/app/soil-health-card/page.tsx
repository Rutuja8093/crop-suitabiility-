"use client";

import React, { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SoilHealthCardView } from "@/components/soil/SoilHealthCardView";

export default function SoilHealthCardPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="max-w-5xl mx-auto py-12 text-center text-sm font-semibold text-stone-500">
            Loading Soil Health Card...
          </div>
        }
      >
        <SoilHealthCardView />
      </Suspense>
    </ProtectedRoute>
  );
}
