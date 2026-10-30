"""Centralized Soil Nutrient Interpretation Rules & Thresholds.
SoilPilot Phase 7 & 8 - Based on Soil Health Card (SHC) & Indian Research (242,827 samples across 615 districts).
"""
from typing import Dict, Any, Tuple

# Scientific classification thresholds for agricultural soils (Vertisols/Deccan Black Soils)
SOIL_THRESHOLDS: Dict[str, Dict[str, Any]] = {
    "ph": {
        "unit": "—",
        "name": "Soil pH",
        "name_mr": "सामू (pH)",
        "interpret": lambda v: (
            ("Acidic", "आम्लधर्मी") if v < 6.5 else
            ("Suitable", "योग्य (उदासीन)") if v <= 7.5 else
            ("Alkaline", "विम्लधर्मी")
        ),
        "reference_range": "< 6.5 (Acidic)\n6.5 – 7.5 (Neutral)\n> 7.5 (Alkaline)",
        "reference_range_mr": "< ६.५ (आम्लधर्मी)\n६.५ – ७.५ (उदासीन)\n> ७.५ (विम्लधर्मी)",
    },
    "ec": {
        "unit": "dS/m",
        "name": "Electrical Conductivity (EC)",
        "name_mr": "विद्युत वाहकता (EC)",
        "interpret": lambda v: (
            ("Non-saline", "अक्षारयुक्त (सामान्य)") if v < 0.8 else
            ("Critical", "चिंताजनक") if v <= 1.6 else
            ("Saline", "क्षारयुक्त")
        ),
        "reference_range": "< 0.8 dS/m (Normal)\n0.8 – 1.6 (Critical)\n> 1.6 (Saline)",
        "reference_range_mr": "< ०.८ dS/m (सामान्य)\n०.८ – १.६ (चिंताजनक)\n> १.६ (क्षारयुक्त)",
    },
    "organic_carbon": {
        "unit": "%",
        "name": "Organic Carbon",
        "name_mr": "सेंद्रिय कर्ब",
        "interpret": lambda v: (
            ("Low", "कमी") if v < 0.50 else
            ("Medium", "मध्यम") if v <= 0.75 else
            ("High", "जास्त")
        ),
        "reference_range": "< 0.50% (Low)\n0.50 – 0.75% (Medium)\n> 0.75% (High)",
        "reference_range_mr": "< ०.५०% (कमी)\n०.५० – ०.७५% (मध्यम)\n> ०.७५% (जास्त)",
    },
    "total_nitrogen": {
        "unit": "%",
        "name": "Total Nitrogen (N)",
        "name_mr": "एकूण नत्र (N)",
        "interpret": lambda v: (
            ("Poor / Low", "कमी") if v < 0.12 else
            ("Medium", "मध्यम") if v <= 0.25 else
            ("High", "जास्त")
        ),
        "reference_range": "< 0.12% (Low)\n0.12 – 0.25% (Medium)\n> 0.25% (High)",
        "reference_range_mr": "< ०.१२% (कमी)\n०.१२ – ०.२५% (मध्यम)\n> ०.२५% (जास्त)",
    },
    "available_nitrogen": {
        "unit": "kg/ha",
        "name": "Available Nitrogen",
        "name_mr": "उपलब्ध नत्र (N)",
        "interpret": lambda v: (
            ("Low", "कमी") if v < 280 else
            ("Medium", "मध्यम") if v <= 560 else
            ("High", "जास्त")
        ),
        "reference_range": "< 280 (Low)\n280 – 560 (Medium)\n> 560 (High)",
        "reference_range_mr": "< २८० (कमी)\n२८० – ५६० (मध्यम)\n> ५६० (जास्त)",
    },
    "available_phosphorus": {
        "unit": "kg/ha",
        "name": "Available Phosphorus",
        "name_mr": "उपलब्ध स्फुरद (P)",
        "interpret": lambda v: (
            ("Low", "कमी") if v < 10.0 else
            ("Medium", "मध्यम") if v <= 25.0 else
            ("High", "जास्त")
        ),
        "reference_range": "< 10 (Low)\n10 – 25 (Medium)\n> 25 (High)",
        "reference_range_mr": "< १० (कमी)\n१० – २५ (मध्यम)\n> २५ (जास्त)",
    },
    "available_potassium": {
        "unit": "kg/ha",
        "name": "Available Potassium",
        "name_mr": "उपलब्ध पालाश (K)",
        "interpret": lambda v: (
            ("Low", "कमी") if v < 120.0 else
            ("Medium", "मध्यम") if v <= 280.0 else
            ("High", "जास्त")
        ),
        "reference_range": "< 120 (Low)\n120 – 280 (Medium)\n> 280 (High)",
        "reference_range_mr": "< १२० (कमी)\n१२० – २८० (मध्यम)\n> २८० (जास्त)",
    },
    "cec": {
        "unit": "cmol(c)/kg",
        "name": "Cation Exchange Capacity (CEC)",
        "name_mr": "धनायन विनिमय क्षमता (CEC)",
        "interpret": lambda v: (
            ("Low", "कमी") if v < 15.0 else
            ("Medium", "मध्यम") if v <= 25.0 else
            ("High Nutrient Buffer (Fertile)", "सुपीक (उत्कृष्ट)")
        ),
        "reference_range": "< 15.0 (Low)\n15.0 – 25.0 (Medium)\n> 25.0 (Fertile)",
        "reference_range_mr": "< १५.० (कमी)\n१५.० – २५.० (मध्यम)\n> २५.० (सुपीक)",
    },
    "clay": {
        "unit": "%",
        "name": "Clay Proportion",
        "name_mr": "चिकणमाती",
        "interpret": lambda v: (
            ("Medium", "मध्यम") if v < 35.0 else
            ("Optimal Vertisol Clay", "इष्टतम चिकणमाती") if v <= 45.0 else
            ("Heavy Clay", "काळी चिकण माती")
        ),
        "reference_range": "< 35.0% (Medium)\n35.0 – 45.0% (Optimal)\n> 45.0% (Heavy Clay)",
        "reference_range_mr": "< ३५.०% (मध्यम)\n३५.० – ४५.०% (इष्टतम)\n> ४५.०% (काळी चिकण माती)",
    },
    "sand": {
        "unit": "%",
        "name": "Sand Proportion",
        "name_mr": "वाळू / रेती",
        "interpret": lambda v: (
            ("Low", "कमी") if v < 20.0 else
            ("Normal / Balanced", "सामान्य / संतुलित") if v <= 35.0 else
            ("High", "जास्त")
        ),
        "reference_range": "< 20.0% (Low)\n20.0 – 35.0% (Normal)\n> 35.0% (High)",
        "reference_range_mr": "< २०.०% (कमी)\n२०.० – ३५.०% (सामान्य)\n> ३५.०% (जास्त)",
    },
    "silt": {
        "unit": "%",
        "name": "Silt Proportion",
        "name_mr": "गाळाचे प्रमाण",
        "interpret": lambda v: (
            ("Low", "कमी") if v < 20.0 else
            ("Optimal Silt", "इष्टतम गाळ") if v <= 30.0 else
            ("High", "जास्त")
        ),
        "reference_range": "< 20.0% (Low)\n20.0 – 30.0% (Optimal)\n> 30.0% (High)",
        "reference_range_mr": "< २०.०% (कमी)\n२०.० – ३०.०% (इष्टतम)\n> ३०.०% (जास्त)",
    },
    "cfvo": {
        "unit": "%",
        "name": "Coarse Fragments (> 2mm)",
        "name_mr": "दगड-गोटे प्रमाण",
        "interpret": lambda v: (
            ("Low", "कमी") if v < 10.0 else
            ("Moderate Coarse Rock", "मध्यम खडेयुक्त") if v <= 15.0 else
            ("High", "जास्त")
        ),
        "reference_range": "< 10.0% (Low)\n10.0 – 15.0% (Moderate)\n> 15.0% (High)",
        "reference_range_mr": "< १०.०% (कमी)\n१०.० – १५.०% (मध्यम)\n> १५.०% (जास्त)",
    },
    "bd": {
        "unit": "g/cm³",
        "name": "Bulk Density",
        "name_mr": "मातीची घनता (BD)",
        "interpret": lambda v: (
            ("Optimal", "इष्टतम") if v < 1.40 else
            ("Moderate Density", "मध्यम घनता") if v <= 1.60 else
            ("Compacted", "कठीण जमीन")
        ),
        "reference_range": "< 1.40 (Optimal)\n1.40 – 1.60 (Moderate)\n> 1.60 (Compacted)",
        "reference_range_mr": "< १.४० (इष्टतम)\n१.४० – १.६० (मध्यम)\n> १.६० (कठीण जमीन)",
    },
    "exchangeable_sodium": {
        "unit": "%",
        "name": "Exchangeable Sodium Percentage",
        "name_mr": "विनिमययोग्य सोडियम (ESP)",
        "interpret": lambda v: (
            ("Normal", "सामान्य") if v <= 15.0 else
            ("Problematic", "समस्याग्रस्त")
        ),
        "reference_range": "< 15.0% (Normal)\n> 15.0% (Problematic)",
        "reference_range_mr": "< १५.०% (सामान्य)\n> १५.०% (समस्याग्रस्त)",
    },
    "free_lime": {
        "unit": "%",
        "name": "Free Lime (CaCO3)",
        "name_mr": "मुक्त चुनखडी (CaCO3)",
        "interpret": lambda v: (
            ("Normal", "सामान्य") if v < 5.0 else
            ("Medium", "मध्यम") if v <= 10.0 else
            ("High", "जास्त")
        ),
        "reference_range": "< 5.0% (Normal)\n5.0 – 10.0% (Medium)\n> 10.0% (High)",
        "reference_range_mr": "< ५.०% (सामान्य)\n५.० – १०.०% (मध्यम)\n> १०.०% (जास्त)",
    },
    "iron": {
        "unit": "ppm",
        "name": "Available Iron (Fe)",
        "name_mr": "उपलब्ध लोह (Fe)",
        "interpret": lambda v: (
            ("Deficient", "कमतरता") if v < 4.5 else
            ("Sufficient", "पुरेसे")
        ),
        "reference_range": "< 4.5 (Deficient)\n> 4.5 (Sufficient)",
        "reference_range_mr": "< ४.५ (कमतरता)\n> ४.५ (पुरेसे)",
    },
    "manganese": {
        "unit": "ppm",
        "name": "Available Manganese (Mn)",
        "name_mr": "उपलब्ध मँगनीज (Mn)",
        "interpret": lambda v: (
            ("Deficient", "कमतरता") if v < 3.0 else
            ("Sufficient", "पुरेसे")
        ),
        "reference_range": "< 3.0 (Deficient)\n> 3.0 (Sufficient)",
        "reference_range_mr": "< ३.० (कमतरता)\n> ३.० (पुरेसे)",
    },
    "zinc": {
        "unit": "ppm",
        "name": "Available Zinc (Zn)",
        "name_mr": "उपलब्ध जस्त (Zn)",
        "interpret": lambda v: (
            ("Deficient", "कमतरता") if v < 0.6 else
            ("Sufficient", "पुरेसे")
        ),
        "reference_range": "< 0.6 (Deficient)\n> 0.6 (Sufficient)",
        "reference_range_mr": "< ०.६ (कमतरता)\n> ०.६ (पुरेसे)",
    },
    "copper": {
        "unit": "ppm",
        "name": "Available Copper (Cu)",
        "name_mr": "उपलब्ध तांबे (Cu)",
        "interpret": lambda v: (
            ("Deficient", "कमतरता") if v < 0.4 else
            ("Sufficient", "पुरेसे")
        ),
        "reference_range": "< 0.4 (Deficient)\n> 0.4 (Sufficient)",
        "reference_range_mr": "< ०.४ (कमतरता)\n> ०.४ (पुरेसे)",
    },
    "sulphur": {
        "unit": "ppm",
        "name": "Available Sulphur (S)",
        "name_mr": "उपलब्ध गंधक (S)",
        "interpret": lambda v: (
            ("Deficient", "कमतरता") if v < 15.0 else
            ("Sufficient", "पुरेसे")
        ),
        "reference_range": "< 15.0 (Deficient)\n> 15.0 (Sufficient)",
        "reference_range_mr": "< १५.० (कमतरता)\n> १५.० (पुरेसे)",
    },
    "boron": {
        "unit": "ppm",
        "name": "Available Boron (B)",
        "name_mr": "उपलब्ध बोरॉन (B)",
        "interpret": lambda v: (
            ("Deficient", "कमतरता") if v < 0.50 else
            ("Sufficient", "पुरेसे")
        ),
        "reference_range": "< 0.5 (Deficient)\n> 0.5 (Sufficient)",
        "reference_range_mr": "< ०.५ (कमतरता)\n> ०.५ (पुरेसे)",
    },
    "soil_texture": {
        "unit": "—",
        "name": "Soil Texture Class",
        "name_mr": "मातीचा पोत वर्ग",
        "interpret": lambda v: ("Clayey", "काळी चिकण माती (Vertisols)"),
        "reference_range": "USDA Class: Clay / Vertisols",
        "reference_range_mr": "USDA वर्ग: काळी चिकण माती",
    },
}

def interpret_parameter(key: str, value: Any) -> Tuple[str, str, str]:
    config = SOIL_THRESHOLDS.get(key)
    if not config:
        return ("Not Available", "उपलब्ध नाही", "N/A")
    if value is None:
        return ("Not Available", "उपलब्ध नाही", config.get("reference_range", "N/A"))
    if isinstance(value, str):
        en, mr = config["interpret"](1.0)
        return (en, mr, config["reference_range"])
    try:
        val_float = float(value)
        en, mr = config["interpret"](val_float)
        return (en, mr, config["reference_range"])
    except (ValueError, TypeError):
        return ("Normal", "सामान्य", config["reference_range"])
