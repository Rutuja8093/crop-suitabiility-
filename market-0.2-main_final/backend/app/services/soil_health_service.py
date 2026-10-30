"""Soil Health Report Service.
SoilPilot Phase 7
"""
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.field import Field
from app.models.farmer import Farmer
from app.models.geography import Village, Taluka, District
from app.models.soil_health import SoilReport, SoilParameterValue
from app.services.soil_interpretation import SOIL_THRESHOLDS, interpret_parameter
from app.services.recommendation_engine import (
    get_concise_parameter_recommendation,
    evaluate_parameter_recommendation,
    get_ranked_key_recommendations,
)

# Authoritative Demo Sample Dataset (matching the reference laboratory report & DSM predictions for Baramati Vertisols)
DEMO_LAB_PARAMETERS = [
    # Primary Nutrients & Chemical Metrics
    {"sr_no": 1, "key": "ph", "name": "Soil pH", "name_mr": "मातीचा सामू (pH)", "category": "Chemical", "value": 7.24, "unit": "—", "source": "LAB OBSERVATION"},
    {"sr_no": 2, "key": "ec", "name": "Electrical Conductivity (EC)", "name_mr": "विद्युत वाहकता (EC)", "category": "Chemical", "value": 0.10, "unit": "dS/m", "source": "LAB OBSERVATION"},
    {"sr_no": 3, "key": "organic_carbon", "name": "Organic Carbon", "name_mr": "सेंद्रिय कर्ब", "category": "Chemical", "value": 1.45, "unit": "%", "source": "LAB OBSERVATION"},
    {"sr_no": 4, "key": "available_nitrogen", "name": "Available Nitrogen", "name_mr": "उपलब्ध नत्र (N)", "category": "Primary Nutrient", "value": 179.50, "unit": "kg/ha", "source": "LAB OBSERVATION"},
    {"sr_no": 5, "key": "available_phosphorus", "name": "Available Phosphorus", "name_mr": "उपलब्ध स्फुरद (P)", "category": "Primary Nutrient", "value": 14.51, "unit": "kg/ha", "source": "LAB OBSERVATION"},
    {"sr_no": 6, "key": "available_potassium", "name": "Available Potassium", "name_mr": "उपलब्ध पालाश (K)", "category": "Primary Nutrient", "value": 313.00, "unit": "kg/ha", "source": "LAB OBSERVATION"},
    {"sr_no": 7, "key": "exchangeable_sodium", "name": "Exchangeable Sodium Percentage", "name_mr": "विनिमययोग्य सोडियम (ESP)", "category": "Chemical", "value": 4.50, "unit": "%", "source": "LAB OBSERVATION"},
    {"sr_no": 8, "key": "free_lime", "name": "Free Lime (CaCO3)", "name_mr": "मुक्त चुनखडी (CaCO3)", "category": "Chemical", "value": 8.20, "unit": "%", "source": "LAB OBSERVATION"},
    # Micronutrients & Secondary Nutrients (Indian Research Critical Limits)
    {"sr_no": 9, "key": "iron", "name": "Available Iron (Fe)", "name_mr": "उपलब्ध लोह (Fe)", "category": "Micronutrient", "value": 3.80, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 10, "key": "manganese", "name": "Available Manganese (Mn)", "name_mr": "उपलब्ध मँगनीज (Mn)", "category": "Micronutrient", "value": 4.20, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 11, "key": "zinc", "name": "Available Zinc (Zn)", "name_mr": "उपलब्ध जस्त (Zn)", "category": "Micronutrient", "value": 0.42, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 12, "key": "copper", "name": "Available Copper (Cu)", "name_mr": "उपलब्ध तांबे (Cu)", "category": "Micronutrient", "value": 1.80, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 13, "key": "sulphur", "name": "Available Sulphur (S)", "name_mr": "उपलब्ध गंधक (S)", "category": "Secondary Nutrient", "value": 9.40, "unit": "ppm", "source": "LAB OBSERVATION"},
    {"sr_no": 14, "key": "boron", "name": "Available Boron (B)", "name_mr": "उपलब्ध बोरॉन (B)", "category": "Micronutrient", "value": 0.35, "unit": "ppm", "source": "LAB OBSERVATION"},
    # Physical metric
    {"sr_no": 15, "key": "bd", "name": "Bulk Density", "name_mr": "मातीची घनता (BD)", "category": "Physical", "value": 1.58, "unit": "g/cm³", "source": "LAB OBSERVATION"},
    # DSM Standardized Root-Zone Layers (0-30 cm)
    {"sr_no": 16, "key": "total_nitrogen", "name": "Total Nitrogen", "name_mr": "एकूण नत्र", "category": "Nutrient", "value": 0.14, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 17, "key": "cec", "name": "Cation Exchange Capacity (CEC)", "name_mr": "धनायन विनिमय क्षमता (CEC)", "category": "Chemical", "value": 32.50, "unit": "cmol(c)/kg", "source": "DSM PREDICTION"},
    {"sr_no": 18, "key": "cfvo", "name": "Coarse Fragments", "name_mr": "दगड-गोटे प्रमाण", "category": "Physical", "value": 2.40, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 19, "key": "sand", "name": "Sand", "name_mr": "वाळू / रेती", "category": "Physical", "value": 32.20, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 20, "key": "silt", "name": "Silt", "name_mr": "गाळाचे प्रमाण", "category": "Physical", "value": 29.10, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 21, "key": "clay", "name": "Clay", "name_mr": "चिकणमाती", "category": "Physical", "value": 36.30, "unit": "%", "source": "DSM PREDICTION"},
    {"sr_no": 22, "key": "soil_texture", "name": "Soil Texture Class", "name_mr": "मातीचा पोत वर्ग", "category": "Physical", "value": "Clay Vertisol", "unit": "—", "source": "DSM PREDICTION"},
]

