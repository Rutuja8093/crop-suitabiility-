/**
 * SoilPilot — Marathi Localization & Translation Normalizer
 * Provides complete, robust Marathi translations for all soil parameters,
 * status categories, agronomic advice, geographic administrative names,
 * units, crops, and system labels.
 */

export const MARATHI_STATUS_MAP: Record<string, string> = {
  // pH classifications
  "strongly acidic": "तीव्र आम्लधर्मी",
  "acidic": "आम्लधर्मी",
  "acidic soil": "आम्लधर्मी माती",
  "slightly acidic": "किंचित आम्लयुक्त",
  "neutral": "उदासीन (योग्य सामू)",
  "optimal neutral": "उत्कृष्ट उदासीन (योग्य सामू)",
  "suitable": "योग्य (अनुकूल)",
  "alkaline": "विम्लधर्मी",
  "moderately alkaline": "मध्यम विम्लधर्मी (खारवट)",
  "moderate alkaline": "मध्यम विम्लधर्मी",
  "strongly alkaline": "तीव्र विम्लधर्मी (चोपण)",
  "highly alkaline": "अति विम्लधर्मी (चोपण)",

  // General Nutrient & Organic Carbon status
  "optimal": "उत्कृष्ट (आदर्श)",
  "good": "उत्कृष्ट / उत्तम",
  "sufficient": "पुरेसे / योग्य",
  "sufficient / high": "पुरेसे / भरपूर",
  "safe": "सुरक्षित",
  "normal": "सर्वसाधारण / सामान्य",
  "non-saline": "क्षारमुक्त",
  "slightly saline": "किंचित क्षारयुक्त",
  "moderately saline": "मध्यम क्षारयुक्त",
  "highly saline": "अति क्षारयुक्त",
  "sodic": "चोपण / सोडियमयुक्त",
  "sodic / problematic": "सोडियमयुक्त (समस्याग्रस्त)",
  "low": "कमी",
  "low / deficient": "कमी (कमतरता)",
  "deficient": "कमतरता",
  "deficient nitrogen": "कमी उपलब्ध नत्र",
  "moderate nitrogen": "मध्यम उपलब्ध नत्र",
  "medium": "मध्यम",
  "moderate": "मध्यम",
  "high": "जास्त",
  "very high": "अति जास्त",
  "high (calcareous)": "जास्त (चुनखडीयुक्त)",
  "critical": "गंभीर",
  "marginal": "सीमांत",

  // Canopy & Vegetation Indices (NDVI / EVI)
  "sparse / fallow": "विरळ पीक / पडिक जमीन",
  "moderate canopy": "मध्यम पीक आच्छादन",
  "healthy / dense canopy": "उत्कृष्ट / दाट पीक आच्छादन",
  "low biomass": "कमी बायोमास",
  "moderate biomass": "मध्यम बायोमास",
  "high biomass": "उत्तम बायोमास",

  // Bulk Density (BD) & Physical
  "ideal porosity": "आदर्श सच्छिद्रता",
  "optimal porosity": "उत्तम सच्छिद्रता",
  "moderate density": "मध्यम घनता",
  "compacted soil": "कठीण / चोपण जमीन",
  "high density / compacted": "जास्त घनता / कठीण जमीन",
  "low rock fragments (favorable)": "कमी दगड-गोटे (अनुकूल)",
  "moderate coarse fragments": "मध्यम दगड-गोटे",
  "high coarse rock content": "जास्त दगड-गोटे (खडकाळ)",
  "medium clay texture": "मध्यम चिकण पोत",
  "high clay vertisol (black soil)": "भारी काळी चिकण माती (Vertisol)",
  "optimal vertisol clay": "उत्तम काळी चिकण माती (Vertisol)",
  "heavy dense clay": "भारी जड चिकण माती",
  "standard sand fraction": "प्रमाणित वाळू प्रमाण",
  "fine / low sand fraction": "कमी वाळू (बारीक पोत)",
  "optimal loamy sand": "मध्यम वाळू पोयटा",
  "coarse sandy fraction": "जास्त वाळू निचरा",
  "standard silt fraction": "प्रमाणित गाळ प्रमाण",
  "light silt fraction": "हलका गाळ पोत",
  "medium silt fraction": "मध्यम गाळ पोत",
  "rich silt fraction": "उत्तम गाळ पोत",
  "class 1: clay vertisol (काळी माती)": "वर्ग १: काळी चिकण माती (Vertisol)",

  // Soil Chemical & Fertility
  "moderate cation exchange": "मध्यम धनायन विनिमय क्षमता",
  "high nutrient buffer": "उत्कृष्ट पोषक साठा (सुपीक)",
  "high nutrient buffer (fertile)": "उत्कृष्ट अन्नद्रव्य धारण क्षमता (सुपीक)",

  // Topography & Elevation
  "flat to gentle (0-3%)": "सपाट ते मंद उतार (०-३%)",
  "moderate slope (3-8%)": "मध्यम उतार (३-८%)",
  "steep slope (erosion risk)": "तीव्र उतार (धूप होण्याचा धोका)",
  "deccan plateau (~540-580m)": "दख्खनचे पठार (~५४०-५८० मी)",

  // Moisture, Water & Bare Soil Indices
  "moisture stressed (dry)": "कमी ओलावा / कोरडी जमीन",
  "moderate moisture": "मध्यम ओलावा",
  "high canopy moisture": "भरपूर ओलावा / सतेज पीक",
  "dense vegetation cover": "दाट वनस्पती / पीक आच्छादन",
  "partial soil exposure": "अंशतः उघडी जमीन",
  "bare exposed soil": "उघडी / नांगरलेली जमीन",
  "non-water / dry": "पाणी नसलेला भूभाग",
  "moist ground / saturated": "पाणथळ / दलदलयुक्त जमीन",
  "open surface water": "खुला जलसाठा / तलाव / विहीर",
  "true-color optical satellite image": "नैसर्गिक रंग उपग्रह प्रतिमा",

  // Prediction Uncertainty & Elevation
  "high confidence": "उच्च अचूकता",
  "moderate confidence": "मध्यम अचूकता",
  "elevated uncertainty": "वाढीव अनिश्चितता",
  "standard monitoring": "नियमित निरीक्षण",
  "deccan plateau": "दख्खनचे पठार",

  // Organic Matter & Carbon
  "low organic carbon": "कमी सेंद्रिय कर्ब",
  "low organic matter": "कमी सेंद्रिय कर्ब",
  "medium organic carbon": "मध्यम सेंद्रिय कर्ब",
  "high organic carbon": "उत्तम सेंद्रिय कर्ब",

  // Administrative & Report Status
  "recorded": "नोंदणीकृत",
  "available": "उपलब्ध",
  "not available": "उपलब्ध नाही",
  "pending": "प्रलंबित",
  "certified": "प्रमाणित",
  "soil data available": "माती माहिती उपलब्ध",
  "demo data": "नमुना माहिती / चाचणी डेटा",
};

