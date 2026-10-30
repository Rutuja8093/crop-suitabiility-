"""
SoilPilot - Comprehensive 22-Layer DSM Exporter for Malegaon Khurd Project
Resamples and exports all 22 layers into 3 structured categories:
1. Soil Properties (0–30 cm Root-Zone Standardized)
2. Topography & Elevation
3. Land Use & Multi-Spectral Indices

Generates:
- PNG georeferenced raster overlays in frontend/public/data/dsm/layers/
- Quantized uint16 grids in frontend/public/data/dsm/grids/
- Master manifest.json in frontend/public/data/dsm/manifest.json
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import numpy as np
import pyproj
import tifffile
from PIL import Image
from scipy.interpolate import RegularGridInterpolator
from scipy.ndimage import distance_transform_edt, gaussian_filter

NODATA_U16 = 65535
MAX_U16 = 65534

# -----------------------------------------------------------------------------
# Color Palettes
# -----------------------------------------------------------------------------

# Precision Agronomic Fertility Contour Palette (Deficient Crimson -> Dark Forest Green)
CONTOUR_AGRONOMIC_PALETTE = [
    (0.00, (253, 35, 0)),     # #fd2300 - Bold Crimson Red (Critical Deficient)
    (0.14, (253, 136, 0)),    # #fd8800 - Vibrant Orange (Low)
    (0.28, (254, 187, 0)),    # #febb00 - Warm Golden Amber (Moderately Low)
    (0.42, (253, 233, 0)),    # #fde900 - Lemon Yellow (Average / Marginal)
    (0.57, (222, 234, 1)),    # #deea01 - Chartreuse / Lime (Good)
    (0.71, (164, 196, 0)),    # #a4c400 - Light Olive Green (Sufficient / High)
    (0.85, (107, 161, 1)),    # #6ba101 - Medium Green (Optimal)
    (1.00, (50, 123, 0)),     # #327b00 - Deep Forest Green (Very High / Prime)
]

# Inverted Palette for physical constraints (compaction, slope, rocks, bare soil)
CONTOUR_INVERTED_PALETTE = [
    (0.00, (50, 123, 0)),     # #327b00 - Deep Forest Green (Low / Well-Aerated / Flat / Favorable)
    (0.14, (107, 161, 1)),    # #6ba101
    (0.28, (164, 196, 0)),    # #a4c400
    (0.42, (222, 234, 1)),    # #deea01
    (0.57, (253, 233, 0)),    # #fde900
    (0.71, (254, 187, 0)),    # #febb00
    (0.85, (253, 136, 0)),    # #fd8800
    (1.00, (253, 35, 0)),     # #fd2300 - Deep Crimson Red (High Compaction / Steep / Rocky / Exposed)
]

# Hypsometric Elevation Palette (Valley green -> Buff terrace -> Ochre ridge)
ELEVATION_PALETTE = [
    (0.00, (45, 106, 79)),    # #2d6a4f - Valley emerald green (~541m)
    (0.20, (82, 183, 136)),   # #52b788 - Lower slope mint green
    (0.40, (183, 228, 199)),  # #b7e4c7 - Gentle bench pale green
    (0.60, (224, 192, 151)),  # #e0c097 - Mid terrace buff sand
    (0.80, (212, 163, 115)),  # #d4a373 - Upper terrace warm amber
    (1.00, (140, 80, 35)),    # #8c5023 - Summit ridge ochre brown (~582m)
]

# Moisture & Water Palette (Dry amber -> Moist green -> Cyan -> Deep Water Blue)
MOISTURE_PALETTE = [
    (0.00, (217, 119, 6)),    # #d97706 - Dry amber
    (0.20, (234, 179, 8)),    # #eab308 - Marginal yellow
    (0.40, (132, 204, 22)),   # #84cc16 - Moderate moisture lime
    (0.60, (16, 185, 129)),   # #10b981 - Good moisture emerald
    (0.80, (6, 182, 212)),    # #06b6d4 - High moisture cyan
    (1.00, (37, 99, 235)),    # #2563eb - Saturated water blue
]

# QGIS LULC Symbology Palette matching DSM workflow specifications
DYNAMIC_WORLD_COLORS = {
    0: (0, 102, 255),    # 0: Water -> Blue (#0066ff)
    1: (0, 100, 0),      # 1: Trees -> Dark Green (#006400)
    2: (124, 252, 0),    # 2: Grass -> Light Green (#7cfc00)
    3: (0, 230, 230),    # 3: Flooded Vegetation -> Cyan (#00e6e6)
    4: (233, 30, 99),    # 4: Crops -> Magenta / Pink (#e91e63)
    5: (128, 128, 0),    # 5: Shrub & Scrub -> Olive (#808000)
    6: (63, 81, 181),    # 6: Built Area -> Blue / Indigo (#3f51b5)
    7: (210, 180, 140),  # 7: Bare Ground -> Light Gray / Tan (#d2b48c)
    8: (255, 255, 255),  # 8: Snow & Ice -> White (#ffffff)
}

DYNAMIC_WORLD_LABELS = {
    0: ("Water", "पाणी / जलाशय"),
    1: ("Trees", "झाडे / वृक्ष"),
    2: ("Grass", "गवत"),
    3: ("Flooded Vegetation", "जलमय वनस्पती"),
    4: ("Crops", "पिके / शेती"),
    5: ("Shrub & Scrub", "झुडपे"),
    6: ("Built Area", "वस्ती / बांधकाम"),
    7: ("Bare Ground", "उघडी जमीन"),
    8: ("Snow & Ice", "बर्फ / हिम"),
}

# USDA Soil Texture Classes
SOIL_TEXTURE_COLORS = {
    1: (92, 61, 46),     # Clay (Vertisol dark reddish brown)
    2: (112, 75, 56),    # Silty Clay
    3: (130, 85, 60),    # Sandy Clay
    4: (150, 100, 70),   # Clay Loam
}

# -----------------------------------------------------------------------------
# Scientifically Fixed Index Color Classifications (Copernicus Sentinel-2)
# -----------------------------------------------------------------------------
INDEX_CLASSES = {
    "ndvi": [
        {"min": -10.0, "max": 0.20, "rgb": (239, 68, 68), "hex": "#EF4444", "label": "< 0.20: Very Low / Stressed"},
        {"min": 0.20, "max": 0.40, "rgb": (249, 115, 22), "hex": "#F97316", "label": "0.20–0.40: Low / Sparse"},
        {"min": 0.40, "max": 0.60, "rgb": (250, 204, 21), "hex": "#FACC15", "label": "0.40–0.60: Moderate"},
        {"min": 0.60, "max": 0.80, "rgb": (74, 222, 128), "hex": "#4ADE80", "label": "0.60–0.80: Healthy"},
        {"min": 0.80, "max": 10.0, "rgb": (22, 163, 74), "hex": "#16A34A", "label": "> 0.80: Dense / Very Healthy"},
    ],
    "evi": [
        {"min": -10.0, "max": 0.12, "rgb": (239, 68, 68), "hex": "#EF4444", "label": "< 0.12: Low EVI / Stressed"},
        {"min": 0.12, "max": 0.20, "rgb": (249, 115, 22), "hex": "#F97316", "label": "0.12–0.20: Moderate-Low"},
        {"min": 0.20, "max": 0.30, "rgb": (250, 204, 21), "hex": "#FACC15", "label": "0.20–0.30: Moderate"},
        {"min": 0.30, "max": 0.42, "rgb": (74, 222, 128), "hex": "#4ADE80", "label": "0.30–0.42: Healthy"},
        {"min": 0.42, "max": 10.0, "rgb": (22, 163, 74), "hex": "#16A34A", "label": "> 0.42: High / Dense"},
    ],
    "savi": [
        {"min": -10.0, "max": 0.12, "rgb": (239, 68, 68), "hex": "#EF4444", "label": "< 0.12: Low Vegetation"},
        {"min": 0.12, "max": 0.18, "rgb": (249, 115, 22), "hex": "#F97316", "label": "0.12–0.18: Low-Moderate"},
        {"min": 0.18, "max": 0.28, "rgb": (250, 204, 21), "hex": "#FACC15", "label": "0.18–0.28: Moderate"},
        {"min": 0.28, "max": 0.40, "rgb": (74, 222, 128), "hex": "#4ADE80", "label": "0.28–0.40: Healthy"},
        {"min": 0.40, "max": 10.0, "rgb": (22, 163, 74), "hex": "#16A34A", "label": "> 0.40: Dense Vegetation"},
    ],
    "ndmi": [
        {"min": -10.0, "max": -0.08, "rgb": (186, 230, 253), "hex": "#BAE6FD", "label": "< -0.08: Low Moisture (Sky Blue)"},
        {"min": -0.08, "max": 0.02, "rgb": (56, 189, 248), "hex": "#38BDF8", "label": "-0.08–0.02: Mild Moisture"},
        {"min": 0.02, "max": 0.12, "rgb": (2, 132, 199), "hex": "#0284C7", "label": "0.02–0.12: Moderate Moisture"},
        {"min": 0.12, "max": 0.24, "rgb": (29, 78, 216), "hex": "#1D4ED8", "label": "0.12–0.24: High Moisture"},
        {"min": 0.24, "max": 10.0, "rgb": (23, 37, 84), "hex": "#172554", "label": "> 0.24: High Moisture (Dark Blue)"},
    ],
    "ndre": [
        {"min": -10.0, "max": 0.12, "rgb": (239, 68, 68), "hex": "#EF4444", "label": "< 0.12: Low / Stressed"},
        {"min": 0.12, "max": 0.20, "rgb": (249, 115, 22), "hex": "#F97316", "label": "0.12–0.20: Moderate-Low"},
        {"min": 0.20, "max": 0.30, "rgb": (250, 204, 21), "hex": "#FACC15", "label": "0.20–0.30: Moderate"},
        {"min": 0.30, "max": 0.42, "rgb": (74, 222, 128), "hex": "#4ADE80", "label": "0.30–0.42: Healthy"},
        {"min": 0.42, "max": 10.0, "rgb": (22, 163, 74), "hex": "#16A34A", "label": "> 0.42: High / Dense"},
    ],
    "bsi": [
        {"min": -10.0, "max": -0.05, "rgb": (22, 163, 74), "hex": "#16A34A", "label": "< -0.05: Dense Vegetation Cover"},
        {"min": -0.05, "max": 0.04, "rgb": (250, 204, 21), "hex": "#FACC15", "label": "-0.05–0.04: Mixed Cover"},
        {"min": 0.04, "max": 0.12, "rgb": (249, 115, 22), "hex": "#F97316", "label": "0.04–0.12: Partial Soil Exposure"},
        {"min": 0.12, "max": 10.0, "rgb": (239, 68, 68), "hex": "#EF4444", "label": "> 0.12: Bare / Exposed Soil"},
    ],
    "ndwi": [
        {"min": -10.0, "max": -0.50, "rgb": (186, 230, 253), "hex": "#BAE6FD", "label": "< -0.50: Very Low / Dry (Sky Blue)"},
        {"min": -0.50, "max": -0.38, "rgb": (56, 189, 248), "hex": "#38BDF8", "label": "-0.50–-0.38: Low Water Presence"},
        {"min": -0.38, "max": -0.20, "rgb": (2, 132, 199), "hex": "#0284C7", "label": "-0.38–-0.20: Moderate Water"},
        {"min": -0.20, "max": 0.00, "rgb": (29, 78, 216), "hex": "#1D4ED8", "label": "-0.20–0.00: High Water"},
        {"min": 0.00, "max": 10.0, "rgb": (23, 37, 84), "hex": "#172554", "label": "> 0.00: Surface Water (Dark Blue)"},
    ],
}


def colorize_classified_index(arr: np.ndarray, class_defs: list[dict], valid_mask: np.ndarray) -> np.ndarray:
    """Colorize continuous spectral index array into exact scientifically fixed classification zones."""
    h, w_img = arr.shape
    rgba = np.zeros((h, w_img, 4), dtype=np.uint8)
    for c in class_defs:
        c_min = c["min"]
        c_max = c["max"]
        rgb = c["rgb"]
        if c_max >= 9.0:
            m = valid_mask & (arr >= c_min)
        else:
            m = valid_mask & (arr >= c_min) & (arr < c_max)
        rgba[m, 0] = rgb[0]
        rgba[m, 1] = rgb[1]
        rgba[m, 2] = rgb[2]
        rgba[m, 3] = 255
    return rgba


def colorize_continuous(arr: np.ndarray, vmin: float, vmax: float, palette: list[tuple[float, tuple[int, int, int]]], valid_mask: np.ndarray) -> np.ndarray:
    """Colorize continuous array into smooth organic agronomic contour bands."""
    filled = arr.copy()
    filled[~valid_mask] = np.nanmean(arr[valid_mask]) if np.any(valid_mask) else 0.0

    smoothed = gaussian_filter(filled, sigma=2.2)

    span = vmax - vmin if vmax > vmin else 1.0
    norm = np.clip((smoothed - vmin) / span, 0.0, 1.0)

    pal_rgb = np.array([p[1] for p in palette], dtype=np.float32)
    N = len(pal_rgb)
    t = norm * (N - 1)
    idx_floor = np.clip(np.floor(t).astype(int), 0, N - 2)
    idx_ceil = idx_floor + 1
    frac = t - idx_floor

    # Anti-aliased transition at band edges (w = 0.08)
    w = 0.08
    trans = np.zeros_like(frac)
    in_trans = frac > (1.0 - w)
    trans[in_trans] = (frac[in_trans] - (1.0 - w)) / w
    trans = trans * trans * (3.0 - 2.0 * trans)

    c0 = pal_rgb[idx_floor]
    c1 = pal_rgb[idx_ceil]
    rgb = (c0 * (1.0 - trans[:, :, None]) + c1 * trans[:, :, None]).astype(np.uint8)

    h, w_img = arr.shape
    rgba = np.zeros((h, w_img, 4), dtype=np.uint8)
    rgba[valid_mask, :3] = rgb[valid_mask]
    rgba[valid_mask, 3] = 255
    return rgba


def build_malegaonkh_dsm(src: Path, out: Path) -> None:
    (out / "layers").mkdir(parents=True, exist_ok=True)
    (out / "grids").mkdir(parents=True, exist_ok=True)

    # 1. Read Master Reference Grid (MalegaonKh_Annual_NDVI.tif)
    master_tif_path = src / "MalegaonKh_Annual_NDVI.tif"
    with tifffile.TiffFile(master_tif_path) as tif:
        p = tif.pages[0]
        master_ndvi = p.asarray().astype(np.float32)
        scale = p.tags["ModelPixelScaleTag"].value
        tie = p.tags["ModelTiepointTag"].value
        h, w = master_ndvi.shape
        west, north = tie[3], tie[4]
        east = west + w * scale[0]
        south = north - h * scale[1]

    ref_bounds = (west, south, east, north)
    ref_shape = (h, w)
    village_mask = np.isfinite(master_ndvi)
    valid_count = int(village_mask.sum())
    print(f"Master Grid: shape={ref_shape}, bounds={ref_bounds}, valid_village_pixels={valid_count}")

    # Pixel coordinate centers for master grid
    lons = np.linspace(west + scale[0] / 2, east - scale[0] / 2, w)
    lats = np.linspace(north - scale[1] / 2, south + scale[1] / 2, h)
    mg_lon, mg_lat = np.meshgrid(lons, lats)

    # Coordinate transformer for SoilGrids (EPSG:4326 -> ESRI:54009 World Mollweide)
    trans_to_moll = pyproj.Transformer.from_crs("EPSG:4326", "ESRI:54009", always_xy=True)
    xm, ym = trans_to_moll.transform(mg_lon, mg_lat)

    # Layer specifications
    LAYER_SPECS = [
        # =====================================================================
        # 1. Soil Properties (0–30 cm Root-Zone Standardized)
        # =====================================================================
        {
            "id": "bdod",
            "filename": "bdod_0-30cm_standard.tif",
            "type": "soilgrids",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "Bulk Density (0–30 cm)",
            "marathiName": "मातीची घनता (०-३० सेमी)",
            "unit": "g/cm³",
            "desc": "Dry mass of soil per unit volume (0–30 cm). Indicator of compaction, root aeration and penetration resistance.",
            "palette": CONTOUR_INVERTED_PALETTE,
            "clip_min": 1.25,
            "clip_max": 1.60,
        },
        {
            "id": "cec",
            "filename": "cec_0-30cm_standard.tif",
            "type": "soilgrids",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "Cation Exchange Capacity - CEC (0–30 cm)",
            "marathiName": "धनायन विनिमय क्षमता - CEC (०-३० सेमी)",
            "unit": "cmol(c)/kg",
            "desc": "Total capacity of soil to hold exchangeable cations (Ca, Mg, K). Reflects nutrient retention & fertility buffer.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 20.0,
            "clip_max": 42.0,
        },
        {
            "id": "cfvo",
            "filename": "cfvo_0-30cm_standard.tif",
            "type": "soilgrids",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "Coarse Fragments Volumetric Fraction (0–30 cm)",
            "marathiName": "जाड दगड-गोटे प्रमाण (०-३० सेमी)",
            "unit": "%",
            "desc": "Volume percentage of coarse rock fragments (>2mm) in root zone. Affects tillability and water capacity.",
            "palette": CONTOUR_INVERTED_PALETTE,
            "clip_min": 5.0,
            "clip_max": 16.0,
        },
        {
            "id": "clay",
            "filename": "clay_0-30cm_standard.tif",
            "type": "soilgrids",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "Clay Proportion (0–30 cm)",
            "marathiName": "मातीतील चिकण प्रमाण (०-३० सेमी)",
            "unit": "%",
            "desc": "Clay fraction (<0.002mm) by weight in root zone. Controls water retention, swelling and shrink-swell cracking.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 28.0,
            "clip_max": 48.0,
        },
        {
            "id": "sand",
            "filename": "sand_0-30cm_standard.tif",
            "type": "soilgrids",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "Sand Proportion (0–30 cm)",
            "marathiName": "मातीतील वाळूचे प्रमाण (०-३० सेमी)",
            "unit": "%",
            "desc": "Sand fraction (0.05–2.0mm) in root zone. Influences drainage, aeration, and thermal conductivity.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 18.0,
            "clip_max": 34.0,
        },
        {
            "id": "silt",
            "filename": "silt_0-30cm_standard.tif",
            "type": "soilgrids",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "Silt Proportion (0–30 cm)",
            "marathiName": "मातीतील गाळाचे प्रमाण (०-३० सेमी)",
            "unit": "%",
            "desc": "Silt fraction (0.002–0.05mm) in root zone. Provides moisture storage and optimal plant-available water.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 18.0,
            "clip_max": 31.0,
        },
        {
            "id": "soc",
            "filename": "soc_0-30cm_standard.tif",
            "type": "soilgrids",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "Soil Organic Carbon - SOC (0–30 cm)",
            "marathiName": "सेंद्रिय कर्ब - SOC (०-३० सेमी)",
            "unit": "%",
            "desc": "Organic carbon percentage in 0–30 cm root zone. Keystone indicator of microbial biological activity & aggregate stability.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 0.60,
            "clip_max": 1.40,
        },
        {
            "id": "nitrogen",
            "filename": "nitrogen_0-30cm_standard.tif",
            "type": "soilgrids",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "Total Nitrogen (0–30 cm)",
            "marathiName": "एकूण नत्र (०-३० सेमी)",
            "unit": "%",
            "desc": "Total Nitrogen concentration in the root zone. Crucial for leaf chlorophyll synthesis and crop vegetative growth.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 0.65,
            "clip_max": 1.25,
        },
        {
            "id": "ph",
            "filename": "phh2o_0-30cm_standard.tif",
            "type": "soilgrids",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "Soil pH (H₂O) (0–30 cm)",
            "marathiName": "जमिनीचा सामू (pH) (०-३० सेमी)",
            "unit": "pH",
            "desc": "Acidity / alkalinity (pH in H2O, 0–30 cm). Optimal neutral to slightly alkaline range for sugarcane & Deccan crops.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 6.80,
            "clip_max": 7.40,
        },
        {
            "id": "soil_texture",
            "filename": "Soil_Texture_Class_30cm.tif",
            "type": "texture_class",
            "category": "soil_properties",
            "categoryLabel": "Soil Properties (0–30 cm Root-Zone Standardized)",
            "categoryLabelMr": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
            "name": "USDA Soil Texture Classes (0–30 cm)",
            "marathiName": "USDA मातीचा पोत वर्ग (०-३० सेमी)",
            "unit": "Class",
            "desc": "Standard USDA Soil Texture Classification (Class 1 = Clay / Deep Vertisols). Dominant black cotton agricultural soil.",
        },

        # =====================================================================
        # 2. Topography & Elevation
        # =====================================================================
        {
            "id": "elevation",
            "filename": "MalegaonKh_Elevation_DEM.tif",
            "type": "elevation_dem",
            "category": "topography",
            "categoryLabel": "Topography & Elevation",
            "categoryLabelMr": "भूरूप आणि उंची",
            "name": "Digital Elevation Model (DEM)",
            "marathiName": "डिजिटल एलिव्हेशन मॉडेल (DEM)",
            "unit": "meters",
            "desc": "Surface elevation above mean sea level from high-resolution SRTM DEM. Drives surface hydrology and watershed drainage.",
            "palette": ELEVATION_PALETTE,
            "clip_min": 541.0,
            "clip_max": 582.0,
        },
        {
            "id": "slope",
            "filename": "SRTM_Slope_pct.tif",
            "type": "slope_pct",
            "category": "topography",
            "categoryLabel": "Topography & Elevation",
            "categoryLabelMr": "भूरूप आणि उंची",
            "name": "Slope Gradient",
            "marathiName": "जमिनीचा उतार (Slope Gradient)",
            "unit": "%",
            "desc": "Topographic inclination percentage. Critical for estimating soil erosion risk, water runoff speed and terracing needs.",
            "palette": CONTOUR_INVERTED_PALETTE,
            "clip_min": 0.0,
            "clip_max": 15.0,
        },

        # =====================================================================
        # 3. Land Use & Multi-Spectral Indices
        # =====================================================================
        {
            "id": "lulc",
            "filename": "LULC.tif",
            "type": "lulc_categorical",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Land Use / Land Cover (Dynamic World)",
            "marathiName": "जमीन वापर व आच्छादन (Dynamic World)",
            "unit": "Class",
            "desc": "Near-real-time global 10m LULC classification by Dynamic World (WRI/Google): Crops, Built, Water, Trees, Shrub, Grass.",
        },
        {
            "id": "kharif_rgb",
            "filename": "MalegaonKh_Kharif_Composite.tif",
            "type": "rgb_composite",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Kharif Season True-Color Composite",
            "marathiName": "खरीप हंगाम नैसर्गिक रंग उपग्रह प्रतिमा",
            "unit": "RGB",
            "desc": "Monsoon / Kharif season true-color optical satellite imagery composite from Sentinel-2 (Bands 4, 3, 2).",
        },
        {
            "id": "rabi_rgb",
            "filename": "MalegaonKh_Rabi_Composite.tif",
            "type": "rgb_composite",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Rabi Season True-Color Composite",
            "marathiName": "रब्बी हंगाम नैसर्गिक रंग उपग्रह प्रतिमा",
            "unit": "RGB",
            "desc": "Winter / Rabi season true-color optical satellite imagery composite from Sentinel-2 (Bands 4, 3, 2).",
        },
        {
            "id": "ndvi",
            "filename": "MalegaonKh_Annual_NDVI.tif",
            "type": "master_index",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Normalized Difference Vegetation Index (NDVI)",
            "marathiName": "वनस्पती निर्देशांक (NDVI)",
            "unit": "index",
            "desc": "Standard vegetation index measuring chlorophyll absorption & near-infrared reflectance. Evaluates crop vigor.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 0.10,
            "clip_max": 0.75,
        },
        {
            "id": "evi",
            "filename": "MalegaonKh_Annual_EVI.tif",
            "type": "master_index",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Enhanced Vegetation Index (EVI)",
            "marathiName": "वर्धित वनस्पती निर्देशांक (EVI)",
            "unit": "index",
            "desc": "Optimized index with reduced canopy background and atmospheric aerosol sensitivity. Ideal for dense crops.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 0.05,
            "clip_max": 0.55,
        },
        {
            "id": "savi",
            "filename": "MalegaonKh_Annual_SAVI.tif",
            "type": "master_index",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Soil-Adjusted Vegetation Index (SAVI)",
            "marathiName": "माती-समायोजित वनस्पती निर्देशांक (SAVI)",
            "unit": "index",
            "desc": "Adjusts for soil brightness influences in early vegetative or sparse canopy stages (L = 0.5 factor).",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 0.05,
            "clip_max": 0.50,
        },
        {
            "id": "ndmi",
            "filename": "MalegaonKh_Annual_NDMI.tif",
            "type": "master_index",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Normalized Difference Moisture Index (NDMI)",
            "marathiName": "ओलावा निर्देशांक (NDMI)",
            "unit": "index",
            "desc": "Monitors crop canopy water content and root-zone soil moisture stress using NIR (B8A) and SWIR (B11).",
            "palette": MOISTURE_PALETTE,
            "clip_min": -0.30,
            "clip_max": 0.40,
        },
        {
            "id": "ndre",
            "filename": "MalegaonKh_Annual_NDRE.tif",
            "type": "master_index",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Normalized Difference Red Edge (NDRE)",
            "marathiName": "रेड एज वनस्पती निर्देशांक (NDRE)",
            "unit": "index",
            "desc": "Uses Sentinel-2 RedEdge (B5/B7) for nitrogen content estimation without early saturation in thick sugarcane.",
            "palette": CONTOUR_AGRONOMIC_PALETTE,
            "clip_min": 0.05,
            "clip_max": 0.55,
        },
        {
            "id": "bsi",
            "filename": "MalegaonKh_Annual_BSI.tif",
            "type": "master_index",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Bare Soil Index (BSI)",
            "marathiName": "उघडी माती निर्देशांक (BSI)",
            "unit": "index",
            "desc": "Differentiates bare agricultural soil from fallow ground, gravel and dense crop cover using SWIR + Blue bands.",
            "palette": CONTOUR_INVERTED_PALETTE,
            "clip_min": -0.20,
            "clip_max": 0.30,
        },
        {
            "id": "ndwi",
            "filename": "MalegaonKh_Annual_NDWI.tif",
            "type": "master_index",
            "category": "land_use",
            "categoryLabel": "Land Use & Multi-Spectral Indices",
            "categoryLabelMr": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
            "name": "Normalized Difference Water Index (NDWI)",
            "marathiName": "पाणी निर्देशांक (NDWI)",
            "unit": "index",
            "desc": "Delineates open surface water bodies, canals, farm ponds and saturated wetland inundation zones.",
            "palette": MOISTURE_PALETTE,
            "clip_min": -0.60,
            "clip_max": 0.20,
        },
    ]

    manifest_layers = []

    for spec in LAYER_SPECS:
        layer_id = spec["id"]
        tif_path = src / spec["filename"]
        if not tif_path.exists():
            print(f"  [ERROR] Missing {tif_path.name}")
            continue

        print(f"Processing [{layer_id:<12}] {spec['name']} ...")

        # ---- Load and resample raster array to master grid (389, 467) ----
        if spec["type"] == "master_index":
            with tifffile.TiffFile(tif_path) as tif:
                arr = tif.pages[0].asarray().astype(np.float32)
            # Mask out outside village
            arr[~village_mask] = np.nan

        elif spec["type"] == "soilgrids":
            with tifffile.TiffFile(tif_path) as tif:
                sp = tif.pages[0]
                s_arr = sp.asarray().astype(np.float32)
                s_scale = sp.tags["ModelPixelScaleTag"].value
                s_tie = sp.tags["ModelTiepointTag"].value
                s_arr[s_arr == -9999] = np.nan
                sh, sw = s_arr.shape
                xs = np.linspace(s_tie[3] + s_scale[0] / 2, s_tie[3] + sw * s_scale[0] - s_scale[0] / 2, sw)
                ys = np.linspace(s_tie[4] - s_scale[1] / 2, s_tie[4] - sh * s_scale[1] + s_scale[1] / 2, sh)
                interp = RegularGridInterpolator((ys[::-1], xs), s_arr[::-1], bounds_error=False, fill_value=np.nan)
                arr = interp((ym, xm)).astype(np.float32)

            # Fill any NaN edges within village mask using distance transform
            nan_in_mask = np.isnan(arr) & village_mask
            if np.any(nan_in_mask):
                valid_src = np.isfinite(arr)
                idx = distance_transform_edt(~valid_src, return_distances=False, return_indices=True)
                arr = arr[tuple(idx)]

            arr[~village_mask] = np.nan

        elif spec["type"] == "elevation_dem":
            with tifffile.TiffFile(tif_path) as tif:
                dp = tif.pages[0]
                d_arr = dp.asarray().astype(np.float32)
                d_scale = dp.tags["ModelPixelScaleTag"].value
                d_tie = dp.tags["ModelTiepointTag"].value
                d_arr[d_arr == 0] = np.nan
                dh, dw = d_arr.shape
                dx_coords = np.linspace(d_tie[3] + d_scale[0] / 2, d_tie[3] + dw * d_scale[0] - d_scale[0] / 2, dw)
                dy_coords = np.linspace(d_tie[4] - d_scale[1] / 2, d_tie[4] - dh * d_scale[1] + d_scale[1] / 2, dh)
                interp = RegularGridInterpolator((dy_coords[::-1], dx_coords), d_arr[::-1], bounds_error=False, fill_value=np.nan)
                arr = interp((mg_lat, mg_lon)).astype(np.float32)

            nan_in_mask = np.isnan(arr) & village_mask
            if np.any(nan_in_mask):
                valid_src = np.isfinite(arr)
                idx = distance_transform_edt(~valid_src, return_distances=False, return_indices=True)
                arr = arr[tuple(idx)]

            arr[~village_mask] = np.nan

        elif spec["type"] == "slope_pct":
            with tifffile.TiffFile(tif_path) as tif:
                sp = tif.pages[0]
                s_arr = sp.asarray().astype(np.float32)
                s_scale = sp.tags["ModelPixelScaleTag"].value
                s_tie = sp.tags["ModelTiepointTag"].value
                sh, sw = s_arr.shape
                sx_coords = np.linspace(s_tie[3] + s_scale[0] / 2, s_tie[3] + sw * s_scale[0] - s_scale[0] / 2, sw)
                sy_coords = np.linspace(s_tie[4] - s_scale[1] / 2, s_tie[4] - sh * s_scale[1] + s_scale[1] / 2, sh)
                interp = RegularGridInterpolator((sy_coords[::-1], sx_coords), s_arr[::-1], bounds_error=False, fill_value=np.nan)
                arr = interp((mg_lat, mg_lon)).astype(np.float32)

            nan_in_mask = np.isnan(arr) & village_mask
            if np.any(nan_in_mask):
                valid_src = np.isfinite(arr)
                idx = distance_transform_edt(~valid_src, return_distances=False, return_indices=True)
                arr = arr[tuple(idx)]

            arr[~village_mask] = np.nan

        elif spec["type"] == "texture_class":
            with tifffile.TiffFile(tif_path) as tif:
                tp = tif.pages[0]
                t_arr = tp.asarray().astype(np.float32)
                t_scale = tp.tags["ModelPixelScaleTag"].value
                t_tie = tp.tags["ModelTiepointTag"].value
                th, tw = t_arr.shape
                tx_coords = np.linspace(t_tie[3] + t_scale[0] / 2, t_tie[3] + tw * t_scale[0] - t_scale[0] / 2, tw)
                ty_coords = np.linspace(t_tie[4] - t_scale[1] / 2, t_tie[4] - th * t_scale[1] + t_scale[1] / 2, th)
                interp = RegularGridInterpolator((ty_coords[::-1], tx_coords), t_arr[::-1], method="nearest", bounds_error=False, fill_value=np.nan)
                arr = interp((mg_lat, mg_lon)).astype(np.float32)

            # Within village mask, set any 0 or NaN to class 1 (Clay vertisol)
            arr[village_mask] = 1.0
            arr[~village_mask] = np.nan

        elif spec["type"] == "lulc_categorical":
            try:
                arr = np.array(Image.open(tif_path)).astype(np.float32)
            except Exception:
                with tifffile.TiffFile(tif_path) as tif:
                    arr = tif.pages[0].asarray().astype(np.float32)
            arr[~village_mask] = np.nan

        elif spec["type"] == "rgb_composite":
            with tifffile.TiffFile(tif_path) as tif:
                rgb_arr = tif.pages[0].asarray().astype(np.float32)  # (389, 467, 3)

        # ---- RENDER PNG OVERLAY & GRID ----
        valid = village_mask & np.isfinite(arr if spec["type"] != "rgb_composite" else rgb_arr[:, :, 0])
        valid_pixel_count = int(valid.sum())

        if spec["type"] == "rgb_composite":
            # True-color RGB percentile stretch
            rgba = np.zeros((h, w, 4), dtype=np.uint8)
            for c in range(3):
                channel = rgb_arr[:, :, c]
                c_valid = channel[valid]
                p2, p98 = np.percentile(c_valid, 2), np.percentile(c_valid, 98)
                span = p98 - p2 if p98 > p2 else 1.0
                norm_c = np.clip((channel - p2) / span, 0.0, 1.0)
                rgba[valid, c] = (norm_c[valid] * 255).astype(np.uint8)
            rgba[valid, 3] = 255
            Image.fromarray(rgba, "RGBA").save(out / "layers" / f"{layer_id}.png", optimize=True)

            # Quantized grid stores luminance for live probe
            luminance = 0.299 * rgb_arr[:, :, 0] + 0.587 * rgb_arr[:, :, 1] + 0.114 * rgb_arr[:, :, 2]
            vals = luminance[valid]
            raw_min, raw_max = float(vals.min()), float(vals.max())
            step = (raw_max - raw_min) / MAX_U16 if (raw_max - raw_min) > 0 else 1.0
            q = np.full((h, w), NODATA_U16, dtype="<u2")
            q[valid] = np.round((luminance[valid] - raw_min) / step).astype("<u2")
            (out / "grids" / f"{layer_id}.bin").write_bytes(q.tobytes())

            stops = [
                {"pct": 0, "color": "rgb(40, 60, 40)", "value": 0.0, "label": "Natural True-Color Composite (Bands 4, 3, 2)"},
                {"pct": 100, "color": "rgb(220, 230, 200)", "value": 1.0, "label": "Optical Surface Reflectance"},
            ]
            vmin, vmax = 0.0, 1.0
            mean_val, std_val = float(vals.mean()), float(vals.std())

        elif spec["type"] == "lulc_categorical":
            rgba = np.zeros((h, w, 4), dtype=np.uint8)
            for cls_val, rgb in DYNAMIC_WORLD_COLORS.items():
                cls_mask = valid & (arr.astype(int) == cls_val)
                rgba[cls_mask, 0] = rgb[0]
                rgba[cls_mask, 1] = rgb[1]
                rgba[cls_mask, 2] = rgb[2]
                rgba[cls_mask, 3] = 255
            Image.fromarray(rgba, "RGBA").save(out / "layers" / f"{layer_id}.png", optimize=True)

            vals = arr[valid]
            raw_min, raw_max = 0.0, 8.0
            step = 1.0
            q = np.full((h, w), NODATA_U16, dtype="<u2")
            q[valid] = arr[valid].astype("<u2")
            (out / "grids" / f"{layer_id}.bin").write_bytes(q.tobytes())

            stops = []
            for cls_val in sorted(np.unique(arr[valid]).astype(int)):
                rgb = DYNAMIC_WORLD_COLORS.get(cls_val, (128, 128, 128))
                en_name, mr_name = DYNAMIC_WORLD_LABELS.get(cls_val, (f"Class {cls_val}", f"वर्ग {cls_val}"))
                stops.append({
                    "pct": int(cls_val * 12.5),
                    "color": f"rgb({rgb[0]}, {rgb[1]}, {rgb[2]})",
                    "value": float(cls_val),
                    "label": f"{cls_val}: {en_name} ({mr_name})",
                })
            vmin, vmax = 0.0, 7.0
            mean_val, std_val = 4.0, 1.0

        elif spec["type"] == "texture_class":
            rgba = np.zeros((h, w, 4), dtype=np.uint8)
            rgb = SOIL_TEXTURE_COLORS[1]
            rgba[valid, 0] = rgb[0]
            rgba[valid, 1] = rgb[1]
            rgba[valid, 2] = rgb[2]
            rgba[valid, 3] = 255
            Image.fromarray(rgba, "RGBA").save(out / "layers" / f"{layer_id}.png", optimize=True)

            q = np.full((h, w), NODATA_U16, dtype="<u2")
            q[valid] = 1
            (out / "grids" / f"{layer_id}.bin").write_bytes(q.tobytes())

            stops = [
                {
                    "pct": 100,
                    "color": f"rgb({rgb[0]}, {rgb[1]}, {rgb[2]})",
                    "value": 1.0,
                    "label": "Class 1: Clay - Vertisols (काळी / चिकण माती)",
                }
            ]
            vmin, vmax = 1.0, 1.0
            mean_val, std_val = 1.0, 0.0

        elif spec["type"] == "master_index" and layer_id in INDEX_CLASSES:
            # Fixed Copernicus Sentinel-2 discrete scientific classification
            vals = arr[valid]
            raw_min, raw_max = float(vals.min()), float(vals.max())
            mean_val, std_val = float(vals.mean()), float(vals.std())
            vmin, vmax = raw_min, raw_max

            class_defs = INDEX_CLASSES[layer_id]
            rgba = colorize_classified_index(arr, class_defs, valid)
            Image.fromarray(rgba, "RGBA").save(out / "layers" / f"{layer_id}.png", optimize=True)

            step = (raw_max - raw_min) / MAX_U16 if (raw_max - raw_min) > 0 else 1.0
            q = np.full((h, w), NODATA_U16, dtype="<u2")
            q[valid] = np.round((arr[valid] - raw_min) / step).astype("<u2")
            (out / "grids" / f"{layer_id}.bin").write_bytes(q.tobytes())

            stops = []
            for i, c in enumerate(class_defs):
                stops.append({
                    "pct": int(i * (100 / (len(class_defs) - 1))) if len(class_defs) > 1 else 0,
                    "color": f"rgb({c['rgb'][0]}, {c['rgb'][1]}, {c['rgb'][2]})",
                    "hex": c["hex"],
                    "value": round(c["min"] if c["min"] > -5.0 else raw_min, 2),
                    "label": c["label"],
                })

        else:
            # Continuous agronomic / topographic / index layers
            vals = arr[valid]
            raw_min, raw_max = float(vals.min()), float(vals.max())
            vmin = spec.get("clip_min", raw_min)
            vmax = spec.get("clip_max", raw_max)
            span = vmax - vmin if vmax > vmin else 1.0

            rgba = colorize_continuous(arr, vmin, vmax, spec["palette"], valid)
            Image.fromarray(rgba, "RGBA").save(out / "layers" / f"{layer_id}.png", optimize=True)

            step = (raw_max - raw_min) / MAX_U16 if (raw_max - raw_min) > 0 else 1.0
            q = np.full((h, w), NODATA_U16, dtype="<u2")
            q[valid] = np.round((arr[valid] - raw_min) / step).astype("<u2")
            (out / "grids" / f"{layer_id}.bin").write_bytes(q.tobytes())

            stops = []
            for pct_pos, (r, g, b) in spec["palette"]:
                val = round(vmin + pct_pos * span, 3)
                stops.append({
                    "pct": int(round(pct_pos * 100)),
                    "color": f"rgb({r}, {g}, {b})",
                    "value": val,
                })
            mean_val, std_val = float(vals.mean()), float(vals.std())

        manifest_layers.append({
            "id": layer_id,
            "key": spec["filename"].replace(".tif", ""),
            "name": spec["name"],
            "marathiName": spec["marathiName"],
            "unit": spec["unit"],
            "category": spec["category"],
            "categoryLabel": spec["categoryLabel"],
            "categoryLabelMr": spec["categoryLabelMr"],
            "description": spec["desc"],
            "cmap": "CustomAgro",
            "min": round(float(vmin), 4),
            "max": round(float(vmax), 4),
            "mean": round(float(mean_val), 4),
            "std": round(float(std_val), 4),
            "validPixels": valid_pixel_count,
            "image": f"layers/{layer_id}.png",
            "grid": {
                "file": f"grids/{layer_id}.bin",
                "width": int(w),
                "height": int(h),
                "dtype": "uint16",
                "scale": step if spec["type"] not in ("texture_class", "lulc_categorical") else 1.0,
                "offset": raw_min if spec["type"] not in ("texture_class", "lulc_categorical") else 0.0,
                "nodata": NODATA_U16,
            },
            "legendStops": stops,
        })
        print(f"  -> Generated {layer_id}.png & {layer_id}.bin [range={vmin}..{vmax}, valid={valid_pixel_count}]")

    # Copy village boundary KML
    village_kml = src / "malegaonkh_final1.kml"
    if village_kml.exists():
        shutil.copyfile(village_kml, out / "malegaonkh_final1.kml")
        print(f"Copied {village_kml.name} to {out / 'malegaonkh_final1.kml'}")

    # Copy farm plots KML (trial.kml containing individual Gats: 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 25)
    trial_sources = [
        root / "layers" / "trial.kml",
        root / "kml" / "trial.kml",
        root / "frontend" / "public" / "data" / "sample-gats.kml",
    ]
    trial_kml = next((p for p in trial_sources if p.exists()), None) 
    if trial_kml:
        shutil.copyfile(trial_kml, out / "sample-gats.kml")
        print(f"Copied {trial_kml.name} to {out / 'sample-gats.kml'}")

    # Build manifest
    manifest = {
        "version": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "crs": "EPSG:4326",
        "bounds": [round(v, 8) for v in ref_bounds],
        "size": [int(ref_shape[1]), int(ref_shape[0])],
        "sampleKml": {
            "file": "sample-gats.kml",
            "label": "Malegaon Khurd - Baramati Pilot Boundary",
            "village": "Malegaon Kh.",
            "taluka": "Baramati",
            "district": "Pune",
            "state": "Maharashtra",
        },
        "categories": [
            {
                "id": "soil_properties",
                "name": "Soil Properties (0–30 cm Root-Zone Standardized)",
                "marathiName": "मातीचे गुणधर्म (०-३० सेमी प्रमाणबद्ध)",
                "icon": "leaf",
            },
            {
                "id": "topography",
                "name": "Topography & Elevation",
                "marathiName": "भूरूप आणि उंची",
                "icon": "mountain",
            },
            {
                "id": "land_use",
                "name": "Land Use & Multi-Spectral Indices",
                "marathiName": "जमीन वापर आणि बहु-स्पेक्ट्रल निर्देशांक",
                "icon": "satellite",
            },
        ],
        "layers": manifest_layers,
    }

    manifest_path = out / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f" Successfully exported {len(manifest_layers)} layers to {manifest_path}!")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", type=Path, default=root / "MalegaonKh_DSM_Project_2026")
    ap.add_argument("--out", type=Path, default=root / "frontend" / "public" / "data" / "dsm")
    a = ap.parse_args()
    build_malegaonkh_dsm(a.src, a.out)
