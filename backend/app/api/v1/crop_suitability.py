"""Crop Suitability API Endpoints.
SoilPilot GIS-Based Multi-Criteria Crop Suitability Module.
Provides crop catalogs, Gat suitability evaluation, crop-wide spatial parcel mapping,
GeoJSON layers, statistical area summaries, and CSV export.
"""

import io
import csv
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status, Query, Response, Depends
from fastapi.responses import StreamingResponse

from app.gis.crop_suitability_engine import crop_suitability_engine
from app.gis.gat_soil_extractor import gat_soil_extractor
from app.gis.weather_processor import weather_processor
from app.services.field_service import normalize_gat_number

router = APIRouter(prefix="/crop-suitability", tags=["Crop Suitability"])


@router.get("/crops", response_model=List[Dict[str, Any]])
def list_crops():
    """Returns the list of 10 supported crops with agronomic tolerance categories and parameters count."""
    return crop_suitability_engine.get_supported_crops()


@router.get("/crops/{crop_code}", response_model=Dict[str, Any])
def get_crop_rules(crop_code: str):
    """Returns the complete rule definitions, weights, and thresholds for a specific crop."""
    crop_def = crop_suitability_engine.get_crop_definition(crop_code)
    if not crop_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop '{crop_code}' not found in suitability criteria.",
        )
    return crop_def


@router.get("/weather-summary", response_model=Dict[str, Any])
def get_weather_summary():
    """Returns agro-climatic normals (1991-2020) and recent variability (2016-2025) with data quality reports."""
    return weather_processor.compute_climatological_normals()


@router.get("/gat/{gat_no}", response_model=Dict[str, Any])
def get_gat_crop_suitability(
    gat_no: str,
    irrigation_available: bool = Query(True, description="Whether assured irrigation is available for high-water crops"),
):
    """Evaluates crop suitability across all 10 crops for a single Gat cadastral parcel."""
    clean_gat = normalize_gat_number(gat_no)
    soil_data = gat_soil_extractor.get_soil_indicators_for_gat(clean_gat)
    if not soil_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Gat parcel '{clean_gat}' not found in cadastral boundary dataset.",
        )

    # Attach user irrigation option
    soil_with_options = dict(soil_data)
    soil_with_options["irrigation_available"] = irrigation_available

    weather_normals = weather_processor.compute_climatological_normals()["historical_30yr"]
    weather_indicators = {
        "annual_rainfall": weather_normals["annual_rainfall_mm"],
        "kharif_rainfall": weather_normals["kharif_rainfall_mm"],
        "rabi_rainfall": weather_normals["rabi_rainfall_mm"],
        "mean_temperature": weather_normals["mean_temperature_c"],
        "relative_humidity": weather_normals["relative_humidity_pct"],
    }

    evaluations = []
    crops = crop_suitability_engine.get_supported_crops()
    for c in crops:
        res = crop_suitability_engine.evaluate_crop_suitability(
            crop_code=c["crop_code"],
            soil_indicators=soil_with_options,
            weather_indicators=weather_indicators,
            gat_no=clean_gat,
        )
        evaluations.append(res)

    return {
        "gat_no": clean_gat,
        "village": soil_data.get("village", "Malegaon Kh."),
        "area_ha": soil_data.get("area_ha"),
        "area_acres": soil_data.get("area_acres"),
        "centroid": soil_data.get("centroid"),
        "bounds": soil_data.get("bounds"),
        "soil_indicators": soil_data,
        "weather_indicators": weather_indicators,
        "evaluations": evaluations,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/crop/{crop_code}", response_model=Dict[str, Any])
def get_crop_suitability_all_gats(
    crop_code: str,
    irrigation_available: bool = Query(True, description="Whether assured irrigation is available for high-water crops"),
):
    """Evaluates suitability of all 217 Gats for the selected crop, returning parcel results and aggregated area statistics."""
    crop_def = crop_suitability_engine.get_crop_definition(crop_code)
    if not crop_def:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop '{crop_code}' not found.",
        )

    all_soils = gat_soil_extractor.extract_all_gat_soil_indicators()
    weather_normals = weather_processor.compute_climatological_normals()["historical_30yr"]
    weather_indicators = {
        "annual_rainfall": weather_normals["annual_rainfall_mm"],
        "kharif_rainfall": weather_normals["kharif_rainfall_mm"],
        "rabi_rainfall": weather_normals["rabi_rainfall_mm"],
        "mean_temperature": weather_normals["mean_temperature_c"],
        "relative_humidity": weather_normals["relative_humidity_pct"],
    }

    class_counts = {"S1": 0, "S2": 0, "S3": 0, "N": 0, "UNCERTAIN": 0}
    class_area_ha = {"S1": 0.0, "S2": 0.0, "S3": 0.0, "N": 0.0, "UNCERTAIN": 0.0}
    class_area_acres = {"S1": 0.0, "S2": 0.0, "S3": 0.0, "N": 0.0, "UNCERTAIN": 0.0}

    gat_results = []
    for gat_no, soil_data in all_soils.items():
        soil_with_options = dict(soil_data)
        soil_with_options["irrigation_available"] = irrigation_available

        res = crop_suitability_engine.evaluate_crop_suitability(
            crop_code=crop_code,
            soil_indicators=soil_with_options,
            weather_indicators=weather_indicators,
            gat_no=gat_no,
        )
        s_class = res["final_suitability_class"]
        ha = float(soil_data.get("area_ha") or 0.0)
        acres = float(soil_data.get("area_acres") or 0.0)

        class_counts[s_class] = class_counts.get(s_class, 0) + 1
        class_area_ha[s_class] = round(class_area_ha.get(s_class, 0.0) + ha, 2)
        class_area_acres[s_class] = round(class_area_acres.get(s_class, 0.0) + acres, 2)

        gat_results.append({
            "gat_no": gat_no,
            "area_ha": ha,
            "area_acres": acres,
            "centroid": soil_data.get("centroid"),
            "bounds": soil_data.get("bounds"),
            "final_suitability_class": s_class,
            "suitability_score": res["suitability_score"],
            "limiting_factors": res["limiting_factors"],
            "missing_inputs": res["missing_inputs"],
        })

    total_gats = len(gat_results)
    total_ha = round(sum(class_area_ha.values()), 2)
    total_acres = round(sum(class_area_acres.values()), 2)

    return {
        "crop_code": crop_code,
        "crop_name": crop_def.get("crop_name"),
        "crop_name_mr": crop_def.get("crop_name_mr"),
        "tolerance": crop_def.get("tolerance"),
        "category": crop_def.get("category"),
        "total_gats": total_gats,
        "total_area_ha": total_ha,
        "total_area_acres": total_acres,
        "class_summary": {
            s: {
                "count": class_counts[s],
                "percentage_gats": round((class_counts[s] / total_gats) * 100, 1) if total_gats else 0,
                "area_ha": round(class_area_ha[s], 2),
                "area_acres": round(class_area_acres[s], 2),
            } for s in ["S1", "S2", "S3", "N", "UNCERTAIN"]
        },
        "gats": gat_results,
    }


