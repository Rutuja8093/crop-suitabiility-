/**
 * Centralized Single Source-of-Truth Classification Engine for SoilPilot GIS.
 *
 * GUARANTEES:
 * 1. ONE ACTIVE LAYER = ONE SOURCE OF TRUTH.
 * 2. Map rendering, cursor/click sampling, info popup, legend, plot average,
 *    and plot distribution ALL consume this exact configuration and function.
 * 3. Exact mathematical consistency: no gaps, no overlaps, stable class IDs.
 */

import {
  VEGETATION_INDEX_STYLES,
  VegetationIndexStyleConfig,
  IndexClassDefinition,
} from "./vegetationIndexStyles";

export interface LayerClassItem {
  id: string;
  label: string;
  marathiLabel: string;
  min: number;
  max: number;
  color: string;         // Hex code e.g. #EF4444
  rgb: [number, number, number];
  textColor: string;     // Accessible text contrast #000000 or #ffffff
  description?: string;
  marathiDescription?: string;
}

export interface LayerClassificationDefinition {
  layerId: string;
  displayName: string;
  marathiName: string;
  unit: string;
  isContinuous: boolean; // if false, layer is discrete categorical or index
  classes: LayerClassItem[];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Standard Soil Property & Terrain Classification Definitions.
 */
const SOIL_PROPERTY_CLASSIFICATIONS: Record<string, LayerClassificationDefinition> = {
  ph: {
    layerId: "ph",
    displayName: "Soil pH (Reaction)",
    marathiName: "जमिनीचा सामू (pH)",
    unit: "pH",
    isContinuous: false,
    classes: [
      {
        id: "acidic",
        label: "Acidic Soil",
        marathiLabel: "आम्लयुक्त जमीन",
        min: -Infinity,
        max: 6.5,
        color: "#EF4444",
        rgb: [239, 68, 68],
        textColor: "#ffffff",
      },
      {
        id: "optimal_neutral",
        label: "Optimal Neutral",
        marathiLabel: "उत्कृष्ट उदासीन (योग्य)",
        min: 6.5,
        max: 7.8,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
      {
        id: "moderate_alkaline",
        label: "Moderate Alkaline",
        marathiLabel: "मध्यम अल्कधर्मी (खारवट)",
        min: 7.8,
        max: 8.5,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "strongly_alkaline",
        label: "Strongly Alkaline",
        marathiLabel: "अति अल्कधर्मी (चोपण)",
        min: 8.5,
        max: Infinity,
        color: "#DC2626",
        rgb: [220, 38, 38],
        textColor: "#ffffff",
      },
    ],
  },

  soc: {
    layerId: "soc",
    displayName: "Soil Organic Carbon (SOC)",
    marathiName: "सेंद्रिय कर्ब (SOC)",
    unit: "%",
    isContinuous: false,
    classes: [
      {
        id: "low",
        label: "Low Organic Carbon",
        marathiLabel: "कमी सेंद्रिय कर्ब",
        min: -Infinity,
        max: 0.75,
        color: "#EF4444",
        rgb: [239, 68, 68],
        textColor: "#ffffff",
      },
      {
        id: "medium",
        label: "Medium Organic Carbon",
        marathiLabel: "मध्यम सेंद्रिय कर्ब",
        min: 0.75,
        max: 1.1,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "high",
        label: "High Organic Carbon",
        marathiLabel: "उत्तम सेंद्रिय कर्ब",
        min: 1.1,
        max: Infinity,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
    ],
  },

  nitrogen: {
    layerId: "nitrogen",
    displayName: "Available Nitrogen (N)",
    marathiName: "उपलब्ध नत्र (N)",
    unit: "mg/kg",
    isContinuous: false,
    classes: [
      {
        id: "low",
        label: "Low / Deficient",
        marathiLabel: "कमी उपलब्ध नत्र",
        min: -Infinity,
        max: 0.85,
        color: "#EF4444",
        rgb: [239, 68, 68],
        textColor: "#ffffff",
      },
      {
        id: "medium",
        label: "Medium Nitrogen",
        marathiLabel: "मध्यम उपलब्ध नत्र",
        min: 0.85,
        max: 1.15,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "high",
        label: "Sufficient / High",
        marathiLabel: "मुबलक उपलब्ध नत्र",
        min: 1.15,
        max: Infinity,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
    ],
  },

  bd: {
    layerId: "bd",
    displayName: "Bulk Density",
    marathiName: "मातीची घनता",
    unit: "g/cm³",
    isContinuous: false,
    classes: [
      {
        id: "ideal",
        label: "Ideal Porosity",
        marathiLabel: "उत्तम हवा खेळती / छिद्रयुक्त",
        min: -Infinity,
        max: 1.45,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
      {
        id: "moderate",
        label: "Moderate Density",
        marathiLabel: "मध्यम घनता",
        min: 1.45,
        max: 1.56,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "compacted",
        label: "Compacted Soil",
        marathiLabel: "माती घट्ट / संकुचित",
        min: 1.56,
        max: Infinity,
        color: "#EF4444",
        rgb: [239, 68, 68],
        textColor: "#ffffff",
      },
    ],
  },

  bdod: {
    layerId: "bdod",
    displayName: "Bulk Density (0–30 cm)",
    marathiName: "मातीची घनता (०-३० सेमी)",
    unit: "g/cm³",
    isContinuous: false,
    classes: [
      {
        id: "ideal",
        label: "Ideal Porosity",
        marathiLabel: "उत्तम हवा खेळती / छिद्रयुक्त",
        min: -Infinity,
        max: 1.45,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
      {
        id: "moderate",
        label: "Moderate Density",
        marathiLabel: "मध्यम घनता",
        min: 1.45,
        max: 1.56,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "compacted",
        label: "Compacted Soil",
        marathiLabel: "माती घट्ट / संकुचित",
        min: 1.56,
        max: Infinity,
        color: "#EF4444",
        rgb: [239, 68, 68],
        textColor: "#ffffff",
      },
    ],
  },

  cec: {
    layerId: "cec",
    displayName: "Cation Exchange Capacity (CEC)",
    marathiName: "धनायन विनिमय क्षमता (CEC)",
    unit: "cmol(c)/kg",
    isContinuous: false,
    classes: [
      {
        id: "moderate",
        label: "Moderate Cation Exchange",
        marathiLabel: "मध्यम धनायन विनिमय",
        min: -Infinity,
        max: 25.0,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "high",
        label: "High Nutrient Buffer (Fertile)",
        marathiLabel: "उच्च अन्नद्रव्य साठा (सुपीक)",
        min: 25.0,
        max: Infinity,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
    ],
  },

  cfvo: {
    layerId: "cfvo",
    displayName: "Coarse Fragments Volumetric",
    marathiName: "खडी / मोठे दगड प्रमाण",
    unit: "%",
    isContinuous: false,
    classes: [
      {
        id: "low",
        label: "Low Rock Fragments (Favorable)",
        marathiLabel: "कमी खडी (अनुकूल)",
        min: -Infinity,
        max: 10.0,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
      {
        id: "moderate",
        label: "Moderate Coarse Fragments",
        marathiLabel: "मध्यम खडी प्रमाण",
        min: 10.0,
        max: 14.0,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "high",
        label: "High Coarse Rock Content",
        marathiLabel: "जास्त दगडधोंडे / खडी",
        min: 14.0,
        max: Infinity,
        color: "#EF4444",
        rgb: [239, 68, 68],
        textColor: "#ffffff",
      },
    ],
  },

  clay: {
    layerId: "clay",
    displayName: "Clay Content",
    marathiName: "चिकणमाती प्रमाण",
    unit: "%",
    isContinuous: false,
    classes: [
      {
        id: "medium",
        label: "Medium Clay Texture",
        marathiLabel: "मध्यम चिकण पोत",
        min: -Infinity,
        max: 35.0,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "optimal",
        label: "Optimal Vertisol Clay",
        marathiLabel: "उत्कृष्ट काळी चिकणमाती",
        min: 35.0,
        max: 44.0,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
      {
        id: "heavy",
        label: "Heavy Dense Clay",
        marathiLabel: "अतिशय जड चिकणमाती",
        min: 44.0,
        max: Infinity,
        color: "#059669",
        rgb: [5, 150, 105],
        textColor: "#ffffff",
      },
    ],
  },

  sand: {
    layerId: "sand",
    displayName: "Sand Content",
    marathiName: "वाळू प्रमाण",
    unit: "%",
    isContinuous: false,
    classes: [
      {
        id: "fine",
        label: "Fine / Low Sand Fraction",
        marathiLabel: "कमी वाळू (बारीक पोत)",
        min: -Infinity,
        max: 25.0,
        color: "#84CC16",
        rgb: [132, 204, 22],
        textColor: "#000000",
      },
      {
        id: "optimal",
        label: "Optimal Loamy Sand",
        marathiLabel: "संतुलित वाळू पोत",
        min: 25.0,
        max: 31.0,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
      {
        id: "coarse",
        label: "Coarse Sandy Fraction",
        marathiLabel: "जास्त वाळूयुक्त भाग",
        min: 31.0,
        max: Infinity,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
    ],
  },

  silt: {
    layerId: "silt",
    displayName: "Silt Content",
    marathiName: "गाळ माती प्रमाण",
    unit: "%",
    isContinuous: false,
    classes: [
      {
        id: "light",
        label: "Light Silt Fraction",
        marathiLabel: "कमी गाळ प्रमाण",
        min: -Infinity,
        max: 24.0,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "medium",
        label: "Medium Silt Fraction",
        marathiLabel: "मध्यम गाळ प्रमाण",
        min: 24.0,
        max: 28.0,
        color: "#84CC16",
        rgb: [132, 204, 22],
        textColor: "#000000",
      },
      {
        id: "rich",
        label: "Rich Silt Fraction",
        marathiLabel: "उत्कृष्ट सुपीक गाळ",
        min: 28.0,
        max: Infinity,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
    ],
  },

  slope: {
    layerId: "slope",
    displayName: "Slope Gradient",
    marathiName: "उताराचे प्रमाण",
    unit: "%",
    isContinuous: false,
    classes: [
      {
        id: "flat",
        label: "Level / Flat (0-2.5%)",
        marathiLabel: "सपाट जमीन (०-२.५%)",
        min: -Infinity,
        max: 2.5,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
      {
        id: "gentle",
        label: "Gentle Slope (2.5-6%)",
        marathiLabel: "मंद उतार (२.५-६%)",
        min: 2.5,
        max: 6.0,
        color: "#84CC16",
        rgb: [132, 204, 22],
        textColor: "#000000",
      },
      {
        id: "moderate",
        label: "Moderate Slope (>6%)",
        marathiLabel: "मध्यम उतार (>६%)",
        min: 6.0,
        max: Infinity,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
    ],
  },

  uncertainty: {
    layerId: "uncertainty",
    displayName: "Prediction Uncertainty",
    marathiName: "मॉडेल अनिश्चितता",
    unit: "%",
    isContinuous: false,
    classes: [
      {
        id: "high_conf",
        label: "High Confidence",
        marathiLabel: "उच्च अचूकता / विश्वासार्ह",
        min: -Infinity,
        max: 8.0,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
      {
        id: "mod_conf",
        label: "Moderate Confidence",
        marathiLabel: "मध्यम विश्वासार्हता",
        min: 8.0,
        max: 15.0,
        color: "#F59E0B",
        rgb: [245, 158, 11],
        textColor: "#000000",
      },
      {
        id: "elevated_unc",
        label: "Elevated Uncertainty",
        marathiLabel: "अधिक अनिश्चितता",
        min: 15.0,
        max: Infinity,
        color: "#EF4444",
        rgb: [239, 68, 68],
        textColor: "#ffffff",
      },
    ],
  },

  elevation: {
    layerId: "elevation",
    displayName: "Elevation (DEM)",
    marathiName: "उंची (समुद्रसपाटीपासून)",
    unit: "m",
    isContinuous: true,
    classes: [
      {
        id: "plateau",
        label: "Deccan Plateau (~540-580m)",
        marathiLabel: "दख्खनचे पठार (~५४०-५८० मी)",
        min: -Infinity,
        max: Infinity,
        color: "#10B981",
        rgb: [16, 185, 129],
        textColor: "#ffffff",
      },
    ],
  },

  soil_texture: {
    layerId: "soil_texture",
    displayName: "Soil Texture Class",
    marathiName: "मातीचा पोत वर्ग",
    unit: "Class",
    isContinuous: false,
    classes: [
      {
        id: "class_1",
        label: "Class 1: Clay Vertisol (काळी माती)",
        marathiLabel: "वर्ग १: काळी कसदार माती (व्हर्टिसॉल)",
        min: -Infinity,
        max: Infinity,
        color: "#5C3D2E",
        rgb: [92, 61, 46],
        textColor: "#ffffff",
      },
    ],
  },

  lulc: {
    layerId: "lulc",
    displayName: "Land Use / Land Cover (LULC)",
    marathiName: "जमीन वापर आणि आच्छादन",
    unit: "Class",
    isContinuous: false,
    classes: [
      { id: "water", label: "Class 0: Water", marathiLabel: "वर्ग ०: पाणी", min: -0.5, max: 0.5, color: "#2563EB", rgb: [37, 99, 235], textColor: "#ffffff" },
      { id: "trees", label: "Class 1: Trees", marathiLabel: "वर्ग १: झाडे", min: 0.5, max: 1.5, color: "#15803D", rgb: [21, 128, 61], textColor: "#ffffff" },
      { id: "grass", label: "Class 2: Grass", marathiLabel: "वर्ग २: गवत", min: 1.5, max: 2.5, color: "#65A30D", rgb: [101, 163, 13], textColor: "#ffffff" },
      { id: "flooded", label: "Class 3: Flooded Veg", marathiLabel: "वर्ग ३: जलमय वनस्पती", min: 2.5, max: 3.5, color: "#06B6D4", rgb: [6, 182, 212], textColor: "#ffffff" },
      { id: "crops", label: "Class 4: Crops", marathiLabel: "वर्ग ४: पिके / शेती", min: 3.5, max: 4.5, color: "#D946EF", rgb: [217, 70, 239], textColor: "#ffffff" },
      { id: "shrub", label: "Class 5: Shrub & Scrub", marathiLabel: "वर्ग ५: झुडपे", min: 4.5, max: 5.5, color: "#854D0E", rgb: [133, 77, 14], textColor: "#ffffff" },
      { id: "built", label: "Class 6: Built Area", marathiLabel: "वर्ग ६: वस्ती", min: 5.5, max: 6.5, color: "#3B82F6", rgb: [59, 130, 246], textColor: "#ffffff" },
      { id: "bare", label: "Class 7: Bare Ground", marathiLabel: "वर्ग ७: उघडी जमीन", min: 6.5, max: 7.5, color: "#D6C7B2", rgb: [214, 199, 178], textColor: "#000000" },
      { id: "snow", label: "Class 8: Snow & Ice", marathiLabel: "वर्ग ८: बर्फ", min: 7.5, max: 8.5, color: "#FFFFFF", rgb: [255, 255, 255], textColor: "#000000" },
    ],
  },
};

/**
 * Retrieve the single authoritative classification definition for ANY layer.
 */
export function getLayerClassificationDefinition(layerId?: string | null): LayerClassificationDefinition | null {
  if (!layerId) return null;
  const id = layerId.toLowerCase();

  // 1. Check Sentinel-2 spectral indices
  const vegCfg: VegetationIndexStyleConfig | undefined = VEGETATION_INDEX_STYLES[id];
  if (vegCfg) {
    const classes: LayerClassItem[] = vegCfg.classes.map((c: IndexClassDefinition) => ({
      id: c.id,
      label: c.label,
      marathiLabel: c.marathiLabel,
      min: c.min,
      max: c.max,
      color: c.color,
      rgb: hexToRgb(c.color),
      textColor: c.textColor,
      description: c.description,
      marathiDescription: c.marathiDescription,
    }));
    return {
      layerId: vegCfg.id,
      displayName: vegCfg.name,
      marathiName: vegCfg.marathiName,
      unit: "index",
      isContinuous: false,
      classes,
    };
  }

  // 2. Check soil property & terrain definitions
  if (SOIL_PROPERTY_CLASSIFICATIONS[id]) {
    return SOIL_PROPERTY_CLASSIFICATIONS[id];
  }

  return null;
}

export interface LayerClassResult {
  classId: string;
  label: string;
  marathiLabel: string;
  status: string;        // localized label based on locale
  color: string;         // #RRGGBB
  rgb: [number, number, number];
  textColor: string;     // #ffffff or #000000
  unit: string;
  isNoData: boolean;
}

/**
 * THE SINGLE CLASSIFICATION FUNCTION.
 * Consumed by:
 * 1. Map rendering (generateParcelLayerCanvas)
 * 2. Click / Cursor pixel sampling (probeValueAt)
 * 3. Information Popup (infoBoxMetric)
 * 4. Map Legend (MapLegend)
 * 5. Plot class distribution (parcelClassAreas / distributionList)
 * 6. Area / Percentage calculations
 */
export function classifyActiveLayer(
  layerId: string | undefined,
  val: number | null | undefined,
  locale?: string
): LayerClassResult {
  const def = getLayerClassificationDefinition(layerId);
  const unit = def?.unit || "index";

  // Section 16: Strict NoData handling
  if (val === null || val === undefined || isNaN(val)) {
    return {
      classId: "nodata",
      label: "No Data",
      marathiLabel: "माहिती उपलब्ध नाही",
      status: locale === "mr" ? "माहिती उपलब्ध नाही" : "No Data",
      color: "#64748B",
      rgb: [100, 116, 139],
      textColor: "#ffffff",
      unit,
      isNoData: true,
    };
  }

  if (!def || !def.classes || def.classes.length === 0) {
    return {
      classId: "standard",
      label: "Standard Value",
      marathiLabel: "प्रमाणित मूल्य",
      status: locale === "mr" ? "प्रमाणित मूल्य" : "Standard Value",
      color: "#10B981",
      rgb: [16, 185, 129],
      textColor: "#ffffff",
      unit,
      isNoData: false,
    };
  }

  // Categorical exact rounding for LULC
  if (def.layerId === "lulc") {
    const cVal = Math.round(val);
    const matched = def.classes.find((c) => cVal >= c.min && cVal <= c.max) || def.classes[4];
    return {
      classId: matched.id,
      label: matched.label,
      marathiLabel: matched.marathiLabel,
      status: locale === "mr" ? matched.marathiLabel : matched.label,
      color: matched.color,
      rgb: matched.rgb,
      textColor: matched.textColor,
      unit,
      isNoData: false,
    };
  }

  // Section 15: Exact boundary rules min <= val < max
  for (let i = 0; i < def.classes.length; i++) {
    const c = def.classes[i];
    const isLast = i === def.classes.length - 1;
    // For last class, inclusive of upper bound
    if (val >= c.min && (isLast ? val <= c.max : val < c.max)) {
      return {
        classId: c.id,
        label: c.label,
        marathiLabel: c.marathiLabel,
        status: locale === "mr" ? c.marathiLabel : c.label,
        color: c.color,
        rgb: c.rgb,
        textColor: c.textColor,
        unit,
        isNoData: false,
      };
    }
  }

  // Fallback for edge cases beyond min/max: choose nearest edge class
  const edge = val < def.classes[0].min ? def.classes[0] : def.classes[def.classes.length - 1];
  return {
    classId: edge.id,
    label: edge.label,
    marathiLabel: edge.marathiLabel,
    status: locale === "mr" ? edge.marathiLabel : edge.label,
    color: edge.color,
    rgb: edge.rgb,
    textColor: edge.textColor,
    unit,
    isNoData: false,
  };
}
