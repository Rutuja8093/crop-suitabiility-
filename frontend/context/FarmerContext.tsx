"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export interface SelectedFarmer {
  id: number | string;
  name: string;           // Authoritative raw name (Marathi Unicode)
  gat_no: string;         // Cadastral Gat number this farmer is mapped to
  village: string;        // Village name
  village_id?: number;
  source_row?: number;    // Row index in cadastral register
  selected_at?: string;   // Timestamp of selection
}

interface FarmerContextType {
  selectedFarmer: SelectedFarmer | null;
  selectFarmer: (farmer: SelectedFarmer) => void;
  clearSelectedFarmer: () => void;
  getSelectedFarmerForGat: (gatNo: string) => SelectedFarmer | null;
}

const STORAGE_KEY = "soilpilot_selected_farmer";

const FarmerContext = createContext<FarmerContextType | undefined>(undefined);

export const FarmerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedFarmer, setSelectedFarmerState] = useState<SelectedFarmer | null>(null);

  // Restore and validate selection from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SelectedFarmer = JSON.parse(stored);
        const currentGat = localStorage.getItem("soilpilot_selected_gat") || "";

        // Strictly validate: farmer must belong to currently active Gat
        const cleanParsedGat = String(parsed.gat_no || "").replace(/[^\d]/g, "");
        const cleanCurrentGat = String(currentGat).replace(/[^\d]/g, "");

        if (cleanCurrentGat && cleanParsedGat && cleanParsedGat !== cleanCurrentGat) {
          // Stale selection from different Gat -> clear it immediately
          localStorage.removeItem(STORAGE_KEY);
          setSelectedFarmerState(null);
        } else if (parsed && parsed.name && parsed.gat_no) {
          setSelectedFarmerState(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to restore selected farmer:", e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Listen for Gat change events across the application
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleGatChanged = () => {
      try {
        const currentGat = localStorage.getItem("soilpilot_selected_gat") || "";
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: SelectedFarmer = JSON.parse(stored);
          const cleanParsedGat = String(parsed.gat_no || "").replace(/[^\d]/g, "");
          const cleanCurrentGat = String(currentGat).replace(/[^\d]/g, "");

          if (cleanCurrentGat && cleanParsedGat && cleanParsedGat !== cleanCurrentGat) {
            // New Gat does not match selected farmer -> invalidate immediately
            localStorage.removeItem(STORAGE_KEY);
            setSelectedFarmerState(null);
            window.dispatchEvent(new CustomEvent("soilpilot_farmer_changed", { detail: null }));
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    };

    window.addEventListener("soilpilot_gat_changed", handleGatChanged);
    return () => window.removeEventListener("soilpilot_gat_changed", handleGatChanged);
  }, []);

  // Set selected farmer and persist to storage
  const selectFarmer = useCallback((farmer: SelectedFarmer) => {
    if (!farmer || !farmer.name || !farmer.gat_no) return;

    const enriched: SelectedFarmer = {
      ...farmer,
      gat_no: String(farmer.gat_no).replace(/[^\d]/g, "") || String(farmer.gat_no),
      selected_at: new Date().toISOString(),
    };

    setSelectedFarmerState(enriched);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched));
        window.dispatchEvent(new CustomEvent("soilpilot_farmer_changed", { detail: enriched }));
      } catch (e) {
        console.warn("Failed to persist selected farmer:", e);
      }
    }
  }, []);

  // Explicitly clear selected farmer
  const clearSelectedFarmer = useCallback(() => {
    setSelectedFarmerState(null);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new CustomEvent("soilpilot_farmer_changed", { detail: null }));
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, []);

  // Helper: Get farmer only if it matches requested Gat
  const getSelectedFarmerForGat = useCallback(
    (gatNo: string): SelectedFarmer | null => {
      if (!selectedFarmer) return null;
      const cleanTarget = String(gatNo).replace(/[^\d]/g, "");
      const cleanFarmerGat = String(selectedFarmer.gat_no).replace(/[^\d]/g, "");
      if (cleanTarget && cleanFarmerGat && cleanTarget === cleanFarmerGat) {
        return selectedFarmer;
      }
      return null;
    },
    [selectedFarmer]
  );

  return (
    <FarmerContext.Provider
      value={{
        selectedFarmer,
        selectFarmer,
        clearSelectedFarmer,
        getSelectedFarmerForGat,
      }}
    >
      {children}
    </FarmerContext.Provider>
  );
};

export const useSelectedFarmer = (): FarmerContextType => {
  const context = useContext(FarmerContext);
  if (!context) {
    throw new Error("useSelectedFarmer must be used within a FarmerProvider");
  }
  return context;
};
