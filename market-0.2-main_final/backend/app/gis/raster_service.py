"""Digital Soil Mapping (DSM) GeoTIFF Raster Service.
Loads local GeoTIFF raster layers (pH, SOC, Nitrogen, BD, NDVI, EVI, Elevation, Uncertainty)
using tifffile and shapely for point probing, zonal statistics, and Gat-level soil diagnostics.
"""

import os
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import numpy as np
import tifffile
from shapely import wkt
from shapely.geometry import shape, Point, Polygon, MultiPolygon

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BASE_DIR.parent
LAYERS_DIR = PROJECT_ROOT / "layers"
RASTERS_DIR = PROJECT_ROOT / "data" / "gis" / "rasters"

# Authoritative layer specifications
DSM_CONFIG: Dict[str, Dict[str, Any]] = {
    "ph": {
        "file": "pH.tif",
        "name": "Soil pH (Reaction)",
        "name_mr": "जमिनीचा सामू (pH)",
        "short_name": "pH",
        "unit": "pH",
        "cmap": "Spectral_r",
        "category": "Soil Chemical (S)",
        "description": "Acidity / Alkalinity level (0-14 scale). Optimal range for Deccan vertisols is 6.5 - 7.8.",
        "scale_min": 7.0,
        "scale_max": 7.3,
        "optimal_min": 6.5,
        "optimal_max": 7.8,
    },
    "soc": {
        "file": "SOC.tif",
        "name": "Soil Organic Carbon (SOC)",
        "name_mr": "सेंद्रिय कर्ब (SOC)",
        "short_name": "SOC",
        "unit": "%",
        "cmap": "YlOrBr",
        "category": "Soil Chemical (S)",
        "description": "Organic Carbon percentage in topsoil (0-15 cm). Key driver of microbial health.",
        "scale_min": 1.20,
        "scale_max": 2.13,
        "optimal_min": 0.5,
        "optimal_max": 1.5,
    },
    "nitrogen": {
        "file": "Nitrogen.tif",
        "name": "Available Nitrogen (N)",
        "name_mr": "उपलब्ध नत्र (N)",
        "short_name": "Nitrogen",
        "unit": "mg/kg",
        "cmap": "YlGnBu",
        "category": "Primary Nutrient (S)",
        "description": "Alkaline permanganate extractable Nitrogen (mg/kg). Equivalent to kg/ha (factor x20).",
        "scale_min": 12.0,
        "scale_max": 15.69,
        "optimal_min": 14.0,
        "optimal_max": 28.0,
    },
    "bd": {
        "file": "BD.tif",
        "name": "Bulk Density",
        "name_mr": "मातीची घनता (Bulk Density)",
        "short_name": "BD",
        "unit": "g/cm³",
        "cmap": "cividis",
        "category": "Soil Physical (S)",
        "description": "Dry mass of soil per unit volume (g/cm³). Indicator of compaction and aeration.",
        "scale_min": 1.51,
        "scale_max": 1.59,
        "optimal_min": 1.1,
        "optimal_max": 1.45,
    },
    "elevation": {
        "file": "Elevation.tif",
        "name": "Elevation (DEM)",
        "name_mr": "उंची (Elevation)",
        "short_name": "DEM",
        "unit": "m",
        "cmap": "terrain",
        "category": "Relief (R)",
        "description": "Height above Mean Sea Level (m) derived from DEM.",
        "scale_min": 539.0,
        "scale_max": 598.7,
        "optimal_min": None,
        "optimal_max": None,
    },
    "ndvi": {
        "file": "NDVI.tif",
        "name": "NDVI Vegetation Index",
        "name_mr": "वनस्पती निर्देशांक (NDVI)",
        "short_name": "NDVI",
        "unit": "index",
        "cmap": "RdYlGn",
        "category": "Organisms (O)",
        "description": "Normalized Difference Vegetation Index from Sentinel-2 (10m). Measures crop vigor.",
        "scale_min": -0.13,
        "scale_max": 0.84,
        "optimal_min": 0.4,
        "optimal_max": 0.85,
    },
    "evi": {
        "file": "EVI.tif",
        "name": "EVI Vegetation Index",
        "name_mr": "वर्धित वनस्पती निर्देशांक (EVI)",
        "short_name": "EVI",
        "unit": "index",
        "cmap": "YlGn",
        "category": "Organisms (O)",
        "description": "Enhanced Vegetation Index with reduced soil background interference.",
        "scale_min": -0.02,
        "scale_max": 0.69,
        "optimal_min": 0.35,
        "optimal_max": 0.75,
    },
    "uncertainty": {
        "file": "Uncertainty.tif",
        "name": "DSM Prediction Uncertainty",
        "name_mr": "मॉडेल अनिश्चितता (Uncertainty)",
        "short_name": "Uncertainty",
        "unit": "% error",
        "cmap": "magma",
        "category": "Model Quality (QRF)",
        "description": "Quantile Regression Forest 90% prediction interval error.",
        "scale_min": 5.24,
        "scale_max": 12.47,
        "optimal_min": 0.0,
        "optimal_max": 15.0,
    },
}