export const MARATHI_PARAMETER_MAP: Record<string, string> = {
  // 1. Soil Properties (0–30 cm Root-Zone Standardized)
  "bdod": "मातीची घनता (०-३० सेमी)",
  "bulk density (0–30 cm)": "मातीची घनता (०-३० सेमी)",
  "cec": "धनायन विनिमय क्षमता - CEC (०-३० सेमी)",
  "cation exchange capacity - cec (0–30 cm)": "धनायन विनिमय क्षमता - CEC (०-३० सेमी)",
  "cfvo": "जाड दगड-गोटे प्रमाण (०-३० सेमी)",
  "coarse fragments volumetric fraction (0–30 cm)": "जाड दगड-गोटे प्रमाण (०-३० सेमी)",
  "clay": "मातीतील चिकण प्रमाण (०-३० सेमी)",
  "clay proportion (0–30 cm)": "मातीतील चिकण प्रमाण (०-३० सेमी)",
  "sand": "मातीतील वाळूचे प्रमाण (०-३० सेमी)",
  "sand proportion (0–30 cm)": "मातीतील वाळूचे प्रमाण (०-३० सेमी)",
  "silt": "मातीतील गाळाचे प्रमाण (०-३० सेमी)",
  "silt proportion (0–30 cm)": "मातीतील गाळाचे प्रमाण (०-३० सेमी)",
  "soc": "सेंद्रिय कर्ब - SOC (०-३० सेमी)",
  "soil organic carbon - soc (0–30 cm)": "सेंद्रिय कर्ब - SOC (०-३० सेमी)",
  "nitrogen": "एकूण नत्र (०-३० सेमी)",
  "total nitrogen (0–30 cm)": "एकूण नत्र (०-३० सेमी)",
  "ph": "जमिनीचा सामू (pH) (०-३० सेमी)",
  "soil ph (h2o) (0–30 cm)": "जमिनीचा सामू (pH) (०-३० सेमी)",
  "soil ph (h₂o) (0–30 cm)": "जमिनीचा सामू (pH) (०-३० सेमी)",
  "soil_texture": "USDA मातीचा पोत वर्ग (०-३० सेमी)",
  "usda soil texture classes (0–30 cm)": "USDA मातीचा पोत वर्ग (०-३० सेमी)",

  // 2. Topography & Elevation
  "elevation": "डिजिटल एलिव्हेशन मॉडेल (DEM)",
  "digital elevation model (dem)": "डिजिटल एलिव्हेशन मॉडेल (DEM)",
  "slope": "जमिनीचा उतार (Slope Gradient)",
  "slope gradient": "जमिनीचा उतार (Slope Gradient)",

  // 3. Land Use & Multi-Spectral Indices
  "lulc": "जमीन वापर व आच्छादन (Dynamic World)",
  "land use / land cover (dynamic world)": "जमीन वापर व आच्छादन (Dynamic World)",
  "kharif_rgb": "खरीप हंगाम नैसर्गिक रंग उपग्रह प्रतिमा",
  "kharif season true-color composite": "खरीप हंगाम नैसर्गिक रंग उपग्रह प्रतिमा",
  "rabi_rgb": "रब्बी हंगाम नैसर्गिक रंग उपग्रह प्रतिमा",
  "rabi season true-color composite": "रब्बी हंगाम नैसर्गिक रंग उपग्रह प्रतिमा",
  "ndvi": "वनस्पती निर्देशांक (NDVI)",
  "normalized difference vegetation index (ndvi)": "वनस्पती निर्देशांक (NDVI)",
  "evi": "वर्धित वनस्पती निर्देशांक (EVI)",
  "enhanced vegetation index (evi)": "वर्धित वनस्पती निर्देशांक (EVI)",
  "savi": "माती-समायोजित वनस्पती निर्देशांक (SAVI)",
  "soil-adjusted vegetation index (savi)": "माती-समायोजित वनस्पती निर्देशांक (SAVI)",
  "ndmi": "ओलावा निर्देशांक (NDMI)",
  "normalized difference moisture index (ndmi)": "ओलावा निर्देशांक (NDMI)",
  "ndre": "रेड एज वनस्पती निर्देशांक (NDRE)",
  "normalized difference red edge (ndre)": "रेड एज वनस्पती निर्देशांक (NDRE)",
  "bsi": "उघडी माती निर्देशांक (BSI)",
  "bare soil index (bsi)": "उघडी माती निर्देशांक (BSI)",
  "ndwi": "पाणी निर्देशांक (NDWI)",
  "normalized difference water index (ndwi)": "पाणी निर्देशांक (NDWI)",

  // Chemical & Lab defaults
  "soil ph": "मातीचा सामू (pH)",
  "soil_ph": "मातीचा सामू (pH)",
  "ec": "विद्युत वाहकता (EC)",
  "electrical conductivity": "विद्युत वाहकता (EC)",
  "electrical_conductivity": "विद्युत वाहकता (EC)",
  "organic_carbon": "सेंद्रिय कर्ब (OC)",
  "organic carbon": "सेंद्रिय कर्ब (OC)",
  "available_nitrogen": "उपलब्ध नत्र (N)",
  "available nitrogen": "उपलब्ध नत्र (N)",
  "available_phosphorus": "उपलब्ध स्फुरद (P)",
  "available phosphorus": "उपलब्ध स्फुरद (P)",
  "phosphorus": "उपलब्ध स्फुरद (P)",
  "available_potassium": "उपलब्ध पालाश (K)",
  "available potassium": "उपलब्ध पालाश (K)",
  "potassium": "उपलब्ध पालाश (K)",
  "exchangeable_sodium": "विनिमययोग्य सोडियम (ESP)",
  "exchangeable sodium percentage": "विनिमययोग्य सोडियम (ESP)",
  "esp": "विनिमययोग्य सोडियम (ESP)",
  "free_lime": "मुक्त चुनखडी (CaCO3)",
  "free lime": "मुक्त चुनखडी (CaCO3)",
  "free lime (caco3)": "मुक्त चुनखडी (CaCO3)",
  "iron": "उपलब्ध लोह (Fe)",
  "available iron": "उपलब्ध लोह (Fe)",
  "available iron (fe)": "उपलब्ध लोह (Fe)",
  "manganese": "उपलब्ध मँगनीज (Mn)",
  "available manganese": "उपलब्ध मँगनीज (Mn)",
  "available manganese (mn)": "उपलब्ध मँगनीज (Mn)",
  "zinc": "उपलब्ध जस्त (Zn)",
  "available zinc": "उपलब्ध जस्त (Zn)",
  "available zinc (zn)": "उपलब्ध जस्त (Zn)",
  "copper": "उपलब्ध तांबे (Cu)",
  "available copper": "उपलब्ध तांबे (Cu)",
  "available copper (cu)": "उपलब्ध तांबे (Cu)",
  "sulphur": "उपलब्ध गंधक (S)",
  "available sulphur": "उपलब्ध गंधक (S)",
  "available sulphur (s)": "उपलब्ध गंधक (S)",
  "boron": "उपलब्ध बोरॉन (B)",
  "available boron": "उपलब्ध बोरॉन (B)",
  "available boron (b)": "उपलब्ध बोरॉन (B)",
  "bd": "मातीची घनता (BD)",
  "bulk density": "मातीची घनता (BD)",
  "bulk_density": "मातीची घनता (BD)",
  "elevation (dem)": "जमिनीची उंची (DEM)",
  "uncertainty": "अनिश्चितता (Uncertainty)",
  "prediction uncertainty": "अनिश्चितता (Uncertainty)",
};

