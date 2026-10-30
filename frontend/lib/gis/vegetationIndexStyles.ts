/**
 * Centralized Sentinel-2 Spectral Indices & Color Classification Configuration.
 * 
 * STRICT COMPLIANCE RULES:
 * 1. FIXED COLOR SCALE: The same index value always receives the exact same color.
 *    No per-Gat, viewport, zoom, crop, or dynamic normalization.
 * 2. GEO-TIFF SOURCE OF TRUTH: Uses actual Copernicus Sentinel-2 derived GeoTIFF values.
 * 3. UNIFIED LOGIC: Map rendering, legends, cursor probe, and Gat area analysis
 *    all consume this exact same configuration.
 */

export interface IndexClassDefinition {
  id: string;
  min: number;
  max: number;
  label: string;
  marathiLabel: string;
  color: string;       // Hex color code (#RRGGBB)
  textColor: string;   // Accessible contrast text color (#000000 or #ffffff)
  description?: string;
  marathiDescription?: string;
}

export interface VegetationIndexStyleConfig {
  id: string;
  name: string;
  shortName: string;
  marathiName: string;
  category: "vegetation" | "moisture" | "soil" | "water" | "composite";
  formula: string;
  bandsUsed: {
    band: string;
    name: string;
    wavelength: string;
    nativeResolution: string;
  }[];
  sourceMetadata: {
    satellite: string;
    constellation: string;
    product: string;
    source: string;
    resolution: string;
    period: string;
  };
  range: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  classes: IndexClassDefinition[];
  /** Color stops formatted for CSS gradients and Leaflet legends */
  stops: { value: number; color: string; label: string; marathiLabel: string }[];
  isVegetationHealth: boolean;
  notes?: string;
}

export const SENTINEL2_BANDS = {
  B2: { band: "B2", name: "Blue", wavelength: "490 nm", nativeResolution: "10m" },
  B3: { band: "B3", name: "Green", wavelength: "560 nm", nativeResolution: "10m" },
  B4: { band: "B4", name: "Red", wavelength: "665 nm", nativeResolution: "10m" },
  B5: { band: "B5", name: "Red Edge 1", wavelength: "705 nm", nativeResolution: "20m" },
  B6: { band: "B6", name: "Red Edge 2", wavelength: "740 nm", nativeResolution: "20m" },
  B7: { band: "B7", name: "Red Edge 3", wavelength: "783 nm", nativeResolution: "20m" },
  B8: { band: "B8", name: "NIR (Broad)", wavelength: "842 nm", nativeResolution: "10m" },
  B8A: { band: "B8A", name: "Narrow NIR", wavelength: "865 nm", nativeResolution: "20m" },
  B11: { band: "B11", name: "SWIR 1", wavelength: "1610 nm", nativeResolution: "20m" },
  B12: { band: "B12", name: "SWIR 2", wavelength: "2190 nm", nativeResolution: "20m" },
} as const;