@router.get("/crop/{crop_code}/geojson", response_model=Dict[str, Any])
def get_crop_suitability_geojson(
    crop_code: str,
    irrigation_available: bool = Query(True, description="Whether assured irrigation is available for high-water crops"),
):
    """Returns a GeoJSON FeatureCollection of all 217 Gats with suitability attributes embedded for Leaflet mapping."""
    features = gat_soil_extractor.get_gat_features()
    all_soils = gat_soil_extractor.extract_all_gat_soil_indicators()
    weather_normals = weather_processor.compute_climatological_normals()["historical_30yr"]
    weather_indicators = {
        "annual_rainfall": weather_normals["annual_rainfall_mm"],
        "kharif_rainfall": weather_normals["kharif_rainfall_mm"],
        "rabi_rainfall": weather_normals["rabi_rainfall_mm"],
        "mean_temperature": weather_normals["mean_temperature_c"],
        "relative_humidity": weather_normals["relative_humidity_pct"],
    }

    CLASS_COLORS = {
        "S1": "#16a34a",       # Rich green
        "S2": "#eab308",       # Amber yellow
        "S3": "#f97316",       # Orange
        "N": "#dc2626",        # Crimson red
        "UNCERTAIN": "#9ca3af" # Gray
    }

    out_features = []
    for feat in features:
        props = dict(feat.get("properties", {}))
        gat_no = str(props.get("gat_no", "")).strip()
        soil_data = all_soils.get(gat_no, {})

        soil_with_options = dict(soil_data)
        soil_with_options["irrigation_available"] = irrigation_available

        res = crop_suitability_engine.evaluate_crop_suitability(
            crop_code=crop_code,
            soil_indicators=soil_with_options,
            weather_indicators=weather_indicators,
            gat_no=gat_no,
        )

        s_class = res["final_suitability_class"]
        props["crop_code"] = crop_code
        props["crop_name"] = res["crop_name"]
        props["suitability_class"] = s_class
        props["suitability_score"] = res["suitability_score"]
        props["fill_color"] = CLASS_COLORS.get(s_class, "#9ca3af")
        props["limiting_factors_count"] = len(res["limiting_factors"])
        props["limiting_factors"] = res["limiting_factors"]
        props["soil_indicators"] = soil_data

        out_features.append({
            "type": "Feature",
            "properties": props,
            "geometry": feat.get("geometry")
        })

    return {
        "type": "FeatureCollection",
        "name": f"crop_suitability_{crop_code}",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": out_features,
    }