export const MARATHI_GEO_MAP: Record<string, string> = {
  "maharashtra": "महाराष्ट्र",
  "pune": "पुणे",
  "baramati": "बारामती",
  "malegaon kh": "माळेगाव खुर्द",
  "malegaon kh.": "माळेगाव खुर्द",
  "malegaon bk": "माळेगाव बुद्रुक",
  "malegaon bk.": "माळेगाव बुद्रुक",
  "malegaon": "माळेगाव",
  "haveli": "हवेली",
  "daund": "दौंड",
  "indapur": "इंदापूर",
  "shirur": "शिरूर",
  "purandar": "पुरंदर",
  "bhor": "भोर",
  "velha": "वेल्हे",
  "khed": "खेड",
  "junnar": "जुन्नर",
  "ambegaon": "आंबेगाव",
  "maval": "मावळ",
  "mulshi": "मुळशी",
  "pimpri-chinchwad": "पिंपरी-चिंचवड",
  "loni kalbhor": "लोणी काळभोर",
  "pune city": "पुणे शहर",
};

export const MARATHI_CROP_MAP: Record<string, string> = {
  "sugarcane": "ऊस",
  "sugarcane / cash crop": "ऊस / नगदी पीक",
  "sugarcane (ऊस)": "ऊस (नगदी पीक)",
  "wheat": "गहू",
  "soybean": "सोयाबीन",
  "gram": "हरभरा",
  "cotton": "कापूस",
  "onion": "कांदा",
  "cash crop": "नगदी पीक",
};

