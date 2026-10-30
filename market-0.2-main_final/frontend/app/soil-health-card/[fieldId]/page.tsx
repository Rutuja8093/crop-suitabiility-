"use client";

import React from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SoilHealthCardView } from "@/components/soil/SoilHealthCardView";

interface SoilHealthCardFieldPageProps {
  params: {
    fieldId: string;
  };
}

export default function SoilHealthCardFieldPage({ params }: SoilHealthCardFieldPageProps) {
  return (
    <ProtectedRoute>
      <SoilHealthCardView fieldIdOverride={params.fieldId} />
    </ProtectedRoute>
  );
}