export const VEGETATION_INDEX_STYLES: Record<string, VegetationIndexStyleConfig> = {
  ndvi: {
    id: "ndvi",
    name: "Normalized Difference Vegetation Index (NDVI)",
    shortName: "NDVI",
    marathiName: "वनस्पती निर्देशांक (NDVI)",
    category: "vegetation",
    formula: "(B8 - B4) / (B8 + B4)",
    bandsUsed: [SENTINEL2_BANDS.B8, SENTINEL2_BANDS.B4],
    sourceMetadata: {
      satellite: "Sentinel-2",
      constellation: "Copernicus",
      product: "Sentinel-2 multispectral imagery (Level-2A BOA Surface Reflectance)",
      source: "Copernicus Sentinel-2",
      resolution: "10m native grid",
      period: "Annual Multi-Temporal Composite (2025–2026)",
    },
    range: { min: -0.1232, max: 0.8544, mean: 0.3816, std: 0.1553 },
    isVegetationHealth: true,
    notes: "Visualization classification based on general vegetative canopy reflectance; not a crop-specific universal threshold.",
    classes: [
      {
        id: "very_low",
        min: -1.0,
        max: 0.20,
        label: "Very Low / Stressed",
        marathiLabel: "अत्यंत कमी / ताणलेली",
        color: "#EF4444",
        textColor: "#ffffff",
      },
      {
        id: "low",
        min: 0.20,
        max: 0.40,
        label: "Low / Sparse Vegetation",
        marathiLabel: "कमी / विरळ वनस्पती",
        color: "#F97316",
        textColor: "#000000",
      },
      {
        id: "moderate",
        min: 0.40,
        max: 0.60,
        label: "Moderate Vegetation",
        marathiLabel: "मध्यम वनस्पती",
        color: "#FACC15",
        textColor: "#000000",
      },
      {
        id: "healthy",
        min: 0.60,
        max: 0.80,
        label: "Healthy Vegetation",
        marathiLabel: "निरोगी वनस्पती",
        color: "#4ADE80",
        textColor: "#000000",
      },
      {
        id: "dense",
        min: 0.80,
        max: 1.0,
        label: "Dense / Very Healthy Vegetation",
        marathiLabel: "घनदाट / अतिशय निरोगी वनस्पती",
        color: "#16A34A",
        textColor: "#ffffff",
      },
    ],
    stops: [
      { value: 0.10, color: "#EF4444", label: "< 0.20: Very Low / Stressed", marathiLabel: "< ०.२०: अत्यंत कमी / ताण" },
      { value: 0.30, color: "#F97316", label: "0.20–0.40: Low / Sparse", marathiLabel: "०.२०–०.४०: कमी / विरळ" },
      { value: 0.50, color: "#FACC15", label: "0.40–0.60: Moderate", marathiLabel: "०.४०–०.६०: मध्यम वनस्पती" },
      { value: 0.70, color: "#4ADE80", label: "0.60–0.80: Healthy", marathiLabel: "०.६०–०.८०: निरोगी वनस्पती" },
      { value: 0.85, color: "#16A34A", label: "> 0.80: Dense / Very Healthy", marathiLabel: "> ०.८०: घनदाट वनस्पती" },
    ],
  },

  evi: {
    id: "evi",
    name: "Enhanced Vegetation Index (EVI)",
    shortName: "EVI",
    marathiName: "वर्धित वनस्पती निर्देशांक (EVI)",
    category: "vegetation",
    formula: "2.5 * (B8 - B4) / (B8 + 6 * B4 - 7.5 * B2 + 1)",
    bandsUsed: [SENTINEL2_BANDS.B8, SENTINEL2_BANDS.B4, SENTINEL2_BANDS.B2],
    sourceMetadata: {
      satellite: "Sentinel-2",
      constellation: "Copernicus",
      product: "Sentinel-2 multispectral imagery (Atmospherically Resistant)",
      source: "Copernicus Sentinel-2",
      resolution: "10m native grid",
      period: "Annual Multi-Temporal Composite (2025–2026)",
    },
    range: { min: -0.0224, max: 0.6649, mean: 0.2502, std: 0.1037 },
    isVegetationHealth: true,
    notes: "EVI accounts for atmospheric aerosol resistance and canopy background; lower numeric range than NDVI.",
    classes: [
      {
        id: "low",
        min: -1.0,
        max: 0.12,
        label: "Low EVI / Stressed",
        marathiLabel: "कमी EVI / ताणलेली",
        color: "#EF4444",
        textColor: "#ffffff",
      },
      {
        id: "moderate_low",
        min: 0.12,
        max: 0.20,
        label: "Moderate-Low EVI",
        marathiLabel: "मध्यम-कमी EVI",
        color: "#F97316",
        textColor: "#000000",
      },
      {
        id: "moderate",
        min: 0.20,
        max: 0.30,
        label: "Moderate EVI",
        marathiLabel: "मध्यम EVI",
        color: "#FACC15",
        textColor: "#000000",
      },
      {
        id: "healthy",
        min: 0.30,
        max: 0.42,
        label: "Healthy EVI",
        marathiLabel: "निरोगी EVI",
        color: "#4ADE80",
        textColor: "#000000",
      },
      {
        id: "high",
        min: 0.42,
        max: 1.0,
        label: "High / Dense EVI",
        marathiLabel: "उच्च / घनदाट EVI",
        color: "#16A34A",
        textColor: "#ffffff",
      },
    ],
    stops: [
      { value: 0.08, color: "#EF4444", label: "< 0.12: Low EVI", marathiLabel: "< ०.१२: कमी EVI" },
      { value: 0.16, color: "#F97316", label: "0.12–0.20: Moderate-Low", marathiLabel: "०.१२–०.२०: मध्यम-कमी EVI" },
      { value: 0.25, color: "#FACC15", label: "0.20–0.30: Moderate", marathiLabel: "०.२०–०.३०: मध्यम EVI" },
      { value: 0.36, color: "#4ADE80", label: "0.30–0.42: Healthy", marathiLabel: "०.३०–०.४२: निरोगी EVI" },
      { value: 0.50, color: "#16A34A", label: "> 0.42: High / Dense", marathiLabel: "> ०.४२: उच्च EVI" },
    ],
  },

  savi: {
    id: "savi",
    name: "Soil-Adjusted Vegetation Index (SAVI)",
    shortName: "SAVI",
    marathiName: "माती-समायोजित वनस्पती निर्देशांक (SAVI)",
    category: "vegetation",
    formula: "((B8 - B4) / (B8 + B4 + 0.5)) * 1.5",
    bandsUsed: [SENTINEL2_BANDS.B8, SENTINEL2_BANDS.B4],
    sourceMetadata: {
      satellite: "Sentinel-2",
      constellation: "Copernicus",
      product: "Sentinel-2 multispectral imagery (Soil Brightness Adjusted L=0.5)",
      source: "Copernicus Sentinel-2",
      resolution: "10m native grid",
      period: "Annual Multi-Temporal Composite (2025–2026)",
    },
    range: { min: -0.0251, max: 0.5828, mean: 0.2325, std: 0.0931 },
    isVegetationHealth: true,
    notes: "SAVI reduces soil brightness influences for sparse Deccan Vertisol conditions with soil factor L = 0.5.",
    classes: [
      {
        id: "low",
        min: -1.0,
        max: 0.12,
        label: "Low Vegetation / Stressed",
        marathiLabel: "कमी वनस्पती / ताण",
        color: "#EF4444",
        textColor: "#ffffff",
      },
      {
        id: "low_moderate",
        min: 0.12,
        max: 0.18,
        label: "Low-Moderate Vegetation",
        marathiLabel: "कमी-मध्यम वनस्पती",
        color: "#F97316",
        textColor: "#000000",
      },
      {
        id: "moderate",
        min: 0.18,
        max: 0.28,
        label: "Moderate Vegetation",
        marathiLabel: "मध्यम वनस्पती",
        color: "#FACC15",
        textColor: "#000000",
      },
      {
        id: "healthy",
        min: 0.28,
        max: 0.40,
        label: "Healthy Vegetation",
        marathiLabel: "निरोगी वनस्पती",
        color: "#4ADE80",
        textColor: "#000000",
      },
      {
        id: "dense",
        min: 0.40,
        max: 1.0,
        label: "Dense Vegetation",
        marathiLabel: "घनदाट वनस्पती",
        color: "#16A34A",
        textColor: "#ffffff",
      },
    ],
    stops: [
      { value: 0.08, color: "#EF4444", label: "< 0.12: Low Vegetation", marathiLabel: "< ०.१२: कमी वनस्पती" },
      { value: 0.15, color: "#F97316", label: "0.12–0.18: Low-Moderate", marathiLabel: "०.१२–०.१८: कमी-मध्यम" },
      { value: 0.23, color: "#FACC15", label: "0.18–0.28: Moderate", marathiLabel: "०.१८–०.२८: मध्यम वनस्पती" },
      { value: 0.34, color: "#4ADE80", label: "0.28–0.40: Healthy", marathiLabel: "०.२८–०.४०: निरोगी वनस्पती" },
      { value: 0.46, color: "#16A34A", label: "> 0.40: Dense Vegetation", marathiLabel: "> ०.४०: घनदाट वनस्पती" },
    ],
  },

  ndmi: {
    id: "ndmi",
    name: "Normalized Difference Moisture Index (NDMI)",
    shortName: "NDMI",
    marathiName: "ओलावा निर्देशांक (NDMI)",
    category: "moisture",
    formula: "(B8A - B11) / (B8A + B11)",
    bandsUsed: [SENTINEL2_BANDS.B8A, SENTINEL2_BANDS.B11],
    sourceMetadata: {
      satellite: "Sentinel-2",
      constellation: "Copernicus",
      product: "Sentinel-2 multispectral imagery (Canopy & Root-Zone Moisture)",
      source: "Copernicus Sentinel-2",
      resolution: "20m resampled to 10m grid",
      period: "Annual Multi-Temporal Composite (2025–2026)",
    },
    range: { min: -0.5350, max: 0.4570, mean: 0.0578, std: 0.1129 },
    isVegetationHealth: false,
    notes: "NDMI measures crop canopy liquid water content using NIR (B8A) and SWIR-1 (B11) bands.",
    classes: [
      {
        id: "severe_stress",
        min: -1.0,
        max: -0.08,
        label: "Very Dry / Low Moisture",
        marathiLabel: "अत्यंत कोरडे / कमी ओलावा",
        color: "#BAE6FD",
        textColor: "#000000",
      },
      {
        id: "dry",
        min: -0.08,
        max: 0.02,
        label: "Dry / Mild Moisture",
        marathiLabel: "कोरडे / सौम्य ओलावा",
        color: "#38BDF8",
        textColor: "#000000",
      },
      {
        id: "moderate",
        min: 0.02,
        max: 0.12,
        label: "Moderate Moisture",
        marathiLabel: "मध्यम ओलावा",
        color: "#0284C7",
        textColor: "#ffffff",
      },
      {
        id: "good",
        min: 0.12,
        max: 0.24,
        label: "Good Moisture",
        marathiLabel: "चांगला ओलावा",
        color: "#1D4ED8",
        textColor: "#ffffff",
      },
      {
        id: "high",
        min: 0.24,
        max: 1.0,
        label: "High Moisture",
        marathiLabel: "उच्च ओलावा",
        color: "#172554",
        textColor: "#ffffff",
      },
    ],
    stops: [
      { value: -0.15, color: "#BAE6FD", label: "< -0.08: Low Moisture (Sky Blue)", marathiLabel: "< -०.०८: कमी ओलावा (आकाशी)" },
      { value: -0.03, color: "#38BDF8", label: "-0.08–0.02: Mild Moisture", marathiLabel: "-०.०८–०.०२: सौम्य ओलावा" },
      { value: 0.07, color: "#0284C7", label: "0.02–0.12: Moderate Moisture", marathiLabel: "०.०२–०.१२: मध्यम ओलावा" },
      { value: 0.18, color: "#1D4ED8", label: "0.12–0.24: High Moisture", marathiLabel: "०.१२–०.२४: चांगला ओलावा" },
      { value: 0.32, color: "#172554", label: "> 0.24: High Moisture (Dark Blue)", marathiLabel: "> ०.२४: उच्च ओलावा (गडद निळा)" },
    ],
  },

  ndre: {
    id: "ndre",
    name: "Normalized Difference Red Edge (NDRE)",
    shortName: "NDRE",
    marathiName: "रेड एज वनस्पती निर्देशांक (NDRE)",
    category: "vegetation",
    formula: "(B8 - B5) / (B8 + B5)",
    bandsUsed: [SENTINEL2_BANDS.B8, SENTINEL2_BANDS.B5],
    sourceMetadata: {
      satellite: "Sentinel-2",
      constellation: "Copernicus",
      product: "Sentinel-2 multispectral imagery (Chlorophyll / Nitrogen Sensitive)",
      source: "Copernicus Sentinel-2",
      resolution: "20m resampled to 10m grid",
      period: "Annual Multi-Temporal Composite (2025–2026)",
    },
    range: { min: -0.3936, max: 0.6299, mean: 0.2448, std: 0.1144 },
    isVegetationHealth: true,
    notes: "Uses Red Edge 1 (B5) to avoid early NDVI saturation in dense sugarcane and orchard canopies.",
    classes: [
      {
        id: "low",
        min: -1.0,
        max: 0.12,
        label: "Low / Stressed",
        marathiLabel: "कमी / ताणलेली वनस्पती",
        color: "#EF4444",
        textColor: "#ffffff",
      },
      {
        id: "moderate_low",
        min: 0.12,
        max: 0.20,
        label: "Moderate-Low",
        marathiLabel: "मध्यम-कमी",
        color: "#F97316",
        textColor: "#000000",
      },
      {
        id: "moderate",
        min: 0.20,
        max: 0.30,
        label: "Moderate",
        marathiLabel: "मध्यम",
        color: "#FACC15",
        textColor: "#000000",
      },
      {
        id: "healthy",
        min: 0.30,
        max: 0.42,
        label: "Healthy",
        marathiLabel: "निरोगी",
        color: "#4ADE80",
        textColor: "#000000",
      },
      {
        id: "dense",
        min: 0.42,
        max: 1.0,
        label: "High / Dense Vegetation",
        marathiLabel: "उच्च / घनदाट वनस्पती",
        color: "#16A34A",
        textColor: "#ffffff",
      },
    ],
    stops: [
      { value: 0.07, color: "#EF4444", label: "< 0.12: Low / Stressed", marathiLabel: "< ०.१२: कमी / ताण" },
      { value: 0.16, color: "#F97316", label: "0.12–0.20: Moderate-Low", marathiLabel: "०.१२–०.२०: मध्यम-कमी" },
      { value: 0.25, color: "#FACC15", label: "0.20–0.30: Moderate", marathiLabel: "०.२०–०.३०: मध्यम" },
      { value: 0.36, color: "#4ADE80", label: "0.30–0.42: Healthy", marathiLabel: "०.३०–०.४२: निरोगी" },
      { value: 0.50, color: "#16A34A", label: "> 0.42: High / Dense", marathiLabel: "> ०.४२: उच्च वनस्पती" },
    ],
  },

  bsi: {
    id: "bsi",
    name: "Bare Soil Index (BSI)",
    shortName: "BSI",
    marathiName: "उघडी माती निर्देशांक (BSI)",
    category: "soil",
    formula: "((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))",
    bandsUsed: [SENTINEL2_BANDS.B11, SENTINEL2_BANDS.B4, SENTINEL2_BANDS.B8, SENTINEL2_BANDS.B2],
    sourceMetadata: {
      satellite: "Sentinel-2",
      constellation: "Copernicus",
      product: "Sentinel-2 multispectral imagery (Bare Soil & Mineral Exposure)",
      source: "Copernicus Sentinel-2",
      resolution: "10m/20m native grid",
      period: "Annual Multi-Temporal Composite (2025–2026)",
    },
    range: { min: -0.3900, max: 0.3810, mean: 0.0086, std: 0.1037 },
    isVegetationHealth: false,
    notes: "BSI is NOT a vegetation-health index. Negative values indicate dense vegetation cover. Never take absolute values.",
    classes: [
      {
        id: "dense_veg",
        min: -1.0,
        max: -0.05,
        label: "Dense Vegetation / Ground Cover",
        marathiLabel: "घनदाट वनस्पती / जमिनीचे आच्छादन",
        color: "#16A34A",
        textColor: "#ffffff",
      },
      {
        id: "mixed_cover",
        min: -0.05,
        max: 0.04,
        label: "Mixed Soil / Vegetation",
        marathiLabel: "मिश्रित आच्छादन / माती व वनस्पती",
        color: "#FACC15",
        textColor: "#000000",
      },
      {
        id: "partial_soil",
        min: 0.04,
        max: 0.12,
        label: "Partial Soil Exposure",
        marathiLabel: "अंशतः उघडी माती",
        color: "#F97316",
        textColor: "#000000",
      },
      {
        id: "bare_soil",
        min: 0.12,
        max: 1.0,
        label: "Bare / Exposed Soil",
        marathiLabel: "पूर्ण उघडी माती",
        color: "#EF4444",
        textColor: "#ffffff",
      },
    ],
    stops: [
      { value: -0.15, color: "#16A34A", label: "< -0.05: Dense Vegetation Cover", marathiLabel: "< -०.०५: वनस्पती आच्छादन" },
      { value: 0.00, color: "#FACC15", label: "-0.05–0.04: Mixed Cover", marathiLabel: "-०.०५–०.०४: मिश्रित आच्छादन" },
      { value: 0.08, color: "#F97316", label: "0.04–0.12: Partial Soil Exposure", marathiLabel: "०.०४–०.१२: अंशतः माती" },
      { value: 0.20, color: "#EF4444", label: "> 0.12: Bare / Exposed Soil", marathiLabel: "> ०.१२: उघडी माती" },
    ],
  },

  ndwi: {
    id: "ndwi",
    name: "Normalized Difference Water Index (NDWI)",
    shortName: "NDWI",
    marathiName: "पाणी निर्देशांक (NDWI)",
    category: "water",
    formula: "(B3 - B8) / (B3 + B8)",
    bandsUsed: [SENTINEL2_BANDS.B3, SENTINEL2_BANDS.B8],
    sourceMetadata: {
      satellite: "Sentinel-2",
      constellation: "Copernicus",
      product: "Sentinel-2 multispectral imagery (McFeeters Open Water Delineation)",
      source: "Copernicus Sentinel-2",
      resolution: "10m native grid",
      period: "Annual Multi-Temporal Composite (2025–2026)",
    },
    range: { min: -0.7861, max: 0.3560, mean: -0.4302, std: 0.1150 },
    isVegetationHealth: false,
    notes: "Water-oriented scale for delineating surface water, canals, and wet soils; non-water agricultural land is negative.",
    classes: [
      {
        id: "very_low",
        min: -1.0,
        max: -0.50,
        label: "Very Low / Dry",
        marathiLabel: "अत्यंत कमी / कोरडे",
        color: "#BAE6FD",
        textColor: "#000000",
      },
      {
        id: "low",
        min: -0.50,
        max: -0.38,
        label: "Low Water Presence",
        marathiLabel: "कमी पाणी अस्तित्व",
        color: "#38BDF8",
        textColor: "#000000",
      },
      {
        id: "moderate",
        min: -0.38,
        max: -0.20,
        label: "Moderate Water Presence",
        marathiLabel: "मध्यम पाणी अस्तित्व",
        color: "#0284C7",
        textColor: "#ffffff",
      },
      {
        id: "high",
        min: -0.20,
        max: 0.00,
        label: "High Water Presence",
        marathiLabel: "उच्च पाणी अस्तित्व",
        color: "#1D4ED8",
        textColor: "#ffffff",
      },
      {
        id: "very_high",
        min: 0.00,
        max: 1.0,
        label: "Very High / Surface Water",
        marathiLabel: "अतिउच्च / पृष्ठभागावरील पाणी",
        color: "#172554",
        textColor: "#ffffff",
      },
    ],
    stops: [
      { value: -0.58, color: "#BAE6FD", label: "< -0.50: Very Low / Dry (Sky Blue)", marathiLabel: "< -०.५०: कोरडे (आकाशी)" },
      { value: -0.44, color: "#38BDF8", label: "-0.50–-0.38: Low", marathiLabel: "-०.५०–-०.३८: कमी पाणी" },
      { value: -0.29, color: "#0284C7", label: "-0.38–-0.20: Moderate", marathiLabel: "-०.३८–-०.२०: मध्यम पाणी" },
      { value: -0.10, color: "#1D4ED8", label: "-0.20–0.00: High Presence", marathiLabel: "-०.२०–०.००: उच्च पाणी" },
      { value: 0.15, color: "#172554", label: "> 0.00: Open Surface Water (Dark Blue)", marathiLabel: "> ०.००: जलाशय / पाणी (गडद निळा)" },
    ],
  },
};