class SoilHealthService:
    @staticmethod
    def _find_field(db: Session, field_identifier: str) -> Optional[Field]:
        """Resolve field by Gat number, string identifier, or internal integer ID."""
        import re
        norm = str(field_identifier).strip()

        # 1. Match Gat number directly in DB (e.g. '12' or '104')
        field = db.query(Field).filter(Field.gat_no == norm).first()
        if field:
            return field

        # 2. Extract digits if e.g. 'gat-12' or 'demo-field-gat-12'
        m = re.search(r"(\d+)", norm)
        if m:
            gat_str = m.group(1)
            field = db.query(Field).filter(Field.gat_no == gat_str).first()
            if field:
                return field

        # 3. Check demo keywords
        if norm.lower() in ["demo-field-gat-104", "demo", "gat-104"]:
            field = db.query(Field).filter(Field.gat_no == "104").first()
            if field:
                return field

        # 4. Fall back to internal integer primary key
        if norm.isdigit():
            field = db.query(Field).filter(Field.id == int(norm)).first()
            if field:
                return field

        return None

    @staticmethod
    def get_report_for_field(
        db: Session,
        field_identifier: str,
        farmer_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        import re
        from app.services.dsm_service import dsm_service
        from app.gis.kml_service import kml_service

        field = SoilHealthService._find_field(db, field_identifier)
        norm_id = str(field_identifier).strip().lower()

        # If not found in DB and identifier is clearly unseeded or zeroed UUID
        if not field and ("unseeded" in norm_id or norm_id.startswith("00000000")):
            return {
                "field": {"id": field_identifier, "gat_no": None},
                "farmer": None,
                "has_report": False,
                "is_demo": False,
                "report": None,
                "parameters": [],
                "primary_parameters": {},
            }

        # Extract Gat number
        if field and field.gat_no:
            clean_gat = str(field.gat_no).strip()
        else:
            clean_gat_match = re.search(r"gat-(\d+)", str(field_identifier), re.IGNORECASE)
            if not clean_gat_match:
                clean_gat_match = re.search(r"\b(\d+)\b", str(field_identifier))
            clean_gat = clean_gat_match.group(1) if clean_gat_match else "18"

        display_gat = clean_gat
        # Validate against known KML Gat parcels
        kml_gat = kml_service.get_gat_by_no(clean_gat)
        stats_gat = clean_gat
        if not kml_gat and clean_gat not in ["12", "13", "14", "15", "16", "17", "18", "20", "21", "22", "25"]:
            stats_gat = "18"
            kml_gat = kml_service.get_gat_by_no(stats_gat)

        # Fetch real DSM raster zonal statistics for this specific Gat
        gat_stats = dsm_service.get_gat_stats(stats_gat, db=db)

        is_gat_18 = clean_gat == "18" or display_gat == "18"
        is_gat_22 = clean_gat == "22" or display_gat == "22"

        gat_area = (
            2.69
            if is_gat_18
            else (
                1.49
                if is_gat_22
                else (
                    kml_gat["area_ha"]
                    if kml_gat and kml_gat.get("area_ha")
                    else (gat_stats.get("area_ha") if gat_stats else (field.area if field and field.area else 3.92))
                )
            )
        )
        village_name = (
            "Malegaon Kh."
            if (is_gat_18 or is_gat_22)
            else (
                "Malegaon Bk"
                if display_gat == "104"
                else (
                    kml_gat.get("village")
                    if kml_gat and kml_gat.get("village")
                    else (field.village.name if field and field.village else "Malegaon Kh.")
                )
            )
        )
        taluka_name = "Baramati"
        district_name = "Pune"

        # Gat reference laboratory report values confirmation
        if is_gat_18 or is_gat_22:
            ph_val = 7.24
            soc_val = 1.45
            n_val = 179.50
            bd_val = 1.58
            total_n_val = 0.14
            cec_val = 32.50
            cfvo_val = 2.40
            sand_val = 32.20
            silt_val = 29.10
            clay_val = 36.30
            texture_val = "Clay Vertisol"
        else:
            ph_raw = gat_stats.get("ph", {}).get("mean")
            ph_val = round(ph_raw, 2) if ph_raw is not None else 7.24

            soc_raw = gat_stats.get("soc", {}).get("mean")
            soc_val = round(soc_raw, 3) if soc_raw is not None else 1.45

            n_raw = gat_stats.get("nitrogen", {}).get("mean")
            if n_raw is not None:
                n_val = round(n_raw * 13.25, 1) if n_raw < 50 else round(n_raw, 1)
            else:
                n_val = 179.50

            bd_raw = gat_stats.get("bd", {}).get("mean")
            bd_val = round(bd_raw, 3) if bd_raw is not None else 1.58

            tot_n_raw = gat_stats.get("total_nitrogen", {}).get("mean") or (round(n_raw * 0.008, 2) if n_raw else 0.12)
            total_n_val = round(tot_n_raw, 2) if tot_n_raw is not None else 0.12

            cec_raw = gat_stats.get("cec", {}).get("mean")
            cec_val = round(cec_raw, 2) if cec_raw is not None else 31.20

            cfvo_raw = gat_stats.get("cfvo", {}).get("mean")
            cfvo_val = round(cfvo_raw, 2) if cfvo_raw is not None else 2.80

            sand_raw = gat_stats.get("sand", {}).get("mean")
            sand_val = round(sand_raw, 2) if sand_raw is not None else 34.00

            silt_raw = gat_stats.get("silt", {}).get("mean")
            silt_val = round(silt_raw, 2) if silt_raw is not None else 28.50

            clay_raw = gat_stats.get("clay", {}).get("mean")
            clay_val = round(clay_raw, 2) if clay_raw is not None else 35.50

            texture_val = "Clay Vertisol"

        params = []
        for p in DEMO_LAB_PARAMETERS:
            val = p["value"]
            src = p["source"]
            if p["key"] == "total_nitrogen":
                val = total_n_val
                src = "DSM PREDICTION"
            elif p["key"] == "cec":
                val = cec_val
                src = "DSM PREDICTION"
            elif p["key"] == "cfvo":
                val = cfvo_val
                src = "DSM PREDICTION"
            elif p["key"] == "sand":
                val = sand_val
                src = "DSM PREDICTION"
            elif p["key"] == "silt":
                val = silt_val
                src = "DSM PREDICTION"
            elif p["key"] == "clay":
                val = clay_val
                src = "DSM PREDICTION"
            elif p["key"] == "soil_texture":
                val = texture_val
                src = "DSM PREDICTION"
            elif not is_gat_18 and not is_gat_22:
                if p["key"] == "ph":
                    val = ph_val
                    src = "DSM PREDICTION" if ph_raw is not None else p["source"]
                elif p["key"] == "organic_carbon":
                    val = soc_val
                    src = "DSM PREDICTION" if soc_raw is not None else p["source"]
                elif p["key"] == "available_nitrogen":
                    val = n_val
                    src = "DSM PREDICTION" if n_raw is not None else p["source"]
                elif p["key"] == "bd":
                    val = bd_val
                    src = "DSM PREDICTION" if bd_raw is not None else p["source"]

            interp_en, interp_mr, ref_range = interpret_parameter(p["key"], val)
            ref_range_mr = SOIL_THRESHOLDS.get(p["key"], {}).get("reference_range_mr", ref_range)
            rec_info = get_concise_parameter_recommendation(p["key"], val, interp_en, interp_mr)
            detailed_rec = evaluate_parameter_recommendation(
                key=p["key"],
                name=p["name"],
                name_mr=p["name_mr"],
                category=p["category"],
                value=val,
                unit=p["unit"],
                interpretation_en=interp_en,
                interpretation_mr=interp_mr,
                source=src,
            )
            detail_guidance = detailed_rec.get("action_guidance", "") if detailed_rec else ""
            detail_guidance_mr = detailed_rec.get("action_guidance_mr", "") if detailed_rec else ""

            params.append({
                "sr_no": p["sr_no"],
                "key": p["key"],
                "parameter_key": p["key"],
                "name": p["name"],
                "parameter_name": p["name"],
                "name_mr": p["name_mr"],
                "parameter_name_mr": p["name_mr"],
                "category": p["category"],
                "value": val,
                "unit": p["unit"],
                "interpretation": interp_en,
                "interpretation_en": interp_en,
                "interpretation_mr": interp_mr,
                "reference_range": ref_range,
                "reference_range_mr": ref_range_mr,
                "recommendation": rec_info["recommendation"],
                "recommendation_mr": rec_info["recommendation_mr"],
                "status_category": rec_info["status_category"],
                "priority_rank": rec_info["priority_rank"],
                "priority_key": rec_info["priority_key"],
                "recommendation_detail": detail_guidance,
                "recommendation_detail_mr": detail_guidance_mr,
                "source": src,
                "source_type": src,
            })

        # Dynamic Key Recommendations Summary (ranked internally: Critical > Low > High > Medium > Optimal)
        key_recs = get_ranked_key_recommendations(params, max_items=5)

        dynamic_observations = [
            f"Soil reaction (pH {ph_val:.2f}) indicates moderately alkaline / near-neutral condition. No automatic pH correction; monitor Fe, Zn and micronutrient availability.",
            "Electrical conductivity (0.10 dS/m) is non-saline; no salinity correction required. Maintain appropriate irrigation and drainage.",
            f"Organic carbon ({soc_val}%) is high; maintain organic-carbon status through residue recycling without extra amendments solely for OC.",
            f"Available nitrogen is low ({n_val} kg/ha); use 125% crop RDF under general SHC rules (preferably Maharashtra STCR-IPNS for sugarcane in split doses).",
            "Available phosphorus (14.51 kg/ha) is medium; maintain balanced P management using 100% crop RDF (preferably STCR-IPNS for sugarcane).",
            "Available potassium (313 kg/ha) is high (not very high); apply ~75% crop RDF under general SHC rules without stopping potassium automatically.",
            "Available iron (3.80 ppm) is deficient; confirm laboratory method and implement validated crop/soil-specific Fe correction.",
            "Available zinc (0.42 ppm) is deficient; apply validated crop- and soil-test-based Zn management without hard-coding universal fixed doses.",
            f"Bulk density ({bd_val:.3f} g/cm³) is optimal to moderate for vertisols; practice periodic organic residue recycling."
        ]

        dynamic_observations_mr = [
            f"मातीची प्रतिक्रिया (pH {ph_val:.2f}) मध्यम विम्लधर्मी / सामान्य दर्शवते. रासायनिक सुधारकाची आवश्यकता नाही; लोह व जस्त उपलब्धतेवर लक्ष ठेवा.",
            "विद्युत वाहकता (0.10 dS/m) क्षारमुक्त आहे; क्षारता सुधारणेची गरज नाही. योग्य सिंचन व निचरा व्यवस्था ठेवा.",
            f"सेंद्रिय कर्ब ({soc_val}%) चांगला आहे; पिकांचे अवशेष जमिनीत मिसळून सेंद्रिय कर्ब टिकवून ठेवा.",
            f"उपलब्ध नत्र कमी आहे ({n_val} kg/ha); शिफारशीत मात्रेच्या (RDF) १२५% नत्र खतांचा वापर हप्त्यांमध्ये करावा.",
            "उपलब्ध स्फुरद (14.51 kg/ha) मध्यम आहे; १००% शिफारशीत मात्रेनुसार संतुलित स्फुरद खते द्यावीत.",
            "उपलब्ध पालाश (313 kg/ha) पुरेसे/जास्त आहे; पालाश खतांची मात्रा ७५% पर्यंत नियंत्रित ठेवावी.",
            "उपलब्ध लोह (3.80 ppm) कमी आहे; पिकाच्या गरजेनुसार चिलेटेड लोह किंवा फेरस सल्फेटचा वापर करावा.",
            "उपलब्ध जस्त (0.42 ppm) कमी आहे; माती चाचणीनुसार झिंक सल्फेटचा वापर करावा.",
            f"मातीची घनता ({bd_val:.3f} g/cm³) भारी काळ्या जमिनीसाठी योग्य आहे; सेंद्रिय घटकांचा नियमित वापर करावा."
        ]

        return {
            "field": {
                "id": f"demo-field-gat-{display_gat}",
                "gat_no": display_gat,
                "area": gat_area,
                "area_unit": "hectare",
                "village": village_name,
                "taluka": taluka_name,
                "district": district_name,
                "state": "Maharashtra",
            },
            "farmer": {
                "id": 1,
                "name": farmer_name.strip() if (farmer_name and farmer_name.strip()) else "Ramesh Patil (रमेश पाटील)",
                "code": f"FARMER-{display_gat}",
            },
            "has_report": True,
            "is_demo": True,
            "report": {
                "id": int(display_gat) if display_gat.isdigit() else 12,
                "report_no": "SPL/2026/SL-0104",
                "receipt_no": "REC-7842/26",
                "sample_name": "Surface Soil Composite (0-15 cm)",
                "sample_date": "15-09-2026",
                "report_date": "20-09-2026",
                "crop_name": "Sugarcane (ऊस)",
                "organization_name": "ADT AI Training Foundation",
                "laboratory_name": "ADT AI Training Foundation — Agricultural Diagnostic & Digital Soil Testing Center, Baramati, Pune, Maharashtra",
                "center_name": "Agricultural Diagnostic & Digital Soil Testing Center",
                "center_location": "Pune, Maharashtra",
                "chemist_name": "A.B.C (Chief Chemist)",
                "is_demo": True,
                "status": "Demonstration Diagnostic Record",
                "observations": dynamic_observations,
                "observations_mr": dynamic_observations_mr,
            },
            "parameters": params,
            "key_recommendations": key_recs,
            "dsm_stats": {
                "gat_no": display_gat,
                "name": display_gat,
                "area_ha": gat_area,
                "area_acres": round(gat_area * 2.47105, 2),
                "area_sqm": round(gat_area * 10000, 1),
                "confidence": gat_stats.get("confidence", 91.2),
                "ph": gat_stats.get("ph") or {"mean": ph_val, "min": ph_val, "max": ph_val, "count": 1720},
                "soc": gat_stats.get("soc") or {"mean": soc_val, "min": round(soc_val * 0.9, 2), "max": round(soc_val * 1.1, 2), "count": 1720},
                "nitrogen": gat_stats.get("nitrogen") or {"mean": n_raw or 12.3, "min": 12.12, "max": 12.55, "count": 1720},
                "bd": gat_stats.get("bd") or {"mean": bd_val, "min": 1.55, "max": 1.58, "count": 1720},
                "elevation": gat_stats.get("elevation") or {"mean": 568.5, "min": 560.0, "max": 575.5, "count": 1720},
                "ndvi": gat_stats.get("ndvi") or {"mean": 0.392, "min": 0.120, "max": 0.650, "count": 1720},
                "evi": gat_stats.get("evi") or {"mean": 0.241, "min": 0.080, "max": 0.420, "count": 1720},
                "uncertainty": gat_stats.get("uncertainty") or {"mean": 7.84, "min": 6.5, "max": 9.8, "count": 1720},
            },
            "observations": dynamic_observations,
            "observations_mr": dynamic_observations_mr,
        }

        # 3. For any unseeded field with no soil testing data
        return {
            "field": {
                "id": field.id,
                "gat_no": field.gat_no,
                "area": field.area,
                "area_unit": field.area_unit,
                "village": village.name if village else "",
                "taluka": taluka.name if taluka else "",
                "district": district.name if district else "",
                "state": "Maharashtra",
            },
            "farmer": {
                "id": farmer.id if farmer else None,
                "name": farmer.full_name if farmer else "Farmer",
                "code": farmer.farmer_code if farmer else "",
            },
            "has_report": False,
            "is_demo": False,
            "report": None,
            "parameters": [],
        }

    @staticmethod
    def get_summary_for_field(db: Session, field_identifier: str) -> Dict[str, Any]:
        full_report = SoilHealthService.get_report_for_field(db, field_identifier)
        if not full_report or not full_report.get("has_report"):
            return {
                "field_id": field_identifier,
                "has_report": False,
                "is_demo": False,
                "report_no": "Pending",
                "status": "Pending",
                "primary_parameters": {},
            }

        params_by_key = {p["key"]: p for p in full_report["parameters"]}
        
        primary_params = {}
        for key in ["ph", "ec", "organic_carbon", "available_nitrogen", "available_phosphorus", "available_potassium"]:
            item = params_by_key.get(key)
            if item:
                primary_params[key] = {
                    "name": item["name"],
                    "name_mr": item["name_mr"],
                    "value": item["value"],
                    "unit": item["unit"],
                    "interpretation": item["interpretation"],
                    "interpretation_mr": item["interpretation_mr"],
                    "source": item["source"],
                }

        return {
            "field_id": field_identifier,
            "has_report": True,
            "is_demo": full_report["is_demo"],
            "report_no": full_report["report"]["report_no"] if full_report["report"] else "Pending",
            "report_date": full_report["report"]["report_date"] if full_report["report"] else "Pending",
            "status": full_report["report"]["status"] if full_report["report"] else "Pending",
            "primary_parameters": primary_params,
            # Flat convenience fields for quick dashboard consumption
            "ph": params_by_key.get("ph", {}).get("value"),
            "ph_status": params_by_key.get("ph", {}).get("interpretation", "N/A"),
            "organic_carbon": params_by_key.get("organic_carbon", {}).get("value"),
            "nitrogen": params_by_key.get("available_nitrogen", {}).get("value"),
            "phosphorus": params_by_key.get("available_phosphorus", {}).get("value"),
            "potassium": params_by_key.get("available_potassium", {}).get("value"),
        }

soil_health_service = SoilHealthService()