export const MARATHI_FARMER_MAP: Record<string, string> = {
  "farmer": "शेतकरी",
  "unassigned": "नोंदणीकृत शेतकरी",
  "suresh patil": "सुरेश पाटील",
  "dattatraya shinde": "दत्तात्रय शिंदे",
  "ramesh patil": "रमेश पाटील",
  "ramesh patil (रमेश पाटील)": "रमेश पाटील",
};

export const MARATHI_UNIT_MAP: Record<string, string> = {
  "hectare": "हेक्टर",
  "hectares": "हेक्टर",
  "ha": "हे.",
  "acre": "एकर",
  "acres": "एकर",
  "ac": "एकर",
  "kg/ha": "कि.ग्रॅ./हेक्टर",
  "ppm": "ppm",
  "ds/m": "dS/m",
  "%": "%",
  "g/cm³": "g/cm³",
};

/**
 * Translates any diagnostic or classification status into Marathi
 */
export function translateStatus(
  status: string | null | undefined,
  isMarathi: boolean = true
): string {
  if (!status) return isMarathi ? "उपलब्ध नाही" : "Not Available";
  if (!isMarathi) return status;

  // If already contains Devanagari characters, return as-is
  if (/[\u0900-\u097F]/.test(status)) {
    return status;
  }

  const normalized = status.trim().toLowerCase();
  if (MARATHI_STATUS_MAP[normalized]) {
    return MARATHI_STATUS_MAP[normalized];
  }

  // Substring checks
  if (normalized.includes("very high")) return "अति जास्त";
  if (normalized.includes("strongly alkaline") || normalized.includes("highly alkaline")) return "तीव्र विम्लधर्मी";
  if (normalized.includes("moderate alkaline") || normalized.includes("moderately alkaline")) return "मध्यम विम्लधर्मी";
  if (normalized.includes("alkaline")) return "विम्लधर्मी";
  if (normalized.includes("strongly acidic")) return "तीव्र आम्लधर्मी";
  if (normalized.includes("acidic")) return "आम्लधर्मी";
  if (normalized.includes("neutral") || normalized.includes("optimal")) return "उत्कृष्ट उदासीन";
  if (normalized.includes("good") || normalized.includes("safe") || normalized.includes("normal")) return "सुरक्षित";
  if (normalized.includes("low") || normalized.includes("deficient")) return "कमी";
  if (normalized.includes("medium") || normalized.includes("moderate")) return "मध्यम";
  if (normalized.includes("high")) return "जास्त";
  if (normalized.includes("critical")) return "गंभीर";
  if (normalized.includes("saline")) return "क्षारयुक्त";
  if (normalized.includes("pending")) return "प्रलंबित";
  if (normalized.includes("available")) return "उपलब्ध";

  return status;
}

