"use client";

import React, { useState, useMemo } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  BookOpen,
  Search,
  Filter,
  Info,
  CheckCircle2,
  AlertTriangle,
  Flame,
  HelpCircle,
} from "lucide-react";

export interface StandardRow {
  parameter: string;
  parameter_mr: string;
  category: "chemical" | "npk" | "micronutrients";
  category_name: string;
  category_name_mr: string;
  unit: string;
  range: string;
  classification: string;
  classification_mr: string;
  statusType: "optimal" | "moderate" | "critical" | "warning";
  recommendation: string;
  recommendation_mr: string;
  ref: string;
}

export const SOIL_REFERENCE_STANDARDS: StandardRow[] = [
  // 1. pH
  {
    parameter: "pH",
    parameter_mr: "सामू (pH)",
    category: "chemical",
    category_name: "Soil Reaction & Salinity",
    category_name_mr: "जमिनीचा सामू व क्षारता",
    unit: "",
    range: "<5.0",
    classification: "Strongly acidic",
    classification_mr: "तीव्र आम्लधर्मी",
    statusType: "critical",
    recommendation: "Apply lime as per soil test",
    recommendation_mr: "माती चाचणीनुसार कृषी चुना वापरा",
    ref: "R1",
  },
  {
    parameter: "pH",
    parameter_mr: "सामू (pH)",
    category: "chemical",
    category_name: "Soil Reaction & Salinity",
    category_name_mr: "जमिनीचा सामू व क्षारता",
    unit: "",
    range: "5.0–6.0",
    classification: "Acidic",
    classification_mr: "आम्लधर्मी",
    statusType: "warning",
    recommendation: "Monitor; lime if needed",
    recommendation_mr: "सामूवर लक्ष ठेवा; आवश्यक असल्यास चुना वापरा",
    ref: "R1",
  },
  {
    parameter: "pH",
    parameter_mr: "सामू (pH)",
    category: "chemical",
    category_name: "Soil Reaction & Salinity",
    category_name_mr: "जमिनीचा सामू व क्षारता",
    unit: "",
    range: "6.0–7.5",
    classification: "Suitable",
    classification_mr: "योग्य (अनुकूल)",
    statusType: "optimal",
    recommendation: "Maintain current pH",
    recommendation_mr: "सध्याचा सामू टिकवून ठेवा",
    ref: "R1",
  },
  {
    parameter: "pH",
    parameter_mr: "सामू (pH)",
    category: "chemical",
    category_name: "Soil Reaction & Salinity",
    category_name_mr: "जमिनीचा सामू व क्षारता",
    unit: "",
    range: "7.5–8.5",
    classification: "Alkaline",
    classification_mr: "विम्लधर्मी",
    statusType: "moderate",
    recommendation: "Monitor Fe/Zn",
    recommendation_mr: "लोह (Fe) व जस्त (Zn) उपलब्धतेवर लक्ष ठेवा",
    ref: "R1, R2",
  },
  {
    parameter: "pH",
    parameter_mr: "सामू (pH)",
    category: "chemical",
    category_name: "Soil Reaction & Salinity",
    category_name_mr: "जमिनीचा सामू व क्षारता",
    unit: "",
    range: ">8.5",
    classification: "Strongly alkaline",
    classification_mr: "अति विम्लधर्मी",
    statusType: "critical",
    recommendation: "Test soil; manage alkalinity",
    recommendation_mr: "माती परीक्षण करा; विम्लता व्यवस्थापन करा",
    ref: "R1",
  },

  // 2. EC
  {
    parameter: "EC",
    parameter_mr: "विद्युत वाहकता (EC)",
    category: "chemical",
    category_name: "Soil Reaction & Salinity",
    category_name_mr: "जमिनीचा सामू व क्षारता",
    unit: "dS/m",
    range: "<0.4",
    classification: "Non-saline",
    classification_mr: "अक्षारयुक्त",
    statusType: "optimal",
    recommendation: "No salinity action",
    recommendation_mr: "क्षार सुधारणेची गरज नाही",
    ref: "R1",
  },
  {
    parameter: "EC",
    parameter_mr: "विद्युत वाहकता (EC)",
    category: "chemical",
    category_name: "Soil Reaction & Salinity",
    category_name_mr: "जमिनीचा सामू व क्षारता",
    unit: "dS/m",
    range: "0.4–0.8",
    classification: "Slightly saline",
    classification_mr: "किंचित क्षारयुक्त",
    statusType: "moderate",
    recommendation: "Improve drainage; monitor",
    recommendation_mr: "पाण्याचा निचरा सुधारा; लक्ष ठेवा",
    ref: "R1",
  },
  {
    parameter: "EC",
    parameter_mr: "विद्युत वाहकता (EC)",
    category: "chemical",
    category_name: "Soil Reaction & Salinity",
    category_name_mr: "जमिनीचा सामू व क्षारता",
    unit: "dS/m",
    range: "0.8–1.6",
    classification: "Moderately saline",
    classification_mr: "मध्यम क्षारयुक्त",
    statusType: "warning",
    recommendation: "Manage salts and irrigation",
    recommendation_mr: "क्षार व सिंचन व्यवस्थापन करा",
    ref: "R1",
  },
  {
    parameter: "EC",
    parameter_mr: "विद्युत वाहकता (EC)",
    category: "chemical",
    category_name: "Soil Reaction & Salinity",
    category_name_mr: "जमिनीचा सामू व क्षारता",
    unit: "dS/m",
    range: ">1.6",
    classification: "Highly saline",
    classification_mr: "अति क्षारयुक्त",
    statusType: "critical",
    recommendation: "Soil/water testing needed",
    recommendation_mr: "माती व पाणी परीक्षण आवश्यक",
    ref: "R1",
  },

  // 3. OC
  {
    parameter: "OC",
    parameter_mr: "सेंद्रिय कर्ब (OC)",
    category: "chemical",
    category_name: "Organic Matter",
    category_name_mr: "सेंद्रिय घटक",
    unit: "%",
    range: "<0.5%",
    classification: "Low",
    classification_mr: "कमी",
    statusType: "critical",
    recommendation: "Add FYM/compost/residues",
    recommendation_mr: "शेणखत/कंपोस्ट/पीक अवशेष वापरा",
    ref: "R1",
  },
  {
    parameter: "OC",
    parameter_mr: "सेंद्रिय कर्ब (OC)",
    category: "chemical",
    category_name: "Organic Matter",
    category_name_mr: "सेंद्रिय घटक",
    unit: "%",
    range: "0.5–0.75%",
    classification: "Medium",
    classification_mr: "मध्यम",
    statusType: "moderate",
    recommendation: "Maintain organic matter",
    recommendation_mr: "सेंद्रिय घटक टिकवून ठेवा",
    ref: "R1",
  },
  {
    parameter: "OC",
    parameter_mr: "सेंद्रिय कर्ब (OC)",
    category: "chemical",
    category_name: "Organic Matter",
    category_name_mr: "सेंद्रिय घटक",
    unit: "%",
    range: ">0.75%",
    classification: "High",
    classification_mr: "जास्त",
    statusType: "optimal",
    recommendation: "Maintain; no extra OC needed",
    recommendation_mr: "पातळी टिकवा; अतिरिक्त कर्बाची गरज नाही",
    ref: "R1",
  },

  // 4. Nitrogen (N)
  {
    parameter: "N",
    parameter_mr: "उपलब्ध नत्र (N)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: "<280 kg/ha",
    classification: "Low",
    classification_mr: "कमी",
    statusType: "critical",
    recommendation: "Increase N; ~125% RDF*",
    recommendation_mr: "नत्र वाढवा; ~१२५% शिफारशीत मात्रा*",
    ref: "R1, R3",
  },
  {
    parameter: "N",
    parameter_mr: "उपलब्ध नत्र (N)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: "280–560",
    classification: "Medium",
    classification_mr: "मध्यम",
    statusType: "optimal",
    recommendation: "Normal RDF*",
    recommendation_mr: "सर्वसाधारण १००% शिफारशीत मात्रा*",
    ref: "R1, R3",
  },
  {
    parameter: "N",
    parameter_mr: "उपलब्ध नत्र (N)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: ">560",
    classification: "High",
    classification_mr: "जास्त",
    statusType: "warning",
    recommendation: "Reduce N; ~75% RDF*",
    recommendation_mr: "नत्र कमी करा; ~७५% शिफारशीत मात्रा*",
    ref: "R1, R3",
  },

  // 5. Phosphorus (P)
  {
    parameter: "P",
    parameter_mr: "उपलब्ध स्फुरद (P)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: "<10 kg/ha",
    classification: "Low",
    classification_mr: "कमी",
    statusType: "critical",
    recommendation: "Increase P; ~125% RDF*",
    recommendation_mr: "स्फुरद वाढवा; ~१२५% शिफारशीत मात्रा*",
    ref: "R1, R3",
  },
  {
    parameter: "P",
    parameter_mr: "उपलब्ध स्फुरद (P)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: "10–25",
    classification: "Medium",
    classification_mr: "मध्यम",
    statusType: "optimal",
    recommendation: "Normal RDF*",
    recommendation_mr: "सर्वसाधारण १००% शिफारशीत मात्रा*",
    ref: "R1, R3",
  },
  {
    parameter: "P",
    parameter_mr: "उपलब्ध स्फुरद (P)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: "25–50",
    classification: "High",
    classification_mr: "जास्त",
    statusType: "warning",
    recommendation: "Reduce P; ~75% RDF*",
    recommendation_mr: "स्फुरद कमी करा; ~७५% शिफारशीत मात्रा*",
    ref: "R1, R3",
  },
  {
    parameter: "P",
    parameter_mr: "उपलब्ध स्फुरद (P)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: ">50",
    classification: "Very high",
    classification_mr: "अति जास्त",
    statusType: "critical",
    recommendation: "Avoid P fertilizer",
    recommendation_mr: "स्फुरद खते देणे टाळा",
    ref: "R1",
  },

  // 6. Potassium (K)
  {
    parameter: "K",
    parameter_mr: "उपलब्ध पालाश (K)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: "<120 kg/ha",
    classification: "Low",
    classification_mr: "कमी",
    statusType: "critical",
    recommendation: "Increase K; ~125% RDF*",
    recommendation_mr: "पालाश वाढवा; ~१२५% शिफारशीत मात्रा*",
    ref: "R1, R3",
  },
  {
    parameter: "K",
    parameter_mr: "उपलब्ध पालाश (K)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: "120–280",
    classification: "Medium",
    classification_mr: "मध्यम",
    statusType: "optimal",
    recommendation: "Normal RDF*",
    recommendation_mr: "सर्वसाधारण १००% शिफारशीत मात्रा*",
    ref: "R1, R3",
  },
  {
    parameter: "K",
    parameter_mr: "उपलब्ध पालाश (K)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: "280–600",
    classification: "High",
    classification_mr: "जास्त",
    statusType: "warning",
    recommendation: "Reduce K; ~75% RDF*",
    recommendation_mr: "पालाश कमी करा; ~७५% शिफारशीत मात्रा*",
    ref: "R1, R3",
  },
  {
    parameter: "K",
    parameter_mr: "उपलब्ध पालाश (K)",
    category: "npk",
    category_name: "Primary Macronutrients (NPK)",
    category_name_mr: "मुख्य अन्नद्रव्ये (NPK)",
    unit: "kg/ha",
    range: ">600",
    classification: "Very high",
    classification_mr: "अति जास्त",
    statusType: "critical",
    recommendation: "Avoid K fertilizer",
    recommendation_mr: "पालाश खते देणे टाळा",
    ref: "R1",
  },

  // 7. Iron (Fe)
  {
    parameter: "Fe",
    parameter_mr: "उपलब्ध लोह (Fe)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "<2.5 mg/kg",
    classification: "Very deficient",
    classification_mr: "अति तीव्र कमतरता",
    statusType: "critical",
    recommendation: "Correct Fe deficiency",
    recommendation_mr: "लोहाची कमतरता त्वरित दूर करा",
    ref: "R2",
  },
  {
    parameter: "Fe",
    parameter_mr: "उपलब्ध लोह (Fe)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "2.5–4.5",
    classification: "Deficient",
    classification_mr: "कमतरता",
    statusType: "warning",
    recommendation: "Apply Fe if needed",
    recommendation_mr: "आवश्यकतेनुसार लोह खते वापरा",
    ref: "R1, R2",
  },
  {
    parameter: "Fe",
    parameter_mr: "उपलब्ध लोह (Fe)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "4.5–6.5",
    classification: "Marginal",
    classification_mr: "सीमांत",
    statusType: "moderate",
    recommendation: "Monitor Fe",
    recommendation_mr: "लोह उपलब्धतेवर लक्ष ठेवा",
    ref: "R2",
  },
  {
    parameter: "Fe",
    parameter_mr: "उपलब्ध लोह (Fe)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: ">6.5",
    classification: "Sufficient",
    classification_mr: "पुरेसे",
    statusType: "optimal",
    recommendation: "No Fe correction",
    recommendation_mr: "लोह दुरुस्तीची आवश्यकता नाही",
    ref: "R2",
  },

  // 8. Zinc (Zn)
  {
    parameter: "Zn",
    parameter_mr: "उपलब्ध जस्त (Zn)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "<0.3 mg/kg",
    classification: "Very deficient",
    classification_mr: "अति तीव्र कमतरता",
    statusType: "critical",
    recommendation: "Correct Zn deficiency",
    recommendation_mr: "जस्ताची कमतरता त्वरित दूर करा",
    ref: "R2",
  },
  {
    parameter: "Zn",
    parameter_mr: "उपलब्ध जस्त (Zn)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "0.3–0.6",
    classification: "Deficient",
    classification_mr: "कमतरता",
    statusType: "warning",
    recommendation: "Apply Zn if needed",
    recommendation_mr: "आवश्यकतेनुसार जस्त वापरा",
    ref: "R1, R2",
  },
  {
    parameter: "Zn",
    parameter_mr: "उपलब्ध जस्त (Zn)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "0.6–0.9",
    classification: "Marginal",
    classification_mr: "सीमांत",
    statusType: "moderate",
    recommendation: "Monitor Zn",
    recommendation_mr: "जस्त पातळीवर लक्ष ठेवा",
    ref: "R2",
  },
  {
    parameter: "Zn",
    parameter_mr: "उपलब्ध जस्त (Zn)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: ">0.9",
    classification: "Sufficient",
    classification_mr: "पुरेसे",
    statusType: "optimal",
    recommendation: "No Zn correction",
    recommendation_mr: "जस्त दुरुस्तीची आवश्यकता नाही",
    ref: "R2",
  },

  // 9. Sulphur (S)
  {
    parameter: "S",
    parameter_mr: "उपलब्ध गंधक (S)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "<15 mg/kg",
    classification: "Deficient",
    classification_mr: "कमतरता",
    statusType: "critical",
    recommendation: "Apply S as needed",
    recommendation_mr: "गरजेनुसार गंधक खते वापरा",
    ref: "R2",
  },
  {
    parameter: "S",
    parameter_mr: "उपलब्ध गंधक (S)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "15–22.5",
    classification: "Marginal",
    classification_mr: "सीमांत",
    statusType: "moderate",
    recommendation: "Monitor S",
    recommendation_mr: "गंधक पातळीवर लक्ष ठेवा",
    ref: "R2",
  },
  {
    parameter: "S",
    parameter_mr: "उपलब्ध गंधक (S)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: ">22.5",
    classification: "Sufficient",
    classification_mr: "पुरेसे",
    statusType: "optimal",
    recommendation: "Maintain S",
    recommendation_mr: "गंधक पातळी टिकवून ठेवा",
    ref: "R2",
  },

  // 10. Boron (B)
  {
    parameter: "B",
    parameter_mr: "उपलब्ध बोरॉन (B)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "<0.5 mg/kg",
    classification: "Deficient",
    classification_mr: "कमतरता",
    statusType: "critical",
    recommendation: "Apply B carefully",
    recommendation_mr: "काळजीपूर्वक बोरॉनचा वापर करा",
    ref: "R2",
  },
  {
    parameter: "B",
    parameter_mr: "उपलब्ध बोरॉन (B)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "0.5–0.7",
    classification: "Marginal",
    classification_mr: "सीमांत",
    statusType: "moderate",
    recommendation: "Monitor B",
    recommendation_mr: "बोरॉन पातळीवर लक्ष ठेवा",
    ref: "R2",
  },
  {
    parameter: "B",
    parameter_mr: "उपलब्ध बोरॉन (B)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: ">0.7",
    classification: "Sufficient",
    classification_mr: "पुरेसे",
    statusType: "optimal",
    recommendation: "No B correction",
    recommendation_mr: "बोरॉन दुरुस्तीची आवश्यकता नाही",
    ref: "R2",
  },

  // 11. Copper (Cu)
  {
    parameter: "Cu",
    parameter_mr: "उपलब्ध तांबे (Cu)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "<0.4 mg/kg",
    classification: "Deficient",
    classification_mr: "कमतरता",
    statusType: "critical",
    recommendation: "Apply Cu if needed",
    recommendation_mr: "आवश्यकतेनुसार तांबे वापरा",
    ref: "R2",
  },
  {
    parameter: "Cu",
    parameter_mr: "उपलब्ध तांबे (Cu)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "0.4–0.6",
    classification: "Marginal",
    classification_mr: "सीमांत",
    statusType: "moderate",
    recommendation: "Monitor Cu",
    recommendation_mr: "तांबे पातळीवर लक्ष ठेवा",
    ref: "R2",
  },
  {
    parameter: "Cu",
    parameter_mr: "उपलब्ध तांबे (Cu)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: ">0.6",
    classification: "Sufficient",
    classification_mr: "पुरेसे",
    statusType: "optimal",
    recommendation: "No Cu correction",
    recommendation_mr: "तांबे दुरुस्तीची आवश्यकता नाही",
    ref: "R2",
  },

  // 12. Manganese (Mn)
  {
    parameter: "Mn",
    parameter_mr: "उपलब्ध मँगनीज (Mn)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "<3 mg/kg",
    classification: "Deficient",
    classification_mr: "कमतरता",
    statusType: "critical",
    recommendation: "Apply Mn if needed",
    recommendation_mr: "आवश्यकतेनुसार मँगनीज वापरा",
    ref: "R2",
  },
  {
    parameter: "Mn",
    parameter_mr: "उपलब्ध मँगनीज (Mn)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: "3–5",
    classification: "Marginal",
    classification_mr: "सीमांत",
    statusType: "moderate",
    recommendation: "Monitor Mn",
    recommendation_mr: "मँगनीज पातळीवर लक्ष ठेवा",
    ref: "R2",
  },
  {
    parameter: "Mn",
    parameter_mr: "उपलब्ध मँगनीज (Mn)",
    category: "micronutrients",
    category_name: "Micronutrients & Secondary",
    category_name_mr: "सूक्ष्म व दुय्यम अन्नद्रव्ये",
    unit: "mg/kg",
    range: ">5",
    classification: "Sufficient",
    classification_mr: "पुरेसे",
    statusType: "optimal",
    recommendation: "No Mn correction",
    recommendation_mr: "मँगनीज दुरुस्तीची आवश्यकता नाही",
    ref: "R2",
  },
];