KEY_ALIASES = {
    "ph": "ph", "reaction": "ph",
    "soc": "soc", "organic_carbon": "soc", "carbon": "soc",
    "nitrogen": "nitrogen", "n": "nitrogen", "available_nitrogen": "nitrogen",
    "bd": "bd", "bulk_density": "bd", "density": "bd",
    "elevation": "elevation", "dem": "elevation",
    "ndvi": "ndvi", "vegetation": "ndvi",
    "evi": "evi",
    "uncertainty": "uncertainty", "confidence": "uncertainty"
}



# Authoritative colormap stops (normalized [0, 1] -> RGB) matching frontend and scientific palettes
LAYER_COLORMAPS: Dict[str, List[Tuple[float, Tuple[int, int, int]]]] = {
    "ph": [
        (0.0, (94, 79, 162)),
        (0.2, (102, 194, 165)),
        (0.4, (230, 245, 152)),
        (0.6, (254, 224, 139)),
        (0.8, (244, 109, 67)),
        (1.0, (158, 1, 66)),
    ],
    "soc": [
        (0.0, (255, 255, 229)),
        (0.2, (254, 235, 162)),
        (0.4, (254, 187, 71)),
        (0.6, (239, 120, 24)),
        (0.8, (183, 66, 2)),
        (1.0, (102, 37, 5)),
    ],
    "nitrogen": [
        (0.0, (255, 255, 217)),
        (0.2, (214, 239, 178)),
        (0.4, (114, 200, 188)),
        (0.6, (36, 152, 192)),
        (0.8, (35, 77, 160)),
        (1.0, (8, 29, 88)),
    ],
    "bd": [
        (0.0, (0, 34, 77)),
        (0.2, (53, 69, 108)),
        (0.4, (102, 105, 112)),
        (0.6, (148, 142, 119)),
        (0.8, (200, 183, 101)),
        (1.0, (253, 231, 55)),
    ],
    "elevation": [
        (0.0, (51, 51, 153)),
        (0.2, (0, 178, 178)),
        (0.4, (153, 234, 132)),
        (0.6, (204, 189, 125)),
        (0.8, (153, 124, 118)),
        (1.0, (255, 255, 255)),
    ],
    "ndvi": [
        (0.0, (165, 0, 38)),
        (0.2, (244, 109, 67)),
        (0.4, (254, 224, 139)),
        (0.6, (217, 239, 139)),
        (0.8, (102, 189, 99)),
        (1.0, (0, 104, 55)),
    ],
    "evi": [
        (0.0, (255, 255, 229)),
        (0.2, (229, 244, 171)),
        (0.4, (162, 216, 137)),
        (0.6, (75, 176, 98)),
        (0.8, (21, 120, 62)),
        (1.0, (0, 69, 41)),
    ],
    "uncertainty": [
        (0.0, (0, 0, 3)),
        (0.2, (59, 15, 111)),
        (0.4, (140, 41, 128)),
        (0.6, (221, 73, 104)),
        (0.8, (253, 159, 108)),
        (1.0, (251, 252, 191)),
    ],
}


