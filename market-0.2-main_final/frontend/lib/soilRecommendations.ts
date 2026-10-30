/**
 * SoilPilot — Client-Side Soil Recommendation Engine
 *
 * Mirrors the backend recommendation_engine.py logic so that the
 * Recommendations page and Soil Health Card always show parameter-specific,
 * data-driven recommendations — even if the backend API is momentarily
 * unavailable.
 *
 * Architecture:
 *   Soil observation → parameter normalization → reference range →
 *   status → recommendation rule → farmer-friendly recommendation
 *
 * Recommendation basis: soil-test-based balanced/integrated nutrient
 * management principles (standard agronomic guidance, not ICAR-certified).
 */

export type StatusCategory =
  | 'OPTIMAL'
  | 'GOOD'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'VERY HIGH'
  | 'CRITICAL'
  | 'NOT AVAILABLE';

export type PriorityKey = 'high' | 'moderate' | 'info';

export interface ParameterRec {
  status_category: StatusCategory;
  priority_rank: number; // 1=Critical, 2=Low, 3=High, 4=Medium, 5=Optimal
  priority_key: PriorityKey;
  recommendation: string;
  recommendation_mr: string;
}

// ---------------------------------------------------------------------------
// CORE PER-PARAMETER RECOMMENDATION ENGINE
// ---------------------------------------------------------------------------
export function getConciseParameterRecommendation(
  key: string,
  value: number | null | undefined,
  interpretationEn: string = '',
  interpretationMr: string = '',
): ParameterRec {
  if (value === null || value === undefined) {
    return {
      status_category: 'NOT AVAILABLE',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Recommendation unavailable because the required soil value is not available.',
      recommendation_mr:
        'या घटकाचे मूल्य उपलब्ध नसल्यामुळे शिफारस देणे शक्य नाही.',
    };
  }

  const k = (key || '').toLowerCase();
  const lowerInterp = interpretationEn.toLowerCase();

  // ── 1. Soil pH ─────────────────────────────────────────────────────────
  if (k === 'ph' || k === 'soil_ph') {
    if (value < 5.0) {
      return {
        status_category: 'CRITICAL',
        priority_rank: 1,
        priority_key: 'high',
        recommendation: 'Apply lime as per soil test',
        recommendation_mr: 'माती चाचणीनुसार चुना वापरा',
      };
    }
    if (value <= 6.0) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Monitor; lime if needed',
        recommendation_mr: 'सामू तपासा; आवश्यकतेनुसार चुना वापरा',
      };
    }
    if (value <= 7.5) {
      return {
        status_category: 'OPTIMAL',
        priority_rank: 5,
        priority_key: 'info',
        recommendation: 'Maintain current pH',
        recommendation_mr: 'सध्याचा सामू टिकवून ठेवा',
      };
    }
    if (value <= 8.5) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Monitor Fe/Zn',
        recommendation_mr: 'लोह (Fe) व जस्त (Zn) उपलब्धतेवर लक्ष ठेवा',
      };
    }
    return {
      status_category: 'CRITICAL',
      priority_rank: 1,
      priority_key: 'high',
      recommendation: 'Test soil; manage alkalinity',
      recommendation_mr: 'माती परीक्षण करा; विम्लता व्यवस्थापन करा',
    };
  }

  // ── 2. Electrical Conductivity (EC) ────────────────────────────────────
  if (k === 'ec' || k === 'electrical_conductivity') {
    if (value < 0.4) {
      return {
        status_category: 'OPTIMAL',
        priority_rank: 5,
        priority_key: 'info',
        recommendation: 'No salinity action',
        recommendation_mr: 'क्षार सुधारणेची गरज नाही',
      };
    }
    if (value <= 0.8) {
      return {
        status_category: 'GOOD',
        priority_rank: 5,
        priority_key: 'info',
        recommendation: 'Improve drainage; monitor',
        recommendation_mr: 'पाण्याचा निचरा सुधारा; लक्ष ठेवा',
      };
    }
    if (value <= 1.6) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Manage salts and irrigation',
        recommendation_mr: 'क्षार व सिंचन व्यवस्थापन करा',
      };
    }
    return {
      status_category: 'CRITICAL',
      priority_rank: 1,
      priority_key: 'high',
      recommendation: 'Soil/water testing needed',
      recommendation_mr: 'माती व पाणी परीक्षण आवश्यक',
    };
  }

  // ── 3. Organic Carbon (OC) ─────────────────────────────────────────────
  if (k === 'organic_carbon' || k === 'soc' || k === 'oc') {
    if (value < 0.50) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Add FYM/compost/residues',
        recommendation_mr: 'शेणखत/कंपोस्ट/पीक अवशेष वापरा',
      };
    }
    if (value <= 0.75) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Maintain organic matter',
        recommendation_mr: 'सेंद्रिय घटक टिकवून ठेवा',
      };
    }
    return {
      status_category: 'HIGH',
      priority_rank: 5,
      priority_key: 'info',
      recommendation: 'Maintain; no extra OC needed',
      recommendation_mr: 'पातळी टिकवा; अतिरिक्त कर्बाची गरज नाही',
    };
  }

  // ── 4. Available Nitrogen (N) ───────────────────────────────────────────
  if (k === 'available_nitrogen' || k === 'nitrogen' || k === 'n') {
    if (value < 280) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Increase N; ~125% RDF*',
        recommendation_mr: 'नत्र वाढवा; ~१२५% शिफारशीत मात्रा*',
      };
    }
    if (value <= 560) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Normal RDF*',
        recommendation_mr: 'सर्वसाधारण १००% शिफारशीत मात्रा*',
      };
    }
    return {
      status_category: 'HIGH',
      priority_rank: 3,
      priority_key: 'info',
      recommendation: 'Reduce N; ~75% RDF*',
      recommendation_mr: 'नत्र कमी करा; ~७५% शिफारशीत मात्रा*',
    };
  }

  // ── 5. Available Phosphorus (P) ─────────────────────────────────────────
  if (k === 'available_phosphorus' || k === 'phosphorus' || k === 'p') {
    if (value < 10) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Increase P; ~125% RDF*',
        recommendation_mr: 'स्फुरद वाढवा; ~१२५% शिफारशीत मात्रा*',
      };
    }
    if (value <= 25) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Normal RDF*',
        recommendation_mr: 'सर्वसाधारण १००% शिफारशीत मात्रा*',
      };
    }
    if (value <= 50) {
      return {
        status_category: 'HIGH',
        priority_rank: 3,
        priority_key: 'info',
        recommendation: 'Reduce P; ~75% RDF*',
        recommendation_mr: 'स्फुरद कमी करा; ~७५% शिफारशीत मात्रा*',
      };
    }
    return {
      status_category: 'VERY HIGH',
      priority_rank: 3,
      priority_key: 'info',
      recommendation: 'Avoid P fertilizer',
      recommendation_mr: 'स्फुरद खत देणे टाळा',
    };
  }

  // ── 6. Available Potassium (K) ──────────────────────────────────────────
  if (k === 'available_potassium' || k === 'potassium' || k === 'k') {
    if (value < 120) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Increase K; ~125% RDF*',
        recommendation_mr: 'पालाश वाढवा; ~१२५% शिफारशीत मात्रा*',
      };
    }
    if (value <= 280) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Normal RDF*',
        recommendation_mr: 'सर्वसाधारण १००% शिफारशीत मात्रा*',
      };
    }
    if (value <= 600) {
      return {
        status_category: 'HIGH',
        priority_rank: 3,
        priority_key: 'info',
        recommendation: 'Reduce K; ~75% RDF*',
        recommendation_mr: 'पालाश कमी करा; ~७५% शिफारशीत मात्रा*',
      };
    }
    return {
      status_category: 'VERY HIGH',
      priority_rank: 3,
      priority_key: 'info',
      recommendation: 'Avoid K fertilizer',
      recommendation_mr: 'पालाश खत देणे टाळा',
    };
  }

  // ── 7. Iron (Fe) ────────────────────────────────────────────────────────
  if (k === 'iron' || k === 'fe') {
    if (value < 2.5) {
      return {
        status_category: 'CRITICAL',
        priority_rank: 1,
        priority_key: 'high',
        recommendation: 'Correct Fe deficiency',
        recommendation_mr: 'लोह कमतरता दूर करा',
      };
    }
    if (value <= 4.5) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Apply Fe if needed',
        recommendation_mr: 'गरज भासल्यास लोह वापरा',
      };
    }
    if (value <= 6.5) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Monitor Fe',
        recommendation_mr: 'लोहावर लक्ष ठेवा',
      };
    }
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation: 'No Fe correction',
      recommendation_mr: 'लोह सुधारणेची गरज नाही',
    };
  }

  // ── 8. Zinc (Zn) ────────────────────────────────────────────────────────
  if (k === 'zinc' || k === 'zn') {
    if (value < 0.3) {
      return {
        status_category: 'CRITICAL',
        priority_rank: 1,
        priority_key: 'high',
        recommendation: 'Correct Zn deficiency',
        recommendation_mr: 'जस्त कमतरता दूर करा',
      };
    }
    if (value <= 0.6) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Apply Zn if needed',
        recommendation_mr: 'गरज भासल्यास जस्त वापरा',
      };
    }
    if (value <= 0.9) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Monitor Zn',
        recommendation_mr: 'जस्तावर लक्ष ठेवा',
      };
    }
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation: 'No Zn correction',
      recommendation_mr: 'जस्त सुधारणेची गरज नाही',
    };
  }

  // ── 9. Sulphur (S) ──────────────────────────────────────────────────────
  if (k === 'sulphur' || k === 'sulfur' || k === 's') {
    if (value < 15.0) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Apply S as needed',
        recommendation_mr: 'गरजेनुसार गंधक वापरा',
      };
    }
    if (value <= 22.5) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Monitor S',
        recommendation_mr: 'गंधकावर लक्ष ठेवा',
      };
    }
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation: 'Maintain S',
      recommendation_mr: 'गंधक पातळी टिकवून ठेवा',
    };
  }

  // ── 10. Boron (B) ───────────────────────────────────────────────────────
  if (k === 'boron' || k === 'b') {
    if (value < 0.50) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Apply B carefully',
        recommendation_mr: 'काळजीपूर्वक बोरॉन वापरा',
      };
    }
    if (value <= 0.70) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Monitor B',
        recommendation_mr: 'बोरॉनवर लक्ष ठेवा',
      };
    }
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation: 'No B correction',
      recommendation_mr: 'बोरॉन सुधारणेची गरज नाही',
    };
  }

  // ── 11. Copper (Cu) ─────────────────────────────────────────────────────
  if (k === 'copper' || k === 'cu') {
    if (value < 0.40) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Apply Cu if needed',
        recommendation_mr: 'गरज असल्यास तांबे वापरा',
      };
    }
    if (value <= 0.60) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Monitor Cu',
        recommendation_mr: 'तांब्यावर लक्ष ठेवा',
      };
    }
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation: 'No Cu correction',
      recommendation_mr: 'तांबे सुधारणेची गरज नाही',
    };
  }

  // ── 12. Manganese (Mn) ──────────────────────────────────────────────────
  if (k === 'manganese' || k === 'mn') {
    if (value < 3.0) {
      return {
        status_category: 'LOW',
        priority_rank: 2,
        priority_key: 'high',
        recommendation: 'Apply Mn if needed',
        recommendation_mr: 'गरज असल्यास मँगनीज वापरा',
      };
    }
    if (value <= 5.0) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation: 'Monitor Mn',
        recommendation_mr: 'मँगनीजवर लक्ष ठेवा',
      };
    }
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation: 'No Mn correction',
      recommendation_mr: 'मँगनीज सुधारणेची गरज नाही',
    };
  }

  // ── 13. Bulk Density (BD) ───────────────────────────────────────────────
  if (k === 'bd' || k === 'bulk_density') {
    if (value > 1.60) {
      return {
        status_category: 'HIGH',
        priority_rank: 3,
        priority_key: 'high',
        recommendation:
          'Soil density is elevated. Consider deep subsoiling and organic residue incorporation to relieve compaction.',
        recommendation_mr:
          'माती घट्ट झाल्याचे दिसते. खोल नांगरट व सेंद्रिय घटकांचा वापर करून मातीची रचना सुधारा.',
      };
    }
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Soil physical condition and density are favorable for root penetration and moisture retention.',
      recommendation_mr:
        'मातीची भौतिक घनता योग्य असून मुळांची वाढ व ओलावा टिकवण्यासाठी अनुकूल आहे.',
    };
  }

  // ── 14. Exchangeable Sodium Percentage (ESP) ────────────────────────────
  if (k === 'exchangeable_sodium' || k === 'esp') {
    if (value > 15.0) {
      return {
        status_category: 'CRITICAL',
        priority_rank: 1,
        priority_key: 'high',
        recommendation:
          'Monitor sodicity risk and follow a soil- and water-test-based reclamation recommendation using agricultural gypsum.',
        recommendation_mr:
          'चोपण जमिनीचा धोका टाळण्यासाठी माती व पाणी चाचणीनुसार कृषी जिप्समचा वापर करा.',
      };
    }
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Exchangeable sodium is within safe range. Maintain appropriate drainage.',
      recommendation_mr:
        'सोडियमचे प्रमाण सुरक्षित मर्यादेत आहे. शेतातील पाण्याचा निचरा योग्य ठेवा.',
    };
  }

  // ── 15. Free Lime (CaCO3) ────────────────────────────────────────────────
  if (k === 'free_lime' || k === 'caco3') {
    if (value > 10.0) {
      return {
        status_category: 'MEDIUM',
        priority_rank: 4,
        priority_key: 'moderate',
        recommendation:
          'High free lime. Micronutrients (Fe, Zn) and P may precipitate; consider organic manures, sulphur, or foliar nutrition.',
        recommendation_mr:
          'चुनखडीचे प्रमाण जास्त असल्याने सेंद्रिय खतांचा वापर वाढवा व लोह-जस्तासाठी फवारणीचा मार्ग निवडा.',
      };
    }
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Free lime is within normal bounds. Maintain balanced fertilization.',
      recommendation_mr:
        'मुक्त चुनखडी योग्य मर्यादेत आहे. नियमित संतुलित शेती पद्धती सुरू ठेवा.',
    };
  }

  // ── 16. Total Nitrogen (%) ───────────────────────────────────────────────
  if (k === 'total_nitrogen' || k === 'total_n') {
    return {
      status_category: 'MEDIUM',
      priority_rank: 4,
      priority_key: 'info',
      recommendation:
        'Total soil N reserve is moderate; maintain soil organic matter through regular compost & residue incorporation.',
      recommendation_mr:
        'जमिनीतील एकूण नत्र साठा मध्यम आहे; शेणखत व सेंद्रिय अवशेषांच्या वापराने नत्र साठा टिकवून ठेवावा.',
    };
  }

  // ── 17. Cation Exchange Capacity (CEC) ───────────────────────────────────
  if (k === 'cec') {
    return {
      status_category: 'HIGH',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'High nutrient retention capacity; excellent buffer against nutrient leaching.',
      recommendation_mr:
        'धनायन विनिमय क्षमता उच्च आहे; खते धरून ठेवण्याची क्षमता उत्कृष्ट आहे.',
    };
  }

  // ── 18. Coarse Fragments (%) ─────────────────────────────────────────────
  if (k === 'cfvo' || k === 'coarse_fragments') {
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Minimal gravel content; favorable tillage and root elongation zone.',
      recommendation_mr:
        'दगड-गोट्यांचे प्रमाण अत्यल्प आहे; मुळांच्या वाढीसाठी व मशागतीसाठी जमीन अत्यंत अनुकूल आहे.',
    };
  }

  // ── 19. Sand (%) ─────────────────────────────────────────────────────────
  if (k === 'sand') {
    return {
      status_category: 'MEDIUM',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Adequate sand fraction ensuring baseline aeration and internal drainage.',
      recommendation_mr:
        'वाळूचे प्रमाण संतुलित असून जमिनीत हवा खेळती राहण्यास व निचरा होण्यास मदत होते.',
    };
  }

  // ── 20. Silt (%) ─────────────────────────────────────────────────────────
  if (k === 'silt') {
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Optimum silt content supporting available water capacity and nutrient retention.',
      recommendation_mr:
        'गाळाचे प्रमाण योग्य असून ओलावा व अन्नद्रव्ये टिकवून ठेवण्यास मदत करते.',
    };
  }

  // ── 21. Clay (%) ─────────────────────────────────────────────────────────
  if (k === 'clay') {
    return {
      status_category: 'HIGH',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'High smectite clay vertisol; maintain proper drainage to prevent waterlogging.',
      recommendation_mr:
        'काळी कसदार चिकणमाती; अति पावसात पाणी साचू नये म्हणून योग्य निचरा व्यवस्था ठेवावी.',
    };
  }

  // ── 22. Soil Texture Class ───────────────────────────────────────────────
  if (k === 'soil_texture' || k === 'soil_texture_class' || k === 'texture_class') {
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Deep black cotton soil (Vertisols); practice broad-bed furrow (BBF) and timely tillage.',
      recommendation_mr:
        'खोल काळी चिकण जमीन (व्हर्टिसॉल); रुंद वरंबा-सरी (BBF) पद्धत आणि योग्य ओलाव्यावर मशागत करावी.',
    };
  }

  // ── Fallback ────────────────────────────────────────────────────────────
  // Use interpretation string to detect low/high/optimal status
  if (lowerInterp.includes('low') || lowerInterp.includes('deficient') || lowerInterp.includes('critical')) {
    return {
      status_category: 'LOW',
      priority_rank: 2,
      priority_key: 'high',
      recommendation:
        'The nutrient level is below the configured reference range. Follow the soil-test-based nutrient recommendation for this field.',
      recommendation_mr:
        'हा घटक संदर्भ श्रेणीपेक्षा कमी आहे. माती परीक्षणाधारित खत शिफारस पाळा.',
    };
  }
  if (lowerInterp.includes('very high')) {
    return {
      status_category: 'VERY HIGH',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Avoid adding additional amounts solely to increase this nutrient. Maintain balanced nutrient management and monitor future soil tests.',
      recommendation_mr:
        'हा घटक अत्यंत उत्तम आहे. अनावश्यक अतिरिक्त खत टाळा आणि पुढील माती चाचणी घ्या.',
    };
  }
  if (lowerInterp.includes('high')) {
    return {
      status_category: 'HIGH',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Avoid unnecessary additional application of this nutrient until the next soil test or crop-specific recommendation.',
      recommendation_mr:
        'हा घटक जास्त आहे. पुढील माती चाचणीशिवाय अतिरिक्त वापर टाळा.',
    };
  }
  if (lowerInterp.includes('medium') || lowerInterp.includes('moderate')) {
    return {
      status_category: 'MEDIUM',
      priority_rank: 4,
      priority_key: 'moderate',
      recommendation:
        'Monitor this nutrient and maintain balanced nutrient management.',
      recommendation_mr:
        'हा घटक मध्यम श्रेणीत आहे. संतुलित खत व्यवस्थापन ठेवा.',
    };
  }
  if (lowerInterp.includes('optimal') || lowerInterp.includes('good') || lowerInterp.includes('sufficient') || lowerInterp.includes('normal') || lowerInterp.includes('safe')) {
    return {
      status_category: 'OPTIMAL',
      priority_rank: 5,
      priority_key: 'info',
      recommendation:
        'Maintain current soil management practices and continue periodic soil testing.',
      recommendation_mr:
        'सध्याच्या शेती पद्धती सुरू ठेवा आणि नियमित माती चाचणी करा.',
    };
  }

  return {
    status_category: 'GOOD',
    priority_rank: 5,
    priority_key: 'info',
    recommendation:
      'Maintain balanced nutrient management and continue periodic soil testing.',
    recommendation_mr:
      'संतुलित खत व्यवस्थापन आणि नियमित माती चाचणी सुरू ठेवा.',
  };
}