/**
 * Translates parameter names into Marathi
 */
export function translateParamName(
  paramNameOrKey: string | null | undefined,
  isMarathi: boolean = true
): string {
  if (!paramNameOrKey) return "";
  if (!isMarathi) return paramNameOrKey;

  if (/[\u0900-\u097F]/.test(paramNameOrKey)) {
    return paramNameOrKey;
  }

  const normalized = paramNameOrKey.trim().toLowerCase();
  if (MARATHI_PARAMETER_MAP[normalized]) {
    return MARATHI_PARAMETER_MAP[normalized];
  }

  return paramNameOrKey;
}

/**
 * Translates administrative geographic names (State, District, Taluka, Village) into Marathi
 */
export function translateGeoName(
  geoName: string | null | undefined,
  isMarathi: boolean = true
): string {
  if (!geoName) return "";
  if (!isMarathi) return geoName;

  if (/[\u0900-\u097F]/.test(geoName)) {
    return geoName;
  }

  const normalized = geoName.trim().toLowerCase();
  if (MARATHI_GEO_MAP[normalized]) {
    return MARATHI_GEO_MAP[normalized];
  }

  return geoName;
}

/**
 * Translates crop names into Marathi
 */
export function translateCropName(
  crop: string | null | undefined,
  isMarathi: boolean = true
): string {
  if (!crop) return isMarathi ? "ऊस / नगदी पीक" : "Sugarcane / Cash Crop";
  if (!isMarathi) return crop;

  if (/[\u0900-\u097F]/.test(crop)) {
    return crop;
  }

  const normalized = crop.trim().toLowerCase();
  if (MARATHI_CROP_MAP[normalized]) {
    return MARATHI_CROP_MAP[normalized];
  }

  return crop;
}

/**
 * Accurately transliterates Marathi Devanagari text to Romanized Latin (English)
 */
