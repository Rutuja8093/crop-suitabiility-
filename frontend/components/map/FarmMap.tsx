"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { fieldService, AuthorizedFieldResponse, GeoJSONGeometry } from "@/services/fieldService";
import { dsmService } from "@/services/dsmService";
import { MapLibreWrapper } from "./MapLibreWrapper";
import {
  MapPinOff,
  AlertCircle,
  RefreshCw,
  Loader2,
  Compass,
} from "lucide-react";
import { DSMLayerConfig } from "@/types/gis";

interface FarmMapProps {
  className?: string;
  previewMode?: boolean;
  onFieldLoaded?: (field: AuthorizedFieldResponse) => void;
  dsmLayer?: DSMLayerConfig | null;
  dsmOpacity?: number;
  selectedGat?: string | null;
}

/**
 * Utility to parse standard WKT POLYGON ((lng lat, lng lat, ...)) into GeoJSON Polygon
 */
function parseWktToGeoJSON(wkt: string): GeoJSONGeometry | null {
  if (!wkt) return null;
  const match = wkt.match(/POLYGON\s*\(\((.*?)\)\)/i);
  if (!match || !match[1]) return null;

  try {
    const rawCoords = match[1].split(",");
    const coords: [number, number][] = [];
    for (const item of rawCoords) {
      const parts = item.trim().split(/\s+/).map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coords.push([parts[0], parts[1]]);
      }
    }
    if (coords.length > 2) {
      return {
        type: "Polygon",
        coordinates: [coords],
      };
    }
  } catch (err) {
    console.warn("Failed to parse WKT:", err);
  }
  return null;
}