// ---------------------------------------------------------------------------
// RANKED KEY RECOMMENDATIONS (top 5, priority order)
// ---------------------------------------------------------------------------
export interface SoilParamLike {
  key?: string;
  parameter_key?: string;
  name?: string;
  parameter_name?: string;
  name_mr?: string;
  parameter_name_mr?: string;
  value?: number | null;
  unit?: string;
  interpretation?: string;
  interpretation_en?: string;
  interpretation_mr?: string;
  status_category?: string;
  priority_rank?: number;
  priority_key?: string;
  recommendation?: string;
  recommendation_mr?: string;
}

export interface KeyRecommendationResult {
  key: string;
  name: string;
  name_mr: string;
  value: number | null;
  unit: string;
  status_category: string;
  priority_rank: number;
  priority_key: string;
  recommendation: string;
  recommendation_mr: string;
}

export function getRankedKeyRecommendations(
  parameters: SoilParamLike[],
  maxItems = 5,
): KeyRecommendationResult[] {
  const seen = new Set<string>();
  const ranked: KeyRecommendationResult[] = [];

  for (const p of parameters) {
    const key = (p.key || p.parameter_key || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const interpEn = p.interpretation || p.interpretation_en || '';
    const interpMr = p.interpretation_mr || interpEn;
    const name = p.name || p.parameter_name || key;
    const nameMr = p.name_mr || p.parameter_name_mr || name;

    // Use existing recommendation from backend if available, else compute client-side
    const backendRec = p.recommendation;
    const backendRecMr = p.recommendation_mr;
    const backendStatus = p.status_category;
    const backendRank = p.priority_rank;
    const backendKey = p.priority_key;

    const computed = getConciseParameterRecommendation(key, p.value ?? null, interpEn, interpMr);

    ranked.push({
      key,
      name,
      name_mr: nameMr,
      value: p.value ?? null,
      unit: p.unit || '',
      status_category: backendStatus || computed.status_category,
      priority_rank: backendRank ?? computed.priority_rank,
      priority_key: (backendKey || computed.priority_key) as PriorityKey,
      recommendation: backendRec || computed.recommendation,
      recommendation_mr: backendRecMr || computed.recommendation_mr,
    });
  }

  // Sort: Critical(1) > Low(2) > High(3) > Medium(4) > Optimal(5)
  ranked.sort((a, b) => a.priority_rank - b.priority_rank || a.key.localeCompare(b.key));

  return ranked.slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// CLEAN BENCHMARK REFERENCE RANGE FORMATTERS
// Strips verbose concatenated classification strings ("<5.0 Acidic | ...")
// and returns concise, authoritative standard reference ranges.
// ---------------------------------------------------------------------------
export function getCleanReferenceRange(key?: string, rawRange?: string): string {
  const cleanMap: Record<string, string> = {
    ph: "< 6.5 (Acidic)\n6.5 – 7.5 (Neutral)\n> 7.5 (Alkaline)",
    soil_ph: "< 6.5 (Acidic)\n6.5 – 7.5 (Neutral)\n> 7.5 (Alkaline)",
    ec: "< 0.8 dS/m (Normal)\n0.8 – 1.6 (Critical)\n> 1.6 (Saline)",
    electrical_conductivity: "< 0.8 dS/m (Normal)\n0.8 – 1.6 (Critical)\n> 1.6 (Saline)",
    organic_carbon: "< 0.50% (Low)\n0.50 – 0.75% (Medium)\n> 0.75% (High)",
    soc: "< 0.50% (Low)\n0.50 – 0.75% (Medium)\n> 0.75% (High)",
    total_nitrogen: "< 0.12% (Low)\n0.12 – 0.25% (Medium)\n> 0.25% (High)",
    total_n: "< 0.12% (Low)\n0.12 – 0.25% (Medium)\n> 0.25% (High)",
    available_nitrogen: "< 280 (Low)\n280 – 560 (Medium)\n> 560 (High)",
    nitrogen: "< 280 (Low)\n280 – 560 (Medium)\n> 560 (High)",
    available_phosphorus: "< 10 (Low)\n10 – 25 (Medium)\n> 25 (High)",
    phosphorus: "< 10 (Low)\n10 – 25 (Medium)\n> 25 (High)",
    available_potassium: "< 120 (Low)\n120 – 280 (Medium)\n> 280 (High)",
    potassium: "< 120 (Low)\n120 – 280 (Medium)\n> 280 (High)",
    cec: "< 15.0 (Low)\n15.0 – 25.0 (Medium)\n> 25.0 (Fertile)",
    cation_exchange_capacity: "< 15.0 (Low)\n15.0 – 25.0 (Medium)\n> 25.0 (Fertile)",
    clay: "< 35.0% (Medium)\n35.0 – 45.0% (Optimal)\n> 45.0% (Heavy Clay)",
    clay_proportion: "< 35.0% (Medium)\n35.0 – 45.0% (Optimal)\n> 45.0% (Heavy Clay)",
    sand: "< 20.0% (Low)\n20.0 – 35.0% (Normal)\n> 35.0% (High)",
    sand_proportion: "< 20.0% (Low)\n20.0 – 35.0% (Normal)\n> 35.0% (High)",
    silt: "< 20.0% (Low)\n20.0 – 30.0% (Optimal)\n> 30.0% (High)",
    silt_proportion: "< 20.0% (Low)\n20.0 – 30.0% (Optimal)\n> 30.0% (High)",
    cfvo: "< 10.0% (Low)\n10.0 – 15.0% (Moderate)\n> 15.0% (High)",
    coarse_fragments: "< 10.0% (Low)\n10.0 – 15.0% (Moderate)\n> 15.0% (High)",
    bd: "< 1.40 (Optimal)\n1.40 – 1.60 (Moderate)\n> 1.60 (Compacted)",
    bulk_density: "< 1.40 (Optimal)\n1.40 – 1.60 (Moderate)\n> 1.60 (Compacted)",
    exchangeable_sodium: "< 15.0% (Normal)\n> 15.0% (Problematic)",
    exchangeable_sodium_percentage: "< 15.0% (Normal)\n> 15.0% (Problematic)",
    esp: "< 15.0% (Normal)\n> 15.0% (Problematic)",
    free_lime: "< 5.0% (Normal)\n5.0 – 10.0% (Medium)\n> 10.0% (High)",
    caco3: "< 5.0% (Normal)\n5.0 – 10.0% (Medium)\n> 10.0% (High)",
    iron: "< 4.5 (Deficient)\n> 4.5 (Sufficient)",
    available_iron: "< 4.5 (Deficient)\n> 4.5 (Sufficient)",
    fe: "< 4.5 (Deficient)\n> 4.5 (Sufficient)",
    manganese: "< 3.0 (Deficient)\n> 3.0 (Sufficient)",
    available_manganese: "< 3.0 (Deficient)\n> 3.0 (Sufficient)",
    mn: "< 3.0 (Deficient)\n> 3.0 (Sufficient)",
    zinc: "< 0.6 (Deficient)\n> 0.6 (Sufficient)",
    available_zinc: "< 0.6 (Deficient)\n> 0.6 (Sufficient)",
    zn: "< 0.6 (Deficient)\n> 0.6 (Sufficient)",
    copper: "< 0.4 (Deficient)\n> 0.4 (Sufficient)",
    available_copper: "< 0.4 (Deficient)\n> 0.4 (Sufficient)",
    cu: "< 0.4 (Deficient)\n> 0.4 (Sufficient)",
    sulphur: "< 15.0 (Deficient)\n> 15.0 (Sufficient)",
    available_sulphur: "< 15.0 (Deficient)\n> 15.0 (Sufficient)",
    sulfur: "< 15.0 (Deficient)\n> 15.0 (Sufficient)",
    s: "< 15.0 (Deficient)\n> 15.0 (Sufficient)",
    boron: "< 0.5 (Deficient)\n> 0.5 (Sufficient)",
    available_boron: "< 0.5 (Deficient)\n> 0.5 (Sufficient)",
    b: "< 0.5 (Deficient)\n> 0.5 (Sufficient)",
    soil_texture: "USDA Class: Clay / Vertisols",
    soil_texture_class: "USDA Class: Clay / Vertisols",
    texture_class: "USDA Class: Clay / Vertisols",
  };

  const k = (key || "").toLowerCase().replace(/[- ]/g, "_");
  if (k && cleanMap[k]) {
    return cleanMap[k];
  }

  // If rawRange contains pipes ('|'), it is cluttered with multiple classification brackets
  if (rawRange && rawRange.includes("|")) {
    const parts = rawRange.split("|").map((s) => s.trim());
    const optimalPart = parts.find((p) => /suitable|normal|medium|sufficient|optimal/i.test(p));
    if (optimalPart) return optimalPart;
    return parts[Math.floor(parts.length / 2)] || rawRange;
  }

  return rawRange || "—";
}

export function getCleanReferenceRangeMr(key?: string, rawRange?: string): string {
  const cleanMapMr: Record<string, string> = {
    ph: "< ६.५ (आम्लधर्मी)\n६.५ – ७.५ (उदासीन)\n> ७.५ (विम्लधर्मी)",
    soil_ph: "< ६.५ (आम्लधर्मी)\n६.५ – ७.५ (उदासीन)\n> ७.५ (विम्लधर्मी)",
    ec: "< ०.८ dS/m (सामान्य)\n०.८ – १.६ (चिंताजनक)\n> १.६ (क्षारयुक्त)",
    electrical_conductivity: "< ०.८ dS/m (सामान्य)\n०.८ – १.६ (चिंताजनक)\n> १.६ (क्षारयुक्त)",
    organic_carbon: "< ०.५०% (कमी)\n०.५० – ०.७५% (मध्यम)\n> ०.७५% (जास्त)",
    soc: "< ०.५०% (कमी)\n०.५० – ०.७५% (मध्यम)\n> ०.७५% (जास्त)",
    total_nitrogen: "< ०.१२% (कमी)\n०.१२ – ०.२५% (मध्यम)\n> ०.२५% (जास्त)",
    total_n: "< ०.१२% (कमी)\n०.१२ – ०.२५% (मध्यम)\n> ०.२५% (जास्त)",
    available_nitrogen: "< २८० (कमी)\n२८० – ५६० (मध्यम)\n> ५६० (जास्त)",
    nitrogen: "< २८० (कमी)\n२८० – ५६० (मध्यम)\n> ५६० (जास्त)",
    available_phosphorus: "< १० (कमी)\n१० – २५ (मध्यम)\n> २५ (जास्त)",
    phosphorus: "< १० (कमी)\n१० – २५ (मध्यम)\n> २५ (जास्त)",
    available_potassium: "< १२० (कमी)\n१२० – २८० (मध्यम)\n> २८० (जास्त)",
    potassium: "< १२० (कमी)\n१२० – २८० (मध्यम)\n> २८० (जास्त)",
    cec: "< १५.० (कमी)\n१५.० – २५.० (मध्यम)\n> २५.० (सुपीक)",
    cation_exchange_capacity: "< १५.० (कमी)\n१५.० – २५.० (मध्यम)\n> २५.० (सुपीक)",
    clay: "< ३५.०% (मध्यम)\n३५.० – ४५.०% (इष्टतम)\n> ४५.०% (काळी चिकण माती)",
    clay_proportion: "< ३५.०% (मध्यम)\n३५.० – ४५.०% (इष्टतम)\n> ४५.०% (काळी चिकण माती)",
    sand: "< २०.०% (कमी)\n२०.० – ३५.०% (सामान्य)\n> ३५.०% (जास्त)",
    sand_proportion: "< २०.०% (कमी)\n२०.० – ३५.०% (सामान्य)\n> ३५.०% (जास्त)",
    silt: "< २०.०% (कमी)\n२०.० – ३०.०% (इष्टतम)\n> ३०.०% (जास्त)",
    silt_proportion: "< २०.०% (कमी)\n२०.० – ३०.०% (इष्टतम)\n> ३०.०% (जास्त)",
    cfvo: "< १०.०% (कमी)\n१०.० – १५.०% (मध्यम)\n> १५.०% (जास्त)",
    coarse_fragments: "< १०.०% (कमी)\n१०.० – १५.०% (मध्यम)\n> १५.०% (जास्त)",
    bd: "< १.४० (इष्टतम)\n१.४० – १.६० (मध्यम)\n> १.६० (कठीण जमीन)",
    bulk_density: "< १.४० (इष्टतम)\n१.४० – १.६० (मध्यम)\n> १.६० (कठीण जमीन)",
    exchangeable_sodium: "< १५.०% (सामान्य)\n> १५.०% (समस्याग्रस्त)",
    exchangeable_sodium_percentage: "< १५.०% (सामान्य)\n> १५.०% (समस्याग्रस्त)",
    esp: "< १५.०% (सामान्य)\n> १५.०% (समस्याग्रस्त)",
    free_lime: "< ५.०% (सामान्य)\n५.० – १०.०% (मध्यम)\n> १०.०% (जास्त)",
    caco3: "< ५.०% (सामान्य)\n५.० – १०.०% (मध्यम)\n> १०.०% (जास्त)",
    iron: "< ४.५ (कमतरता)\n> ४.५ (पुरेसे)",
    available_iron: "< ४.५ (कमतरता)\n> ४.५ (पुरेसे)",
    fe: "< ४.५ (कमतरता)\n> ४.५ (पुरेसे)",
    manganese: "< ३.० (कमतरता)\n> ३.० (पुरेसे)",
    available_manganese: "< ३.० (कमतरता)\n> ३.० (पुरेसे)",
    mn: "< ३.० (कमतरता)\n> ३.० (पुरेसे)",
    zinc: "< ०.६ (कमतरता)\n> ०.६ (पुरेसे)",
    available_zinc: "< ०.६ (कमतरता)\n> ०.६ (पुरेसे)",
    zn: "< ०.६ (कमतरता)\n> ०.६ (पुरेसे)",
    copper: "< ०.४ (कमतरता)\n> ०.४ (पुरेसे)",
    available_copper: "< ०.४ (कमतरता)\n> ०.४ (पुरेसे)",
    cu: "< ०.४ (कमतरता)\n> ०.४ (पुरेसे)",
    sulphur: "< १५.० (कमतरता)\n> १५.० (पुरेसे)",
    available_sulphur: "< १५.० (कमतरता)\n> १५.० (पुरेसे)",
    sulfur: "< १५.० (कमतरता)\n> १५.० (पुरेसे)",
    s: "< १५.० (कमतरता)\n> १५.० (पुरेसे)",
    boron: "< ०.५ (कमतरता)\n> ०.५ (पुरेसे)",
    available_boron: "< ०.५ (कमतरता)\n> ०.५ (पुरेसे)",
    b: "< ०.५ (कमतरता)\n> ०.५ (पुरेसे)",
    soil_texture: "USDA वर्ग: काळी चिकण माती",
    soil_texture_class: "USDA वर्ग: काळी चिकण माती",
    texture_class: "USDA वर्ग: काळी चिकण माती",
  };

  const k = (key || "").toLowerCase().replace(/[- ]/g, "_");
  if (k && cleanMapMr[k]) return cleanMapMr[k];
  return getCleanReferenceRange(key, rawRange);
}

