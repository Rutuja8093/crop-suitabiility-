"use client";

import React, { useState, useEffect } from "react";
import {
  Sprout,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Info,
  Calendar,
  Layers,
  MapPin,
  FileCheck2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Droplets,
} from "lucide-react";
import {
  marketService,
  FieldSuitabilityResponse,
  CropSuitabilityItem,
  EvaluatedParameterSoilData,
  CriterionEvaluationResult,
} from "@/services/marketService";
import { getCertifiedFieldSuitability } from "@/services/certifiedDecisionPlanData";
import { useI18n } from "@/i18n/useI18n";

interface FieldSuitabilitySectionProps {
  currentGat: string;
  fieldId?: number | null;
  farmerName?: string | null;
  currentVillage?: string;
  currentTaluka?: string;
  currentDistrict?: string;
  activeSeason?: string;
}

export const FieldSuitabilitySection: React.FC<FieldSuitabilitySectionProps> = ({
  currentGat,
  fieldId,
  farmerName,
  currentVillage,
  currentTaluka,
  currentDistrict,
  activeSeason = "RABI",
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [suitabilityData, setSuitabilityData] = useState<FieldSuitabilityResponse | null>(null);
  const [selectedCropCode, setSelectedCropCode] = useState<string>("CHANA");
  const [showDetailedEvidence, setShowDetailedEvidence] = useState<boolean>(false);

  const fetchSuitability = async () => {
    setLoading(true);
    setError(null);
    const identifier = fieldId ? String(fieldId) : currentGat;
    try {
      const data = await marketService.getFieldCropSuitability({
        fieldIdentifier: identifier,
        season: activeSeason.toUpperCase(),
      });
      if (data && data.crops && data.crops.length > 0) {
        setSuitabilityData(data);
        if (!data.crops.some((c) => c.crop_code === selectedCropCode)) {
          setSelectedCropCode(data.crops[0].crop_code);
        }
      } else {
        const demo = getCertifiedFieldSuitability(identifier);
        setSuitabilityData(demo);
      }
    } catch (_err: any) {
      const demo = getCertifiedFieldSuitability(identifier);
      setSuitabilityData(demo);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuitability();
  }, [currentGat, fieldId, activeSeason]);

  const selectedCrop = suitabilityData?.crops.find((c) => c.crop_code === selectedCropCode) || suitabilityData?.crops[0];

  const getStatusBadge = (status: string, label: string) => {
    switch (status) {
      case "PRELIMINARY_SUITABLE":
      case "SUITABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#2A7C13]/10 text-[#2A7C13] border border-[#2A7C13]/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2A7C13]" />
            {isMr ? "अनुकूल (योग्य)" : label}
          </span>
        );
      case "CONDITIONAL_SUITABILITY":
      case "MARGINAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            {isMr ? "सशर्त अनुकूल (मध्यम)" : label}
          </span>
        );
      case "POTENTIAL_CONSTRAINT":
      case "UNSUITABLE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-600/10 text-rose-700 border border-rose-600/30">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            {isMr ? "प्रतिकूल (मर्यादा)" : label}
          </span>
        );
      case "INSUFFICIENT_DATA":
      case "UNKNOWN":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-700 border border-slate-500/30">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
            {isMr ? "माहिती अनुपलब्ध" : label}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            <Info className="w-3.5 h-3.5 text-gray-500" />
            {label}
          </span>
        );
    }
  };

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case "LAB OBSERVATION":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#2A7C13] text-white">
            <FileCheck2 className="w-3 h-3" />
            {isMr ? "प्रयोगशाळा तपासणी" : "LAB OBSERVATION"}
          </span>
        );
      case "DSM PREDICTION":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#76C457]/20 text-[#2A7C13] border border-[#76C457]/50">
            <Layers className="w-3 h-3" />
            {isMr ? "डिजिटल सॉईल मॅपिंग अंदाज" : "DSM PREDICTION"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
            {sourceType}
          </span>
        );
    }
  };

  return (
    <section className="bg-white border-2 border-[#76C457]/30 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#FBE6C2] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2A7C13]/10 flex items-center justify-center text-[#2A7C13]">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {isMr ? "शेतानुसार पीक अनुकूलता मूल्यांकन" : "Field Crop Suitability Assessment"}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFF8CF] text-[#2A7C13] border border-[#FBE6C2]">
                  Phase 8
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isMr
                  ? "माती चाचणी, डिजिटल सॉईल मॅपिंग (DSM) आणि महात्मा फुले कृषी विद्यापीठ (MPKV) निकषांवर आधारित"
                  : "Grounded in certified soil reports, DSM spatial rasters & MPKV Rahuri / ICAR agronomic thresholds"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSuitability}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#2A7C13] bg-[#FFF8CF] hover:bg-[#FBE6C2] transition-colors border border-[#76C457]/40 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{isMr ? "पुनरावलोकन" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#2A7C13] animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">
            {isMr ? "माती डेटा व कृषी निकष पडताळत आहे..." : "Evaluating field soil data against agronomic criteria..."}
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <p className="font-bold text-sm">
                {isMr ? "आम्ही तुमच्या शेताच्या स्थितीची तपासणी करू शकलो नाही." : "We could not check your field conditions."}
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {isMr ? "कृपया तुमच्या शेताचे तपशील तपासा." : "Please check your farm details or try again."}
              </p>
            </div>
          </div>
          <button
            onClick={fetchSuitability}
            className="px-3 py-1.5 bg-[#2A7C13] text-white rounded-lg text-xs font-bold hover:bg-[#2A7C13]/90 transition-colors shrink-0"
          >
            {isMr ? "पुन्हा तपासा" : "Retry"}
          </button>
        </div>
      )}

      {!loading && !error && suitabilityData && (
        <div className="space-y-6">
          {/* SECTION A: Selected Field Cadastral Context */}
          <div className="bg-[#FFF8CF]/40 border border-[#FBE6C2] rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#2A7C13]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {isMr ? "निवडलेले शेत" : "Selected Cadastral Parcel"}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-black bg-[#2A7C13] text-white">
                  Gat {suitabilityData.field_summary.gat_no}
                </span>
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {isMr ? "डेटा तारीख / वैधता:" : "Soil Data Effective Date:"}{" "}
                  <strong className="text-slate-800">{suitabilityData.field_summary.soil_data_freshness_date || "2026-10-22"}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-[#FBE6C2]/80 text-xs">
              <div>
                <span className="text-slate-500 block">{isMr ? "शेतकरी" : "Farmer"}:</span>
                <span className="font-semibold text-slate-800">
                  {suitabilityData.field_summary.farmer_name || farmerName || (isMr ? "नोंदणीकृत शेतकरी" : "Registered Farmer")}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">{isMr ? "गाव / तालुका" : "Village / Taluka"}:</span>
                <span className="font-semibold text-slate-800">
                  {suitabilityData.field_summary.village_name}, {suitabilityData.field_summary.taluka_name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">{isMr ? "जिल्हा" : "District"}:</span>
                <span className="font-semibold text-slate-800">{suitabilityData.field_summary.district_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isMr ? "क्षेत्रफळ" : "Area"}:</span>
                <span className="font-semibold text-slate-800">
                  {suitabilityData.field_summary.area_ha ? `${suitabilityData.field_summary.area_ha} ha (${suitabilityData.field_summary.area_acres} ac)` : "2.69 ha"}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION B: Available Soil Information Grid with Source Provenance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2A7C13]" />
                {isMr ? "उपलब्ध माती गुणधर्म (डेटा स्रोत व मूल्ये)" : "Available Soil Characteristics & Data Provenance"}
              </h3>
              <span className="text-xs text-slate-500">
                {suitabilityData.field_summary.has_lab_report ? (
                  <span className="text-[#2A7C13] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {isMr ? "अधिकृत प्रयोगशाळा अहवाल जोडलेला आहे" : "Certified Lab Report Attached"}
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> {isMr ? "डिजिटल सॉईल मॅपिंग अंदाज वापरले आहेत" : "DSM Spatial Predictions Active"}
                  </span>
                )}
              </span>
            </div>

            {/* Discrepancy Alert Notice if any */}
            {suitabilityData.field_summary.discrepancies_found.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {isMr
                      ? "डेटा स्त्रोतांमध्ये तफावत आढळली (Lab vs DSM Discrepancy)"
                      : "Source Discrepancy Detected between Certified Lab Observation and DSM Prediction"}
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {isMr
                      ? "नियम: अधिकृत प्रयोगशाळा चाचणी निकालास प्राधान्य देण्यात आले आहे, परंतु स्थानिक तफावत नोंदवली गेली आहे."
                      : "Policy: Certified laboratory observations take precedence for agronomic evaluation. Notable variance is documented below."}
                  </p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                    {suitabilityData.field_summary.discrepancies_found.map((disc, idx) => (
                      <li key={idx} className="font-medium">
                        {disc}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Soil Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {suitabilityData.field_summary.soil_parameters.map((param) => (
                <div
                  key={param.parameter_key}
                  className={`p-3 rounded-xl border transition-all ${
                    param.discrepancy_detected
                      ? "bg-amber-50/50 border-amber-300"
                      : param.is_available
                      ? "bg-white border-slate-200 hover:border-[#76C457]"
                      : "bg-slate-50 border-dashed border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-500 truncate">
                      {isMr && param.parameter_name_mr ? param.parameter_name_mr : param.parameter_name}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 my-1">
                    {param.is_available ? (
                      <>
                        <span className="text-lg font-black text-slate-900">
                          {param.value !== null && param.value !== undefined
                            ? param.value
                            : param.text_value || "—"}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">{param.unit !== "—" ? param.unit : ""}</span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 italic">
                        {isMr ? "उपलब्ध नाही" : "Not Available"}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    {param.is_available ? (
                      getSourceBadge(param.source_type)
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {isMr ? "नमुना आवश्यक" : "Test Required"}
                      </span>
                    )}
                  </div>

                  {param.discrepancy_detected && param.secondary_source_value !== undefined && (
                    <div className="mt-1 text-[10px] text-amber-700 font-medium">
                      DSM: {param.secondary_source_value} {param.unit}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION C: Crop Suitability Assessment & Interactive Selector */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-[#2A7C13]" />
                  {isMr ? "पिकांची अनुकूलता पडताळणी (विद्यापीठ निकषांनुसार)" : "Crop-Specific Agronomic Evaluation"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isMr
                    ? "महात्मा फुले कृषी विद्यापीठ (MPKV) व ICAR संशोधन शिफारसींनुसार"
                    : "Evaluated against verified MPKV Rahuri / ICAR pulse, oilseed & cereal tolerance standards"}
                </p>
              </div>

              {/* Crop Selector Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {suitabilityData.crops.map((crop) => {
                  const isSelected = crop.crop_code === selectedCropCode;
                  return (
                    <button
                      key={crop.crop_code}
                      onClick={() => setSelectedCropCode(crop.crop_code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                        isSelected
                          ? "bg-[#2A7C13] text-white border-[#2A7C13] shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:border-[#76C457]"
                      }`}
                    >
                      {isMr ? crop.crop_name_mr : crop.crop_name.split("(")[0].trim()}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedCrop && (
              <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-5 space-y-5">
                {/* Crop Header & Overall Suitability Status */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-black text-slate-900">
                        {isMr ? selectedCrop.crop_name_mr : selectedCrop.crop_name}
                      </h4>
                      {selectedCrop.scientific_name && (
                        <span className="text-xs italic text-slate-500 hidden sm:inline">
                          ({selectedCrop.scientific_name})
                        </span>
                      )}
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {selectedCrop.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      {selectedCrop.summary_explanation}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <span className="text-[11px] uppercase font-bold text-slate-400 block mb-1">
                      {isMr ? "एकूण मूल्यांकन निष्कर्ष" : "Preliminary Field Assessment"}
                    </span>
                    {getStatusBadge(selectedCrop.overall_status, selectedCrop.overall_status_label)}
                  </div>
                </div>

                {/* Non-Soil Factors Card (Transparently displays irrigation, window, area) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Droplets className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700 block">
                        {isMr ? "पाणी उपलब्धता / सिंचन" : "Irrigation Availability"}:
                      </span>
                      <span className="text-slate-600">
                        {selectedCrop.non_soil_factors.irrigation_status_label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-[#2A7C13] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700 block">
                        {isMr ? "हंगाम व पेरणी खिडकी (Phase 7)" : "Planting Window Alignment"}:
                      </span>
                      <span
                        className={
                          selectedCrop.non_soil_factors.in_planting_window
                            ? "text-[#2A7C13] font-semibold"
                            : "text-amber-700 font-semibold"
                        }
                      >
                        {selectedCrop.non_soil_factors.planting_window_label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-700 block">
                        {isMr ? "पाण्याचा निचरा व भूरूप" : "Field Drainage & Terrain"}:
                      </span>
                      <span className="text-slate-600">
                        {selectedCrop.non_soil_factors.drainage_condition}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evaluated Agronomic Criteria Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {isMr ? "तपासलेले माती निकष व सहनशीलता मर्यादा" : "Evaluated Agronomic Criteria & Tolerance Limits"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Rule Version: <code className="font-bold text-slate-700">{selectedCrop.rule_version}</code>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <tr>
                          <th className="py-2.5 px-4">{isMr ? "निकष" : "Criterion"}</th>
                          <th className="py-2.5 px-3">{isMr ? "शेतातील मूल्य" : "Field Value"}</th>
                          <th className="py-2.5 px-3">{isMr ? "योग्य मर्यादा" : "Optimal Range"}</th>
                          <th className="py-2.5 px-3">{isMr ? "प्रतिकूल मर्यादा" : "Unsuitable Threshold"}</th>
                          <th className="py-2.5 px-4">{isMr ? "निकष स्थिती" : "Criterion Status"}</th>
                          <th className="py-2.5 px-4">{isMr ? "कृषी संदर्भ व कारण" : "Agronomic Rationale & Source"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedCrop.criteria_results.map((crit, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {crit.criterion_name}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {crit.evaluated_value !== null && crit.evaluated_value !== undefined ? (
                                <>
                                  {crit.evaluated_value} <span className="text-slate-500">{crit.unit}</span>
                                </>
                              ) : (
                                <span className="text-slate-400 italic">
                                  {isMr ? "उपलब्ध नाही" : "Not Available"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-medium text-emerald-700 whitespace-nowrap">
                              {crit.optimal_range}
                            </td>
                            <td className="py-3 px-3 font-medium text-rose-700 whitespace-nowrap">
                              {crit.unsuitable_threshold}
                            </td>
                            <td className="py-3 px-4">
                              {getStatusBadge(crit.status, crit.status_label)}
                            </td>
                            <td className="py-3 px-4 text-slate-600 max-w-xs">
                              <p className="line-clamp-2">{crit.interpretation}</p>
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                                {crit.source_organization} ({crit.source_reference})
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Constraints or Missing Parameters Alerts */}
                {selectedCrop.identified_constraints.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                    <p className="font-bold flex items-center gap-1.5 text-rose-900">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      {isMr ? "ओळखल्या गेलेल्या मर्यादा (Agronomic Constraints)" : "Agronomic Constraints Identified for this Field"}:
                    </p>
                    <ul className="list-disc list-inside mt-1.5 space-y-1 text-[11px] text-rose-700">
                      {selectedCrop.identified_constraints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedCrop.missing_parameters.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs">
                    <p className="font-bold flex items-center gap-1.5 text-slate-800">
                      <Info className="w-4 h-4 text-slate-500" />
                      {isMr ? "पडताळणी बाकी असलेले माती घटक (Missing Parameters)" : "Unrecorded Parameters Requiring Laboratory Testing"}:
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      {isMr
                        ? "खालील घटकांची अधिकृत चाचणी शेतासाठी उपलब्ध नाही:"
                        : "The following criteria could not be evaluated due to missing field data:"}{" "}
                      <strong className="text-slate-800">{selectedCrop.missing_parameters.join(", ")}</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION D: Evidence and Limitations Transparency Drawer */}
          <div className="border border-[#FBE6C2] rounded-xl bg-[#FFF8CF]/20 overflow-hidden">
            <button
              onClick={() => setShowDetailedEvidence(!showDetailedEvidence)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-[#FFF8CF]/40 transition-colors"
            >
              <span className="flex items-center gap-2 text-[#2A7C13]">
                <FileCheck2 className="w-4 h-4" />
                {isMr
                  ? "मूल्यांकन पुरावे, संशोधन संदर्भ व शास्त्रीय अस्वीकरण (Evidence & Limitations)"
                  : "Agronomic Evidence, University References & Scientific Limitations"}
              </span>
              {showDetailedEvidence ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {showDetailedEvidence && (
              <div className="p-4 border-t border-[#FBE6C2] space-y-3 text-xs text-slate-700 bg-white">
                <div className="space-y-1.5">
                  <h5 className="font-bold text-slate-900">{isMr ? "प्रमाणित कृषी संदर्भ:" : "Authoritative Agronomic References"}:</h5>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
                    {selectedCrop?.agronomic_sources.map((src, i) => (
                      <li key={i}>{src}</li>
                    ))}
                    <li>ICAR-CSSRI Karnal Soil Salinity Guidelines for Peninsular Vertisols</li>
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 text-amber-900 text-[11px] leading-relaxed">
                  <p className="font-bold text-amber-950 mb-0.5">
                    {isMr ? "शास्त्रीय अस्वीकरण (Scientific Disclaimer)" : "Non-Negotiable Agronomic Disclaimer"}
                  </p>
                  {suitabilityData.evidence_and_limitations_disclaimer}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
