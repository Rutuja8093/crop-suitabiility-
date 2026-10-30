"""
SoilPilot - Export DSM GeoTIFF rasters for the web frontend.

Takes the Digital Soil Mapping GeoTIFFs (NDVI, EVI, Elevation, pH, SOC,
Nitrogen, BD, Uncertainty) and produces a static, browser-friendly bundle:

    frontend/public/data/dsm/
        manifest.json          layer catalogue the frontend fetches
        layers/<id>.png        colour-ramped RGBA overlay (transparent = no data)
        grids/<id>.bin         raw values, little-endian uint16 (for pixel probe
                               and per-Gat zonal statistics computed in the browser)
        sample-gats.kml        the sample cadastral Gat boundaries

Usage (from repo root):

    pip install numpy pillow matplotlib tifffile
    python scripts/gis/export_dsm_web.py --src path/to/tifs --kml path/to/trial.kml

All rasters must share one grid (same size / extent) and be in EPSG:4326.
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import tifffile  # noqa: E402
from PIL import Image  # noqa: E402

NODATA_U16 = 65535
MAX_U16 = 65534

# id (frontend DSMLayerId) -> config. `file` is the GeoTIFF stem.
LAYERS = [
    dict(id="ndvi", file="NDVI", name="NDVI Vegetation Index", marathi="वनस्पती निर्देशांक (NDVI)", unit="index",
         cmap="RdYlGn", category="Organisms (O)",
         desc="Normalized Difference Vegetation Index from Sentinel-2 (10m). Measures crop vigor & canopy density."),
    dict(id="evi", file="EVI", name="EVI Vegetation Index", marathi="वर्धित वनस्पती निर्देशांक (EVI)", unit="index",
         cmap="YlGn", category="Organisms (O)",
         desc="Enhanced Vegetation Index. Reduced atmospheric and soil background interference for high biomass."),
    dict(id="ph", file="pH", name="Soil pH (Reaction)", marathi="जमिनीचा सामू (pH)", unit="pH",
         cmap="Spectral_r", category="Soil Chemical (S)",
         desc="Acidity / Alkalinity level (0-14 scale). Optimal range for Deccan vertisols is 6.5 - 7.8."),
    dict(id="soc", file="SOC", name="Soil Organic Carbon (SOC)", marathi="सेंद्रिय कर्ब (SOC)", unit="%",
         cmap="YlOrBr", category="Soil Chemical (S)",
         desc="Organic Carbon percentage in topsoil (0-15 cm). Key driver of microbial health and nutrient buffering."),
    dict(id="nitrogen", file="Nitrogen", name="Available Nitrogen (N)", marathi="उपलब्ध नत्र (N)", unit="mg/kg",
         cmap="YlGnBu", category="Primary Nutrient (S)",
         desc="Alkaline permanganate extractable Nitrogen (mg/kg). Equivalent to kg/ha (x2 factor)."),
    dict(id="bd", file="BD", name="Bulk Density", marathi="घनता (Bulk Density)", unit="g/cm³",
         cmap="cividis", category="Soil Physical (S)",
         desc="Dry mass of soil per unit volume (g/cm³). Indicator of compaction, root penetration and aeration."),
    dict(id="elevation", file="Elevation", name="Elevation (DEM)", marathi="उंची (Elevation)", unit="m",
         cmap="terrain", category="Relief (R)",
         desc="Height above Mean Sea Level (m) derived from DEM. Controls hydrologic runoff & accumulation."),
    dict(id="uncertainty", file="Uncertainty", name="DSM Prediction Uncertainty", marathi="मॉडेल अनिश्चितता (Uncertainty)",
         unit="% error", cmap="magma", category="Model Quality (QRF)",
         desc="Quantile Regression Forest 90% prediction interval error. Lower values represent higher confidence."),
]


def read_geotiff(path: Path):
    """Return (float32 array with NaN nodata, (west, south, east, north))."""
    with tifffile.TiffFile(path) as tif:
        page = tif.pages[0]
        arr = page.asarray().astype(np.float32)
        tags = page.tags
        scale = tags["ModelPixelScaleTag"].value  # (sx, sy, sz)
        tie = tags["ModelTiepointTag"].value  # (i, j, k, x, y, z)
        nodata_tag = tags.get("GDAL_NODATA")
        nodata = float(nodata_tag.value) if nodata_tag is not None else None

    if nodata is not None and not np.isnan(nodata):
        arr[arr == nodata] = np.nan

    h, w = arr.shape
    west, north = tie[3], tie[4]
    east = west + w * scale[0]
    south = north - h * scale[1]
    return arr, (west, south, east, north)


def build(src: Path, kml: Path, out: Path) -> None:
    (out / "layers").mkdir(parents=True, exist_ok=True)
    (out / "grids").mkdir(parents=True, exist_ok=True)

    manifest_layers = []
    ref_bounds = None
    ref_shape = None

    for cfg in LAYERS:
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
        vmin, vmax = float(vals.min()), float(vals.max())
        span = vmax - vmin

        # ---- colour-ramped PNG overlay --------------------------------------
        norm = np.zeros_like(arr) if span == 0 else np.clip((arr - vmin) / span, 0, 1)
        rgba = (plt.get_cmap(cfg["cmap"])(np.where(valid, norm, 0)) * 255).astype(np.uint8)
        rgba[~valid, 3] = 0
        Image.fromarray(rgba, "RGBA").save(out / "layers" / f"{cfg['id']}.png", optimize=True)

        # ---- quantised uint16 grid ------------------------------------------
        step = span / MAX_U16 if span > 0 else 1.0
        q = np.full(arr.shape, NODATA_U16, dtype="<u2")
        q[valid] = np.round((arr[valid] - vmin) / step).astype("<u2")
        (out / "grids" / f"{cfg['id']}.bin").write_bytes(q.tobytes())

        # ---- legend ---------------------------------------------------------
        cmap = plt.get_cmap(cfg["cmap"])
        stops = []
        for p in np.linspace(0, 1, 6):
            r, g, b, _ = cmap(p)
            stops.append({
                "pct": int(round(p * 100)),
                "color": f"rgb({int(r * 255)}, {int(g * 255)}, {int(b * 255)})",
                "value": round(vmin + p * span, 3),
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
            "cmap": cfg["cmap"],
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
                "offset": vmin,
                "nodata": NODATA_U16,
            },
            "legendStops": stops,
        })
        print(f"  ✓ {cfg['id']:<12} {vmin:>9.3f} .. {vmax:<9.3f} valid={int(valid.sum()):,}")

    if ref_bounds is None:
        raise SystemExit("No rasters found")

    shutil.copyfile(kml, out / "sample-gats.kml")

    manifest = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "crs": "EPSG:4326",
        "bounds": [round(v, 8) for v in ref_bounds],  # west, south, east, north
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
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, required=True, help="folder containing the GeoTIFFs")
    ap.add_argument("--kml", type=Path, required=True, help="sample Gat boundaries KML")
    ap.add_argument("--out", type=Path, default=root / "frontend" / "public" / "data" / "dsm")
    a = ap.parse_args()
    build(a.src, a.kml, a.out)