export function devanagariToEnglish(text: string | null | undefined): string {
  if (!text) return "";

  // Common dictionary overrides for titles, relationships, suffixes, surnames
  const wordOverrides: Record<string, string> = {
    "उर्फ": "alias",
    "मयत": "Late",
    "वारस": "Heir",
    "नावे": "in name of",
    "इतर": "others",
    "वगैरे": "etc.",
    "आणि": "and",
    "श्री": "Shri",
    "श्रीमती": "Shrimati",
    "सौ": "Sau.",
    "कु": "Ku.",
    "अण्णा": "Anna",
    "भाऊ": "Bhau",
    "आप्पा": "Appa",
    "बापू": "Bapu",
    "तात्या": "Tatya",
    "काका": "Kaka",
    "नाना": "Nana",
    "दादा": "Dada",
    "साहेब": "Saheb",
    "राव": "Rao",
    "बाळासाहेब": "Balasaheb",
    "दत्तात्रय": "Dattatray",
    "राजेंद्र": "Rajendra",
    "राजेंद": "Rajendra",
    "राजेद्र": "Rajendra",
    "ज्ञानदेव": "Dnyandev",
    "ज्ञानेश्वर": "Dnyaneshwar",
    "ज्ञानेश्‍वर": "Dnyaneshwar",
    "काटे": "Kate",
    "बागल": "Bagal",
    "सस्ते": "Saste",
    "देवकाते": "Devkate",
    "चव्हाण": "Chavan",
    "लाडकत": "Ladkat",
    "खोमणे": "Khomane",
    "कदम": "Kadam",
    "साबळे": "Sabale",
    "आडके": "Aadke",
    "सरगर": "Sargar",
    "ताकवणे": "Takawane",
    "शिंदे": "Shinde",
    "पाटील": "Patil",
    "पवार": "Pawar",
    "जाधव": "Jadhav",
    "मोरे": "More",
    "भोसले": "Bhosale",
    "गायकवाड": "Gaikwad",
    "जगताप": "Jagtap",
    "हरिभाऊ": "Haribhau",
    "खंडेराव": "Khanderao",
    "आनंदराव": "Anandrao",
    "विजयसिंह": "Vijaysinh",
    "दिनकर": "Dinkar",
    "धनंजय": "Dhananjay",
    "सिताराम": "Sitaram",
    "भाग्यश्री": "Bhagyashree",
    "चंद्रकांत": "Chandrakant",
    "संपत": "Sampat",
    "बबन": "Baban",
    "पोपट": "Popat",
    "रघुनाथ": "Raghunath",
    "गंगाराम": "Gangaram",
    "तात्याबा": "Tatyaba",
    "सोनाली": "Sonali",
    "जान्हवी": "Janhavi",
    "अशोक": "Ashok",
    "विनोद": "Vinod",
    "रंजना": "Ranjana",
    "वैष्णवी": "Vaishnavi",
    "शंभुराज": "Shambhuraj",
    "संगीता": "Sangita",
    "अनिल": "Anil",
    "श्रीकांत": "Shrikant",
    "योगेश": "Yogesh",
    "भूपेश": "Bhupesh",
    "भुपेश": "Bhupesh",
    "राजेश": "Rajesh",
    "वैभव": "Vaibhav",
    "शोभा": "Shobha",
    "प्रदीप": "Pradip",
    "संदीप": "Sandip",
    "कमल": "Kamal",
    "गोपिनाथ": "Gopinath",
    "अंकुश": "Ankush",
    "नरसिंग": "Narsing",
    "प्रताप": "Pratap",
    "सचिन": "Sachin",
    "भरत": "Bharat",
    "लक्ष्मण": "Laxman",
    "विठ्ठल": "Vitthal",
  };

  const words = text.trim().split(/\s+/);
  const resultWords = words.map((word) => {
    if (wordOverrides[word]) {
      return wordOverrides[word];
    }
    if (word.endsWith("राव") && word.length > 3) {
      const base = word.slice(0, -3);
      return transliterateWord(base) + "rao";
    }
    if (word.endsWith("भाऊ") && word.length > 3) {
      const base = word.slice(0, -3);
      return transliterateWord(base) + "bhau";
    }
    if (word.endsWith("सिंह") && word.length > 4) {
      const base = word.slice(0, -4);
      return transliterateWord(base) + "sinh";
    }
    return transliterateWord(word);
  });

  return resultWords.join(" ");
}

