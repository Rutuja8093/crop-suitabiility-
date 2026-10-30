"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { DSMLayerConfig, ColorStop } from "@/types/gis";
import { getVegetationIndexStyle } from "@/lib/gis/vegetationIndexStyles";
import { getLayerClassificationDefinition } from "@/lib/gis/layerClassification";

interface MapLegendProps {
  layer: DSMLayerConfig;
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  className?: string;
}

function parseRgbOrHex(colorStr: string): [number, number, number] {
  if (colorStr.startsWith("#")) {
    const hex = colorStr.replace("#", "");
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  }
  return [100, 100, 100];
}

function getSteppedColors(colorStops?: ColorStop[], steps = 18): string[] {
  if (!colorStops || colorStops.length < 2) {
    return [
      "#5a0004", "#7b0008", "#9d0010", "#bf0d18", "#e2231c",
      "#ec4924", "#f56f24", "#f99222", "#fbb31e", "#fedd1f",
      "#e7ee3e", "#c6e355", "#9dce69", "#71b66b", "#459c5d",
      "#227f49", "#0c5d33", "#00e500",
    ];
  }
  const minVal = colorStops[0].value;
  const maxVal = colorStops[colorStops.length - 1].value;
  const range = maxVal - minVal || 1;

  const result: string[] = [];
  for (let i = 0; i < steps; i++) {
    const val = minVal + (range * i) / (steps - 1);
    let sIdx = 0;
    while (sIdx < colorStops.length - 1 && colorStops[sIdx + 1].value < val) {
      sIdx++;
    }
    const s1 = colorStops[sIdx];
    const s2 = colorStops[Math.min(sIdx + 1, colorStops.length - 1)];
    const factor = s2.value === s1.value ? 0 : (val - s1.value) / (s2.value - s1.value);
    const [r1, g1, b1] = parseRgbOrHex(s1.color);
    const [r2, g2, b2] = parseRgbOrHex(s2.color);
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);
    result.push(`rgb(${r}, ${g}, ${b})`);
  }
  return result;
}

const QGIS_LULC_CLASSES = [
  { val: 0, name: "Water", mr: "पाणी", color: "#2563eb", qgisColor: "Blue" },
  { val: 1, name: "Trees", mr: "झाडे", color: "#15803d", qgisColor: "Dark Green" },
  { val: 2, name: "Grass", mr: "गवत", color: "#65a30d", qgisColor: "Light Green" },
  { val: 3, name: "Flooded Veg", mr: "जलमय वनस्पती", color: "#06b6d4", qgisColor: "Cyan" },
  { val: 4, name: "Crops", mr: "पिके / शेती", color: "#d946ef", qgisColor: "Magenta / Pink" },
  { val: 5, name: "Shrub", mr: "झुडपे", color: "#854d0e", qgisColor: "Olive / Brown" },
  { val: 6, name: "Built", mr: "वस्ती", color: "#3b82f6", qgisColor: "Blue / Indigo" },
  { val: 7, name: "Bare", mr: "उघडी जमीन", color: "#d6c7b2", qgisColor: "Light Gray / Sand" },
  { val: 8, name: "Snow", mr: "बर्फ", color: "#ffffff", qgisColor: "White" },
];

