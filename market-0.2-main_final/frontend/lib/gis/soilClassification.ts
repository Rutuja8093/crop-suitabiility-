import { SoilClassification } from "@/types/gat";
import { DSMRasterLayerId } from "@/types/gis";

export function classifyParameter(
  layerId: DSMRasterLayerId | string,
  val: number
): SoilClassification {
  switch (layerId) {
    case "ph": {
      if (val < 6.5) {
        return {
          status: "Slightly Acidic",
          statusMr: "किंचित आम्लयुक्त",
          color: "#f59e0b",
          rating: "Caution",
          advice: "Apply agricultural lime or dolomite to increase soil pH.",
          adviceMr: "जमिनीचा सामू वाढवण्यासाठी कृषी चुना किंवा डोलोमाइट वापरा.",
        };
      }
      if (val <= 7.8) {
        return {
          status: "Optimal Neutral",
          statusMr: "उत्कृष्ट उदासीन (योग्य)",
          color: "#00e676",
          rating: "Optimal",
          advice: "Ideal nutrient availability. Maintain organic soil management.",
          adviceMr: "अन्नद्रव्ये उपलब्धतेसाठी आदर्श. सेंद्रिय खतांचा नियमित वापर चालू ठेवा.",
        };
      }
      if (val <= 8.5) {
        return {
          status: "Moderately Alkaline",
          statusMr: "मध्यम अल्कधर्मी (खारवट)",
          color: "#f59e0b",
          rating: "Moderate",
          advice: "Incorporate gypsum and farmyard manure to moderate alkalinity.",
          adviceMr: "अल्कधर्मीपणा कमी करण्यासाठी जिप्सम आणि शेणखताचा वापर करा.",
        };
      }
      return {
        status: "Highly Alkaline",
        statusMr: "अति अल्कधर्मी (चोपण)",
        color: "#ef4444",
        rating: "Critical",
        advice: "Requires reclamation with gypsum and improved sub-surface drainage.",
        adviceMr: "जिप्समचा योग्य वापर आणि पाण्याचा निचरा सुधारण्याची तातडीने गरज आहे.",
      };
    }

    case "soc": {
      if (val < 0.5) {
        return {
          status: "Low Organic Carbon",
          statusMr: "कमी सेंद्रिय कर्ब",
          color: "#ef4444",
          rating: "Low",
          advice: "Apply 5-10 tonnes/ha of well-decomposed FYM or compost.",
          adviceMr: "दर हेक्टरी ५-१० टन कुजलेले शेणखत किंवा कंपोस्ट खत टाका.",
        };
      }
      if (val <= 0.75) {
        return {
          status: "Medium Organic Carbon",
          statusMr: "मध्यम सेंद्रिय कर्ब",
          color: "#f59e0b",
          rating: "Medium",
          advice: "Maintain regular additions of green manure, compost, or biochar.",
          adviceMr: "हिरवळीची खते, गांडूळ खत किंवा बायोचारचा नियमित वापर करा.",
        };
      }
      return {
        status: "High Organic Carbon",
        statusMr: "उत्तम सेंद्रिय कर्ब",
        color: "#00e676",
        rating: "High",
        advice: "Healthy microbial activity and moisture retention. Maintain practices.",
        adviceMr: "जमिनीची सुपीकता व पाणी धरून ठेवण्याची क्षमता उत्कृष्ट आहे.",
      };
    }

    case "nitrogen": {
      if (val < 12.0) {
        return {
          status: "Deficient Nitrogen",
          statusMr: "कमी उपलब्ध नत्र",
          color: "#ef4444",
          rating: "Deficient",
          advice: "Supplement with urea/DAP split doses and Azotobacter inoculants.",
          adviceMr: "युरिया/डीएपी च्या हप्त्यांमध्ये विभागून मात्रा द्या व ॲझोटोबॅक्टर वापरा.",
        };
      }
      if (val <= 16.0) {
        return {
          status: "Moderate Nitrogen",
          statusMr: "मध्यम उपलब्ध नत्र",
          color: "#f59e0b",
          rating: "Moderate",
          advice: "Apply recommended maintenance doses according to crop demand.",
          adviceMr: "पिकाच्या गरजेनुसार शिफारस केलेली संतुलित नत्र मात्रा द्या.",
        };
      }
      return {
        status: "Sufficient Nitrogen",
        statusMr: "मुबलक उपलब्ध नत्र",
        color: "#00e676",
        rating: "Sufficient",
        advice: "Adequate vegetative nutrition. Avoid excessive nitrogenous inputs.",
        adviceMr: "नत्राचे प्रमाण योग्य आहे. अतिरिक्त रासायनिक नत्र वापरणे टाळा.",
      };
    }

    case "bd": {
      if (val < 1.4) {
        return {
          status: "Well Aerated",
          statusMr: "उत्तम हवा खेळती",
          color: "#00e676",
          rating: "Good",
          advice: "Excellent soil porosity and root penetrability.",
          adviceMr: "मुळांच्या वाढीसाठी मातीची रचना अत्यंत अनुकूल आहे.",
        };
      }
      if (val <= 1.6) {
        return {
          status: "Moderate Density",
          statusMr: "मध्यम घनता",
          color: "#f59e0b",
          rating: "Moderate",
          advice: "Satisfactory soil structure for Deccan black cotton vertisols.",
          adviceMr: "काळी कापसाची मातीसाठी सामान्य रचना. नियमित सेंद्रिय घटकांचा वापर करा.",
        };
      }
      return {
        status: "Compacted Soil",
        statusMr: "माती घट्ट / संकुचित",
        color: "#ef4444",
        rating: "Compacted",
        advice: "Deep subsoiling and chiseling recommended to relieve hardpan.",
        adviceMr: "माती मोकळी करण्यासाठी खोल नांगरट व सेंद्रिय आच्छादनाचा वापर करा.",
      };
    }

    case "ndvi": {
      if (val < 0.2) {
        return {
          status: "Sparse Canopy / Bare Soil",
          statusMr: "विरळ पिके / उघडी जमीन",
          color: "#ef4444",
          rating: "Low",
          advice: "Early germination phase or fallow land.",
          adviceMr: "उगवण अवस्था किंवा नापीक/पडिक क्षेत्र दर्शविते.",
        };
      }
      if (val <= 0.45) {
        return {
          status: "Moderate Canopy Vigor",
          statusMr: "मध्यम वनस्पती वाढ",
          color: "#f59e0b",
          rating: "Moderate",
          advice: "Vegetative development phase. Ensure timely irrigation.",
          adviceMr: "पिकाची शाकीय वाढीची अवस्था. वेळेवर पाणी व खते व्यवस्थापन करा.",
        };
      }
      return {
        status: "Dense Healthy Canopy",
        statusMr: "जोमदार व दाट पीक वाढ",
        color: "#00e676",
        rating: "High",
        advice: "Optimal vegetative vigor and high chlorophyll density.",
        adviceMr: "पिकाची वाढ जोमदार असून पानांमध्ये हरितद्रव्य उत्तम आहे.",
      };
    }

    case "evi": {
      if (val < 0.15) {
        return {
          status: "Low Biomass Index",
          statusMr: "कमी बायोमास निर्देशांक",
          color: "#ef4444",
          rating: "Low",
          advice: "Sparse foliage or post-harvest residue.",
          adviceMr: "कमी पानांची घनता किंवा काढणीनंतरची स्थिती.",
        };
      }
      if (val <= 0.35) {
        return {
          status: "Moderate Biomass",
          statusMr: "मध्यम बायोमास",
          color: "#f59e0b",
          rating: "Moderate",
          advice: "Healthy growing foliage with minimal atmospheric interference.",
          adviceMr: "पिकांची समाधानकारक वाढ सुरू आहे.",
        };
      }
      return {
        status: "High Biomass Index",
        statusMr: "उच्च बायोमास निर्देशांक",
        color: "#00e676",
        rating: "High",
        advice: "Lush crop canopy with high photosynthetic activity.",
        adviceMr: "भरपूर पालापाचोळा व उत्तम प्रकाशसंश्लेषण क्रिया.",
      };
    }

    case "elevation": {
      return {
        status: "Deccan Plateau",
        statusMr: "दख्खनचे पठार",
        color: "#00e676",
        rating: "Normal",
        advice: "Gentle topographic gradient favorable for furrow irrigation.",
        adviceMr: "पाण्याच्या निचऱ्यासाठी व सिंचनासाठी योग्य पठारी उतार.",
      };
    }

    case "uncertainty": {
      if (val <= 8.0) {
        return {
          status: "High Confidence",
          statusMr: "उच्च अचूकता (विश्वासार्ह)",
          color: "#00e676",
          rating: "High",
          advice: "DSM predictions are supported by dense ground truth observations.",
          adviceMr: "स्थानिक माती नमुन्यांवर आधारित अत्यंत अचूक अंदाज.",
        };
      }
      if (val <= 15.0) {
        return {
          status: "Moderate Confidence",
          statusMr: "मध्यम अचूकता",
          color: "#f59e0b",
          rating: "Moderate",
          advice: "Reasonable predictive fidelity. Secondary ground verification helpful.",
          adviceMr: "समाधानकारक अंदाज. प्रत्यक्ष माती परीक्षण पडताळणी उपयुक्त ठरेल.",
        };
      }
      return {
        status: "Elevated Uncertainty",
        statusMr: "अधिक अनिश्चितता",
        color: "#ef4444",
        rating: "Low",
        advice: "Additional soil sampling is recommended for this parcel.",
        adviceMr: "या क्षेत्रासाठी अतिरिक्त माती नमुना तपासणीची शिफारस केली जाते.",
      };
    }

    default: {
      return {
        status: "Standard Value",
        statusMr: "प्रमाणित मूल्य",
        color: "#00e676",
        rating: "Normal",
        advice: "Monitored parcel parameter.",
        adviceMr: "नोंदवलेले शेत घटक मूल्य.",
      };
    }
  }
}