@router.get("/export/csv")
def export_suitability_csv(
    crop_code: Optional[str] = Query(None, description="Optional crop filter, e.g. sugarcane, chickpea"),
    gat_no: Optional[str] = Query(None, description="Optional Gat filter"),
):
    """Exports evaluated Gat crop suitability records as a CSV download."""
    all_soils = gat_soil_extractor.extract_all_gat_soil_indicators()
    weather_normals = weather_processor.compute_climatological_normals()["historical_30yr"]
    weather_indicators = {
        "annual_rainfall": weather_normals["annual_rainfall_mm"],
        "kharif_rainfall": weather_normals["kharif_rainfall_mm"],
        "rabi_rainfall": weather_normals["rabi_rainfall_mm"],
        "mean_temperature": weather_normals["mean_temperature_c"],
        "relative_humidity": weather_normals["relative_humidity_pct"],
    }

    crops = crop_suitability_engine.get_supported_crops()
    if crop_code:
        clean_crop = crop_code.lower().strip()
        crops = [c for c in crops if c["crop_code"] == clean_crop]
        if not crops:
            raise HTTPException(status_code=404, detail=f"Crop '{crop_code}' not supported.")

    target_gats = all_soils
    if gat_no:
        clean_g = normalize_gat_number(gat_no)
        if clean_g in all_soils:
            target_gats = {clean_g: all_soils[clean_g]}
        else:
            raise HTTPException(status_code=404, detail=f"Gat '{gat_no}' not found.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Gat Number", "Village", "Area (ha)", "Area (acres)", "Crop Code", "Crop Name",
        "Suitability Class", "Suitability Score", "Soil pH", "SOC (%)", "Available N (kg/ha)",
        "EC (dS/m)", "Available P (kg/ha)", "Available K (kg/ha)",
        "Slope (%)", "Soil Texture", "Annual Rainfall (mm)", "Mean Temp (°C)", "Relative Humidity (%)",
        "Limiting Factors", "Rule Version", "Calculated At"
    ])

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    for g_id, s_data in target_gats.items():
        for c in crops:
            res = crop_suitability_engine.evaluate_crop_suitability(
                crop_code=c["crop_code"],
                soil_indicators=s_data,
                weather_indicators=weather_indicators,
                gat_no=g_id,
            )
            lim_str = "; ".join([f"{f['parameter']} ({f['class']})" for f in res["limiting_factors"]])
            n_kgha = s_data.get("nitrogen", 0) * 20.0 if s_data.get("nitrogen") else None
            ec_val = s_data.get("ec", 0.85)
            p_val = s_data.get("phosphorus", 22.5)
            k_val = s_data.get("potassium", 320.0)

            writer.writerow([
                g_id,
                s_data.get("village", "Malegaon Kh."),
                s_data.get("area_ha", ""),
                s_data.get("area_acres", ""),
                res["crop_code"],
                res["crop_name"],
                res["final_suitability_class"],
                res["suitability_score"],
                s_data.get("ph", ""),
                s_data.get("soc", ""),
                round(n_kgha, 1) if n_kgha else "",
                ec_val,
                p_val,
                k_val,
                s_data.get("slope", ""),
                s_data.get("texture", ""),
                weather_indicators["annual_rainfall"],
                weather_indicators["mean_temperature"],
                weather_indicators["relative_humidity"],
                lim_str,
                res["rule_version"],
                now_iso
            ])

    filename = f"soilpilot_crop_suitability_{crop_code or 'all'}_{datetime.now().strftime('%Y%m%d')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/refresh", response_model=Dict[str, Any])
def refresh_suitability_cache():
    """Forces recalculation and cache refresh of Gat soil indicators and climate summaries."""
    weather_processor._cached_summary = None
    weather_normals = weather_processor.compute_climatological_normals()
    soils = gat_soil_extractor.extract_all_gat_soil_indicators(force_refresh=True)

    return {
        "status": "success",
        "message": "Crop suitability cache successfully refreshed from rasters and weather data.",
        "gats_extracted": len(soils),
        "weather_baseline": weather_normals["baseline_period"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