function formatClassRange(
  cls: { min: number; max: number },
  index: number,
  total: number
): string {
  const formatNum = (n: number) => {
    if (!Number.isFinite(n)) return "";
    const s = n.toFixed(2);
    if (s.endsWith(".00")) return n.toFixed(0);
    if (s.endsWith("0")) return n.toFixed(1);
    return Number(n.toFixed(2)).toString();
  };

  if (cls.min === -Infinity && cls.max === Infinity) {
    return "1";
  }
  if (cls.min === -Infinity || cls.min <= -0.9) {
    return `<${formatNum(cls.max)}`;
  }
  if (cls.max === Infinity) {
    return `>${formatNum(cls.min)}`;
  }
  if (index === total - 1 && cls.max <= 1.01 && cls.min >= 0.7) {
    return `${formatNum(cls.min)}–1`;
  }
  return `${formatNum(cls.min)}–${formatNum(cls.max)}`;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  layer,
  className = "",
}) => {
  const { t, locale } = useI18n();
  const isBoundaryOnly = layer.id === "farm_boundary";
  const isRgbComposite = layer.id === "kharif_rgb" || layer.id === "rabi_rgb";
  const isLulc = layer.id === "lulc";
  const layerDef = getLayerClassificationDefinition(layer.id);
  const hasDiscreteClasses = Boolean(layerDef && layerDef.classes.length > 0 && !layerDef.isContinuous);
  const vegStyle = getVegetationIndexStyle(layer.id);

  // Stepped colors for continuous gradient representation
  const segments = getSteppedColors(layer.colorStops, 18);

  // Dynamic scale bounds for continuous layers
  let minDisplay = vegStyle ? vegStyle.classes[0].min.toFixed(1) : "-1.0";
  let midDisplay = vegStyle ? ((vegStyle.classes[0].min + vegStyle.classes[vegStyle.classes.length - 1].max) / 2).toFixed(1) : "0.0";
  let maxDisplay = vegStyle ? vegStyle.classes[vegStyle.classes.length - 1].max.toFixed(1) : "1.0";

  if (!vegStyle && layer.min !== undefined && layer.max !== undefined) {
    const min = layer.min;
    const max = layer.max;
    const mid = (min + max) / 2;
    const isDecimal = max < 10 && max - min < 5;
    const unitStr = layer.unit ? ` ${layer.unit}` : "";
    minDisplay = isDecimal ? min.toFixed(1) : Math.round(min).toString();
    midDisplay = isDecimal ? mid.toFixed(1) : Math.round(mid).toString();
    maxDisplay = (isDecimal ? max.toFixed(1) : Math.round(max).toString()) + unitStr;
  }

  // Header Title matching bold uppercase style
  const getHeaderTitle = (): string => {
    if (locale === "mr") {
      if (layer.id === "lulc") return "जमीन वापर (LULC)";
      if (vegStyle) return vegStyle.marathiName;
      if (layer.id === "kharif_rgb") return "खरीप हंगाम उपग्रह प्रतिमा";
      if (layer.id === "rabi_rgb") return "रब्बी हंगाम उपग्रह प्रतिमा";
      if (layer.marathiName) return layer.marathiName;
    }
    if (layer.id === "lulc") return "LAND USE / COVER (LULC)";
    if (vegStyle) return vegStyle.name.toUpperCase();
    if (layer.id === "kharif_rgb") return "KHARIF RGB COMPOSITE";
    if (layer.id === "rabi_rgb") return "RABI RGB COMPOSITE";
    if (layer.name) return layer.name.toUpperCase();
    if (layer.shortName) return layer.shortName.toUpperCase();
    return (layer.id || "LAYER").toUpperCase();
  };

  const displayClasses = hasDiscreteClasses && layerDef ? layerDef.classes : vegStyle?.classes;

  return (
    <div
      id="map-legend-box"
      className={`bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200/80 px-3 py-2 text-xs w-[240px] sm:w-[260px] max-w-[calc(100vw-32px)] transition-all select-none ${className}`}
    >
      {/* Top Header: Layer Name */}
      <h4
        className="font-bold text-[#08542b] text-[11px] sm:text-xs tracking-wide uppercase leading-tight line-clamp-2"
        title={getHeaderTitle()}
      >
        {getHeaderTitle()}
      </h4>

      {/* Main Color Bar + Numeric Scale */}
      {isBoundaryOnly ? (
        <div className="flex items-center gap-2 text-[11px] text-slate-700 font-medium mt-1.5">
          <span className="w-4 h-2.5 rounded bg-amber-400/40 border-2 border-amber-500 shrink-0" />
          <span className="truncate">
            {locale === "mr" ? "निवडलेला गट भूखंड" : (t("soilMap.selectedParcel") || "Selected Gat Parcel")}
          </span>
        </div>
      ) : isRgbComposite ? (
        <div className="mt-1.5 space-y-1">
          <div
            className="h-3 w-full rounded-full overflow-hidden shadow-inner border border-slate-200/60"
            style={{
              background: "linear-gradient(to right, #1e3a1e, #3e6b3e, #8ca85a, #d4db96, #ffffff)",
            }}
          />
          <div className="flex justify-between items-center text-[9px] sm:text-[9.5px] font-semibold text-slate-500 px-0.5 font-mono">
            <span>Low Refl</span>
            <span>Canopy</span>
            <span>Bare/Cloud</span>
          </div>
        </div>
      ) : isLulc ? (
        <div className="mt-1.5 space-y-1">
          <div className="h-3 w-full rounded-full overflow-hidden flex shadow-inner border border-slate-200/60">
            {QGIS_LULC_CLASSES.map((item) => (
              <div
                key={item.val}
                className="flex-1 h-full"
                style={{ backgroundColor: item.color }}
                title={`${item.val}: ${locale === "mr" ? item.mr : item.name}`}
              />
            ))}
          </div>
          <div className="flex w-full text-[9px] sm:text-[10px] font-semibold text-slate-600 font-mono">
            {QGIS_LULC_CLASSES.map((item) => (
              <div
                key={item.val}
                className="flex-1 text-center truncate px-0.5"
                title={`${item.val}: ${locale === "mr" ? item.mr : item.name}`}
              >
                {item.val}
              </div>
            ))}
          </div>
        </div>
      ) : displayClasses && displayClasses.length > 0 ? (
        <div className="mt-1.5 space-y-1">
          <div className="h-3 w-full rounded-full overflow-hidden flex shadow-inner border border-slate-200/60">
            {displayClasses.map((cls) => (
              <div
                key={cls.id}
                className="flex-1 h-full"
                style={{ backgroundColor: cls.color }}
                title={`${cls.label} (${cls.min} to ${cls.max})`}
              />
            ))}
          </div>
          <div className="flex w-full text-[9px] sm:text-[9.5px] font-semibold text-slate-600 font-mono">
            {displayClasses.map((cls, idx) => (
              <div
                key={cls.id}
                className="flex-1 text-center truncate px-0.5"
                title={`${cls.label} (${cls.min} to ${cls.max})`}
              >
                {formatClassRange(cls, idx, displayClasses.length)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-1.5 space-y-1">
          <div
            className="h-3 w-full rounded-full overflow-hidden shadow-inner border border-slate-200/60"
            style={{
              background: `linear-gradient(to right, ${segments.join(", ")})`,
            }}
          />
          <div className="flex justify-between items-center text-[9px] sm:text-[9.5px] font-semibold text-slate-600 px-0.5 font-mono">
            <span>{minDisplay}</span>
            <span className="text-center">{midDisplay}</span>
            <span>{maxDisplay}</span>
          </div>
        </div>
      )}
    </div>
  );
};
