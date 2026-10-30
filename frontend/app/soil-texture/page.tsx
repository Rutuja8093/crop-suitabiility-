import React, { Suspense } from "react";
import type { Metadata } from "next";
import { SoilTextureCalculator } from "@/components/soilTexture/SoilTextureCalculator";

export const metadata: Metadata = {
  title: "Soil Texture Calculator — USDA Soil Texture Triangle | SoilPilot",
  description:
    "Interactive USDA Soil Texture Triangle Calculator. Enter sand, silt, and clay percentages or tap the diagram to classify soil texture for agricultural diagnostics.",
};

export default function SoilTexturePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto py-16 text-center text-sm font-semibold text-text-muted">
          Loading Soil Texture Triangle...
        </div>
      }
    >
      <SoilTextureCalculator />
    </Suspense>
  );
}