def _interpolate_color(val_norm: np.ndarray, stops: List[Tuple[float, Tuple[int, int, int]]]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Linearly interpolates RGB channels across color stops for a 2D float array in [0, 1]."""
    r = np.zeros_like(val_norm, dtype=np.float32)
    g = np.zeros_like(val_norm, dtype=np.float32)
    b = np.zeros_like(val_norm, dtype=np.float32)

    for i in range(len(stops) - 1):
        p0, (r0, g0, b0) = stops[i]
        p1, (r1, g1, b1) = stops[i + 1]
        mask = (val_norm >= p0) & (val_norm <= p1 if i == len(stops) - 2 else val_norm < p1)
        if not np.any(mask):
            continue
        span = p1 - p0
        factor = (val_norm[mask] - p0) / (span if span > 0 else 1.0)
        r[mask] = r0 + factor * (r1 - r0)
        g[mask] = g0 + factor * (g1 - g0)
        b[mask] = b0 + factor * (b1 - b0)

    # Values beyond 1.0 or below 0.0
    under = val_norm < stops[0][0]
    if np.any(under):
        r[under], g[under], b[under] = stops[0][1]
    over = val_norm > stops[-1][0]
    if np.any(over):
        r[over], g[over], b[over] = stops[-1][1]

    return np.clip(r, 0, 255).astype(np.uint8), np.clip(g, 0, 255).astype(np.uint8), np.clip(b, 0, 255).astype(np.uint8)


class RasterService:
    """Service to load, mask, sample and calculate stats from GeoTIFF soil rasters."""

    def __init__(self):
        self._raster_cache: Dict[str, Tuple[np.ndarray, Tuple[float, float, float, float], Tuple[float, float]]] = {}
        self._raster_paths: Dict[str, Path] = {}
        self._find_raster_files()

    def _find_raster_files(self):
        search_dirs = [
            LAYERS_DIR,
            RASTERS_DIR,
            PROJECT_ROOT / "data" / "gis" / "raw",
            Path("D:/SoilPilot_01-main/layers"),
            Path("D:/SoilPilot_01-main_latest/layers")
        ]
        for key, conf in DSM_CONFIG.items():
            filename = conf["file"]
            for s_dir in search_dirs:
                if s_dir and s_dir.exists():
                    p = s_dir / filename
                    if p.exists():
                        self._raster_paths[key] = p
                        break

    def _resolve_key(self, raw_key: str) -> Optional[str]:
        clean = str(raw_key).strip().lower()
        clean = KEY_ALIASES.get(clean, clean)
        return clean if clean in DSM_CONFIG else None

    def get_raster_path(self, layer_key: str) -> Optional[Path]:
        norm_key = self._resolve_key(layer_key)
        if not norm_key:
            return None
        return self._raster_paths.get(norm_key)

    def is_raster_available(self, layer_key: str) -> bool:
        p = self.get_raster_path(layer_key)
        return p is not None and p.exists()

    def _load_raster(self, layer_key: str):
        """Loads and caches (array, (west, south, east, north), (scale_x, scale_y))."""
        norm_key = self._resolve_key(layer_key)
        if not norm_key or norm_key in self._raster_cache:
            return self._raster_cache.get(norm_key)

        p = self.get_raster_path(norm_key)
        if not p or not p.exists():
            return None

        try:
            with tifffile.TiffFile(p) as tif:
                page = tif.pages[0]
                arr = page.asarray().astype(np.float32)
                scale = page.tags["ModelPixelScaleTag"].value
                tie = page.tags["ModelTiepointTag"].value
                nodata_tag = page.tags.get("GDAL_NODATA")
                nodata = float(nodata_tag.value) if nodata_tag is not None else None

                if nodata is not None and not np.isnan(nodata):
                    arr[arr == nodata] = np.nan

                h, w = arr.shape
                west, north = float(tie[3]), float(tie[4])
                sx, sy = float(scale[0]), float(scale[1])
                east = west + w * sx
                south = north - h * sy

                entry = (arr, (west, south, east, north), (sx, sy))
                self._raster_cache[norm_key] = entry
                return entry
        except Exception as e:
            print(f"Error loading GeoTIFF {p}: {e}")
            return None

    def get_pixel_value(self, layer_key: str, lat: float, lon: float) -> Optional[float]:
        """Directly reads exact raster cell value from GeoTIFF at given (lat, lon)."""
        data = self._load_raster(layer_key)
        if not data:
            return None

        arr, (west, south, east, north), (sx, sy) = data
        if not (west <= lon <= east and south <= lat <= north):
            return None

        col = int((lon - west) / sx)
        row = int((north - lat) / sy)

        if 0 <= row < arr.shape[0] and 0 <= col < arr.shape[1]:
            val = float(arr[row, col])
            if np.isnan(val) or np.isinf(val):
                return None
            return round(val, 3)
        return None

    def classify_value(self, layer_key: str, value: Optional[float]) -> Optional[str]:
        if value is None:
            return None
        norm_key = self._resolve_key(layer_key)
        if norm_key == "ph":
            if value < 6.5: return "Acidic"
            elif value <= 7.8: return "Optimal (Neutral-Alkaline)"
            else: return "Highly Alkaline"
        elif norm_key == "soc":
            if value < 0.5: return "Very Low"
            elif value < 0.75: return "Moderate"
            else: return "High (Rich)"
        elif norm_key == "nitrogen":
            if value < 14.0: return "Low / Deficient"
            elif value < 28.0: return "Medium"
            else: return "High"
        elif norm_key == "bd":
            if value < 1.3: return "Ideal / Porous"
            elif value <= 1.55: return "Normal"
            else: return "Compacted"
        elif norm_key == "ndvi":
            if value < 0.2: return "Sparse / Bare Soil"
            elif value < 0.4: return "Moderate Vigor"
            else: return "Dense Healthy Crop"
        elif norm_key == "evi":
            if value < 0.2: return "Low Biomass"
            elif value < 0.4: return "Moderate Biomass"
            else: return "High Biomass"
        elif norm_key == "uncertainty":
            if value < 10.0: return "High Confidence (<10% error)"
            elif value < 15.0: return "Medium Confidence"
            else: return "Lower Confidence"
        return "Normal"

    def probe_all_layers(self, lat: float, lon: float) -> Dict[str, Any]:
        """Queries all 8 GeoTIFF layers at a single location simultaneously."""
        results = {}
        for key, cfg in DSM_CONFIG.items():
            val = self.get_pixel_value(key, lat, lon)
            results[key] = {
                "key": key,
                "name": cfg["name"],
                "name_mr": cfg["name_mr"],
                "short_name": cfg["short_name"],
                "unit": cfg["unit"],
                "value": val,
                "classification": self.classify_value(key, val) if val is not None else None
            }
        return results

    def _resolve_geometry(self, geom_input: Any):
        if not geom_input:
            return None
        if hasattr(geom_input, "data"):
            try:
                from geoalchemy2.shape import to_shape
                return to_shape(geom_input)
            except Exception:
                try:
                    import shapely.wkb
                    return shapely.wkb.loads(bytes(geom_input.data))
                except Exception:
                    pass
        if isinstance(geom_input, str):
            try:
                return wkt.loads(geom_input)
            except Exception:
                pass
        elif isinstance(geom_input, dict):
            try:
                return shape(geom_input)
            except Exception:
                pass
        elif hasattr(geom_input, "bounds"):
            return geom_input
        return None

    def get_gat_raster_stats(self, geom_input: Any, area_ha: Optional[float] = None) -> Dict[str, Dict[str, Any]]:
        """Calculates zonal statistics (mean, min, max, std, count, classification, canopy_statistics)
        across all GeoTIFF layers for the given Gat geometry.
        Accepts GeoJSON dict or Shapely geometry or WKT string.
        """
        poly = self._resolve_geometry(geom_input)
        if not poly or poly.is_empty:
            return {}

        minx, miny, maxx, maxy = poly.bounds
        stats_by_layer = {}

        for key, cfg in DSM_CONFIG.items():
            data = self._load_raster(key)
            if not data:
                continue

            arr, (west, south, east, north), (sx, sy) = data
            if maxx < west or minx > east or maxy < south or miny > north:
                continue

            c_min = max(0, int((minx - west) / sx))
            c_max = min(arr.shape[1], int((maxx - west) / sx) + 1)
            r_min = max(0, int((north - maxy) / sy))
            r_max = min(arr.shape[0], int((north - miny) / sy) + 1)

            vals = []
            for r in range(r_min, r_max):
                py = north - (r + 0.5) * sy
                for c in range(c_min, c_max):
                    px = west + (c + 0.5) * sx
                    if poly.contains(Point(px, py)):
                        v = arr[r, c]
                        if np.isfinite(v):
                            vals.append(float(v))

            if vals:
                mean_v = round(float(np.mean(vals)), 3)
                min_v = round(float(np.min(vals)), 3)
                max_v = round(float(np.max(vals)), 3)
                std_v = round(float(np.std(vals)), 3)
                median_v = round(float(np.median(vals)), 3)

                stats_by_layer[key] = {
                    "layer_id": key,
                    "name": cfg["name"],
                    "name_mr": cfg["name_mr"],
                    "unit": cfg["unit"],
                    "category": cfg["category"],
                    "mean": mean_v,
                    "median": median_v,
                    "min": min_v,
                    "max": max_v,
                    "std": std_v,
                    "pixel_count": len(vals),
                    "classification": self.classify_value(key, mean_v),
                }

                if key == "ndvi":
                    sparse_cnt = sum(1 for v in vals if v < 0.2)
                    mod_cnt = sum(1 for v in vals if 0.2 <= v < 0.5)
                    dense_cnt = sum(1 for v in vals if v >= 0.5)
                    tot_cnt = len(vals)
                    tot_ha = float(area_ha) if area_ha is not None else None
                    tot_acres = round(tot_ha * 2.47105, 2) if tot_ha is not None else None

                    stats_by_layer[key]["canopy_statistics"] = {
                        "low": {
                            "name": "Sparse / Fallow",
                            "pixel_count": sparse_cnt,
                            "percentage": round((sparse_cnt / tot_cnt) * 100, 2) if tot_cnt > 0 else 0.0,
                            "area_acres": round((sparse_cnt / tot_cnt) * tot_acres, 2) if tot_acres is not None else None,
                            "area_hectares": round((sparse_cnt / tot_cnt) * tot_ha, 2) if tot_ha is not None else None,
                        },
                        "moderate": {
                            "name": "Moderate Canopy",
                            "pixel_count": mod_cnt,
                            "percentage": round((mod_cnt / tot_cnt) * 100, 2) if tot_cnt > 0 else 0.0,
                            "area_acres": round((mod_cnt / tot_cnt) * tot_acres, 2) if tot_acres is not None else None,
                            "area_hectares": round((mod_cnt / tot_cnt) * tot_ha, 2) if tot_ha is not None else None,
                        },
                        "healthy_dense": {
                            "name": "Healthy / Dense Canopy",
                            "pixel_count": dense_cnt,
                            "percentage": round((dense_cnt / tot_cnt) * 100, 2) if tot_cnt > 0 else 0.0,
                            "area_acres": round((dense_cnt / tot_cnt) * tot_acres, 2) if tot_acres is not None else None,
                            "area_hectares": round((dense_cnt / tot_cnt) * tot_ha, 2) if tot_ha is not None else None,
                        },
                    }

        return stats_by_layer

    def render_heatmap_png(
        self,
        layer_key: str,
        geom_input: Optional[Any] = None,
        opacity: float = 1.0,
        crop_to_geom: bool = False
    ) -> Tuple[Optional[bytes], Dict[str, Any]]:
        """Renders color-ramped RGBA PNG heatmap image from the GeoTIFF raster.
        If geom_input is given, clips/masks outside the polygon to transparent (alpha=0).
        If crop_to_geom is True, crops the returned image to the Gat bounding box.
        """
        import io
        from PIL import Image

        norm_key = self._resolve_key(layer_key)
        if not norm_key:
            return None, {}

        data = self._load_raster(norm_key)
        if not data:
            return None, {}

        arr, (west, south, east, north), (sx, sy) = data
        cfg = DSM_CONFIG[norm_key]
        poly = self._resolve_geometry(geom_input)

        out_arr = arr
        out_west, out_south, out_east, out_north = west, south, east, north
        c_min, c_max, r_min, r_max = 0, arr.shape[1], 0, arr.shape[0]

        # Geometry clipping / masking
        mask = None
        if poly and not poly.is_empty:
            minx, miny, maxx, maxy = poly.bounds
            c_min = max(0, int((minx - west) / sx))
            c_max = min(arr.shape[1], int((maxx - west) / sx) + 1)
            r_min = max(0, int((north - maxy) / sy))
            r_max = min(arr.shape[0], int((north - miny) / sy) + 1)

            if crop_to_geom and (c_max > c_min) and (r_max > r_min):
                out_arr = arr[r_min:r_max, c_min:c_max]
                out_west = west + c_min * sx
                out_east = west + c_max * sx
                out_north = north - r_min * sy
                out_south = north - r_max * sy

                mask = np.zeros(out_arr.shape, dtype=bool)
                for r in range(out_arr.shape[0]):
                    py = out_north - (r + 0.5) * sy
                    for c in range(out_arr.shape[1]):
                        px = out_west + (c + 0.5) * sx
                        if poly.contains(Point(px, py)):
                            mask[r, c] = True
            else:
                out_arr = arr
                out_west, out_south, out_east, out_north = west, south, east, north
                mask = np.zeros(arr.shape, dtype=bool)
                for r in range(max(0, r_min), min(arr.shape[0], r_max)):
                    py = north - (r + 0.5) * sy
                    for c in range(max(0, c_min), min(arr.shape[1], c_max)):
                        px = west + (c + 0.5) * sx
                        if poly.contains(Point(px, py)):
                            mask[r, c] = True

        valid = np.isfinite(out_arr)
        if mask is not None:
            valid = valid & mask

        # Normalization
        vmin = cfg.get("scale_min")
        vmax = cfg.get("scale_max")
        if vmin is None or vmax is None:
            if np.any(valid):
                vmin = float(np.nanmin(out_arr[valid]))
                vmax = float(np.nanmax(out_arr[valid]))
            else:
                vmin, vmax = 0.0, 1.0

        span = vmax - vmin if vmax > vmin else 1.0
        norm_vals = np.clip((out_arr - vmin) / span, 0.0, 1.0)

        stops = LAYER_COLORMAPS.get(norm_key, LAYER_COLORMAPS["ndvi"])
        r_ch, g_ch, b_ch = _interpolate_color(norm_vals, stops)

        # Alpha channel: transparent where invalid or outside polygon
        alpha_val = int(np.clip(opacity, 0.0, 1.0) * 255)
        a_ch = np.where(valid, alpha_val, 0).astype(np.uint8)

        rgba = np.stack([r_ch, g_ch, b_ch, a_ch], axis=-1)
        img = Image.fromarray(rgba, "RGBA")

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        png_bytes = buf.getvalue()

        meta = {
            "layer_id": norm_key,
            "name": cfg["name"],
            "unit": cfg["unit"],
            "min": round(float(vmin), 3),
            "max": round(float(vmax), 3),
            "width": int(out_arr.shape[1]),
            "height": int(out_arr.shape[0]),
            "bounds": [out_west, out_south, out_east, out_north],
            "valid_pixels": int(valid.sum()),
        }
        return png_bytes, meta


raster_service = RasterService()

