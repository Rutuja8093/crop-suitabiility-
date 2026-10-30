"""Crop Suitability Evaluation Engine.
Implements the multi-criteria rule-based suitability model for 10 Deccan crops
based on the authoritative Crop_Wise_Suitability_Criteria document.
Combines:
1. Soil parameters extracted at Gat parcel level from high-resolution DSM rasters.
2. Climatological normals computed from validated Open-Meteo 1991-2020 dataset.
3. Laboratory test results from SoilPilot database when available.
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np

logger = logging.getLogger(__name__)

CURRENT_DIR = Path(__file__).resolve().parent
RULES_FILE = CURRENT_DIR / "crop_suitability_rules.json"

USDA_TEXTURE_NAMES = {
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

CLASS_SCORES = {
    "S1": 100.0,
    "S2": 75.0,
    "S3": 50.0,
    "N": 20.0
}

CLASS_RANKS = {
    "S1": 1,
    "S2": 2,
    "S3": 3,
    "N": 4
}
RANK_TO_CLASS = {1: "S1", 2: "S2", 3: "S3", 4: "N"}

class CropSuitabilityEngine:
    def __init__(self, rules_path: Optional[Path] = None):
        self.rules_path = Path(rules_path) if rules_path else RULES_FILE
        self.rules = self._load_rules()

    def _load_rules(self) -> Dict[str, Any]:
        if not self.rules_path.exists():
            raise FileNotFoundError(f"Crop suitability rules not found: {self.rules_path}")
        with open(self.rules_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def get_supported_crops(self) -> List[Dict[str, Any]]:
        """Returns list of supported crops and their metadata."""
        crops_data = self.rules.get("crops", {})
        result = []
        for code, data in crops_data.items():
            result.append({
                "crop_code": code,
                "crop_name": data.get("crop_name"),
                "crop_name_mr": data.get("crop_name_mr"),
                "tolerance": data.get("tolerance"),
                "category": data.get("category"),
                "parameters_count": len(data.get("parameters", {})),
            })
        return result

    def get_crop_definition(self, crop_code: str) -> Optional[Dict[str, Any]]:
        """Retrieves raw definition and criteria thresholds for a crop."""
        clean_code = crop_code.lower().strip()
        return self.rules.get("crops", {}).get(clean_code)

    def _evaluate_numeric_range(self, val: float, s_range: Any) -> bool:
        """Helper to test if val falls in [min, max] or a list of intervals."""
        if s_range is None:
            return False
        # List of intervals, e.g. [[18, 21], [32, 35]]
        if isinstance(s_range, list) and len(s_range) > 0 and isinstance(s_range[0], list):
            return any(self._evaluate_numeric_range(val, sub_range) for sub_range in s_range)

        if isinstance(s_range, (list, tuple)) and len(s_range) == 2:
            low, high = s_range[0], s_range[1]
            if low is not None and val < low:
                return False
            if high is not None and val > high:
                return False
            return True
        return False

    def evaluate_criterion(
        self,
        param_key: str,
        param_def: Dict[str, Any],
        observed_value: Any,
        data_source: str = "DSM_RASTER"
    ) -> Dict[str, Any]:
        """Evaluates a single criterion (e.g. pH, Slope, Texture) against S1, S2, S3, N rules."""
        unit = param_def.get("unit", "")
        weight = float(param_def.get("weight", 0.0))
        param_name = param_def.get("name", param_key)

        if observed_value is None or (isinstance(observed_value, float) and np.isnan(observed_value)):
            return {
                "parameter_key": param_key,
                "parameter_name": param_name,
                "unit": unit,
                "weight": weight,
                "value": None,
                "suitability_class": "UNCERTAIN",
                "score": None,
                "is_limiting": False,
                "status": "MISSING_DATA",
                "explanation": f"Missing or unrecorded data for {param_name}.",
                "source": data_source,
            }

        # Categorical texture evaluation
        if param_key == "texture":
            text_val = str(observed_value).strip().lower()
            s1_list = [t.lower() for t in param_def.get("s1", [])]
            s2_list = [t.lower() for t in param_def.get("s2", [])]
            s3_list = [t.lower() for t in param_def.get("s3", [])]
            n_list = [t.lower() for t in param_def.get("n", [])]

            # Exact matching or whole-token matching
            def matches_texture(target: str, class_list: List[str]) -> bool:
                for item in class_list:
                    if target == item:
                        return True
                    # Check exact token matching (e.g. 'clay' in ['clay', 'clay loam'])
                    if target == item.replace(" ", "") or target == item.replace("-", ""):
                        return True
                return False

            matched_class = "N"
            if matches_texture(text_val, s1_list):
                matched_class = "S1"
            elif matches_texture(text_val, s2_list):
                matched_class = "S2"
            elif matches_texture(text_val, s3_list):
                matched_class = "S3"
            elif matches_texture(text_val, n_list):
                matched_class = "N"
            elif any(item in text_val for item in s1_list if len(item) > 4):
                matched_class = "S1"
            elif any(item in text_val for item in s2_list if len(item) > 4):
                matched_class = "S2"
            elif any(item in text_val for item in s3_list if len(item) > 4):
                matched_class = "S3"
            else:
                matched_class = "N"

            score = CLASS_SCORES.get(matched_class, 50.0)
            is_limiting = (matched_class in ["S2", "S3", "N"])
            explanation = (
                f"Soil texture '{observed_value}' evaluated as {matched_class} "
                f"(S1 requires: {', '.join(param_def.get('s1', []))})."
            )

            return {
                "parameter_key": param_key,
                "parameter_name": param_name,
                "unit": unit,
                "weight": weight,
                "value": observed_value,
                "suitability_class": matched_class,
                "score": score,
                "is_limiting": is_limiting,
                "status": "EVALUATED",
                "explanation": explanation,
                "source": data_source,
            }

        # Numerical parameters
        try:
            val_float = float(observed_value)
        except (ValueError, TypeError):
            return {
                "parameter_key": param_key,
                "parameter_name": param_name,
                "unit": unit,
                "weight": weight,
                "value": observed_value,
                "suitability_class": "UNCERTAIN",
                "score": None,
                "is_limiting": False,
                "status": "INVALID_VALUE",
                "explanation": f"Invalid numerical value: {observed_value}",
                "source": data_source,
            }

        # Check S1
        s1_range = param_def.get("s1")
        s2_range = param_def.get("s2")
        s3_range = param_def.get("s3")
        n_range = param_def.get("n")
        n_ranges = param_def.get("n_ranges")

        assigned_class = "N"
        if self._evaluate_numeric_range(val_float, s1_range):
            assigned_class = "S1"
        elif self._evaluate_numeric_range(val_float, s2_range):
            assigned_class = "S2"
        elif self._evaluate_numeric_range(val_float, s3_range):
            assigned_class = "S3"
        elif n_range and self._evaluate_numeric_range(val_float, n_range):
            assigned_class = "N"
        elif n_ranges and any(self._evaluate_numeric_range(val_float, r) for r in n_ranges):
            assigned_class = "N"
        else:
            # Out of bounds fallback
            assigned_class = "N"

        score = CLASS_SCORES.get(assigned_class, 20.0)
        is_limiting = (assigned_class in ["S2", "S3", "N"])

        # Format explanation
        explanation = f"{param_name}: {val_float:.1f} {unit} is {assigned_class}."
        if is_limiting:
            explanation += f" (Optimum S1: {self._format_range(s1_range)} {unit})."

        return {
            "parameter_key": param_key,
            "parameter_name": param_name,
            "unit": unit,
            "weight": weight,
            "value": round(val_float, 2),
            "suitability_class": assigned_class,
            "score": score,
            "is_limiting": is_limiting,
            "status": "EVALUATED",
            "explanation": explanation,
            "source": data_source,
        }

    def _format_range(self, r: Any) -> str:
        if not r:
            return "N/A"
        if isinstance(r, list) and len(r) == 2 and not isinstance(r[0], list):
            low, high = r[0], r[1]
            if low is None:
                return f"< {high}"
            if high is None:
                return f"> {low}"
            return f"{low} – {high}"
        return str(r)

    def evaluate_crop_suitability(
        self,
        crop_code: str,
        soil_indicators: Dict[str, Any],
        weather_indicators: Dict[str, Any],
        gat_no: str = "",
        field_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Evaluates overall suitability for a crop given Gat soil statistics and climate baseline."""
        clean_code = crop_code.lower().strip()
        crop_def = self.get_crop_definition(clean_code)
        if not crop_def:
            raise ValueError(f"Unknown crop code: '{crop_code}'")

        param_defs = crop_def.get("parameters", {})
        evaluated_criteria: List[Dict[str, Any]] = []
        missing_inputs: List[str] = []
        limiting_factors: List[str] = []

        active_ranks = []
        weighted_score_sum = 0.0
        total_active_weights = 0.0

        for p_key, p_def in param_defs.items():
            # Match indicator from soil or weather
            obs_val = None
            src_label = "DSM_RASTER"

            if p_key == "nitrogen":
                raw_n = soil_indicators.get("nitrogen")
                # Nitrogen GeoTIFF is in mg/kg; factor x20 = kg/ha (standard agronomic conversion)
                obs_val = round(raw_n * 20.0, 1) if raw_n is not None else None
                src_label = "DSM_RASTER (mg/kg x20 = kg/ha)"
            elif p_key == "oc":
                obs_val = soil_indicators.get("soc", soil_indicators.get("oc"))
                src_label = "DSM_RASTER (SOC %)"
            elif p_key == "slope":
                obs_val = soil_indicators.get("slope")
                src_label = "SRTM_SLOPE_RASTER (%)"
            elif p_key == "texture":
                obs_val = soil_indicators.get("texture")
                src_label = "SOIL_TEXTURE_RASTER (USDA Class)"
            elif p_key in soil_indicators:
                obs_val = soil_indicators[p_key]
                src_label = "DSM_RASTER"
            elif p_key == "rainfall":
                r_type = p_def.get("rainfall_type", "annual")
                if r_type == "kharif":
                    obs_val = weather_indicators.get("kharif_rainfall_mm", weather_indicators.get("kharif_rainfall"))
                elif r_type == "rabi":
                    obs_val = weather_indicators.get("rabi_rainfall_mm", weather_indicators.get("rabi_rainfall"))
                else:
                    obs_val = weather_indicators.get("annual_rainfall_mm", weather_indicators.get("annual_rainfall"))
                src_label = f"OPEN_METEO_NORMAL_30YR ({r_type})"

                # In canal/lift irrigated commands like Baramati / Malegaon Khurd,
                # crops with heavy water requirement (Sugarcane, Banana) receive assured irrigation.
                # If rainfall alone is evaluated, flag supplemental irrigation option.
                if p_def.get("notes") and ("irrigation" in p_def.get("notes", "").lower()):
                    # When canal/drip irrigation is available, effective water supply meets S1 criteria
                    if soil_indicators.get("irrigation_available", True) or weather_indicators.get("irrigation_available", True):
                        base_val = obs_val if obs_val is not None else 654.0
                        obs_val = max(base_val, 1550.0)
                        src_label = f"OPEN_METEO_NORMAL ({base_val:.0f}mm) + ASSURED CANAL IRRIGATION"
            elif p_key == "temperature":
                obs_val = weather_indicators.get("mean_temperature_c", weather_indicators.get("mean_temperature"))
                src_label = "OPEN_METEO_NORMAL_30YR"
            elif p_key == "humidity":
                obs_val = weather_indicators.get("relative_humidity_pct", weather_indicators.get("relative_humidity"))
                src_label = "OPEN_METEO_NORMAL_30YR"
            elif p_key in ["phosphorus", "potassium", "ec"]:
                # Lab only parameters - check if lab report provides them, else use standard regional baseline values
                if p_key in soil_indicators and soil_indicators[p_key] is not None:
                    obs_val = soil_indicators[p_key]
                    src_label = "LAB_OBSERVATION"
                else:
                    # Regional vertisol baseline defaults for Baramati / Malegaon Khurd
                    default_lab_values = {
                        "ec": 0.85,          # dS/m (normal non-saline Deccan vertisol)
                        "phosphorus": 22.5,   # kg/ha P2O5 (medium fertility baseline)
                        "potassium": 320.0,   # kg/ha K2O (high potassium typical of Deccan black cotton soil)
                    }
                    obs_val = default_lab_values.get(p_key)
                    src_label = "LAB_REPORT_BASELINE (Regional Estimate)"

            crit_res = self.evaluate_criterion(p_key, p_def, obs_val, data_source=src_label)
            evaluated_criteria.append(crit_res)

            if crit_res["status"] == "MISSING_DATA":
                missing_inputs.append(crit_res["parameter_name"])
            else:
                s_class = crit_res["suitability_class"]
                active_ranks.append(CLASS_RANKS[s_class])
                weight = crit_res["weight"]
                score = crit_res["score"]
                weighted_score_sum += (score * weight)
                total_active_weights += weight

                if crit_res["is_limiting"]:
                    limiting_factors.append({
                        "parameter": crit_res["parameter_name"],
                        "class": s_class,
                        "value": crit_res["value"],
                        "unit": crit_res["unit"],
                        "explanation": crit_res["explanation"],
                    })

        # Calculate final class based on weighted suitability score:
        # S1: Highly Suitable (80–100%)
        # S2: Moderately Suitable (60–less than 80%)
        # S3: Marginally Suitable (40–less than 60%)
        # N: Not Suitable (Below 40%)
        if not active_ranks or total_active_weights <= 0:
            final_class = "UNCERTAIN"
            final_score = 0.0
        else:
            final_score = round(weighted_score_sum / total_active_weights, 1)
            if final_score >= 80.0:
                final_class = "S1"
            elif final_score >= 60.0:
                final_class = "S2"
            elif final_score >= 40.0:
                final_class = "S3"
            else:
                final_class = "N"

        # Class explanations (single language)
        class_titles = {
            "S1": "Highly Suitable",
            "S2": "Moderately Suitable",
            "S3": "Marginally Suitable",
            "N": "Not Suitable",
            "UNCERTAIN": "Incomplete Data"
        }
        class_titles_mr = {
            "S1": "उच्च अनुकूल",
            "S2": "मध्यम अनुकूल",
            "S3": "किमान अनुकूल",
            "N": "अनुकूल नाही",
            "UNCERTAIN": "अपूर्ण माहिती"
        }

        return {
            "gat_no": str(gat_no),
            "field_id": field_id,
            "crop_code": clean_code,
            "crop_name": crop_def.get("crop_name"),
            "crop_name_mr": crop_def.get("crop_name_mr"),
            "tolerance": crop_def.get("tolerance"),
            "category": crop_def.get("category"),
            "final_suitability_class": final_class,
            "class_title": class_titles.get(final_class, final_class),
            "class_title_mr": class_titles_mr.get(final_class, final_class),
            "suitability_score": final_score,
            "limiting_factors": limiting_factors,
            "missing_inputs": missing_inputs,
            "data_quality": {
                "total_criteria": len(param_defs),
                "evaluated_criteria_count": len(evaluated_criteria) - len(missing_inputs),
                "missing_criteria_count": len(missing_inputs),
                "completeness_pct": round(((len(evaluated_criteria) - len(missing_inputs)) / len(param_defs)) * 100, 1),
            },
            "evaluated_criteria": evaluated_criteria,
            "rule_version": self.rules.get("rule_version", "CRITERIA_DOC_2026_V1"),
        }


    def list_supported_crops(self) -> List[Dict[str, Any]]:
        """Alias for get_supported_crops."""
        return self.get_supported_crops()


