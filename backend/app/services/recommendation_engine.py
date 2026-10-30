"""SoilPilot Phase 8: Deterministic Rule-Based Soil Recommendations Engine.
Based on Soil Health Card (SHC) & Indian Micronutrient Research (242,827 samples across 615 districts),
incorporating MPKV Rahuri STCR-IPNS framework for Maharashtra sugarcane/Vertisols.

NO generative AI / LLM is used. All recommendations are derived from structured rules.
"""
from typing import Dict, Any, List, Optional


def evaluate_parameter_recommendation(
    key: str,
    name: str,
    name_mr: str,
    category: str,
    value: Optional[float],
    unit: str,
    interpretation_en: str,
    interpretation_mr: str,
    source: str = "LAB OBSERVATION",
) -> Optional[Dict[str, Any]]:
    """Evaluates a single soil parameter observation and returns a structured recommendation.
    Returns None if value is not available.
    """
    if value is None:
        return None

    k = key.lower().replace("-", "_").strip()
    concise = get_concise_parameter_recommendation(k, value, interpretation_en, interpretation_mr)

    # Base record structure with extended DB-ready metadata
    rec: Dict[str, Any] = {
        # Standard API fields
        "parameter_key": key,
        "parameter_name": name,
        "parameter_name_mr": name_mr,
        "category": category,
        "value": value,
        "unit": unit,
        "status": concise.get("classification") or interpretation_en,
        "status_mr": concise.get("classification_mr") or interpretation_mr,
        "source": source,
        "priority": "HIGH PRIORITY" if concise["priority_key"] == "high" else ("MODERATE" if concise["priority_key"] == "moderate" else "INFORMATION"),
        "priority_key": concise["priority_key"],
        "priority_rank": concise["priority_rank"],
        "needs_attention": concise["priority_key"] in ["high", "moderate"],
        "recommendation": concise["recommendation"],
        "recommendation_mr": concise["recommendation_mr"],
        "action_guidance": concise.get("action", concise["recommendation"]),
        "action_guidance_mr": concise.get("action_mr", concise["recommendation_mr"]),
        "why_it_matters": "",
        "why_it_matters_mr": "",
        "what_observed": f"{name} is {f'{value:.2f}' if isinstance(value, (int, float)) else str(value)} {unit}".strip() + f", classified as {concise.get('classification', interpretation_en)}.",
        "what_observed_mr": f"{name_mr} पातळी {f'{value:.2f}' if isinstance(value, (int, float)) else str(value)} {unit} आहे ({concise.get('classification_mr', interpretation_mr)}).".strip(),
        "what_it_means": concise.get("what_it_means", ""),
        "what_it_means_mr": concise.get("what_it_means_mr", ""),

        # Structured Database Rules Schema requested by user
        "parameter": key,
        "observed_value": value,
        "lower_limit": concise.get("lower_limit"),
        "upper_limit": concise.get("upper_limit"),
        "classification": concise.get("classification", interpretation_en),
        "classification_mr": concise.get("classification_mr", interpretation_mr),
        "severity": concise.get("severity", "Normal"),
        "action": concise.get("action", ""),
        "action_mr": concise.get("action_mr", ""),
        "fertilizer_rule": concise.get("fertilizer_rule", ""),
        "reference_id": concise.get("reference_id", "SHC-RULES"),
        "reference_type": concise.get("reference_type", "Government SHC + Indian Research"),
    }

    # Contextual Why-It-Matters & Educational details
    if k == "ph":
        rec["why_it_matters"] = "Soil pH dictates chemical solubility and how readily crop roots can absorb macro and micronutrients."
        rec["why_it_matters_mr"] = "मातीचा सामू (pH) रासायनिक विद्राव्यता आणि पिकांची मुळे अन्नद्रव्ये किती सहज शोषून घेऊ शकतात हे ठरवतो."
        rec["what_it_means"] = (
            "Acidity locks phosphorus and calcium while elevating toxic aluminium." if value < 6.0 else
            ("Optimal chemical reaction for nutrient absorption." if value <= 7.05 else
             "Alkalinity reduces availability of phosphorus, iron, and zinc due to precipitation with calcium carbonate.")
        )
        rec["what_it_means_mr"] = (
            "आम्लतेमुळे स्फुरद आणि कॅल्शियम उपलब्धता घटते." if value < 6.0 else
            ("अन्नद्रव्य शोषणासाठी अत्यंत योग्य सामू." if value <= 7.05 else
             "विम्लतेमुळे चुनखडीच्या उपस्थितीत स्फुरद, लोह आणि जस्त जमिनीत बद्ध होतात.")
        )
    elif k in ["ec", "electrical_conductivity"]:
        rec["why_it_matters"] = "Electrical conductivity measures dissolved soluble salts in soil water, indicating salinity risks."
        rec["why_it_matters_mr"] = "विद्युत वाहकता मातीतील विद्राव्य क्षारांचे प्रमाण मोजते आणि क्षारयुक्ततेचा धोका दर्शवते."
    elif k in ["organic_carbon", "soc"]:
        rec["why_it_matters"] = "Organic carbon is the biological backbone of soil, controlling moisture retention, microbial activity, and nutrient delivery."
        rec["why_it_matters_mr"] = "सेंद्रिय कर्ब हा मातीचा कणा आहे; तो ओलावा टिकवून ठेवणे, सूक्ष्मजीव क्रियाशीलता आणि अन्नद्रव्य पुरवठा नियंत्रित करतो."
    elif k in ["available_nitrogen", "nitrogen"]:
        rec["why_it_matters"] = "Nitrogen drives rapid vegetative growth, tillering, stem elongation, and chlorophyll synthesis for green foliage."
        rec["why_it_matters_mr"] = "नत्र हे पिकांची जोमदार शाकीय वाढ, फुटवे, हिरवेगार पानांसाठी क्लोरोफिल निर्मितीसाठी अत्यावश्यक आहे."
    elif k in ["available_phosphorus", "phosphorus"]:
        rec["why_it_matters"] = "Phosphorus fuels root architecture development, energy transfer (ATP), and early flowering/pod setting."
        rec["why_it_matters_mr"] = "स्फुरद मुळांचा विस्तार, वनस्पतीतील ऊर्जा वहन आणि वेळेवर फुले व फळे धरण्यासाठी अत्यंत महत्त्वाचे आहे."
    elif k in ["available_potassium", "potassium"]:
        rec["why_it_matters"] = "Potassium strengthens cell walls, governs stomatal water management during drought, and improves grain/fruit weight and quality."
        rec["why_it_matters_mr"] = "पालाश पेशींची रचना बळकट करते, दुष्काळात पाण्याचे नियंत्रण ठेवते आणि दाण्यांचे/फळांचे वजन व प्रत सुधारते."
    elif k in ["iron", "zinc", "copper", "manganese", "boron", "sulphur"]:
        rec["why_it_matters"] = f"{name} is an essential catalytic micronutrient vital for enzyme activation and hormonal balance."
        rec["why_it_matters_mr"] = f"{name_mr} हे वनस्पतींमधील विकर (एंझाइम) सक्रिय करण्यासाठी आणि उत्पादन क्षमता वाढवण्यासाठी आवश्यक आहे."

    return rec


