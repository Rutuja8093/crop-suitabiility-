"""
SoilPilot - Export DSM GeoTIFF rasters with darker, richer, saturated color palettes
matching the reference agricultural monitoring visuals (deep wine red -> bold crimson
-> dark orange -> golden sand -> vibrant green -> deep dark forest pine green).

Uses pure numpy, tifffile, and Pillow (no matplotlib dependency).
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image

NODATA_U16 = 65535
MAX_U16 = 65534

# -----------------------------------------------------------------------------
# Darker, richer multi-stop color palettes matching user's reference image
# Format: list of (position_0_to_1, (R, G, B))
# -----------------------------------------------------------------------------

# Reference Screenshot: Deep wine red -> Crimson -> Dark orange -> Amber -> Golden cream -> Rich green -> Darkest pine green
# Precision Agriculture Fertility Contour Palettes matching user reference screenshot
# 8 discrete contour levels: Red (Deficient) -> Orange -> Amber -> Yellow -> Lime -> Olive -> Mid Green -> Deep Forest Green
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

CONTOUR_INVERTED_PALETTE = [
    (0.00, (50, 123, 0)),     # #327b00 - Deep Forest Green (Optimal / Well-Aerated / High Confidence)
    (0.14, (107, 161, 1)),    # #6ba101
    (0.28, (164, 196, 0)),    # #a4c400
    (0.42, (222, 234, 1)),    # #deea01
    (0.57, (253, 233, 0)),    # #fde900
    (0.71, (254, 187, 0)),    # #febb00
    (0.85, (253, 136, 0)),    # #fd8800
    (1.00, (253, 35, 0)),     # #fd2300 - Deep Crimson Red (Compacted / Severe Uncertainty)
]

LAYERS_CONFIG = [
    dict(
        id="ndvi",
        file="NDVI",
        name="NDVI Vegetation Index",
        marathi="वनस्पती निर्देशांक (NDVI)",
        unit="index",
        palette=CONTOUR_AGRONOMIC_PALETTE,
        category="Organisms (O)",
        desc="Normalized Difference Vegetation Index from Sentinel-2 (10m). Measures crop vigor & canopy density.",
        clip_pmin=0.08,
        clip_pmax=0.72,
    ),
    dict(
        id="evi",
        file="EVI",
        name="EVI Vegetation Index",
        marathi="वर्धित वनस्पती निर्देशांक (EVI)",
        unit="index",
        palette=CONTOUR_AGRONOMIC_PALETTE,
        category="Organisms (O)",
        desc="Enhanced Vegetation Index. Reduced atmospheric and soil background interference for high biomass.",
        clip_pmin=0.05,
        clip_pmax=0.52,
    ),
    dict(
        id="ph",
        file="pH",
        name="Soil pH (Reaction)",
        marathi="जमिनीचा सामू (pH)",
        unit="pH",
        palette=CONTOUR_AGRONOMIC_PALETTE,
        category="Soil Chemical (S)",
        desc="Acidity / Alkalinity level (0-14 scale). Optimal range for Deccan vertisols is 6.5 - 7.8.",
        clip_pmin=7.02,
        clip_pmax=7.28,
    ),
    dict(
        id="soc",
        file="SOC",
        name="Soil Organic Carbon (SOC)",
        marathi="सेंद्रिय कर्ब (SOC)",
        unit="%",
        palette=CONTOUR_AGRONOMIC_PALETTE,
        category="Soil Chemical (S)",
        desc="Organic Carbon percentage in topsoil (0-15 cm). Key driver of microbial health and nutrient buffering.",
        clip_pmin=1.22,
        clip_pmax=2.05,
    ),
    dict(
        id="nitrogen",
        file="Nitrogen",
        name="Available Nitrogen (N)",
        marathi="उपलब्ध नत्र (N)",
        unit="mg/kg",
        palette=CONTOUR_AGRONOMIC_PALETTE,
        category="Primary Nutrient (S)",
        desc="Alkaline permanganate extractable Nitrogen (mg/kg). Equivalent to kg/ha (x2 factor).",
        clip_pmin=12.1,
        clip_pmax=15.5,
    ),
    dict(
        id="bd",
        file="BD",
        name="Bulk Density",
        marathi="घनता (Bulk Density)",
        unit="g/cm³",
        palette=CONTOUR_INVERTED_PALETTE,
        category="Soil Physical (S)",
        desc="Dry mass of soil per unit volume (g/cm³). Indicator of compaction, root penetration and aeration.",
        clip_pmin=1.51,
        clip_pmax=1.59,
    ),
    dict(
        id="elevation",
        file="Elevation",
        name="Elevation (DEM)",
        marathi="उंची (Elevation)",
        unit="m",
        palette=CONTOUR_AGRONOMIC_PALETTE,
        category="Relief (R)",
        desc="Height above Mean Sea Level (m) derived from DEM. Controls hydrologic runoff & accumulation.",
        clip_pmin=542.0,
        clip_pmax=578.0,
    ),
    dict(
        id="uncertainty",
        file="Uncertainty",
        name="DSM Prediction Uncertainty",
        marathi="मॉडेल अनिश्चितता (Uncertainty)",
        unit="% error",
        palette=CONTOUR_INVERTED_PALETTE,
        category="Model Quality (QRF)",
        desc="Quantile Regression Forest 90% prediction interval error. Lower values represent higher confidence.",
        clip_pmin=5.8,
        clip_pmax=10.5,
    ),
]


def read_geotiff(path: Path):
    """Return (float32 array with NaN nodata, (west, south, east, north))."""
    with tifffile.TiffFile(path) as tif:
        page = tif.pages[0]
        arr = page.asarray().astype(np.float32)
        tags = page.tags
        scale = tags["ModelPixelScaleTag"].value
        tie = tags["ModelTiepointTag"].value
        nodata_tag = tags.get("GDAL_NODATA")
        nodata = float(nodata_tag.value) if nodata_tag is not None else None

    if nodata is not None and not np.isnan(nodata):
        arr[arr == nodata] = np.nan

    h, w = arr.shape
    west, north = tie[3], tie[4]
    east = west + w * scale[0]
    south = north - h * scale[1]
    return arr, (west, south, east, north)


def colorize_array(arr: np.ndarray, vmin: float, vmax: float, palette: list[tuple[float, tuple[int, int, int]]]) -> np.ndarray:
    """Map 2D float array to precision agronomic contour bands matching user reference image."""
    from scipy.ndimage import gaussian_filter
    valid = np.isfinite(arr)
    filled = arr.copy()
    filled[~valid] = np.nanmean(arr) if np.any(valid) else 0.0

    # Smooth slightly to create natural rounded organic contour zones
    smoothed = gaussian_filter(filled, sigma=2.8)

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
    rgba[valid, :3] = rgb[valid]
    rgba[valid, 3] = 255  # Fully opaque contour bands

    return rgba


def build_darker_dsm(src: Path, kml: Path, out: Path) -> None:
    (out / "layers").mkdir(parents=True, exist_ok=True)
    (out / "grids").mkdir(parents=True, exist_ok=True)

    manifest_layers = []
    ref_bounds = None
    ref_shape = None

    for cfg in LAYERS_CONFIG:
        tif_path = src / f"{cfg['file']}.tif"
        if not tif_path.exists():
            print(f"  ! skipping {cfg['id']}: {tif_path} not found")
            continue

        arr, bounds = read_geotiff(tif_path)
        if ref_bounds is None:
            ref_bounds, ref_shape = bounds, arr.shape
        elif arr.shape != ref_shape or not np.allclose(bounds, ref_bounds, atol=1e-7):
            raise SystemExit(f"{tif_path.name} does not share the reference grid - resample first")

        valid = np.isfinite(arr)
        vals = arr[valid]
        raw_min, raw_max = float(vals.min()), float(vals.max())

        # Use tuned agricultural contrast limits if configured, else raw limits
        vmin = cfg.get("clip_pmin", raw_min)
        vmax = cfg.get("clip_pmax", raw_max)
        span = vmax - vmin if vmax > vmin else 1.0

        # ---- 1. Colorized darker PNG overlay ---------------------------------
        rgba = colorize_array(arr, vmin, vmax, cfg["palette"])
        Image.fromarray(rgba, "RGBA").save(out / "layers" / f"{cfg['id']}.png", optimize=True)

        # ---- 2. Quantised uint16 grid for live pixel probe & client stats ----
        step = (raw_max - raw_min) / MAX_U16 if (raw_max - raw_min) > 0 else 1.0
        q = np.full(arr.shape, NODATA_U16, dtype="<u2")
        q[valid] = np.round((arr[valid] - raw_min) / step).astype("<u2")
        (out / "grids" / f"{cfg['id']}.bin").write_bytes(q.tobytes())

        # ---- 3. Darker legend color stops ------------------------------------
        stops = []
        for pct_pos, (r, g, b) in cfg["palette"]:
            val = round(vmin + pct_pos * span, 3)
            stops.append({
                "pct": int(round(pct_pos * 100)),
                "color": f"rgb({r}, {g}, {b})",
                "value": val,
            })

        h, w = arr.shape
        manifest_layers.append({
            "id": cfg["id"],
            "key": cfg["file"],
            "name": cfg["name"],
            "marathiName": cfg["marathi"],
            "unit": cfg["unit"],
            "category": cfg["category"],
            "description": cfg["desc"],
            "cmap": "DarkerAgro",
            "min": round(vmin, 4),
            "max": round(vmax, 4),
            "mean": round(float(vals.mean()), 4),
            "std": round(float(vals.std()), 4),
            "validPixels": int(valid.sum()),
            "image": f"layers/{cfg['id']}.png",
            "grid": {
                "file": f"grids/{cfg['id']}.bin",
                "width": int(w),
                "height": int(h),
                "dtype": "uint16",
                "scale": step,
                "offset": raw_min,
                "nodata": NODATA_U16,
            },
            "legendStops": stops,
        })
        print(f"  [OK] {cfg['id']:<12} range=[{vmin:>7.3f} .. {vmax:<7.3f}] valid={int(valid.sum()):,}")

    if ref_bounds is None:
        raise SystemExit("No rasters found")

    shutil.copyfile(kml, out / "sample-gats.kml")

    manifest = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "crs": "EPSG:4326",
        "bounds": [round(v, 8) for v in ref_bounds],
        "size": [int(ref_shape[1]), int(ref_shape[0])],
        "sampleKml": {
            "file": "sample-gats.kml",
            "label": "Baramati pilot - sample Gat boundaries",
            "village": "Malegaon",
            "taluka": "Baramati",
            "district": "Pune",
            "state": "Maharashtra",
        },
        "layers": manifest_layers,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out / 'manifest.json'}")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--src", type=Path, default=root / "layers")
    ap.add_argument("--kml", type=Path, default=root / "layers" / "trial.kml")
    ap.add_argument("--out", type=Path, default=root / "frontend" / "public" / "data" / "dsm")
    a = ap.parse_args()
    build_darker_dsm(a.src, a.kml, a.out)
