"use client";

import React, { useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { DSMLayerConfig, DSMLayerId, DSMLayerCategoryId } from "@/types/gis";
import type { BasemapStyle } from "./SoilMapViewer";
import {
  Layers,
  Satellite,
  Moon,
  Map as StreetIcon,
  Mountain,
  Sprout,
  Compass,
  CheckCircle2,
  ChevronDown,
  Info,
} from "lucide-react";

interface DSMLayerSelectorProps {
  layers: DSMLayerConfig[];
  activeLayerId: DSMLayerId;
  onSelectLayer: (layerId: DSMLayerId) => void;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  basemap?: BasemapStyle;
  onBasemapChange?: (basemap: BasemapStyle) => void;
  className?: string;
}

interface CategoryDefinition {
  id: DSMLayerCategoryId;
  icon: React.ReactNode;
  enTitle: string;
  mrTitle: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    id: "soil_properties",
    icon: <Sprout className="w-4 h-4 text-emerald-400" />,
    enTitle: "1. Soil Properties",
    mrTitle: "१. मातीचे गुणधर्म",
    badgeBg: "bg-emerald-950/60",
    badgeBorder: "border-emerald-700/50",
    badgeText: "text-emerald-300",
  },
  {
    id: "topography",
    icon: <Mountain className="w-4 h-4 text-amber-400" />,
    enTitle: "2. Topography & Elevation",
    mrTitle: "२. भूरूप आणि उंची",
    badgeBg: "bg-amber-950/60",
    badgeBorder: "border-amber-700/50",
    badgeText: "text-amber-300",
  },
  {
    id: "land_use",
    icon: <Compass className="w-4 h-4 text-cyan-400" />,
    enTitle: "3. Land Use & Multi-Spectral Indices",
    mrTitle: "३. जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
    badgeBg: "bg-cyan-950/60",
    badgeBorder: "border-cyan-700/50",
    badgeText: "text-cyan-300",
  },
];

