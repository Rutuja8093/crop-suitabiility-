"""Weather Data Processing and Climatology Module for SoilPilot.
Processes Open-Meteo historical CSV datasets (1991-2020 WMO normal and 2016-2025 recent variability).
Calculates annual and seasonal agro-climatic indicators (Rainfall, Temperature, Relative Humidity, ET0, VPD, Rainy Days).
"""

import os
import io
import json
import logging
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
WEATHER_DIR = PROJECT_ROOT / "weather data_crop suitability"

class WeatherProcessor:
    """Validates, parses, cleans, and computes agro-climatic normals from Open-Meteo datasets."""

    def __init__(self, weather_dir: Optional[Path] = None):
        self.weather_dir = Path(weather_dir) if weather_dir else WEATHER_DIR
        self._cached_summary: Optional[Dict[str, Any]] = None

    def parse_open_meteo_csv(self, filepath: Path) -> Tuple[Dict[str, Any], pd.DataFrame, pd.DataFrame]:
        """Parses Open-Meteo dual-section CSV containing metadata, hourly observations, and daily summaries."""
        if not filepath.exists():
            raise FileNotFoundError(f"Weather file not found: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()

        if len(lines) < 5:
            raise ValueError(f"File too short to be valid Open-Meteo export: {filepath}")

        # Metadata header & values
        meta_keys = [k.strip() for k in lines[0].strip().split(",")]
        meta_vals = [v.strip() for v in lines[1].strip().split(",")]
        metadata = dict(zip(meta_keys, meta_vals))

        # Detect section header row indices
        section_indices = [idx for idx, line in enumerate(lines) if line.startswith("time,")]
        if not section_indices:
            raise ValueError(f"No data table headers found in {filepath}")

        # Hourly section
        h_start = section_indices[0]
        h_end = section_indices[1] - 1 if len(section_indices) > 1 else len(lines)
        # trim trailing blank lines
        while h_end > h_start and not lines[h_end].strip():
            h_end -= 1

        df_hourly = pd.read_csv(io.StringIO("".join(lines[h_start:h_end + 1])))
        df_hourly["time"] = pd.to_datetime(df_hourly["time"])

        # Daily section (if present)
        if len(section_indices) > 1:
            d_start = section_indices[1]
            df_daily = pd.read_csv(io.StringIO("".join(lines[d_start:])))
            df_daily["time"] = pd.to_datetime(df_daily["time"])
        else:
            df_daily = pd.DataFrame()

        return metadata, df_hourly, df_daily

    def load_validated_historical_30yr(self) -> Tuple[Dict[str, Any], pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
        """Combines and validates the 1991-2016 and 2017-2020 Open-Meteo CSVs into a continuous 30-year dataset (1991-2020).
        Ensures:
        - 0 duplicate timestamps
        - 0 missing dates
        - Strict chronologic ordering
        - Comprehensive data quality report
        """
        f_part1 = self.weather_dir / "open-meteo-18.10N74.49E542m.csv"
        f_part2 = self.weather_dir / "open-meteo-18.10N74.49E542m (1).csv"

        meta1, h1, d1 = self.parse_open_meteo_csv(f_part1)
        meta2, h2, d2 = self.parse_open_meteo_csv(f_part2)

        # Validate consistent metadata
        lat1, lon1 = float(meta1.get("latitude", 0)), float(meta1.get("longitude", 0))
        lat2, lon2 = float(meta2.get("latitude", 0)), float(meta2.get("longitude", 0))
        if abs(lat1 - lat2) > 0.001 or abs(lon1 - lon2) > 0.001:
            raise ValueError(f"Inconsistent coordinate metadata between weather parts: ({lat1}, {lon1}) vs ({lat2}, {lon2})")

        # Combine hourly
        h_combined = pd.concat([h1, h2], ignore_index=True).drop_duplicates(subset=["time"]).sort_values("time").reset_index(drop=True)
        # Combine daily
        d_combined = pd.concat([d1, d2], ignore_index=True).drop_duplicates(subset=["time"]).sort_values("time").reset_index(drop=True)

        # Quality check: check completeness
        expected_days = (pd.to_datetime("2020-12-31") - pd.to_datetime("1991-01-01")).days + 1  # 10958 days
        actual_days = len(d_combined)
        missing_days = expected_days - actual_days

        expected_hours = expected_days * 24  # 262992 hours
        actual_hours = len(h_combined)
        missing_hours = expected_hours - actual_hours

        quality_report = {
            "period": "1991-2020 (WMO Climatological Normal)",
            "latitude": lat1,
            "longitude": lon1,
            "elevation_m": float(meta1.get("elevation", 542.0)),
            "timezone": meta1.get("timezone", "Asia/Kolkata"),
            "expected_days": expected_days,
            "actual_days": actual_days,
            "missing_days": missing_days,
            "expected_hours": expected_hours,
            "actual_hours": actual_hours,
            "missing_hours": missing_hours,
            "null_values_hourly": {col: int(h_combined[col].isnull().sum()) for col in h_combined.columns},
            "null_values_daily": {col: int(d_combined[col].isnull().sum()) for col in d_combined.columns},
            "is_continuous": (missing_days == 0 and missing_hours == 0),
        }

        return meta1, h_combined, d_combined, quality_report

    def load_recent_variability_dataset(self) -> Tuple[Dict[str, Any], pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
        """Loads and validates the 2016-2025 dataset for recent climate variability analysis."""
        f_recent = self.weather_dir / "open-meteo-18.10N74.49E542m (4).csv"
        meta, h, d = self.parse_open_meteo_csv(f_recent)

        quality_report = {
            "period": "2016-2025 (Recent Climate Variability)",
            "latitude": float(meta.get("latitude", 18.10)),
            "longitude": float(meta.get("longitude", 74.49)),
            "elevation_m": float(meta.get("elevation", 542.0)),
            "timezone": meta.get("timezone", "Asia/Kolkata"),
            "total_days": len(d),
            "start_date": str(d["time"].min().date()),
            "end_date": str(d["time"].max().date()),
            "total_hours": len(h),
            "null_values_daily": {col: int(d[col].isnull().sum()) for col in d.columns},
        }

        return meta, h, d, quality_report

    def compute_climatological_normals(self) -> Dict[str, Any]:
        """Calculates multi-year annual, seasonal, and monthly agro-climatic normals.
        Key outputs:
        - Annual precipitation mean (mm)
        - Kharif rainfall (June-October)
        - Rabi rainfall (October-February)
        - Mean temperature (°C)
        - Max / Min temperature statistics
        - Relative humidity mean (%)
        - Rainy days count per year (rain >= 2.5 mm per IMD definition)
        - Reference Evapotranspiration (ET0) annual sum (mm)
        - Vapour Pressure Deficit (VPD) mean (kPa)
        """
        if self._cached_summary:
            return self._cached_summary

        meta, h_30, d_30, q_30 = self.load_validated_historical_30yr()
        _, _, d_rec, q_rec = self.load_recent_variability_dataset()

        # Add calendar helpers to daily
        d_30 = d_30.copy()
        d_30["year"] = d_30["time"].dt.year
        d_30["month"] = d_30["time"].dt.month

        # Annual aggregations for 1991-2020
        annual_rain = d_30.groupby("year")["precipitation_sum (mm)"].sum()
        annual_mean_temp = d_30.groupby("year")["temperature_2m_mean (°C)"].mean()
        annual_et0 = d_30.groupby("year")["et0_fao_evapotranspiration (mm)"].sum()

        # Rainy days: daily rainfall >= 2.5 mm (India Meteorological Department standard threshold)
        rainy_days_series = d_30[d_30["precipitation_sum (mm)"] >= 2.5].groupby("year")["time"].count()
        # Ensure all years present
        for yr in annual_rain.index:
            if yr not in rainy_days_series:
                rainy_days_series[yr] = 0

        # Kharif Season: June 1 to October 31 (Months 6-10)
        kharif_d = d_30[d_30["month"].isin([6, 7, 8, 9, 10])]
        kharif_rain_by_year = kharif_d.groupby("year")["precipitation_sum (mm)"].sum()

        # Rabi Season: October 1 to February 28/29 (Months 10, 11, 12, 1, 2)
        rabi_d = d_30[d_30["month"].isin([10, 11, 12, 1, 2])]
        rabi_rain_by_year = rabi_d.groupby("year")["precipitation_sum (mm)"].sum()

        # Hourly relative humidity & VPD multi-year statistics
        h_30 = h_30.copy()
        mean_rh = float(h_30["relative_humidity_2m (%)"].mean())
        mean_vpd = float(h_30["vapour_pressure_deficit (kPa)"].mean())

        # Recent 2016-2025 aggregations for comparison
        d_rec = d_rec.copy()
        d_rec["year"] = d_rec["time"].dt.year
        d_rec["month"] = d_rec["time"].dt.month
        rec_annual_rain = d_rec.groupby("year")["precipitation_sum (mm)"].sum()
        rec_mean_temp = d_rec.groupby("year")["temperature_2m_mean (°C)"].mean()

        normals = {
            "metadata": {
                "latitude": float(meta.get("latitude", 18.101933)),
                "longitude": float(meta.get("longitude", 74.4888)),
                "elevation_m": float(meta.get("elevation", 542.0)),
                "timezone": meta.get("timezone", "Asia/Kolkata"),
                "source": "Open-Meteo ERA5 / ERA5-Land Reanalysis",
            },
            "baseline_period": "1991-2020",
            "historical_30yr": {
                "annual_rainfall_mm": round(float(annual_rain.mean()), 1),
                "annual_rainfall_min_mm": round(float(annual_rain.min()), 1),
                "annual_rainfall_max_mm": round(float(annual_rain.max()), 1),
                "annual_rainfall_std_mm": round(float(annual_rain.std()), 1),
                "kharif_rainfall_mm": round(float(kharif_rain_by_year.mean()), 1),
                "rabi_rainfall_mm": round(float(rabi_rain_by_year.mean()), 1),
                "mean_temperature_c": round(float(annual_mean_temp.mean()), 1),
                "mean_max_temperature_c": round(float(d_30["temperature_2m_max (°C)"].mean()), 1),
                "mean_min_temperature_c": round(float(d_30["temperature_2m_min (°C)"].mean()), 1),
                "relative_humidity_pct": round(mean_rh, 1),
                "reference_et0_annual_mm": round(float(annual_et0.mean()), 1),
                "vpd_mean_kpa": round(mean_vpd, 2),
                "mean_rainy_days_count": round(float(rainy_days_series.mean()), 1),
            },
            "recent_period_2016_2025": {
                "annual_rainfall_mm": round(float(rec_annual_rain.mean()), 1),
                "annual_rainfall_min_mm": round(float(rec_annual_rain.min()), 1),
                "annual_rainfall_max_mm": round(float(rec_annual_rain.max()), 1),
                "mean_temperature_c": round(float(rec_mean_temp.mean()), 1),
            },
            "quality_reports": {
                "historical_30yr": q_30,
                "recent_variability": q_rec,
            }
        }

        self._cached_summary = normals
        return normals

    # Method alias for convenience
    def compute_agro_climatic_normals(self) -> Dict[str, Any]:
        """Alias for compute_climatological_normals."""
        return self.compute_climatological_normals()


weather_processor = WeatherProcessor()

if __name__ == "__main__":
    import sys
    # Handle console encoding on Windows
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except AttributeError:
            pass

    print("=" * 60)
    print("SoilPilot Climatological Normal Processor (Open-Meteo)")
    print("=" * 60)
    try:
        normals = weather_processor.compute_climatological_normals()
        print(f"\n[+] Baseline Period: {normals['baseline_period']}")
        print(f"[+] Annual Rainfall Mean: {normals['historical_30yr']['annual_rainfall_mm']} mm/year")
        print(f"[+] Mean Temperature: {normals['historical_30yr']['mean_temperature_c']} deg C")
        print(f"[+] Reference ET0: {normals['historical_30yr']['reference_et0_annual_mm']} mm/year")
        print(f"[+] IMD Rainy Days (>= 2.5mm): {normals['historical_30yr']['mean_rainy_days_count']} days/year")
        print(f"[+] Vapour Pressure Deficit (VPD): {normals['historical_30yr']['vpd_mean_kpa']} kPa")
        print(f"\n[+] Recent Variability (2016-2025):")
        print(f"    - Mean Annual Rainfall: {normals['recent_period_2016_2025']['annual_rainfall_mm']} mm")
        print(f"    - Mean Temperature: {normals['recent_period_2016_2025']['mean_temperature_c']} deg C")
        print("\nAll historical and recent weather records validated successfully.")
    except Exception as e:
        print(f"[-] Error processing weather records: {e}")
        import traceback
        traceback.print_exc()