/**
 * Check if layer is a Sentinel-2 spectral index.
 */
export function isVegetationIndex(layerId?: string | null): boolean {
  if (!layerId) return false;
  return layerId.toLowerCase() in VEGETATION_INDEX_STYLES;
}

/**
 * Retrieve style configuration for a Sentinel-2 spectral index.
 */
export function getVegetationIndexStyle(layerId?: string | null): VegetationIndexStyleConfig | null {
  if (!layerId) return null;
  return VEGETATION_INDEX_STYLES[layerId.toLowerCase()] ?? null;
}

/**
 * Classify a raw Sentinel-2 spectral index value using the FIXED centralized rules.
 * 
 * GUARANTEE:
 * Same index value + same layer = same status, same color, same classification.
 * No per-Gat or per-viewport normalization.
 */
export function classifyVegetationIndexValue(
  layerId: string,
  rawVal: number,
  locale?: string
): {
  status: string;
  color: string;
  textColor: string;
  classId: string;
  indexConfig: VegetationIndexStyleConfig;
} | null {
  const cfg = getVegetationIndexStyle(layerId);
  if (!cfg) return null;

  for (const c of cfg.classes) {
    if (rawVal >= c.min && rawVal < c.max) {
      return {
        status: locale === "mr" ? c.marathiLabel : c.label,
        color: c.color,
        textColor: c.textColor,
        classId: c.id,
        indexConfig: cfg,
      };
    }
  }

  // Fallback for upper bound inclusive or out-of-range edge cases
  const last = cfg.classes[cfg.classes.length - 1];
  const first = cfg.classes[0];
  const chosen = rawVal >= last.max ? last : first;

  return {
    status: locale === "mr" ? chosen.marathiLabel : chosen.label,
    color: chosen.color,
    textColor: chosen.textColor,
    classId: chosen.id,
    indexConfig: cfg,
  };
}