export const DSMLayerSelector: React.FC<DSMLayerSelectorProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  opacity = 0.85,
  onOpacityChange,
  basemap = "satellite",
  onBasemapChange,
  className = "",
}) => {
  const { t, locale } = useI18n();

  // Find active layer object
  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  // Determine current active category
  const activeCategoryId: DSMLayerCategoryId =
    (activeLayer?.category as DSMLayerCategoryId) ||
    (activeLayerId === "elevation" || activeLayerId === "slope"
      ? "topography"
      : ["lulc", "kharif_rgb", "rabi_rgb", "ndvi", "evi", "savi", "ndmi", "ndre", "bsi", "ndwi"].includes(activeLayerId)
      ? "land_use"
      : "soil_properties");

  // Filter out unwanted / duplicate layers (bd alias, uncertainty, farm_boundary)
  const excludedLayerIds = new Set(["bd", "uncertainty", "farm_boundary"]);
  const cleanLayers = layers.filter((l) => !excludedLayerIds.has(l.id));

  // Deduplicate by layer id to ensure strict uniqueness
  const uniqueLayers: DSMLayerConfig[] = [];
  const seenIds = new Set<string>();
  for (const l of cleanLayers) {
    if (!seenIds.has(l.id)) {
      seenIds.add(l.id);
      uniqueLayers.push(l);
    }
  }

  // Group layers into the 3 categories (deduplicating redundant bd alias & boundaries)
  const soilLayers = uniqueLayers.filter(
    (l) =>
      l.category === "soil_properties" ||
      ["bdod", "cec", "cfvo", "clay", "sand", "silt", "soc", "nitrogen", "ph", "soil_texture"].includes(l.id)
  );

  const topoLayers = uniqueLayers.filter(
    (l) => l.category === "topography" || ["elevation", "slope"].includes(l.id)
  );

  const landUseLayers = uniqueLayers.filter(
    (l) =>
      l.category === "land_use" ||
      ["lulc", "kharif_rgb", "rabi_rgb", "ndvi", "evi", "savi", "ndmi", "ndre", "bsi", "ndwi"].includes(l.id)
  );

  const getCategoryLayers = (catId: DSMLayerCategoryId): DSMLayerConfig[] => {
    switch (catId) {
      case "soil_properties":
        return soilLayers;
      case "topography":
        return topoLayers;
      case "land_use":
        return landUseLayers;
      default:
        return [];
    }
  };

  /**
   * Ultra-clean layer name formatter:
   * Strips depth brackets like (0–30 cm), "Root-Zone", and units for clean farmer UX.
   */
  const getCleanLayerName = (layer: DSMLayerConfig): string => {
    if (locale === "mr") {
      switch (layer.id) {
        case "bdod":
        case "bd":
          return "मातीची घनता (Bulk Density)";
        case "cec":
          return "धनायन विनिमय क्षमता (CEC)";
        case "cfvo":
          return "जाड दगड-गोटे प्रमाण";
        case "clay":
          return "चिकणमाती (Clay)";
        case "sand":
          return "वाळू / रेती (Sand)";
        case "silt":
          return "गाळ (Silt)";
        case "soc":
          return "सेंद्रिय कर्ब (SOC)";
        case "nitrogen":
          return "उपलब्ध नत्र (N)";
        case "ph":
          return "मातीचा सामू (pH)";
        case "soil_texture":
          return "मातीचा पोत / प्रकार";
        case "farm_boundary":
          return "गट सीमा नकाशा";
        case "elevation":
          return "उंची (Elevation)";
        case "slope":
          return "उतार (Slope)";
        case "lulc":
          return "जमीन वापर (LULC)";
        case "ndvi":
          return "NDVI वनस्पती निर्देशांक";
        case "evi":
          return "EVI वनस्पती निर्देशांक";
        default:
          return (layer.marathiName || layer.name || layer.shortName || "")
            .replace(/\s*\([0-9]+[–-][0-9]+\s*cm[^)]*\)/gi, "")
            .replace(/\s*Root-Zone\s*/gi, "")
            .replace(/\s*\[[^\]]+\]/g, "")
            .trim();
      }
    }

    switch (layer.id) {
      case "bdod":
      case "bd":
        return "Bulk Density";
      case "cec":
        return "Cation Exchange Capacity (CEC)";
      case "cfvo":
        return "Coarse Fragments";
      case "clay":
        return "Clay";
      case "sand":
        return "Sand";
      case "silt":
        return "Silt";
      case "soc":
        return "Soil Organic Carbon (SOC)";
      case "nitrogen":
        return "Available Nitrogen (N)";
      case "ph":
        return "Soil pH";
      case "soil_texture":
        return "Soil Texture Classes";
      case "farm_boundary":
        return "Cadastral Farm Boundary";
      case "elevation":
        return "Digital Elevation (DEM)";
      case "slope":
        return "Terrain Slope";
      case "lulc":
        return "Land Use / Land Cover";
      case "ndvi":
        return "NDVI Vegetation Index";
      case "evi":
        return "EVI Vegetation Index";
      case "savi":
        return "SAVI Soil-Adjusted Index";
      case "ndmi":
        return "NDMI Moisture Index";
      case "ndre":
        return "NDRE Red-Edge Index";
      case "bsi":
        return "BSI Bare Soil Index";
      case "ndwi":
        return "NDWI Water Index";
      case "kharif_rgb":
        return "Kharif True Color RGB";
      case "rabi_rgb":
        return "Rabi True Color RGB";
      case "uncertainty":
        return "Prediction Uncertainty";
      default:
        return (layer.shortName || layer.name || "")
          .replace(/\s*\([0-9]+[–-][0-9]+\s*cm[^)]*\)/gi, "")
          .replace(/\s*Root-Zone\s*/gi, "")
          .replace(/\s*Proportion\b/gi, "")
          .replace(/\s*Volumetric Fraction\b/gi, "")
          .replace(/\s*\[[^\]]+\]/g, "")
          .trim();
    }
  };

  return (
    <div
      className={`bg-slate-900/95 backdrop-blur-md text-white rounded-2xl border border-slate-800 p-4 shadow-2xl space-y-4 select-none ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              {locale === "mr" ? "डिजिटल सॉईल मॅपिंग स्तर" : "DSM Spatial Layers"}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              {locale === "mr" ? "माळेगाव खुर्द पायलट (२२ स्तर)" : "Malegaon Khurd Pilot (22 Layers)"}
            </p>
          </div>
        </div>

        {activeLayer && (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
            {activeLayer.unit || "unit"}
          </span>
        )}
      </div>

      {/* 3 DISTINCT CATEGORY DROPDOWNS */}
      <div className="space-y-3">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>{locale === "mr" ? "३ स्तर वर्ग ड्रॉपडाउन्स" : "3 LAYER CATEGORY SELECTORS"}</span>
          <span className="text-[10px] text-emerald-400 font-semibold lowercase">
            {uniqueLayers.length} {locale === "mr" ? "एकूण स्तर" : "total layers"}
          </span>
        </div>

        {CATEGORIES.map((cat, idx) => {
          const catLayers = getCategoryLayers(cat.id);
          const isCategorySelectedLayer = catLayers.some(
            (l) => l.id === activeLayerId || (l.id === "bdod" && activeLayerId === "bd")
          );

          return (
            <div
              key={cat.id}
              className={`rounded-xl border p-2.5 transition-all ${
                isCategorySelectedLayer
                  ? `${cat.badgeBg} ${cat.badgeBorder} shadow-sm ring-1 ring-emerald-500/20`
                  : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {cat.icon}
                  <label
                    htmlFor={`select-${cat.id}`}
                    className={`text-[11px] font-bold tracking-tight cursor-pointer ${
                      isCategorySelectedLayer ? "text-white" : "text-slate-300"
                    }`}
                  >
                    {locale === "mr" ? cat.mrTitle : cat.enTitle}
                  </label>
                </div>

                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                  {catLayers.length} {locale === "mr" ? "स्तर" : "layers"}
                </span>
              </div>

              {/* Native Accessible Dropdown Select */}
              <div className="relative">
                <select
                  id={`select-${cat.id}`}
                  value={
                    isCategorySelectedLayer
                      ? activeLayerId === "bd"
                        ? "bdod"
                        : activeLayerId
                      : ""
                  }
                  onChange={(e) => {
                    const selectedVal = e.target.value as DSMLayerId;
                    if (selectedVal) {
                      onSelectLayer(selectedVal);
                    }
                  }}
                  className={`w-full text-xs font-semibold rounded-lg px-2.5 py-2 border cursor-pointer appearance-none pr-8 transition-colors ${
                    isCategorySelectedLayer
                      ? "bg-slate-900/90 text-white border-emerald-500/60 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                      : "bg-slate-900/60 text-slate-300 border-slate-700 hover:border-slate-600"
                  }`}
                >
                  <option value="" disabled className="bg-slate-900 text-slate-500">
                    {locale === "mr"
                      ? `-- ${cat.mrTitle.replace(/^[०-९0-9.]+\s*/, "")} निवडा (${catLayers.length}) --`
                      : `-- Select ${cat.enTitle.replace(/^[0-9.]+\s*/, "")} (${catLayers.length}) --`}
                  </option>
                  {catLayers.map((l) => (
                    <option key={l.id} value={l.id} className="bg-slate-900 text-white py-1">
                      {getCleanLayerName(l)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-2.5 pointer-events-none text-slate-400 text-xs">
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ACTIVE LAYER BADGE & INFO */}
      {activeLayer && (
        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {locale === "mr" ? "सध्या सक्रिय स्तर:" : "Active Layer:"}
            </span>
            <span className="text-emerald-400 font-bold truncate text-[11px]">
              {activeLayer.unit ? `[${activeLayer.unit}]` : ""}
            </span>
          </div>
          <div className="text-xs font-extrabold text-white leading-tight">
            {getCleanLayerName(activeLayer)}
          </div>
          {activeLayer.description && (
            <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed font-normal pt-0.5">
              {activeLayer.description}
            </p>
          )}
        </div>
      )}

      {/* Overlay Opacity Slider */}
      {onOpacityChange && (
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">
              {t("soilMap.overlayOpacity") || "Overlay Opacity"}
            </span>
            <span className="font-mono font-bold text-emerald-400">{Math.round(opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>
      )}

      {/* BASEMAP STYLE */}
      {onBasemapChange && (
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t("soilMap.basemapStyle") || "BASEMAP STYLE"}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              {
                id: "satellite" as const,
                label: locale === "mr" ? "उपग्रह (Satellite)" : "Satellite",
                icon: <Satellite className="w-3.5 h-3.5" />,
              },
              {
                id: "dark" as const,
                label: locale === "mr" ? "गडद (Dark)" : "Dark Matter",
                icon: <Moon className="w-3.5 h-3.5" />,
              },
              {
                id: "street" as const,
                label: locale === "mr" ? "रस्ते (Street)" : "Open Street",
                icon: <StreetIcon className="w-3.5 h-3.5" />,
              },
              {
                id: "topo" as const,
                label: locale === "mr" ? "स्थलाकृतिक (Topo)" : "Topographic",
                icon: <Mountain className="w-3.5 h-3.5" />,
              },
            ].map((bm) => {
              const active = basemap === bm.id;
              return (
                <button
                  key={bm.id}
                  type="button"
                  onClick={() => onBasemapChange(bm.id)}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                    active
                      ? "bg-emerald-950/60 border-emerald-500 text-white shadow-xs"
                      : "bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800"
                  }`}
                >
                  {bm.icon}
                  <span className="truncate text-[11px]">{bm.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