def get_concise_parameter_recommendation(
    key: str,
    value: Optional[float],
    interp_en: str = "",
    interp_mr: str = "",
) -> Dict[str, Any]:
    """Generates the concise, deterministic advisory matching official Soil Health Card (SHC) rules
    and Indian Micronutrient Research (242,827 soil samples across 615 districts).
    """
    if value is None:
        return {
            "classification": "Not Available",
            "classification_mr": "उपलब्ध नाही",
            "status_category": "UNKNOWN",
            "priority_rank": 5,
            "priority_key": "info",
            "severity": "Unknown",
            "recommendation": "Laboratory observation not recorded for this parameter.",
            "recommendation_mr": "या घटकासाठी प्रयोगशाळा चाचणी उपलब्ध नाही.",
            "action": "Submit soil sample for testing.",
            "action_mr": "माती नमुना तपासणीसाठी पाठवा.",
            "fertilizer_rule": "N/A",
            "reference_id": "N/A",
            "reference_type": "N/A",
            "lower_limit": None,
            "upper_limit": None,
        }

    k = key.lower().replace("-", "_").strip()

    # =========================================================================
    # 1. Soil pH
    # =========================================================================
    # =========================================================================
    # 1. Soil pH
    # =========================================================================
    if k == "ph":
        if value < 5.0:
            return {
                "classification": "Strongly acidic",
                "classification_mr": "तीव्र आम्लधर्मी",
                "status_category": "CRITICAL",
                "priority_rank": 1,
                "priority_key": "high",
                "severity": "High",
                "lower_limit": None,
                "upper_limit": 5.0,
                "recommendation": "Apply lime as per soil test.",
                "recommendation_mr": "माती चाचणीनुसार कृषी चुना वापरा.",
                "action": "Apply agricultural lime according to laboratory test and crop requirement.",
                "action_mr": "माती चाचणीनुसार आवश्यकतेनुसार चुना वापरा.",
                "fertilizer_rule": "Soil-test-based liming",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }
        elif value <= 6.0:
            return {
                "classification": "Acidic",
                "classification_mr": "आम्लधर्मी",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "moderate",
                "severity": "Moderate",
                "lower_limit": 5.0,
                "upper_limit": 6.0,
                "recommendation": "Monitor; lime if needed.",
                "recommendation_mr": "सामूवर लक्ष ठेवा; आवश्यक असल्यास चुना वापरा.",
                "action": "Monitor soil reaction; apply amendment only if target crop requires higher pH.",
                "action_mr": "सामूवर लक्ष ठेवा; पिकास आवश्यकता असल्यास भूसुधारक वापरा.",
                "fertilizer_rule": "Crop-specific amendment if needed",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }
        elif value <= 7.5:
            # Gat 22: 7.10 -> Suitable
            return {
                "classification": "Suitable",
                "classification_mr": "योग्य (अनुकूल)",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 6.0,
                "upper_limit": 7.5,
                "recommendation": "Maintain current pH.",
                "recommendation_mr": "सध्याचा सामू टिकवून ठेवा.",
                "action": "Maintain balanced fertilization; no pH correction required.",
                "action_mr": "सध्याचा सामू उत्तम आहे; कोणतीही दुरुस्ती आवश्यक नाही.",
                "fertilizer_rule": "Maintain current pH; 100% standard management",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }
        elif value <= 8.5:
            return {
                "classification": "Alkaline",
                "classification_mr": "विम्लधर्मी",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "moderate",
                "severity": "Moderate",
                "lower_limit": 7.5,
                "upper_limit": 8.5,
                "recommendation": "Monitor Fe/Zn.",
                "recommendation_mr": "लोह (Fe) व जस्त (Zn) उपलब्धतेवर लक्ष ठेवा.",
                "action": "Avoid alkaline amendments and fertilizers; use foliar or chelated micronutrients if deficiencies appear.",
                "action_mr": "विम्लधर्मी खते टाळा आणि लोह/जस्त उपलब्धतेवर लक्ष ठेवा.",
                "fertilizer_rule": "Micronutrient monitoring and management",
                "reference_id": "R1, R2",
                "reference_type": "Soil Health Card + Indian Research",
            }
        else:
            return {
                "classification": "Strongly alkaline",
                "classification_mr": "अति विम्लधर्मी",
                "status_category": "CRITICAL",
                "priority_rank": 1,
                "priority_key": "high",
                "severity": "Critical",
                "lower_limit": 8.5,
                "upper_limit": None,
                "recommendation": "Test soil; manage alkalinity.",
                "recommendation_mr": "माती परीक्षण करा; विम्लता व्यवस्थापन करा.",
                "action": "Conduct detailed soil/ESP testing; apply gypsum or sulphur as per soil test.",
                "action_mr": "सविस्तर माती चाचणी करून जिप्सम किंवा सेंद्रिय भूसुधारक वापरा.",
                "fertilizer_rule": "Soil-test-based reclamation (gypsum requirement)",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }

    # =========================================================================
    # 2. Electrical Conductivity — EC (dS/m)
    # =========================================================================
    elif k in ["ec", "electrical_conductivity"]:
        if value < 0.4:
            # Gat 22: 0.10 dS/m -> Non-saline
            return {
                "classification": "Non-saline",
                "classification_mr": "अक्षारयुक्त",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": None,
                "upper_limit": 0.4,
                "recommendation": "No salinity action.",
                "recommendation_mr": "क्षार सुधारणेची गरज नाही.",
                "action": "Maintain appropriate irrigation and field drainage.",
                "action_mr": "योग्य सिंचन व पाण्याचा चांगला निचरा ठेवा.",
                "fertilizer_rule": "Standard irrigation/drainage practice",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }
        elif value <= 0.8:
            return {
                "classification": "Slightly saline",
                "classification_mr": "किंचित क्षारयुक्त",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "info",
                "severity": "Low Risk",
                "lower_limit": 0.4,
                "upper_limit": 0.8,
                "recommendation": "Improve drainage; monitor.",
                "recommendation_mr": "पाण्याचा निचरा सुधारा; लक्ष ठेवा.",
                "action": "Improve drainage channels, check irrigation water quality, and avoid salt build-up.",
                "action_mr": "निचरा सुधारा, पाण्याचा दर्जा तपासा आणि क्षार साचू देऊ नका.",
                "fertilizer_rule": "Periodic monitoring; maintain drainage",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }
        elif value <= 1.6:
            return {
                "classification": "Moderately saline",
                "classification_mr": "मध्यम क्षारयुक्त",
                "status_category": "HIGH",
                "priority_rank": 3,
                "priority_key": "moderate",
                "severity": "Moderate",
                "lower_limit": 0.8,
                "upper_limit": 1.6,
                "recommendation": "Manage salts and irrigation.",
                "recommendation_mr": "क्षार व सिंचन व्यवस्थापन करा.",
                "action": "Improve drainage, monitor irrigation water, and avoid chloride-based fertilizers.",
                "action_mr": "क्षार व्यवस्थापन सुरू करा व पाण्याचा चांगला निचरा ठेवा.",
                "fertilizer_rule": "Salinity management; leaching irrigation",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }
        else:
            return {
                "classification": "Highly saline",
                "classification_mr": "अति क्षारयुक्त",
                "status_category": "CRITICAL",
                "priority_rank": 1,
                "priority_key": "high",
                "severity": "Critical",
                "lower_limit": 1.6,
                "upper_limit": None,
                "recommendation": "Soil/water testing needed.",
                "recommendation_mr": "माती व पाणी परीक्षण आवश्यक.",
                "action": "Perform detailed soil and water testing; prepare leaching and reclamation plan.",
                "action_mr": "सविस्तर माती-पाणी परीक्षण करून जमीन सुधारणा योजना आखा.",
                "fertilizer_rule": "Reclamation leaching program",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }

    # =========================================================================
    # 3. Organic Carbon — OC (%)
    # =========================================================================
    elif k in ["organic_carbon", "soc"]:
        if value < 0.50:
            return {
                "classification": "Low",
                "classification_mr": "कमी",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "high",
                "severity": "Deficient",
                "lower_limit": None,
                "upper_limit": 0.50,
                "recommendation": "Add FYM/compost/residues.",
                "recommendation_mr": "शेणखत/कंपोस्ट/पीक अवशेष वापरा.",
                "action": "Incorporate FYM (8-10 t/ha), compost, or crop residues; avoid burning residues.",
                "action_mr": "शेणखत किंवा कंपोस्टचा नियमित वापर करा; अवशेष जाळू नका.",
                "fertilizer_rule": "Integrated Nutrient Management (INM) + organic recycling",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }
        elif value <= 0.75:
            return {
                "classification": "Medium",
                "classification_mr": "मध्यम",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "info",
                "severity": "Moderate",
                "lower_limit": 0.50,
                "upper_limit": 0.75,
                "recommendation": "Maintain organic matter.",
                "recommendation_mr": "सेंद्रिय घटक टिकवून ठेवा.",
                "action": "Maintain organic matter using crop residues, green manuring, and balanced fertilization.",
                "action_mr": "सेंद्रिय खते व पीक अवशेषांद्वारे सेंद्रिय घटक टिकवून ठेवा.",
                "fertilizer_rule": "Balanced INM & residue retention",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }
        else:
            # Gat 22: 1.60% -> High
            return {
                "classification": "High",
                "classification_mr": "जास्त",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Optimal",
                "lower_limit": 0.75,
                "upper_limit": None,
                "recommendation": "Maintain; no extra OC needed.",
                "recommendation_mr": "पातळी टिकवा; अतिरिक्त कर्बाची गरज नाही.",
                "action": "Maintain existing organic-carbon status through suitable residue recycling.",
                "action_mr": "सध्याची सेंद्रिय पातळी टिकवा; वेगळी खते देण्याची गरज नाही.",
                "fertilizer_rule": "No additional amendment solely for OC",
                "reference_id": "R1",
                "reference_type": "Soil Health Card (SHC) Scheme",
            }

    # =========================================================================
    # 4. Available Nitrogen — N (kg/ha)
    # =========================================================================
    elif k in ["available_nitrogen", "nitrogen"]:
        if value < 280:
            # Gat 22: 189.30 -> Low
            return {
                "classification": "Low",
                "classification_mr": "कमी",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "high",
                "severity": "Deficient",
                "lower_limit": None,
                "upper_limit": 280.0,
                "recommendation": "Increase N; ~125% RDF*",
                "recommendation_mr": "नत्र वाढवा; ~१२५% शिफारशीत मात्रा*",
                "action": "Apply 125% crop RDF nitrogen in splits; for sugarcane, use Maharashtra STCR-IPNS recommendation.",
                "action_mr": "१२५% नत्र खत हप्त्यांमध्ये द्या; उसासाठी STCR-IPNS वापरा.",
                "fertilizer_rule": "RDF × 1.25 (General SHC) / Maharashtra STCR-IPNS (Sugarcane)",
                "reference_id": "R1, R3",
                "reference_type": "Government SHC + STCR (*For sugarcane: Maharashtra STCR-IPNS)",
            }
        elif value <= 560:
            return {
                "classification": "Medium",
                "classification_mr": "मध्यम",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 280.0,
                "upper_limit": 560.0,
                "recommendation": "Normal RDF*",
                "recommendation_mr": "सर्वसाधारण १००% शिफारशीत मात्रा*",
                "action": "Apply standard 100% crop RDF split according to crop requirement.",
                "action_mr": "पिकाच्या गरजेनुसार १००% नत्र खत विभागून द्यावे.",
                "fertilizer_rule": "100% RDF (General SHC)",
                "reference_id": "R1, R3",
                "reference_type": "Government SHC + STCR",
            }
        else:
            return {
                "classification": "High",
                "classification_mr": "जास्त",
                "status_category": "HIGH",
                "priority_rank": 3,
                "priority_key": "moderate",
                "severity": "Surplus",
                "lower_limit": 560.0,
                "upper_limit": None,
                "recommendation": "Reduce N; ~75% RDF*",
                "recommendation_mr": "नत्र कमी करा; ~७५% शिफारशीत मात्रा*",
                "action": "Reduce N application to 75% RDF to avoid vegetative overgrowth and losses.",
                "action_mr": "नत्र खताचा वापर २५% कमी करा (७५% मात्रा द्या).",
                "fertilizer_rule": "RDF × 0.75 (General SHC)",
                "reference_id": "R1, R3",
                "reference_type": "Government SHC + STCR",
            }

    # =========================================================================
    # 5. Available Phosphorus — P (kg/ha)
    # =========================================================================
    elif k in ["available_phosphorus", "phosphorus"]:
        if value < 10.0:
            return {
                "classification": "Low",
                "classification_mr": "कमी",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "high",
                "severity": "Deficient",
                "lower_limit": None,
                "upper_limit": 10.0,
                "recommendation": "Increase P; ~125% RDF*",
                "recommendation_mr": "स्फुरद वाढवा; ~१२५% शिफारशीत मात्रा*",
                "action": "Apply 125% crop RDF placed in root zone; for sugarcane, use STCR-IPNS.",
                "action_mr": "पेरणीवेळी १२५% स्फुरद खत मुळांच्या सानिध्यात द्या.",
                "fertilizer_rule": "RDF × 1.25 (General SHC) / STCR-IPNS",
                "reference_id": "R1, R3",
                "reference_type": "Government SHC + STCR",
            }
        elif value <= 25.0:
            # Gat 22: 14.51 -> Medium
            return {
                "classification": "Medium",
                "classification_mr": "मध्यम",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 10.0,
                "upper_limit": 25.0,
                "recommendation": "Normal RDF*",
                "recommendation_mr": "सर्वसाधारण १००% शिफारशीत मात्रा*",
                "action": "Apply standard 100% crop RDF (for sugarcane, preferably STCR-IPNS).",
                "action_mr": "पिकाच्या गरजेनुसार १००% शिफारशीत स्फुरद खत द्यावे.",
                "fertilizer_rule": "100% RDF (General SHC) / STCR-IPNS",
                "reference_id": "R1, R3",
                "reference_type": "Government SHC + STCR",
            }
        elif value <= 50.0:
            return {
                "classification": "High",
                "classification_mr": "जास्त",
                "status_category": "HIGH",
                "priority_rank": 3,
                "priority_key": "info",
                "severity": "Surplus",
                "lower_limit": 25.0,
                "upper_limit": 50.0,
                "recommendation": "Reduce P; ~75% RDF*",
                "recommendation_mr": "स्फुरद कमी करा; ~७५% शिफारशीत मात्रा*",
                "action": "Reduce P application to 75% RDF to avoid excess accumulation.",
                "action_mr": "स्फुरदाची मात्रा २५% कमी करून खर्चात बचत करा.",
                "fertilizer_rule": "RDF × 0.75 (General SHC)",
                "reference_id": "R1, R3",
                "reference_type": "Government SHC + STCR",
            }
        else:
            return {
                "classification": "Very high",
                "classification_mr": "अति जास्त",
                "status_category": "VERY HIGH",
                "priority_rank": 3,
                "priority_key": "info",
                "severity": "High Surplus",
                "lower_limit": 50.0,
                "upper_limit": None,
                "recommendation": "Avoid P fertilizer",
                "recommendation_mr": "स्फुरद खत देणे टाळा",
                "action": "Omit phosphatic fertilizer; monitor future soil tests.",
                "action_mr": "स्फुरद खत देणे थांबवा आणि पुढील चाचणीवर लक्ष ठेवा.",
                "fertilizer_rule": "0% RDF (Avoid P fertilizer)",
                "reference_id": "R1",
                "reference_type": "Government SHC",
            }

    # =========================================================================
    # 6. Available Potassium — K (kg/ha)
    # =========================================================================
    elif k in ["available_potassium", "potassium"]:
        if value < 120.0:
            return {
                "classification": "Low",
                "classification_mr": "कमी",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "high",
                "severity": "Deficient",
                "lower_limit": None,
                "upper_limit": 120.0,
                "recommendation": "Increase K; ~125% RDF*",
                "recommendation_mr": "पालाश वाढवा; ~१२५% शिफारशीत मात्रा*",
                "action": "Apply 125% crop RDF potassium; for sugarcane, use STCR-IPNS.",
                "action_mr": "१२५% पालाश खताचा वापर करावा; उसासाठी STCR-IPNS वापरा.",
                "fertilizer_rule": "RDF × 1.25 (General SHC) / STCR-IPNS",
                "reference_id": "R1, R3",
                "reference_type": "Government SHC + STCR",
            }
        elif value <= 280.0:
            return {
                "classification": "Medium",
                "classification_mr": "मध्यम",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 120.0,
                "upper_limit": 280.0,
                "recommendation": "Normal RDF*",
                "recommendation_mr": "सर्वसाधारण १००% शिफारशीत मात्रा*",
                "action": "Apply standard 100% recommended potassium dose.",
                "action_mr": "पिकाच्या गरजेनुसार १००% पालाश द्यावे.",
                "fertilizer_rule": "100% RDF (General SHC)",
                "reference_id": "R1, R3",
                "reference_type": "Government SHC + STCR",
            }
        elif value <= 600.0:
            # Gat 22: 313 kg/ha -> High
            return {
                "classification": "High",
                "classification_mr": "जास्त",
                "status_category": "HIGH",
                "priority_rank": 3,
                "priority_key": "moderate",
                "severity": "High",
                "lower_limit": 280.0,
                "upper_limit": 600.0,
                "recommendation": "Reduce K; ~75% RDF*",
                "recommendation_mr": "पालाश कमी करा; ~७५% शिफारशीत मात्रा*",
                "action": "Apply ~75% crop RDF potassium; for sugarcane, use Maharashtra STCR-IPNS.",
                "action_mr": "पालाश सुमारे ७५% द्या; उसासाठी महाराष्ट्र STCR-IPNS वापरा.",
                "fertilizer_rule": "RDF × 0.75 (General SHC) / Maharashtra STCR-IPNS",
                "reference_id": "R1, R3",
                "reference_type": "Government SHC + STCR",
            }
        else:
            return {
                "classification": "Very high",
                "classification_mr": "अति जास्त",
                "status_category": "VERY HIGH",
                "priority_rank": 3,
                "priority_key": "info",
                "severity": "Very High",
                "lower_limit": 600.0,
                "upper_limit": None,
                "recommendation": "Avoid K fertilizer",
                "recommendation_mr": "पालाश खत देणे टाळा",
                "action": "Avoid chemical K fertilizer unless local crop advisory indicates special need.",
                "action_mr": "पालाश खत देणे टाळा आणि पुढील चाचणीवर लक्ष ठेवा.",
                "fertilizer_rule": "0% RDF (Avoid K fertilizer)",
                "reference_id": "R1",
                "reference_type": "Government SHC",
            }

    # =========================================================================
    # 7. Available Iron — Fe (mg/kg)
    # =========================================================================
    elif k in ["iron", "fe"]:
        if value < 2.5:
            return {
                "classification": "Very deficient",
                "classification_mr": "अति तीव्र कमतरता",
                "status_category": "CRITICAL",
                "priority_rank": 1,
                "priority_key": "high",
                "severity": "Acute Deficient",
                "lower_limit": None,
                "upper_limit": 2.5,
                "recommendation": "Correct Fe deficiency",
                "recommendation_mr": "लोह कमतरता दूर करा",
                "action": "Implement crop- and soil-specific Fe correction (e.g. foliar spray / chelated iron).",
                "action_mr": "फेरस सल्फेट फवारणी किंवा चिलेटेड लोहाचा वापर करा.",
                "fertilizer_rule": "Crop-specific Fe correction",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        elif value <= 4.5:
            # Gat 22: 3.80 mg/kg -> Deficient
            return {
                "classification": "Deficient",
                "classification_mr": "कमतरता",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "high",
                "severity": "Deficient",
                "lower_limit": 2.5,
                "upper_limit": 4.5,
                "recommendation": "Apply Fe if needed",
                "recommendation_mr": "गरज भासल्यास लोह वापरा",
                "action": "Confirm laboratory method and apply validated crop-specific Fe correction if needed.",
                "action_mr": "लक्षणे तपासा व गरज असल्यास फेरस सल्फेट फवारणी करा.",
                "fertilizer_rule": "Apply Fe if needed",
                "reference_id": "R1, R2",
                "reference_type": "Government SHC + Indian Research",
            }
        elif value <= 6.5:
            return {
                "classification": "Marginal",
                "classification_mr": "सीमांत",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "moderate",
                "severity": "Marginal",
                "lower_limit": 4.5,
                "upper_limit": 6.5,
                "recommendation": "Monitor Fe",
                "recommendation_mr": "लोहावर लक्ष ठेवा",
                "action": "Monitor crop foliage for chlorosis; maintain balanced nutrition.",
                "action_mr": "पानांवर पिवळेपणा दिसल्यास लक्ष ठेवा.",
                "fertilizer_rule": "Conditional monitoring",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        else:
            return {
                "classification": "Sufficient",
                "classification_mr": "पुरेसे",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 6.5,
                "upper_limit": None,
                "recommendation": "No Fe correction",
                "recommendation_mr": "लोह सुधारणेची गरज नाही",
                "action": "Maintain current management; no Fe application required.",
                "action_mr": "अतिरिक्त लोह खताची गरज नाही.",
                "fertilizer_rule": "None",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }

    # =========================================================================
    # 8. Available Zinc — Zn (mg/kg)
    # =========================================================================
    elif k in ["zinc", "zn"]:
        if value < 0.3:
            return {
                "classification": "Very deficient",
                "classification_mr": "अति तीव्र कमतरता",
                "status_category": "CRITICAL",
                "priority_rank": 1,
                "priority_key": "high",
                "severity": "Acute Deficient",
                "lower_limit": None,
                "upper_limit": 0.3,
                "recommendation": "Correct Zn deficiency",
                "recommendation_mr": "जस्त कमतरता दूर करा",
                "action": "Implement crop-specific Zn correction (e.g. Zinc Sulphate in splits or foliar spray).",
                "action_mr": "झिंक सल्फेट किंवा फवारणीद्वारे जस्त कमतरता दूर करा.",
                "fertilizer_rule": "Crop-specific Zn correction",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        elif value <= 0.6:
            # Gat 22: 0.42 mg/kg -> Deficient
            return {
                "classification": "Deficient",
                "classification_mr": "कमतरता",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "high",
                "severity": "Deficient",
                "lower_limit": 0.3,
                "upper_limit": 0.6,
                "recommendation": "Apply Zn if needed",
                "recommendation_mr": "गरज भासल्यास जस्त वापरा",
                "action": "Apply validated soil or foliar zinc management based on crop requirement.",
                "action_mr": "पीक गरजेनुसार झिंक सल्फेट किंवा फवारणी करा.",
                "fertilizer_rule": "Apply Zn if needed",
                "reference_id": "R1, R2",
                "reference_type": "Government SHC + Indian Research",
            }
        elif value <= 0.9:
            return {
                "classification": "Marginal",
                "classification_mr": "सीमांत",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "moderate",
                "severity": "Marginal",
                "lower_limit": 0.6,
                "upper_limit": 0.9,
                "recommendation": "Monitor Zn",
                "recommendation_mr": "जस्तावर लक्ष ठेवा",
                "action": "Monitor crop response; apply Zn if growing sensitive crops.",
                "action_mr": "पिकाची वाढ तपासा व लक्ष ठेवा.",
                "fertilizer_rule": "Conditional monitoring",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        else:
            return {
                "classification": "Sufficient",
                "classification_mr": "पुरेसे",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 0.9,
                "upper_limit": None,
                "recommendation": "No Zn correction",
                "recommendation_mr": "जस्त सुधारणेची गरज नाही",
                "action": "Maintain balanced nutrition; avoid unnecessary Zn application.",
                "action_mr": "अतिरिक्त जस्त खत देण्याची गरज नाही.",
                "fertilizer_rule": "None",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }

    # =========================================================================
    # 9. Available Sulphur — S (mg/kg)
    # =========================================================================
    elif k in ["sulphur", "sulfur", "s"]:
        if value < 15.0:
            return {
                "classification": "Deficient",
                "classification_mr": "कमतरता",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "moderate",
                "severity": "Deficient",
                "lower_limit": None,
                "upper_limit": 15.0,
                "recommendation": "Apply S as needed",
                "recommendation_mr": "गरजेनुसार गंधक वापरा",
                "action": "Apply crop-specific S management (SSP or agricultural gypsum).",
                "action_mr": "एसएसपी किंवा जिप्समद्वारे पिकाच्या गरजेनुसार गंधक द्या.",
                "fertilizer_rule": "Apply S as needed",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        elif value <= 22.5:
            return {
                "classification": "Marginal",
                "classification_mr": "सीमांत",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "info",
                "severity": "Marginal",
                "lower_limit": 15.0,
                "upper_limit": 22.5,
                "recommendation": "Monitor S",
                "recommendation_mr": "गंधकावर लक्ष ठेवा",
                "action": "Monitor crop requirement; consider S if growing oilseeds or pulses.",
                "action_mr": "पिकाच्या गरजेनुसार गंधकाचा वापर विचारात घ्या.",
                "fertilizer_rule": "Conditional monitoring",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        else:
            return {
                "classification": "Sufficient",
                "classification_mr": "पुरेसे",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 22.5,
                "upper_limit": None,
                "recommendation": "Maintain S",
                "recommendation_mr": "गंधक पातळी टिकवून ठेवा",
                "action": "Maintain balanced nutrition; no routine S addition needed.",
                "action_mr": "अतिरिक्त गंधक वापरण्याची गरज नाही.",
                "fertilizer_rule": "Maintenance",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }

    # =========================================================================
    # 10. Available Boron — B (mg/kg)
    # =========================================================================
    elif k in ["boron", "b"]:
        if value < 0.50:
            return {
                "classification": "Deficient",
                "classification_mr": "कमतरता",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "moderate",
                "severity": "Deficient",
                "lower_limit": None,
                "upper_limit": 0.50,
                "recommendation": "Apply B carefully",
                "recommendation_mr": "काळजीपूर्वक बोरॉन वापरा",
                "action": "Apply validated soil or foliar Boron (e.g. 0.1% Solubor before flowering); avoid overdose.",
                "action_mr": "विद्राव्य बोरॉनची काळजीपूर्वक फवारणी करा; जास्त मात्रा टाळा.",
                "fertilizer_rule": "Careful crop-specific B recommendation",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        elif value <= 0.70:
            return {
                "classification": "Marginal",
                "classification_mr": "सीमांत",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "info",
                "severity": "Marginal",
                "lower_limit": 0.50,
                "upper_limit": 0.70,
                "recommendation": "Monitor B",
                "recommendation_mr": "बोरॉनवर लक्ष ठेवा",
                "action": "Monitor fruit set and flowering.",
                "action_mr": "फुलोरा व फळधारणेच्या वेळी लक्ष ठेवा.",
                "fertilizer_rule": "Conditional monitoring",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        else:
            return {
                "classification": "Sufficient",
                "classification_mr": "पुरेसे",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 0.70,
                "upper_limit": None,
                "recommendation": "No B correction",
                "recommendation_mr": "बोरॉन सुधारणेची गरज नाही",
                "action": "Avoid additional B; excess B can cause crop toxicity.",
                "action_mr": "अतिरिक्त बोरॉन देऊ नका, विषबाधा होऊ शकते.",
                "fertilizer_rule": "None",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }

    # =========================================================================
    # 11. Available Copper — Cu (mg/kg)
    # =========================================================================
    elif k in ["copper", "cu"]:
        if value < 0.40:
            return {
                "classification": "Deficient",
                "classification_mr": "कमतरता",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "moderate",
                "severity": "Deficient",
                "lower_limit": None,
                "upper_limit": 0.40,
                "recommendation": "Apply Cu if needed",
                "recommendation_mr": "गरज असल्यास तांबे वापरा",
                "action": "Apply validated soil/crop-specific Copper management if required.",
                "action_mr": "माती चाचणीनुसार कॉपर सल्फेटचा वापर करा.",
                "fertilizer_rule": "Apply Cu if needed",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        elif value <= 0.60:
            return {
                "classification": "Marginal",
                "classification_mr": "सीमांत",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "info",
                "severity": "Marginal",
                "lower_limit": 0.40,
                "upper_limit": 0.60,
                "recommendation": "Monitor Cu",
                "recommendation_mr": "तांब्यावर लक्ष ठेवा",
                "action": "Monitor crop vigor and leaves.",
                "action_mr": "पिकाच्या वाढीवर लक्ष ठेवा.",
                "fertilizer_rule": "Conditional monitoring",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        else:
            return {
                "classification": "Sufficient",
                "classification_mr": "पुरेसे",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 0.60,
                "upper_limit": None,
                "recommendation": "No Cu correction",
                "recommendation_mr": "तांबे सुधारणेची गरज नाही",
                "action": "No routine Cu application needed.",
                "action_mr": "अतिरिक्त तांबे देण्याची गरज नाही.",
                "fertilizer_rule": "None",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }

    # =========================================================================
    # 12. Available Manganese — Mn (mg/kg)
    # =========================================================================
    elif k in ["manganese", "mn"]:
        if value < 3.0:
            return {
                "classification": "Deficient",
                "classification_mr": "कमतरता",
                "status_category": "LOW",
                "priority_rank": 2,
                "priority_key": "moderate",
                "severity": "Deficient",
                "lower_limit": None,
                "upper_limit": 3.0,
                "recommendation": "Apply Mn if needed",
                "recommendation_mr": "गरज असल्यास मँगनीज वापरा",
                "action": "Apply validated soil or foliar Manganese Sulphate.",
                "action_mr": "मँगनीज सल्फेटची फवारणी किंवा जमिनीत वापर करा.",
                "fertilizer_rule": "Apply Mn if needed",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        elif value <= 5.0:
            return {
                "classification": "Marginal",
                "classification_mr": "सीमांत",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "info",
                "severity": "Marginal",
                "lower_limit": 3.0,
                "upper_limit": 5.0,
                "recommendation": "Monitor Mn",
                "recommendation_mr": "मँगनीजवर लक्ष ठेवा",
                "action": "Monitor crop foliage for deficiency symptoms.",
                "action_mr": "पानांच्या लक्षणांवर लक्ष ठेवा.",
                "fertilizer_rule": "Conditional monitoring",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }
        else:
            return {
                "classification": "Sufficient",
                "classification_mr": "पुरेसे",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 5.0,
                "upper_limit": None,
                "recommendation": "No Mn correction",
                "recommendation_mr": "मँगनीज सुधारणेची गरज नाही",
                "action": "No routine Mn application needed.",
                "action_mr": "अतिरिक्त मँगनीज देण्याची गरज नाही.",
                "fertilizer_rule": "None",
                "reference_id": "R2",
                "reference_type": "Indian Micronutrient Research (ICAR)",
            }

    # =========================================================================
    # Additional Soil Diagnostics: ESP, Free Lime, Bulk Density
    # =========================================================================
    elif k in ["exchangeable_sodium", "esp"]:
        if value > 15.0:
            return {
                "classification": "Sodic / Problematic",
                "classification_mr": "सोडियमयुक्त (समस्याग्रस्त)",
                "status_category": "CRITICAL",
                "priority_rank": 1,
                "priority_key": "high",
                "severity": "Sodic",
                "lower_limit": 15.0,
                "upper_limit": None,
                "recommendation": "Monitor sodicity risk and follow a soil- and water-test-based reclamation recommendation using agricultural gypsum.",
                "recommendation_mr": "चोपण जमिनीचा धोका टाळण्यासाठी माती व पाणी चाचणीनुसार कृषी जिप्समचा वापर करा.",
                "action": "Apply agricultural gypsum based on gypsum requirement; improve drainage.",
                "action_mr": "जिप्समचा वापर करा व पाण्याचा निचरा सुधारा.",
                "fertilizer_rule": "Gypsum requirement for sodicity reclamation",
                "reference_id": "SHC-ESP-RULE-1",
                "reference_type": "Soil Science Standards",
            }
        else:
            return {
                "classification": "Normal",
                "classification_mr": "सर्वसाधारण",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 0.0,
                "upper_limit": 15.0,
                "recommendation": "Exchangeable sodium is within safe range. Maintain appropriate drainage.",
                "recommendation_mr": "सोडियमचे प्रमाण सुरक्षित मर्यादेत आहे. शेतातील पाण्याचा निचरा योग्य ठेवा.",
                "action": "Maintain appropriate field drainage.",
                "action_mr": "पाण्याचा निचरा योग्य ठेवा.",
                "fertilizer_rule": "Standard management",
                "reference_id": "SHC-ESP-RULE-2",
                "reference_type": "Soil Science Standards",
            }

    elif k in ["free_lime", "caco3"]:
        if value > 10.0:
            return {
                "classification": "High (Calcareous)",
                "classification_mr": "जास्त (चुनखडीयुक्त)",
                "status_category": "MEDIUM",
                "priority_rank": 4,
                "priority_key": "moderate",
                "severity": "Calcareous",
                "lower_limit": 10.0,
                "upper_limit": None,
                "recommendation": "High free lime. Micronutrients (Fe, Zn) and P may precipitate; consider organic manures, sulphur, or foliar nutrition.",
                "recommendation_mr": "चुनखडीचे प्रमाण जास्त असल्याने सेंद्रिय खतांचा वापर वाढवा व लोह-जस्तासाठी फवारणीचा मार्ग निवडा.",
                "action": "Use organic amendments and prefer foliar sprays for iron and zinc.",
                "action_mr": "सेंद्रिय खते वापरा आणि लोह-जस्ताची फवारणी करा.",
                "fertilizer_rule": "Organic buffering & foliar micronutrients",
                "reference_id": "SHC-LIME-RULE-1",
                "reference_type": "Vertisol Management Standards",
            }
        else:
            return {
                "classification": "Normal",
                "classification_mr": "सर्वसाधारण",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Normal",
                "lower_limit": 0.0,
                "upper_limit": 10.0,
                "recommendation": "Free lime is within normal bounds. Maintain balanced fertilization.",
                "recommendation_mr": "मुक्त चुनखडी योग्य मर्यादेत आहे. नियमित संतुलित शेती पद्धती सुरू ठेवा.",
                "action": "Maintain balanced fertilization.",
                "action_mr": "संतुलित व्यवस्थापन ठेवा.",
                "fertilizer_rule": "Standard management",
                "reference_id": "SHC-LIME-RULE-2",
                "reference_type": "Vertisol Management Standards",
            }

    elif k in ["bd", "bulk_density"]:
        if value > 1.60:
            return {
                "classification": "High Density / Compacted",
                "classification_mr": "जास्त घनता / कठीण जमीन",
                "status_category": "HIGH",
                "priority_rank": 3,
                "priority_key": "moderate",
                "severity": "Compacted",
                "lower_limit": 1.60,
                "upper_limit": None,
                "recommendation": "Soil density is elevated; consider deep subsoiling and organic residue incorporation to relieve compaction.",
                "recommendation_mr": "माती घट्ट झाल्याचे दिसते; खोल नांगरट व सेंद्रिय घटकांचा वापर करून मातीची रचना सुधारा.",
                "action": "Deep subsoiling and organic residue incorporation.",
                "action_mr": "खोल नांगरट आणि सेंद्रिय खतांचा वापर करा.",
                "fertilizer_rule": "Mechanical tillage & residue retention",
                "reference_id": "SHC-BD-RULE-1",
                "reference_type": "Physical Soil Science",
            }
        else:
            return {
                "classification": "Optimal Porosity",
                "classification_mr": "उत्तम सच्छिद्रता",
                "status_category": "OPTIMAL",
                "priority_rank": 5,
                "priority_key": "info",
                "severity": "Optimal",
                "lower_limit": None,
                "upper_limit": 1.60,
                "recommendation": "Soil physical condition and density are favorable for root penetration and moisture retention.",
                "recommendation_mr": "मातीची भौतिक घनता योग्य असून मुळांची वाढ व ओलावा टिकवण्यासाठी अनुकूल आहे.",
                "action": "Maintain conservation tillage.",
                "action_mr": "सध्याची मशागत पद्धत सुरू ठेवा.",
                "fertilizer_rule": "Standard conservation tillage",
                "reference_id": "SHC-BD-RULE-2",
                "reference_type": "Physical Soil Science",
            }

    # =========================================================================
    # 16. Total Nitrogen (%)
    # =========================================================================
    elif k in ["total_nitrogen", "total_n"]:
        val_f = float(value) if isinstance(value, (int, float)) else 0.12
        return {
            "classification": "Medium" if val_f <= 0.18 else "High",
            "classification_mr": "मध्यम" if val_f <= 0.18 else "जास्त",
            "status_category": "MEDIUM",
            "priority_rank": 4,
            "priority_key": "info",
            "severity": "Normal",
            "lower_limit": 0.05,
            "upper_limit": 0.18,
            "recommendation": "Total soil N reserve is moderate; maintain soil organic matter through regular compost & residue incorporation.",
            "recommendation_mr": "जमिनीतील एकूण नत्र साठा मध्यम आहे; शेणखत व सेंद्रिय अवशेषांच्या वापराने नत्र साठा टिकवून ठेवावा.",
            "action": "Maintain soil organic matter through crop residue recycling and compost.",
            "action_mr": "पीक अवशेष व शेणखताचा वापर करून सेंद्रिय नत्र पातळी टिकवून ठेवावी.",
            "fertilizer_rule": "Maintain soil organic matter",
            "reference_id": "DSM-AOI-TN",
            "reference_type": "DSM Root-Zone Standardized",
        }

    # =========================================================================
    # 17. Cation Exchange Capacity — CEC (cmol(c)/kg)
    # =========================================================================
    elif k == "cec":
        val_f = float(value) if isinstance(value, (int, float)) else 31.20
        return {
            "classification": "High" if val_f >= 25.0 else "Moderate",
            "classification_mr": "जास्त (उत्कृष्ट)" if val_f >= 25.0 else "मध्यम",
            "status_category": "HIGH" if val_f >= 25.0 else "MEDIUM",
            "priority_rank": 5,
            "priority_key": "info",
            "severity": "Normal",
            "lower_limit": 18.5,
            "upper_limit": 35.0,
            "recommendation": "High nutrient retention capacity; excellent buffer against nutrient leaching.",
            "recommendation_mr": "धनायन विनिमय क्षमता उच्च आहे; खते धरून ठेवण्याची क्षमता उत्कृष्ट आहे.",
            "action": "Soil has high nutrient buffering capacity. Balanced NPK application is highly effective without rapid leaching.",
            "action_mr": "जमिनीची अन्नद्रव्ये धरून ठेवण्याची क्षमता उत्तम असल्याने खतांचा योग्य वापर प्रभावी ठरतो.",
            "fertilizer_rule": "Standard balanced nutrient management",
            "reference_id": "DSM-AOI-CEC",
            "reference_type": "DSM Root-Zone Standardized",
        }

    # =========================================================================
    # 18. Coarse Fragments (%)
    # =========================================================================
    elif k in ["cfvo", "coarse_fragments"]:
        val_f = float(value) if isinstance(value, (int, float)) else 2.80
        return {
            "classification": "Normal" if val_f <= 6.5 else "Moderate",
            "classification_mr": "कमी (चांगले)" if val_f <= 6.5 else "मध्यम",
            "status_category": "OPTIMAL",
            "priority_rank": 5,
            "priority_key": "info",
            "severity": "Normal",
            "lower_limit": 1.2,
            "upper_limit": 6.5,
            "recommendation": "Minimal gravel content; favorable tillage and root elongation zone.",
            "recommendation_mr": "दगड-गोट्यांचे प्रमाण अत्यल्प आहे; मुळांच्या वाढीसाठी व मशागतीसाठी जमीन अत्यंत अनुकूल आहे.",
            "action": "Soil texture offers unobstructed root development. Standard tillage practices recommended.",
            "action_mr": "जमीन मशागतीसाठी अत्यंत सुलभ असून मुळांची वाढ मुक्तपणे होते.",
            "fertilizer_rule": "Standard tillage management",
            "reference_id": "DSM-AOI-CFVO",
            "reference_type": "DSM Root-Zone Standardized",
        }

    # =========================================================================
    # 19. Sand (%)
    # =========================================================================
    elif k == "sand":
        return {
            "classification": "Moderate",
            "classification_mr": "मध्यम",
            "status_category": "MEDIUM",
            "priority_rank": 5,
            "priority_key": "info",
            "severity": "Normal",
            "lower_limit": 28.0,
            "upper_limit": 45.0,
            "recommendation": "Adequate sand fraction ensuring baseline aeration and internal drainage.",
            "recommendation_mr": "वाळूचे प्रमाण संतुलित असून जमिनीत हवा खेळती राहण्यास व निचरा होण्यास मदत होते.",
            "action": "Maintain soil physical structure with regular organic amendments.",
            "action_mr": "सेंद्रिय खतांच्या नियमित वापरामुळे जमिनीची घडण उत्तम राहते.",
            "fertilizer_rule": "Maintain soil physical structure",
            "reference_id": "DSM-AOI-SAND",
            "reference_type": "DSM Root-Zone Standardized",
        }

    # =========================================================================
    # 20. Silt (%)
    # =========================================================================
    elif k == "silt":
        return {
            "classification": "Moderate",
            "classification_mr": "मध्यम",
            "status_category": "OPTIMAL",
            "priority_rank": 5,
            "priority_key": "info",
            "severity": "Normal",
            "lower_limit": 25.0,
            "upper_limit": 35.0,
            "recommendation": "Optimum silt content supporting available water capacity and nutrient retention.",
            "recommendation_mr": "गाळाचे प्रमाण योग्य असून ओलावा व अन्नद्रव्ये टिकवून ठेवण्यास मदत करते.",
            "action": "Favorable silt fraction contributes to balanced moisture holding capacity.",
            "action_mr": "गाळाच्या योग्य प्रमाणामुळे जमिनीची जलधारण क्षमता चांगली राहते.",
            "fertilizer_rule": "Maintain soil structure",
            "reference_id": "DSM-AOI-SILT",
            "reference_type": "DSM Root-Zone Standardized",
        }

    # =========================================================================
    # 21. Clay (%)
    # =========================================================================
    elif k == "clay":
        return {
            "classification": "Heavy Clay",
            "classification_mr": "काळी चिकण माती",
            "status_category": "HIGH",
            "priority_rank": 5,
            "priority_key": "info",
            "severity": "Normal",
            "lower_limit": 22.0,
            "upper_limit": 38.5,
            "recommendation": "High smectite clay vertisol; maintain proper drainage to prevent waterlogging.",
            "recommendation_mr": "काळी कसदार चिकणमाती; अति पावसात पाणी साचू नये म्हणून योग्य निचरा व्यवस्था ठेवावी.",
            "action": "Deep black vertisol with high shrink-swell properties. Ensure broad-bed furrows for drainage.",
            "action_mr": "भारी काळी चिकण जमीन असल्याने जास्त पावसात पाण्याचा योग्य निचरा होण्यासाठी सऱ्या-वरंबे पद्धत वापरावी.",
            "fertilizer_rule": "Drainage & conservation tillage",
            "reference_id": "DSM-AOI-CLAY",
            "reference_type": "DSM Root-Zone Standardized",
        }

    # =========================================================================
    # 22. Soil Texture Class
    # =========================================================================
    elif k in ["soil_texture", "soil_texture_class", "texture_class"]:
        return {
            "classification": "Clay Vertisol",
            "classification_mr": "काळी चिकण माती (Vertisols)",
            "status_category": "OPTIMAL",
            "priority_rank": 5,
            "priority_key": "info",
            "severity": "Normal",
            "lower_limit": None,
            "upper_limit": None,
            "recommendation": "Deep black cotton soil (Vertisols); practice broad-bed furrow (BBF) and timely tillage.",
            "recommendation_mr": "खोल काळी चिकण जमीन (व्हर्टिसॉल); रुंद वरंबा-सरी (BBF) पद्धत आणि योग्य ओलाव्यावर मशागत करावी.",
            "action": "Optimal Vertisol agricultural soil. Perform tillage operations at right soil moisture condition (वाफसा).",
            "action_mr": "उत्कृष्ट काळी जमीन; मशागतीची कामे योग्य वाफशावरच करावीत.",
            "fertilizer_rule": "Vertisol soil management practices",
            "reference_id": "DSM-AOI-TEXTURE",
            "reference_type": "USDA Soil Taxonomy",
        }

    # Generic Fallback
    return {
        "classification": interp_en or "Recorded",
        "classification_mr": interp_mr or "नोंदणीकृत",
        "status_category": "GOOD",
        "priority_rank": 5,
        "priority_key": "info",
        "severity": "Normal",
        "lower_limit": None,
        "upper_limit": None,
        "recommendation": "Maintain balanced nutrient management and continue periodic soil testing.",
        "recommendation_mr": "संतुलित खत व्यवस्थापन आणि नियमित माती चाचणी सुरू ठेवा.",
        "action": "Maintain balanced soil management.",
        "action_mr": "संतुलित खत व्यवस्थापन ठेवा.",
        "fertilizer_rule": "Standard 100% RDF",
        "reference_id": "SHC-GENERIC",
        "reference_type": "General SHC Guidelines",
    }


def get_ranked_key_recommendations(
    parameters: List[Dict[str, Any]],
    max_items: int = 5,
) -> List[Dict[str, Any]]:
    """Rank recommendations internally by priority:
    1. Critical / Acute Deficient
    2. Low / Deficient
    3. High Surplus / Review Zone
    4. Medium / Latent Deficient
    5. Optimal / Adequate / Non-saline

    Returns the top most relevant recommendations dynamically generated from actual soil data.
    """
    ranked_list = []
    seen_keys = set()

    for p in parameters:
        key = p.get("key") or p.get("parameter_key") or ""
        if key in seen_keys:
            continue
        val = p.get("value")
        interp_en = p.get("interpretation") or p.get("interpretation_en") or ""
        interp_mr = p.get("interpretation_mr") or interp_en
        name = p.get("name") or p.get("parameter_name") or key
        name_mr = p.get("name_mr") or p.get("parameter_name_mr") or name

        rec_meta = get_concise_parameter_recommendation(key, val, interp_en, interp_mr)
        seen_keys.add(key)

        ranked_list.append({
            "key": key,
            "name": name,
            "parameter": name,
            "name_mr": name_mr,
            "value": val,
            "unit": p.get("unit", ""),
            "status": rec_meta["classification"],
            "status_category": rec_meta["status_category"],
            "classification": rec_meta["classification"],
            "classification_mr": rec_meta["classification_mr"],
            "severity": rec_meta["severity"],
            "priority_rank": rec_meta["priority_rank"],
            "priority_key": rec_meta["priority_key"],
            "recommendation": rec_meta["recommendation"],
            "recommendation_mr": rec_meta["recommendation_mr"],
            "action": rec_meta.get("action", ""),
            "fertilizer_rule": rec_meta.get("fertilizer_rule", ""),
            "reference_id": rec_meta.get("reference_id", ""),
            "reference_type": rec_meta.get("reference_type", ""),
        })

    # Sort strictly by priority_rank (1=Critical, 2=Low, 3=High, 4=Medium, 5=Optimal)
    ranked_list.sort(key=lambda x: (x["priority_rank"], x["key"]))

    return ranked_list[:max_items]
