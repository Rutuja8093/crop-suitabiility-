import React, { Suspense } from "react";
import type { Metadata } from "next";
import { SoilTextureCalculator } from "@/components/soilTexture/SoilTextureCalculator";

export const metadata: Metadata = {
  title: "Soil Texture Calculator — SoilPilot",
  description: "Interactive USDA Soil Texture Triangle Calculator",
};

export default function SoilTextureCalculatorPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto py-16 text-center text-sm font-semibold text-text-muted">
          Loading Soil Texture Calculator...
        </div>
      }
    >
      <SoilTextureCalculator />
    </Suspense>
  );
}