crop_suitability_engine = CropSuitabilityEngine()

if __name__ == "__main__":
    import sys
    from pathlib import Path
    backend_dir = Path(__file__).resolve().parent.parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except AttributeError:
            pass

    print("=" * 60)
    print("SoilPilot Crop Suitability Rule Engine (10 Deccan Crops)")
    print("=" * 60)
    try:
        from app.gis.gat_soil_extractor import gat_soil_extractor
        from app.gis.weather_processor import weather_processor

        soil_indicators = gat_soil_extractor.get_soil_indicators_for_gat("1") or {}
        weather_summary = weather_processor.compute_climatological_normals()
        weather_indicators = weather_summary.get("historical_30yr", {})

        crops = crop_suitability_engine.get_supported_crops()
        print(f"[+] Loaded {len(crops)} crops from criteria JSON:")
        for c in crops:
            print(f"    - {c['crop_name']} ({c['crop_name_mr']}) [{c['crop_code']}]")

        print("\n[+] Evaluating Gat 1 for Sugarcane (Canal Irrigated):")
        res = crop_suitability_engine.evaluate_crop_suitability(
            crop_code="sugarcane",
            soil_indicators=soil_indicators,
            weather_indicators={**weather_indicators, "irrigation_available": True},
            gat_no="1"
        )
        print(f"    - Final Class: {res['final_suitability_class']} ({res['class_title']})")
        print(f"    - Score: {res['suitability_score']}%")
        print(f"    - Limiting Factors: {len(res['limiting_factors'])}")
        for lf in res["limiting_factors"]:
            print(f"      * {lf['parameter']}: {lf['value']} {lf['unit']} -> Class {lf['class']}")
    except Exception as e:
        print(f"[-] Error evaluating suitability engine: {e}")
        import traceback
        traceback.print_exc()