interface SoilReferenceStandardsTableProps {
  embedded?: boolean;
}

export const SoilReferenceStandardsTable: React.FC<SoilReferenceStandardsTableProps> = ({
  embedded = false,
}) => {
  const { locale } = useI18n();
  const isMr = locale === "mr";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredData = useMemo(() => {
    return SOIL_REFERENCE_STANDARDS.filter((row) => {
      const matchesCategory =
        selectedCategory === "all" || row.category === selectedCategory;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;

      const pMatches =
        row.parameter.toLowerCase().includes(q) ||
        row.parameter_mr.toLowerCase().includes(q) ||
        row.classification.toLowerCase().includes(q) ||
        row.classification_mr.toLowerCase().includes(q) ||
        row.recommendation.toLowerCase().includes(q) ||
        row.recommendation_mr.toLowerCase().includes(q) ||
        row.ref.toLowerCase().includes(q);

      return matchesCategory && pMatches;
    });
  }, [searchQuery, selectedCategory]);

  const getBadge = (statusType: string, text: string) => {
    switch (statusType) {
      case "optimal":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            {text}
          </span>
        );
      case "moderate":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
            {text}
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            {text}
          </span>
        );
      case "critical":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
            {text}
          </span>
        );
    }
  };

  const getRefBadge = (ref: string) => {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-100 text-stone-700 border border-stone-300">
        {ref}
      </span>
    );
  };

  return (
    <div className={`space-y-4 ${embedded ? "" : "bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-card"}`}>
      {/* Table Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-soil-primary" />
            <h3 className="text-base font-black text-stone-900">
              {isMr
                ? "माती घटक संदर्भ श्रेणी, वर्गीकरण व शिफारस मानके"
                : "Soil Parameter Diagnostic Norms & Recommendation Standards"}
            </h3>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            {isMr
              ? "शासकीय मृदा आरोग्य पत्रिका (SHC) आणि भारतीय सूक्ष्म अन्नद्रव्य संशोधन (२,४२,८२७ नमुने) मानकांवर आधारित अधिकृत वर्गीकरण."
              : "Official scientific benchmarks derived from Govt. Soil Health Card (SHC) scheme & Indian Micronutrient Research (242,827 soil samples across 615 districts)."}
          </p>
        </div>

        {/* Categories / Count pill */}
        <div className="flex items-center gap-1.5 self-start md:self-auto">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-soil-primaryLight text-soil-primary border border-soil-primary/20">
            {filteredData.length} {isMr ? "मानक नोंदी" : "Benchmark Rules"}
          </span>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors shrink-0 ${
              selectedCategory === "all"
                ? "bg-soil-primary text-white shadow-xs"
                : "bg-white text-stone-700 hover:bg-stone-200/70 border border-stone-200"
            }`}
          >
            {isMr ? "सर्व घटक (१२)" : "All Parameters (12)"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("chemical")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors shrink-0 ${
              selectedCategory === "chemical"
                ? "bg-soil-primary text-white shadow-xs"
                : "bg-white text-stone-700 hover:bg-stone-200/70 border border-stone-200"
            }`}
          >
            {isMr ? "सामू, क्षारता व कर्ब" : "pH, EC & OC"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("npk")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors shrink-0 ${
              selectedCategory === "npk"
                ? "bg-soil-primary text-white shadow-xs"
                : "bg-white text-stone-700 hover:bg-stone-200/70 border border-stone-200"
            }`}
          >
            {isMr ? "मुख्य अन्नद्रव्ये (N-P-K)" : "Macronutrients (N-P-K)"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("micronutrients")}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors shrink-0 ${
              selectedCategory === "micronutrients"
                ? "bg-soil-primary text-white shadow-xs"
                : "bg-white text-stone-700 hover:bg-stone-200/70 border border-stone-200"
            }`}
          >
            {isMr ? "सूक्ष्म व दुय्यम (Fe, Zn, S, B, Cu, Mn)" : "Micronutrients (Fe, Zn, S, B, Cu, Mn)"}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isMr ? "घटक किंवा शिफारस शोधा..." : "Search parameter or rule..."}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-soil-primary"
          />
        </div>
      </div>

      {/* The Master Table */}
      <div className="overflow-x-auto rounded-xl border border-stone-800 bg-white shadow-xs">
        <table className="w-full text-left text-xs border-collapse min-w-[720px]">
          <thead className="bg-stone-800 text-white uppercase text-[11px] tracking-wider font-sans">
            <tr>
              <th className="py-2.5 px-3 border-r border-stone-700 w-24">
                {isMr ? "घटक (Parameter)" : "Parameter"}
              </th>
              <th className="py-2.5 px-3 border-r border-stone-700 w-32">
                {isMr ? "मर्यादा (Range)" : "Range"}
              </th>
              <th className="py-2.5 px-3 border-r border-stone-700 w-36">
                {isMr ? "वर्गीकरण (Classification)" : "Classification"}
              </th>
              <th className="py-2.5 px-3 border-r border-stone-700">
                {isMr ? "थोडक्यात शिफारस (Short recommendation)" : "Short recommendation"}
              </th>
              <th className="py-2.5 px-3 w-16 text-center">
                {isMr ? "संदर्भ" : "Ref."}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-300 font-sans">
            {filteredData.length > 0 ? (
              filteredData.map((row, idx) => {
                // Check if this row is the start of a parameter group
                const isFirstOfParam =
                  idx === 0 || filteredData[idx - 1].parameter !== row.parameter;

                return (
                  <tr
                    key={`${row.parameter}-${row.range}-${idx}`}
                    className={
                      idx % 2 === 0
                        ? "bg-white hover:bg-stone-50/90"
                        : "bg-stone-50/50 hover:bg-stone-100/70"
                    }
                  >
                    <td className="py-2.5 px-3 border-r border-stone-300 font-bold text-stone-900 align-top">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-stone-950 font-mono">
                          {row.parameter}
                        </span>
                        <span className="text-[10.5px] text-stone-500 font-medium">
                          {isMr ? row.parameter_mr : (row.unit ? `(${row.unit})` : "")}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-r border-stone-300 font-mono font-bold text-stone-800 align-middle">
                      {row.range}
                    </td>
                    <td className="py-2.5 px-3 border-r border-stone-300 align-middle">
                      {getBadge(
                        row.statusType,
                        isMr ? row.classification_mr : row.classification
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-r border-stone-300 text-stone-900 font-medium leading-relaxed align-middle">
                      {isMr ? row.recommendation_mr : row.recommendation}
                    </td>
                    <td className="py-2.5 px-3 text-center align-middle">
                      {getRefBadge(row.ref)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-500">
                  {isMr ? "कोणतेही जुळणारे मानक सापडले नाही." : "No matching benchmark standards found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Scientific Footnotes & Citations */}
      <div className="bg-soil-cream/40 rounded-xl border border-soil-secondary/30 p-4 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-stone-800 text-[11.5px]">
          <Info className="w-4 h-4 text-soil-primary shrink-0" />
          <span>{isMr ? "अधिकृत वैज्ञानिक संदर्भ व संज्ञा:" : "Authoritative Scientific Citations & Notes:"}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-stone-700 pt-1">
          <div className="p-2.5 bg-white/80 rounded-lg border border-soil-secondary/20">
            <span className="font-bold font-mono text-soil-primary block">
              {isMr ? "[R1] मृदा आरोग्य पत्रिका (SHC)" : "[R1] Soil Health Card (SHC)"}
            </span>
            <p className="mt-0.5 text-stone-600">
              {isMr
                ? "केंद्रीय कृषी मंत्रालय, भारत सरकार मृदा आरोग्य पत्रिका मार्गदर्शक मानके."
                : "Ministry of Agriculture & Farmers Welfare, Government of India Soil Health Card Standards."}
            </p>
          </div>
          <div className="p-2.5 bg-white/80 rounded-lg border border-soil-secondary/20">
            <span className="font-bold font-mono text-soil-primary block">
              {isMr ? "[R2] भारतीय संशोधन (२,४२,८२७ माती नमुने)" : "[R2] Indian Research (242,827 Soils)"}
            </span>
            <p className="mt-0.5 text-stone-600">
              {isMr
                ? "शुक्ला आणि इतर, ६१५ जिल्ह्यांतील २,४२,८२७ माती नमुन्यांचे सूक्ष्म अन्नद्रव्य विश्लेषण (ICAR-IISS)."
                : "Shukla et al., 242,827 soil samples across 615 Indian districts (ICAR-IISS Micronutrient Project)."}
            </p>
          </div>
          <div className="p-2.5 bg-white/80 rounded-lg border border-soil-secondary/20">
            <span className="font-bold font-mono text-soil-primary block">
              {isMr ? "[R3] STCR व म.फु.कृ.वि. राहुरी मानके" : "[R3] STCR & MPKV Rahuri Framework"}
            </span>
            <p className="mt-0.5 text-stone-600">
              {isMr
                ? "महात्मा फुले कृषी विद्यापीठ, राहुरी STCR-IPNS खत समीकरणे (*RDF = शिफारशीत खत मात्रा)."
                : "MPKV Rahuri STCR-IPNS Equations for Maharashtra Vertisols (*RDF = Recommended Dose of Fertilizers)."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
