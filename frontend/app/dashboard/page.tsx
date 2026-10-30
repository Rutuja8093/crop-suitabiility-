"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { useSelectedFarmer } from "@/context/FarmerContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { WelcomeSection } from "@/components/dashboard/WelcomeSection";
import { FarmSummaryCard } from "@/components/dashboard/FarmSummaryCard";
import { FarmMapPreview } from "@/components/dashboard/FarmMapPreview";
import { GatFarmersSection } from "@/components/dashboard/GatFarmersSection";
import { SoilOverview } from "@/components/dashboard/SoilOverview";
import { AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { t } = useI18n();
  const { loading, farmer, field, location } = useAuth();
  const { selectedFarmer } = useSelectedFarmer();
  const [mounted, setMounted] = useState(false);

  // Active Gat state with localStorage synchronization
  const [selectedGat, setSelectedGat] = useState<string>("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (field?.gat_no) {
      setSelectedGat(field.gat_no);
    } else if (typeof window !== "undefined") {
      const stored = localStorage.getItem("soilpilot_selected_gat");
      if (stored) setSelectedGat(stored);
    }
  }, [field?.gat_no]);

  useEffect(() => {
    const handleGatChanged = () => {
      const stored = localStorage.getItem("soilpilot_selected_gat");
      if (stored) setSelectedGat(stored);
    };
    window.addEventListener("soilpilot_gat_changed", handleGatChanged);
    return () => window.removeEventListener("soilpilot_gat_changed", handleGatChanged);
  }, []);

  const handleGatChange = (newGat: string) => {
    setSelectedGat(newGat);
  };

  // Show clean skeleton while session is validating or hydrating
  if (!mounted || loading) {
    return (
      <ProtectedRoute>
        <DashboardSkeleton />
      </ProtectedRoute>
    );
  }

  // Graceful fallback if data somehow failed to load
  if (!field) {
    return (
      <ProtectedRoute>
        <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-surface-border shadow-card text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-text-main">
            {t("dashboard.loadError")}
          </h2>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-soil-primary text-white font-medium text-sm rounded-lg hover:bg-soil-primaryHover transition-colors shadow-sm cursor-pointer"
          >
            {t("dashboard.retry")}
          </button>
        </div>
      </ProtectedRoute>
    );
  }

  const activeGat = selectedGat || field.gat_no || "124";
  const activeFarmerName =
    (selectedFarmer && String(selectedFarmer.gat_no) === String(activeGat) ? selectedFarmer.name : null) ||
    farmer?.name ||
    t("geo.unassigned");
  const village = location?.village || "Malegaon Khurd";
  const taluka = location?.taluka || "Baramati";
  const district = location?.district || "Pune";
  const state = location?.state || "Maharashtra";
  const area = field.area;
  const areaUnit = field.area_unit || "hectare";
  const isDemo = field.is_demo ?? true;

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* 1. Welcome Section */}
        <WelcomeSection
          farmerName={activeFarmerName}
          gatNo={activeGat}
          village={village}
          taluka={taluka}
          district={district}
        />

        {/* 2. Farm Identity & Location Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* YOUR FARM Summary Card */}
          <FarmSummaryCard
            gatNo={activeGat}
            village={village}
            taluka={taluka}
            district={district}
            state={state}
            area={area}
            areaUnit={areaUnit}
            isDemo={isDemo}
          />

          {/* Farm Map Location Preview */}
          <FarmMapPreview gatNo={activeGat} />
        </div>

        {/* 3. Farmers Associated with This Gat Card */}
        <GatFarmersSection
          initialGatNo={activeGat}
          villageName={village}
          taluka={taluka}
          onGatChange={handleGatChange}
        />

        {/* 4. Soil Overview Preview */}
        <SoilOverview />
      </div>
    </ProtectedRoute>
  );
}
