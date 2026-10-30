"""Gat-Level Soil Extraction and Zonal Statistics Service.
Extracts continuous and categorical soil attributes for all 217 Gats in Malegaon Khurd
from authoritative DSM and terrain GeoTIFF layers:
- pH (pH.tif)
- Soil Organic Carbon (SOC.tif)
- Available Nitrogen (Nitrogen.tif)
- Bulk Density (BD.tif)
- Elevation (Elevation.tif)
- Slope % (SRTM_Slope_pct.tif)
- Soil Texture Class (Soil_Texture_Class_30cm.tif)
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import rasterio
from rasterio.mask import mask
from shapely.geometry import shape

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
LAYERS_DIR = PROJECT_ROOT / "layers"
DSM_PROJECT_DIR = PROJECT_ROOT / "MalegaonKh_DSM_Project_2026"
GEOJSON_FILE = PROJECT_ROOT / "frontend" / "public" / "data" / "malegaon_plots.geojson"
CACHE_FILE = PROJECT_ROOT / "data" / "gis" / "gat_soil_indicators_cache.json"

USDA_TEXTURE_MAP = {
    1: "Clay",
    2: "Silty Clay",
    3: "Sandy Clay",
    4: "Clay Loam",
    5: "Silty Clay Loam",
    6: "Sandy Clay Loam",
    7: "Loam",
    8: "Silty Loam",
    9: "Sandy Loam",
    10: "Silt",
    11: "Loamy Sand",
    12: "Sand"
}

class GatSoilExtractor:
    def __init__(self):
        self.geojson_path = GEOJSON_FILE
        self.cache_path = CACHE_FILE
        self._indicators_cache: Optional[Dict[str, Dict[str, Any]]] = None

    def get_gat_features(self) -> List[Dict[str, Any]]:
        """Loads validated 217 Gat GeoJSON features."""
        if not self.geojson_path.exists():
            raise FileNotFoundError(f"Gat GeoJSON not found: {self.geojson_path}")
        with open(self.geojson_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("features", [])

    def extract_all_gat_soil_indicators(self, force_refresh: bool = False) -> Dict[str, Dict[str, Any]]:
        """Extracts soil indicators across all 217 Gats and caches the result."""
        if not force_refresh and self._indicators_cache:
            return self._indicators_cache

        if not force_refresh and self.cache_path.exists():
            try:
                with open(self.cache_path, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                    if len(cached) >= 215:
                        self._indicators_cache = cached
                        return cached
            except Exception as e:
                logger.warning(f"Could not load soil cache: {e}. Recomputing...")

        features = self.get_gat_features()
        results: Dict[str, Dict[str, Any]] = {}

        # Raster file sources
        rasters = {
            "ph": LAYERS_DIR / "pH.tif",
            "soc": LAYERS_DIR / "SOC.tif",
            "nitrogen": LAYERS_DIR / "Nitrogen.tif",
            "bd": LAYERS_DIR / "BD.tif",
            "elevation": LAYERS_DIR / "Elevation.tif",
            "slope": DSM_PROJECT_DIR / "SRTM_Slope_pct.tif",
            "texture": DSM_PROJECT_DIR / "Soil_Texture_Class_30cm.tif",
        }

        # Check existing files
        opened_srcs = {}
        for k, p in rasters.items():
            if p.exists():
                opened_srcs[k] = rasterio.open(p)
            else:
                logger.warning(f"Raster missing: {p}")

        try:
            for feat in features:
                props = feat.get("properties", {})
                gat_no = str(props.get("gat_no", "")).strip()
                if not gat_no:
                    continue

                geom = [feat.get("geometry")]
                area_ha = props.get("area_ha") or props.get("area", 0.0)

                soil_data: Dict[str, Any] = {
                    "gat_no": gat_no,
                    "area_ha": round(float(area_ha), 2) if area_ha else None,
                    "area_acres": round(float(props.get("area_acres", 0.0)), 2) if props.get("area_acres") else None,
                    "village": props.get("village", "Malegaon Kh."),
                    "centroid": props.get("centroid"),
                    "bounds": props.get("bounds"),
                }

                # Extract continuous layers
                for layer_key in ["ph", "soc", "nitrogen", "bd", "elevation", "slope"]:
                    if layer_key in opened_srcs:
                        src = opened_srcs[layer_key]
                        try:
                            out_img, _ = mask(src, geom, crop=True)
                            arr = out_img[0]
                            if src.nodata is not None and not np.isnan(src.nodata):
                                valid = arr[arr != src.nodata]
                            else:
                                valid = arr[~np.isnan(arr)]

                            if len(valid) > 0:
                                soil_data[layer_key] = round(float(np.nanmean(valid)), 2)
                                soil_data[f"{layer_key}_min"] = round(float(np.nanmin(valid)), 2)
                                soil_data[f"{layer_key}_max"] = round(float(np.nanmax(valid)), 2)
                                soil_data[f"{layer_key}_count"] = int(len(valid))
                            else:
                                soil_data[layer_key] = None
                        except Exception as e:
                            soil_data[layer_key] = None

                # Extract categorical texture layer
                if "texture" in opened_srcs:
                    src = opened_srcs["texture"]
                    try:
                        out_img, _ = mask(src, geom, crop=True)
                        arr = out_img[0]
                        # Discard 0 / nodata
                        valid_pixels = arr[arr > 0]
                        if len(valid_pixels) > 0:
                            vals, counts = np.unique(valid_pixels, return_counts=True)
                            dom_val = int(vals[np.argmax(counts)])
                            dom_name = USDA_TEXTURE_MAP.get(dom_val, "Clay")
                            freqs = {USDA_TEXTURE_MAP.get(int(v), f"Class {v}"): round(float(c / len(valid_pixels) * 100), 1) for v, c in zip(vals, counts)}
                            soil_data["texture"] = dom_name
                            soil_data["texture_class_id"] = dom_val
                            soil_data["texture_frequencies"] = freqs
                            soil_data["texture_pixel_count"] = int(len(valid_pixels))
                        else:
                            # Fallback regional vertisol default
                            soil_data["texture"] = "Clay"
                            soil_data["texture_class_id"] = 1
                            soil_data["texture_frequencies"] = {"Clay": 100.0}
                            soil_data["texture_pixel_count"] = 0
                    except Exception as e:
                        soil_data["texture"] = "Clay"
                        soil_data["texture_class_id"] = 1

                # If slope is None, fallback to local mean ~1.5%
                if soil_data.get("slope") is None:
                    soil_data["slope"] = 1.5

                results[gat_no] = soil_data

        finally:
            for s in opened_srcs.values():
                s.close()

        # Save to cache file
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.cache_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)

        self._indicators_cache = results
        return results

    def get_soil_indicators_for_gat(self, gat_no: str) -> Optional[Dict[str, Any]]:
        """Retrieves soil indicators for a single Gat."""
        clean_gat = str(gat_no).strip()
        all_indicators = self.extract_all_gat_soil_indicators()
        return all_indicators.get(clean_gat)


gat_soil_extractor = GatSoilExtractor()

if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except AttributeError:
            pass

    print("=" * 60)
    print("SoilPilot Gat Soil Indicator Extractor (Rasterio Zonal)")
    print("=" * 60)
    try:
        data = gat_soil_extractor.extract_all_gat_soil_indicators()
        print(f"[+] Total Gats extracted and cached: {len(data)}")
        if "1" in data:
            print("\n[+] Sample Attributes for Gat 1:")
            for k, v in data["1"].items():
                print(f"    - {k}: {v}")
    except Exception as e:
        print(f"[-] Error extracting soil indicators: {e}")
        import traceback
        traceback.print_exc()

