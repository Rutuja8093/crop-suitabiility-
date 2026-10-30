"""SoilPilot Phase 8: Recommendations Service.
Integrates field soil reports with the deterministic recommendation engine.
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.services.soil_health_service import soil_health_service
from app.services.recommendation_engine import evaluate_parameter_recommendation

class RecommendationService:
    @staticmethod
    def get_recommendations_for_field(db: Session, field_identifier: str) -> Dict[str, Any]:
        """Fetch soil report and generate deterministic field-specific recommendations."""
        try:
            report_data = soil_health_service.get_report_for_field(db, field_identifier)
        except Exception as e:
            # Fallback for unresolvable field to default demo field
            try:
                report_data = soil_health_service.get_report_for_field(db, "15")
            except Exception:
                report_data = {}

        field_info = report_data.get("field", {})
        farmer_info = report_data.get("farmer", {})
        has_report = report_data.get("has_report", False)
        is_demo = report_data.get("is_demo", False)
        parameters = report_data.get("parameters", [])
        key_recs = report_data.get("key_recommendations", [])

        # Build soil status overview for key nutrients (pH, OC, N, P, K)
        key_params_map = {
            "ph": {"name": "Soil pH", "name_mr": "मातीचा सामू (pH)", "default_unit": ""},
            "organic_carbon": {"name": "Organic Carbon", "name_mr": "सेंद्रिय कर्ब", "default_unit": "%"},
            "available_nitrogen": {"name": "Nitrogen", "name_mr": "उपलब्ध नत्र (N)", "default_unit": "kg/ha"},
            "available_phosphorus": {"name": "Phosphorus", "name_mr": "उपलब्ध स्फुरद (P)", "default_unit": "kg/ha"},
            "available_potassium": {"name": "Potassium", "name_mr": "उपलब्ध पालाश (K)", "default_unit": "kg/ha"},
        }

        soil_overview: List[Dict[str, Any]] = []
        param_dict = {p.get("key") or p.get("parameter_key"): p for p in parameters}

        for k, meta in key_params_map.items():
            param_obj = param_dict.get(k)
            if param_obj and param_obj.get("value") is not None:
                soil_overview.append({
                    "key": k,
                    "name": meta["name"],
                    "name_mr": meta["name_mr"],
                    "value": param_obj.get("value"),
                    "unit": param_obj.get("unit") or meta["default_unit"],
                    "status": param_obj.get("interpretation") or param_obj.get("interpretation_en") or "Recorded",
                    "status_mr": param_obj.get("interpretation_mr") or "नोंदणीकृत",
                    "is_available": True,
                })
            else:
                soil_overview.append({
                    "key": k,
                    "name": meta["name"],
                    "name_mr": meta["name_mr"],
                    "value": None,
                    "unit": meta["default_unit"],
                    "status": "Not Available",
                    "status_mr": "उपलब्ध नाही",
                    "is_available": False,
                })

        if not has_report and len(parameters) == 0:
            return {
                "field": field_info,
                "farmer": farmer_info,
                "has_data": False,
                "is_demo": is_demo,
                "summary": {
                    "parameters_reviewed": 0,
                    "parameters_needing_attention": 0,
                    "high_priority_count": 0,
                    "moderate_count": 0,
                    "info_count": 0,
                },
                "soil_overview": soil_overview,
                "recommendations": [],
                "key_recommendations": [],
                "message_en": "No soil test records found for this field. Recommendations require valid laboratory or DSM observations.",
                "message_mr": "या शेतासाठी माती परीक्षण अहवाल उपलब्ध नाही. शिफारसींसाठी माती परीक्षण किंवा DSM निरीक्षणे आवश्यक आहेत.",
            }

        # Evaluate recommendations for each parameter
        evaluated_recs: List[Dict[str, Any]] = []
        for p in parameters:
            p_key = p.get("key") or p.get("parameter_key")
            val = p.get("value")
            name = p.get("name") or p.get("parameter_name") or p_key
            name_mr = p.get("name_mr") or p.get("parameter_name_mr") or name
            category = p.get("category", "General")
            unit = p.get("unit", "")
            interp_en = p.get("interpretation") or p.get("interpretation_en") or ""
            interp_mr = p.get("interpretation_mr") or interp_en
            source = p.get("source") or p.get("source_type") or "LAB OBSERVATION"

            rec = evaluate_parameter_recommendation(
                key=p_key,
                name=name,
                name_mr=name_mr,
                category=category,
                value=val,
                unit=unit,
                interpretation_en=interp_en,
                interpretation_mr=interp_mr,
                source=source,
            )
            if rec:
                # Also attach concise farmer-friendly recommendation
                rec["concise_recommendation"] = p.get("recommendation", "")
                rec["concise_recommendation_mr"] = p.get("recommendation_mr", "")
                rec["status_category"] = p.get("status_category", "GOOD")
                rec["priority_rank"] = p.get("priority_rank", 5)
                evaluated_recs.append(rec)

        # Sort recommendations: priority_rank ascending (1=Critical, 2=Low, 3=High, 4=Medium, 5=Optimal)
        evaluated_recs.sort(key=lambda r: (r.get("priority_rank", 5), r.get("parameter_key", "")))

        # Calculate metrics
        high_count = sum(1 for r in evaluated_recs if r.get("priority_key") == "high")
        mod_count = sum(1 for r in evaluated_recs if r.get("priority_key") == "moderate")
        info_count = sum(1 for r in evaluated_recs if r.get("priority_key") == "info")
        attention_count = sum(1 for r in evaluated_recs if r.get("needs_attention", False))

        return {
            "field": field_info,
            "farmer": farmer_info,
            "has_data": True,
            "is_demo": is_demo,
            "summary": {
                "parameters_reviewed": len(evaluated_recs),
                "parameters_needing_attention": attention_count,
                "high_priority_count": high_count,
                "moderate_count": mod_count,
                "info_count": info_count,
            },
            "soil_overview": soil_overview,
            "recommendations": evaluated_recs,
            "key_recommendations": key_recs,
            "message_en": "Field-specific recommendations generated from verified soil observations.",
            "message_mr": "माती परीक्षण निरीक्षणांवर आधारित शेत-विशिष्ट शिफारसी तयार केल्या आहेत.",
        }

recommendation_service = RecommendationService()