function transliterateWord(word: string): string {
  const vowels: Record<string, string> = {
    "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u",
    "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "अं": "an", "अः": "ah",
  };

  const matras: Record<string, string> = {
    "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u",
    "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
    "ं": "n", "ँ": "n", "ः": "h",
  };

  const consonants: Record<string, string> = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
    "ष": "sh", "स": "s", "ह": "h", "ळ": "l", "क्ष": "ksh",
    "ज्ञ": "dny", "श्र": "shr", "त्र": "tr",
  };

  let out = "";
  const len = word.length;
  let i = 0;

  while (i < len) {
    const ch = word[i];
    const next = i + 1 < len ? word[i + 1] : "";
    const nextNext = i + 2 < len ? word[i + 2] : "";

    // Compound letter specials
    if (ch === "ज" && next === "्" && nextNext === "ञ") {
      out += "dny";
      i += 3;
      if (i < len && matras[word[i]]) {
        out += matras[word[i]];
        i++;
      } else if (i < len && word[i] === "्") {
        i++;
      } else if (i < len && !isPunctuation(word[i])) {
        out += "a";
      }
      continue;
    }

    if (ch === "क" && next === "्" && nextNext === "ष") {
      out += "ksh";
      i += 3;
      if (i < len && matras[word[i]]) {
        out += matras[word[i]];
        i++;
      } else if (i < len && word[i] === "्") {
        i++;
      } else if (i < len && !isPunctuation(word[i])) {
        out += "a";
      }
      continue;
    }

    if (ch === "श" && next === "्" && nextNext === "र") {
      out += "shr";
      i += 3;
      if (i < len && matras[word[i]]) {
        out += matras[word[i]];
        i++;
      } else if (i < len && word[i] === "्") {
        i++;
      } else if (i < len && !isPunctuation(word[i])) {
        out += "a";
      }
      continue;
    }

    if (ch === "त" && next === "्" && nextNext === "र") {
      out += "tr";
      i += 3;
      if (i < len && matras[word[i]]) {
        out += matras[word[i]];
        i++;
      } else if (i < len && word[i] === "्") {
        i++;
      } else if (i < len && !isPunctuation(word[i])) {
        out += "a";
      }
      continue;
    }

    if (vowels[ch]) {
      out += vowels[ch];
      i++;
      continue;
    }

    if (consonants[ch]) {
      const c = consonants[ch];
      i++;

      if (i < len) {
        const nextChar = word[i];
        if (nextChar === "्") {
          out += c;
          i++;
        } else if (matras[nextChar]) {
          out += c + matras[nextChar];
          i++;
          if (i < len && (word[i] === "ं" || word[i] === "ँ")) {
            const nextAfterAnusvara = i + 1 < len ? word[i + 1] : "";
            if (["प", "फ", "ब", "भ", "म"].includes(nextAfterAnusvara)) {
              out += "m";
            } else {
              out += "n";
            }
            i++;
          }
        } else if (nextChar === "ं" || nextChar === "ँ") {
          const nextAfterAnusvara = i + 1 < len ? word[i + 1] : "";
          if (["प", "फ", "ब", "भ", "म"].includes(nextAfterAnusvara)) {
            out += c + "am";
          } else {
            out += c + "an";
          }
          i++;
        } else if (nextChar === "ः") {
          out += c + "ah";
          i++;
        } else if (consonants[nextChar] || vowels[nextChar]) {
          out += c + "a";
        } else {
          out += c;
        }
      } else {
        out += c;
      }
      continue;
    }

    if (matras[ch]) {
      out += matras[ch];
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  if (out.length > 0) {
    return out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

function isPunctuation(ch: string): boolean {
  return /[\s.,\/#!$%\^&\*;:{}=\-_`~()]/i.test(ch);
}

/**
 * Translates farmer names / landholders into Marathi or English based on locale
 */
export function translateFarmerName(
  farmerName: string | null | undefined,
  isMarathi: boolean = true
): string {
  if (!farmerName) return isMarathi ? "शेतकरी" : "Farmer";

  // If Marathi requested and already Devanagari, return as-is
  if (isMarathi) {
    if (/[\u0900-\u097F]/.test(farmerName)) {
      return farmerName;
    }
    const normalized = farmerName.trim().toLowerCase();
    if (MARATHI_FARMER_MAP[normalized]) {
      return MARATHI_FARMER_MAP[normalized];
    }
    return farmerName;
  }

  // English requested
  // If farmerName has Devanagari characters, transliterate to clean English
  if (/[\u0900-\u097F]/.test(farmerName)) {
    return devanagariToEnglish(farmerName);
  }

  return farmerName;
}

/**
 * Translates unit strings into Marathi
 */
export function translateUnit(
  unit: string | null | undefined,
  isMarathi: boolean = true
): string {
  if (!unit) return "";
  if (!isMarathi) return unit;

  const normalized = unit.trim().toLowerCase();
  if (MARATHI_UNIT_MAP[normalized]) {
    return MARATHI_UNIT_MAP[normalized];
  }

  return unit;
}

/**
 * Formats Gat number label in Marathi
 */
export function formatGatLabel(
  gatNo: string | number | null | undefined,
  isMarathi: boolean = true
): string {
  if (!gatNo) return isMarathi ? "गट क्रमांक" : "Gat No.";
  return isMarathi ? `गट क्र. ${gatNo}` : `Gat No. ${gatNo}`;
}
