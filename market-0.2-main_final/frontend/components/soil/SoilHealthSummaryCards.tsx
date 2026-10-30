"use client";

import React from "react";
import { useI18n } from "@/i18n/useI18n";
import { SoilParameter } from "@/types/soilHealth";
import { Activity, Droplets, Leaf, Zap, Shield, Sparkles } from "lucide-react";

interface SoilHealthSummaryCardsProps {
  parameters: SoilParameter[];
}

export const SoilHealthSummaryCards: React.FC<SoilHealthSummaryCardsProps> = ({ parameters }) => {
  const { t, locale } = useI18n();

  const getParam = (key: string) => {
    return parameters.find((p) => p.key === key);
  };

  const phParam = getParam("ph");
  const ecParam = getParam("ec");
  const ocParam = getParam("organic_carbon");
  const nParam = getParam("available_nitrogen");
  const pParam = getParam("available_phosphorus");
  const kParam = getParam("available_potassium");

  const cards = [
    {
      title: locale === "mr" ? "मातीचा सामू (pH)" : "Soil pH",
      value: phParam?.value !== null && phParam?.value !== undefined ? phParam.value : "N/A",
      unit: "",
      status: locale === "mr" ? phParam?.interpretation_mr || "विम्लधर्मी" : phParam?.interpretation || "Alkaline",
      description: locale === "mr" 
        ? "माती किंचित विम्लधर्मी आहे. सूक्ष्म अन्नद्रव्यांची उपलब्धता योग्य राखण्यासाठी शेणखत किंवा सेंद्रिय खतांचा वापर वाढवा." 
        : "Soil pH is moderately alkaline. Organic matter application will maintain ideal micronutrient uptake.",
      icon: <Activity className="w-5 h-5 text-amber-600" />,
      bgClass: "bg-amber-50/60 border-amber-200",
      statusClass: "bg-amber-100 text-amber-800 border-amber-300",
    },
    {
      title: locale === "mr" ? "विद्युत वाहकता (EC)" : "Electrical Conductivity",
      value: ecParam?.value !== null && ecParam?.value !== undefined ? ecParam.value : "N/A",
      unit: "dS/m",
      status: locale === "mr" ? ecParam?.interpretation_mr || "सुरक्षित" : ecParam?.interpretation || "Normal",
      description: locale === "mr" 
        ? "मातीतील क्षारांचे प्रमाण सर्वसाधारण व सुरक्षित आहे. जमिनीमध्ये क्षारतेची कोणतीही समस्या नाही." 
        : "Soil salinity is well within the safe normal limit. No immediate salt toxicity risks for crops.",
      icon: <Zap className="w-5 h-5 text-emerald-600" />,
      bgClass: "bg-emerald-50/60 border-emerald-200",
      statusClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    },
    {
      title: locale === "mr" ? "सेंद्रिय कर्ब (OC)" : "Organic Carbon",
      value: ocParam?.value !== null && ocParam?.value !== undefined ? `${ocParam.value}%` : "N/A",
      unit: "%",
      status: locale === "mr" ? ocParam?.interpretation_mr || "अति जास्त" : ocParam?.interpretation || "Very High",
      description: locale === "mr" 
        ? "सेंद्रिय कर्बाचे प्रमाण अतिशय उत्तम (> ०.८०%) आहे. यामुळे जमिनीची ओलावा टिकवून ठेवण्याची क्षमता उत्कृष्ट राहते." 
        : "Organic carbon is very high (> 0.80%), providing rich soil biological activity and superior moisture retention.",
      icon: <Leaf className="w-5 h-5 text-soil-primary" />,
      bgClass: "bg-soil-cream/60 border-soil-secondary/30",
      statusClass: "bg-soil-primaryLight text-soil-primary border-soil-primary/20",
    },
    {
      title: locale === "mr" ? "उपलब्ध नत्र (N)" : "Available Nitrogen",
      value: nParam?.value !== null && nParam?.value !== undefined ? `${nParam.value}` : "N/A",
      unit: "kg/ha",
      status: locale === "mr" ? nParam?.interpretation_mr || "कमी" : nParam?.interpretation || "Low",
      description: locale === "mr" 
        ? "मातीतील नत्राचे प्रमाण कमी (< २८० किलो/हे.) आहे. पिकांच्या वाढीनुसार युरिया/नत्र खते हप्त्यांमध्ये विभागून द्यावीत." 
        : "Available nitrogen is low (< 280 kg/ha). Split applications of nitrogen or green manuring are recommended.",
      icon: <Droplets className="w-5 h-5 text-rose-600" />,
      bgClass: "bg-rose-50/60 border-rose-200",
      statusClass: "bg-rose-100 text-rose-800 border-rose-300",
    },
    {
      title: locale === "mr" ? "उपलब्ध स्फुरद (P)" : "Available Phosphorus",
      value: pParam?.value !== null && pParam?.value !== undefined ? `${pParam.value}` : "N/A",
      unit: "kg/ha",
      status: locale === "mr" ? pParam?.interpretation_mr || "मध्यम" : pParam?.interpretation || "Medium",
      description: locale === "mr" 
        ? "स्फुरदाचे प्रमाण मध्यम आहे. मुळांच्या सुदृढ वाढीसाठी शिफारसीनुसार डीएपी किंवा एसएसपी खतांचा संतुलित वापर करा." 
        : "Phosphorus is at a medium level (14–28 kg/ha). Balanced phosphatic fertilization will support strong root growth.",
      icon: <Sparkles className="w-5 h-5 text-amber-600" />,
      bgClass: "bg-amber-50/60 border-amber-200",
      statusClass: "bg-amber-100 text-amber-800 border-amber-300",
    },
    {
      title: locale === "mr" ? "उपलब्ध पालाश (K)" : "Available Potassium",
      value: kParam?.value !== null && kParam?.value !== undefined ? `${kParam.value}` : "N/A",
      unit: "kg/ha",
      status: locale === "mr" ? kParam?.interpretation_mr || "अति जास्त" : kParam?.interpretation || "Very High",
      description: locale === "mr" 
        ? "मातीतील पालाश अति जास्त (> ३०० किलो/हे.) आहे. बेसल डोसमध्ये म्युरिएट ऑफ पोटॅशची (MOP) बचत केली जाऊ शकते." 
        : "Soil potassium is abundant (> 300 kg/ha). Basal potash doses can be optimized to save input costs.",
      icon: <Shield className="w-5 h-5 text-emerald-600" />,
      bgClass: "bg-emerald-50/60 border-emerald-200",
      statusClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    },
  ];

  return (
    <div className="space-y-4 mb-8">
      <div>
        <h3 className="text-base font-bold text-stone-900">
          {t("soilHealthCard.summaryTitle")}
        </h3>
        <p className="text-xs text-stone-600">
          {t("soilHealthCard.summarySubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl border ${card.bgClass} flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-stone-800">{card.title}</span>
                <div className="p-1.5 rounded-lg bg-white shadow-2xs">
                  {card.icon}
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-stone-900 font-mono">
                  {card.value}
                </span>
                {card.unit && (
                  <span className="text-xs font-semibold text-stone-500 font-mono">
                    {card.unit}
                  </span>
                )}
                <span
                  className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${card.statusClass}`}
                >
                  {card.status}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-700 mt-3 pt-2.5 border-t border-stone-200/80 leading-relaxed">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