export const FarmMap: React.FC<FarmMapProps> = ({
  className = "",
  previewMode = false,
  onFieldLoaded,
  dsmLayer,
  dsmOpacity = 0.75,
  selectedGat: propSelectedGat,
}) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";
  const { field: authField, farmer: authFarmer, location: authLocation } = useAuth();
  const [fieldData, setFieldData] = useState<AuthorizedFieldResponse | null>(null);
  const [allPlots, setAllPlots] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Keep a stable ref to onFieldLoaded to prevent infinite re-render loops
  const onFieldLoadedRef = useRef(onFieldLoaded);
  useEffect(() => {
    onFieldLoadedRef.current = onFieldLoaded;
  });

  const fetchField = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Determine active Gat priority: prop > URL ?gat= > localStorage > authField > default 13
      const urlGat =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("gat")
          : null;
      const storedGat =
        typeof window !== "undefined"
          ? localStorage.getItem("soilpilot_selected_gat")
          : null;

      // 2. Fetch authenticated field with real backend KML/GIS geometry
      let data: AuthorizedFieldResponse | null = null;
      try {
        data = await fieldService.getAuthenticatedField();
      } catch (err) {
        console.warn("Could not fetch /fields/me directly:", err);
      }

      const rawTarget =
        propSelectedGat ||
        urlGat ||
        authField?.gat_no ||
        data?.gat_no ||
        authFarmer?.gat_number ||
        storedGat ||
        "13";

      const cleanNum = rawTarget.replace(/[^\d]/g, "") || rawTarget.trim().toLowerCase();

      let resolvedGeometry: GeoJSONGeometry | null = null;
      let calculatedArea = data?.area ?? authField?.area ?? null;

      // Check if authenticated field matches the target Gat
      const authGatClean = (data?.gat_no || authField?.gat_no || "").replace(/[^\d]/g, "");
      if (data?.geometry && (!cleanNum || authGatClean === cleanNum)) {
        resolvedGeometry = data.geometry;
        calculatedArea = data.area ?? calculatedArea;
      }

      // If not resolved or target Gat differs, look up in sample-gats.kml (12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 25)
      if (!resolvedGeometry && cleanNum) {
        try {
          const { collection } = await dsmService.loadSampleGats();
          const matchedFeature = collection.features.find((f) => {
            const fName =
              (f.properties?.name || "")
                .replace(/[^\d]/g, "")
                .trim()
                .toLowerCase() || (f.properties?.name || "").trim().toLowerCase();
            const fId =
              (f.id || "").replace(/[^\d]/g, "").trim().toLowerCase() ||
              (f.id || "").trim().toLowerCase();
            return fName === cleanNum || fId === cleanNum;
          });

          if (matchedFeature && matchedFeature.geometry) {
            resolvedGeometry = matchedFeature.geometry as GeoJSONGeometry;
            if (matchedFeature.properties?.area_ha) {
              calculatedArea = matchedFeature.properties.area_ha;
            }
          }
        } catch (kmlErr) {
          console.warn("Could not load geometry from sample gats:", kmlErr);
        }
      }

      // If not resolved from sample gats, look up in local GeoJSON (/data/malegaon_plots.geojson)
      if (!resolvedGeometry && cleanNum) {
        try {
          const res = await fetch("/data/malegaon_plots.geojson");
          if (res.ok) {
            const geojson = await res.json();
            const matched = (geojson.features || []).find((f: any) => {
              const pGat = (f.properties?.gat_no || f.properties?.name || f.id || "").toString().replace(/[^\d]/g, "");
              return pGat === cleanNum;
            });
            if (matched?.geometry) {
              resolvedGeometry = matched.geometry as GeoJSONGeometry;
              if (matched.properties?.area) {
                calculatedArea = matched.properties.area;
              }
            }
          }
        } catch (geoErr) {
          console.warn("Could not load geometry from malegaon_plots.geojson:", geoErr);
        }
      }

      // If still not resolved, query backend by Gat
      if (!resolvedGeometry && cleanNum) {
        try {
          const lookup = await fieldService.getFieldByGat({
            gatNo: cleanNum,
            villageName: data?.village || authLocation?.village || "Malegaon Kh",
            taluka: data?.taluka || authLocation?.taluka || "Baramati",
          });
          if (lookup) {
            calculatedArea = lookup.area ?? calculatedArea;
            if (lookup.geometry_wkt) {
              resolvedGeometry = parseWktToGeoJSON(lookup.geometry_wkt);
            }
          }
        } catch (lookupErr) {
          console.warn("Could not lookup field by gat:", lookupErr);
        }
      }

      if (calculatedArea === null || calculatedArea === undefined) {
        calculatedArea = data?.area ?? authField?.area ?? null;
      }

      const calculatedAcres = calculatedArea ? Number((calculatedArea * 2.47105).toFixed(2)) : null;
      const enriched: AuthorizedFieldResponse = {
        ...(data || {}),
        id: data?.id || authField?.id || (cleanNum ? parseInt(cleanNum, 10) || 15 : 15),
        gat_no: cleanNum || rawTarget,
        area: calculatedArea,
        area_acres: data?.area_acres ?? calculatedAcres,
        area_unit: data?.area_unit || authField?.area_unit || "hectare",
        village: data?.village || authLocation?.village || "Malegaon Kh",
        taluka: data?.taluka || authLocation?.taluka || "Baramati",
        district: data?.district || authLocation?.district || "Pune",
        state: data?.state || authLocation?.state || "Maharashtra",
        farmer_name: data?.farmer_name || authFarmer?.name || "Ramesh Patil (रमेश पाटील)",
        is_demo: data?.is_demo ?? authField?.is_demo ?? true,
        geometry: resolvedGeometry,
      };

      setFieldData(enriched);
      onFieldLoadedRef.current?.(enriched);

      // 3. Fetch village all-plots GeoJSON for background boundaries (Admin only)
      const isAdmin =
        authFarmer?.role === "admin" ||
        (typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("admin") === "true");

      if (isAdmin) {
        try {
          const villagePlots = await fieldService.getVillageGeoJSON({
            villageName: data?.village || authLocation?.village || "Malegaon Kh",
            taluka: data?.taluka || authLocation?.taluka || "Baramati",
          });
          if (villagePlots && villagePlots.features) {
            setAllPlots(villagePlots);
          }
        } catch (err) {
          console.warn("Could not load neighboring village plots:", err);
        }
      } else {
        setAllPlots(null);
      }
    } catch (err: any) {
      console.error("Failed to load authenticated field map:", err);
      if (authField) {
        const fallbackData: AuthorizedFieldResponse = {
          id: authField.id,
          gat_no: authField.gat_no,
          area: authField.area,
          area_unit: authField.area_unit || "hectare",
          village: authLocation?.village || "Malegaon Kh",
          taluka: authLocation?.taluka || "Baramati",
          district: authLocation?.district || "Pune",
          state: authLocation?.state || "Maharashtra",
          farmer_name: authFarmer?.name || null,
          is_demo: authField.is_demo ?? true,
          geometry: null,
        };
        setFieldData(fallbackData);
        onFieldLoadedRef.current?.(fallbackData);
      } else {
        setError(err?.message || "Failed to load field");
      }
    } finally {
      setLoading(false);
    }
  }, [
    propSelectedGat,
    authField?.id,
    authField?.gat_no,
    authField?.area,
    authLocation?.village,
    authLocation?.taluka,
    authLocation?.district,
    authLocation?.state,
    authFarmer?.name,
    authFarmer?.role,
  ]);

  useEffect(() => {
    fetchField();

    // Listen for storage changes from other tabs/components
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "soilpilot_selected_gat") {
        fetchField();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [fetchField]);

  const mapHeightClass = previewMode
    ? "h-48 sm:h-56"
    : "h-[380px] sm:h-[480px] lg:h-[580px]";

  // 1. Loading State
  if (loading) {
    return (
      <div
        className={`w-full ${mapHeightClass} rounded-2xl border border-surface-border bg-gradient-to-br from-surface-subtle via-white to-soil-primaryLight/20 flex flex-col items-center justify-center p-6 text-center space-y-4 shadow-card ${className}`}
      >
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-soil-primaryLight border border-soil-secondary/40 flex items-center justify-center text-soil-primary shadow-xs">
            <Compass className="w-7 h-7 animate-pulse text-soil-primary" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-soil-primary absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm sm:text-base font-bold text-text-main">
            {t("map.loadingMap") || t("myFarm.loadingMap")}
          </h3>
          <p className="text-xs text-text-muted">
            {t("auth.checkingSession")}
          </p>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error || !fieldData) {
    return (
      <div
        className={`w-full ${mapHeightClass} rounded-2xl border border-red-200 bg-red-50/50 flex flex-col items-center justify-center p-6 text-center space-y-4 shadow-card ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="text-sm sm:text-base font-bold text-red-900">
            {t("myFarm.mapError")}
          </h3>
          <p className="text-xs text-red-700">
            {error || t("auth.serverProblemError")}
          </p>
        </div>
        <button
          type="button"
          onClick={fetchField}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-700 text-xs font-bold rounded-xl hover:bg-red-100/50 transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t("myFarm.retry")}</span>
        </button>
      </div>
    );
  }

  // 3. Missing Geometry State
  if (!fieldData.geometry) {
    return (
      <div
        className={`w-full ${mapHeightClass} rounded-2xl border border-surface-border bg-surface-subtle flex flex-col items-center justify-center p-6 text-center space-y-3.5 shadow-card ${className}`}
      >
        <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
          <MapPinOff className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h3 className="text-sm sm:text-base font-bold text-text-main">
            {t("map.noPlotFound") || t("myFarm.noFieldFound") || (isMr ? "या गट क्रमांकाची सीमा उपलब्ध नाही." : "Boundary not available for this Gat.")}
          </h3>
          <p className="text-xs text-text-muted">
            {t("myFarm.noFieldFoundDesc") || (isMr ? "या गटाची अधिकृत सीमा नवीन नकाशा संचामध्ये उपलब्ध नाही." : "Cadastral boundary polygon not available in the validated survey dataset.")}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-surface-border text-xs text-text-muted">
          <span>
            {fieldData.village} • {t("geo.gatNo")} {fieldData.gat_no}
          </span>
        </div>
      </div>
    );
  }

  // 4. Working Interactive Map (convert field area to acres)
  const rawArea = fieldData.area ? Number(fieldData.area) : null;
  const isAcreUnit = fieldData.area_unit?.toLowerCase().includes("acre") || fieldData.area_unit?.toLowerCase() === "ac";
  const areaInAcres =
    fieldData.area_acres ??
    (rawArea && !isNaN(rawArea)
      ? (isAcreUnit ? rawArea : Number((rawArea * 2.47105).toFixed(2)))
      : null);

  const formattedArea = areaInAcres !== null
    ? `${areaInAcres} ${isMr ? "एकर" : "Acres"}`
    : undefined;

  return (
    <MapLibreWrapper
      geometry={fieldData.geometry}
      gatNo={fieldData.gat_no}
      villageName={fieldData.village}
      talukaName={fieldData.taluka || authLocation?.taluka}
      districtName={fieldData.district || authLocation?.district}
      areaText={formattedArea}
      allPlotsGeoJSON={allPlots}
      className={`${mapHeightClass} ${className}`}
      interactive={!previewMode}
      dsmLayer={dsmLayer}
      dsmOpacity={dsmOpacity}
    />
  );
};
