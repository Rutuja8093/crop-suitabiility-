"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { soilHealthService } from "@/services/soilHealthService";
import { SoilHealthReport } from "@/types/soilHealth";
import { KML_AVAILABLE_GATS } from "@/types/gat";
import {
  SoilComposition,
  validateSoilComposition,
  classifyUSDA,
  USDAClassKey,
} from "@/lib/soilTexture/soilTextureClassification";
import {
  USDA_CLASS_METADATA,
  SAMPLE_SOIL_PRESETS,
  SoilPreset,
} from "@/lib/soilTexture/soilTextureData";
import {
  extractTextureParametersFromReport,
  processSoilTextureIntegration,
  IntegratedSoilTextureResult,
  ExtractedTextureParameters,
} from "@/lib/soilTexture/soilTextureIntegration";
import { SoilTextureTriangle } from "./SoilTextureTriangle";
import {
  Layers,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileBadge,
  Info,
  Droplets,
  Scale,
  Compass,
  ArrowRight,
  Sliders,
  RefreshCw,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
  FlaskConical,
  HelpCircle,
} from "lucide-react";

export const SoilTextureCalculator: React.FC = () => {
  const { t, language } = useI18n();
  const { field, farmer, location, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const isMr = language === "mr";

  // URL query params
  const urlGat = searchParams?.get("gat");

  // SSR-safe Gat resolution: deterministic on both server and initial client render
  const [selectedGat, setSelectedGat] = useState<string>(() => {
    const validGats: string[] = [...KML_AVAILABLE_GATS];
    if (urlGat && validGats.includes(urlGat.replace(/[^\d]/g, ""))) {
      return urlGat.replace(/[^\d]/g, "");
    }
    const fieldGat = field?.gat_no?.replace(/[^\d]/g, "");
    if (fieldGat && validGats.includes(fieldGat)) return fieldGat;
    return "18";
  });

  const [hasMounted, setHasMounted] = useState<boolean>(false);

  // Mode: "field" (official Soil Health Card data) or "simulation" (user modified)
  const [activeMode, setActiveMode] = useState<"field" | "simulation">("field");

  // Field Report Data State
  const [report, setReport] = useState<SoilHealthReport | null>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(true);
  const [reportError, setReportError] = useState<string | null>(null);

  // Input states (strings for responsive numeric typing & sliders)
  const [sandInput, setSandInput] = useState<string>("32.2");
  const [siltInput, setSiltInput] = useState<string>("29.1");
  const [clayInput, setClayInput] = useState<string>("38.7");

  // Visualization options
  const [showGuideLines, setShowGuideLines] = useState<boolean>(true);
  const [showClassLabels, setShowClassLabels] = useState<boolean>(true);
  const [useFineEarthNormalized, setUseFineEarthNormalized] = useState<boolean>(true);

  // Status feedback message
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "warning" | "info";
    text: string;
  } | null>(null);

  // Sync selectedGat with URL or auth and localStorage after mount (hydration safe)
  useEffect(() => {
    setHasMounted(true);
    const validGats: string[] = [...KML_AVAILABLE_GATS];
    if (urlGat) {
      const clean = urlGat.replace(/[^\d]/g, "");
      if (clean && clean !== selectedGat && validGats.includes(clean)) {
        setSelectedGat(clean);
        try {
          localStorage.setItem("soilpilot_selected_gat", clean);
        } catch (_) {}
      }
    } else {
      try {
        const stored = localStorage.getItem("soilpilot_selected_gat");
        if (stored) {
          const clean = stored.replace(/[^\d]/g, "");
          if (clean && clean !== selectedGat && validGats.includes(clean)) {
            setSelectedGat(clean);
          }
        }
      } catch (_) {}
    }
  }, [urlGat]);

  // Fetch official Soil Health Card for the active Gat
  const fetchFieldReport = useCallback(
    async (gatToFetch: string) => {
      try {
        setLoadingReport(true);
        setReportError(null);
        const activeFieldId = `demo-field-gat-${gatToFetch}`;
        const data = await soilHealthService.getFieldReport(activeFieldId);
        setReport(data);

        // Process data through integration layer
        const extracted = extractTextureParametersFromReport(data);
        const result = processSoilTextureIntegration(extracted);

        if (result.status === "valid" && result.activeComposition) {
          setSandInput(String(result.activeComposition.sand));
          setSiltInput(String(result.activeComposition.silt));
          setClayInput(String(result.activeComposition.clay));
          setActiveMode("field");
          setFeedbackMessage({
            type: "success",
            text: isMr
              ? `गट क्र. ${gatToFetch} चे मृदा आरोग्य पत्रक डेटा लोड केले (${extracted.sourceType})`
              : `Loaded official Soil Health Card data for Gat #${gatToFetch} (${extracted.sourceType})`,
          });
        } else if (result.status === "warning_tolerance" && result.normalizedFineEarthComposition) {
          setSandInput(String(result.normalizedFineEarthComposition.sand));
          setSiltInput(String(result.normalizedFineEarthComposition.silt));
          setClayInput(String(result.normalizedFineEarthComposition.clay));
          setActiveMode("field");
          setFeedbackMessage({
            type: "warning",
            text: isMr
              ? `गट क्र. ${gatToFetch} ची माती माहिती लोड केली: मूळ बेरीज ${result.rawComposition.total}% होती, सूक्ष्म-माती प्रमाण १००% वर दर्शविले आहे.`
              : `Loaded Gat #${gatToFetch}: Raw sum was ${result.rawComposition.total}%. Fine-earth fraction (<2mm) normalized to 100% for USDA classification.`,
          });
        } else if (result.status === "incomplete") {
          setActiveMode("field");
          setFeedbackMessage({
            type: "warning",
            text: isMr
              ? `गट क्र. ${gatToFetch} साठी वाळू, गाळ किंवा चिकणमाती माहिती अपूर्ण आहे.`
              : `Sand, silt, or clay parameters are incomplete for Gat #${gatToFetch}.`,
          });
        }
      } catch (err: any) {
        console.error("Failed to load Soil Health Card data:", err);
        setReportError(
          isMr
            ? "मृदा आरोग्य पत्रक माहिती लोड करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा."
            : "Could not load Soil Health Card data. Please check connection and retry."
        );
      } finally {
        setLoadingReport(false);
      }
    },
    [isMr]
  );

  useEffect(() => {
    if (!authLoading) {
      fetchFieldReport(selectedGat);
    }
  }, [selectedGat, authLoading, fetchFieldReport]);

  // Handle changing Gat
  const handleGatChange = (newGat: string) => {
    setSelectedGat(newGat);
    if (typeof window !== "undefined") {
      localStorage.setItem("soilpilot_selected_gat", newGat);
    }
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set("gat", newGat);
    router.replace(`/soil-texture?${currentParams.toString()}`);
  };

  // Integration analysis of the current report
  const integrationResult: IntegratedSoilTextureResult | null = useMemo(() => {
    if (!report) return null;
    const extracted = extractTextureParametersFromReport(report);
    return processSoilTextureIntegration(extracted);
  }, [report]);

  // Numeric parsing of current inputs
  const numericComposition: SoilComposition = useMemo(() => {
    return {
      sand: parseFloat(sandInput) || 0,
      silt: parseFloat(siltInput) || 0,
      clay: parseFloat(clayInput) || 0,
    };
  }, [sandInput, siltInput, clayInput]);

  // Validation of current inputs
  const validation = useMemo(() => {
    return validateSoilComposition({
      sand: sandInput,
      silt: siltInput,
      clay: clayInput,
    });
  }, [sandInput, siltInput, clayInput]);

  // Classification of current inputs
  const classification = useMemo(() => {
    if (!validation.isValid) return null;
    return classifyUSDA(numericComposition);
  }, [validation.isValid, numericComposition]);

  const activeMetadata = useMemo(() => {
    if (!classification) return null;
    return USDA_CLASS_METADATA[classification.classKey];
  }, [classification]);

  // Handle triangle interactive clicks/taps
  const handleTriangleSelect = useCallback(
    (newComp: SoilComposition) => {
      setSandInput(String(newComp.sand));
      setSiltInput(String(newComp.silt));
      setClayInput(String(newComp.clay));
      setActiveMode("simulation");
      setFeedbackMessage({
        type: "info",
        text: isMr
          ? "त्रिकोण नकाशावरून बिंदू निवडला (सिम्युलेशन मोड)"
          : "Point selected from triangle diagram (Simulation Mode)",
      });
    },
    [isMr]
  );

  // Apply benchmark preset
  const applyPreset = (preset: SoilPreset) => {
    setSandInput(String(preset.sand));
    setSiltInput(String(preset.silt));
    setClayInput(String(preset.clay));
    setActiveMode("simulation");
    setFeedbackMessage({
      type: "info",
      text: isMr
        ? `मानक नमुना लोड केला: ${preset.nameMr}`
        : `Loaded standard benchmark: ${preset.nameEn}`,
    });
  };

  // Auto-balance remaining to 100%
  const handleAutoBalance = () => {
    const s = parseFloat(sandInput) || 0;
    const c = parseFloat(clayInput) || 0;
    const remaining = Math.max(0, Math.min(100, Number((100 - s - c).toFixed(2))));
    setSiltInput(String(remaining));
  };

  // Re-sync with Field Soil Health Card
  const handleSyncFieldData = () => {
    fetchFieldReport(selectedGat);
  };

  const extractedParams: ExtractedTextureParameters | null = integrationResult?.extractedParams || null;

  return (
    <div className="space-y-6">
      {/* 1. Top Header Banner & Field Selector */}
      <div className="bg-white rounded-2xl border border-surface-border p-5 sm:p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-soil-primary text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-text-main tracking-tight">
                  {t("soilTexture.title") || "Soil Texture Calculator"}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-soil-cream text-soil-primary border border-soil-secondary/30 uppercase">
                  USDA System
                </span>
              </div>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                {t("soilTexture.subtitle") ||
                  "Interactive USDA Soil Texture Triangle connected directly to Soil Health Card data."}
              </p>
            </div>
          </div>
        </div>

        {/* Gat Selector & Sync Action */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Field Gat Selector Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-subtle border border-surface-border text-xs">
            <MapPin className="w-3.5 h-3.5 text-soil-primary" />
            <span className="font-bold text-text-muted">{isMr ? "गट क्र." : "Gat:"}</span>
            <select
              value={selectedGat}
              onChange={(e) => handleGatChange(e.target.value)}
              className="bg-transparent font-black text-text-main focus:outline-hidden cursor-pointer"
              aria-label="Select Gat Number"
            >
              {KML_AVAILABLE_GATS.map((g) => (
                <option key={g} value={g}>
                  {g} {g === "18" ? "(Reference Demo)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSyncFieldData}
            disabled={loadingReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-soil-primaryLight text-soil-primary text-xs font-bold border border-soil-primary/20 hover:bg-soil-primary hover:text-white transition-all shadow-2xs disabled:opacity-50"
            title="Reload official Soil Health Card values for this Gat"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? "animate-spin" : ""}`} />
            <span suppressHydrationWarning>
              {isMr ? `मृदा कार्ड सिंक करा (गट ${selectedGat})` : `Sync Card Data (Gat #${selectedGat})`}
            </span>
          </button>

          <Link
            href={`/soil-health-card?gat=${selectedGat}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-muted text-text-muted text-xs font-semibold border border-surface-border hover:bg-surface-border transition-colors"
            title="View full Soil Health Card"
          >
            <FileBadge className="w-3.5 h-3.5 text-soil-primary" />
            <span suppressHydrationWarning>{isMr ? "आरोग्य पत्रक पहा" : "View Card"}</span>
          </Link>
        </div>
      </div>

      {/* 2. Compact Data Source Transparency Section (Section 9 of Master Prompt) */}
      <div className="bg-white rounded-2xl border border-surface-border p-4 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-surface-border pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
              {isMr ? "माती माहिती व स्त्रोत पारदर्शकता" : "Soil Health Card Data Provenance & Matching"}
            </h2>
          </div>

          {/* Mode Pill */}
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                activeMode === "field"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-amber-50 text-amber-800 border-amber-300"
              }`}
            >
              {activeMode === "field"
                ? isMr
                  ? "शेतकऱ्याचे अधिकृत मृदा कार्ड डेटा"
                  : "Field Soil Health Card Data"
                : isMr
                ? "मॅन्युअल / सिम्युलेशन मोड"
                : "Manual Simulation Point"}
            </span>

            {extractedParams?.isDemo && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-300">
                VERIFIED TEST RECORD
              </span>
            )}
          </div>
        </div>

        {/* Provenance Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-3 text-xs">
          {/* Gat Identifier */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-text-muted uppercase block">
              {isMr ? "गट / सर्व्हे क्र." : "Gat Number"}
            </span>
            <span className="font-mono font-bold text-text-main text-sm">
              #{selectedGat}
            </span>
          </div>

          {/* Village & Region */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-text-muted uppercase block">
              {isMr ? "गाव व तालुका" : "Village & Taluka"}
            </span>
            <span className="font-semibold text-text-main truncate block" title={extractedParams?.village || "Malegaon Kh."}>
              {extractedParams?.village || "Malegaon Kh."}, Baramati
            </span>
          </div>

          {/* Farmer Name */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-text-muted uppercase block">
              {isMr ? "शेतकरी" : "Farmer"}
            </span>
            <span className="font-semibold text-text-main truncate block" title={extractedParams?.farmerName || "Farmer"}>
              {extractedParams?.farmerName || "Ramesh Patil"}
            </span>
          </div>

          {/* Depth Interval */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-text-muted uppercase block">
              {isMr ? "मातीचा थर / खोली" : "Soil Depth"}
            </span>
            <span className="font-semibold text-text-main block">
              {extractedParams?.depthInterval || "0–30 cm Root Zone"}
            </span>
          </div>

          {/* Data Provenance */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-text-muted uppercase block">
              {isMr ? "स्त्रोत प्रकार" : "Source Provenance"}
            </span>
            <span
              className={`font-bold inline-block px-1.5 py-0.2 rounded text-[11px] ${
                extractedParams?.sourceType === "LABORATORY TEST"
                  ? "bg-purple-100 text-purple-800"
                  : extractedParams?.sourceType === "DERIVED VALUE"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {extractedParams?.sourceType || "DSM PREDICTION"}
            </span>
          </div>

          {/* Classification Standard */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-text-muted uppercase block">
              {isMr ? "वर्गीकरण मानक" : "Standard"}
            </span>
            <span className="font-semibold text-text-main block" title="USDA-NRCS Soil Survey Manual Standard">
              USDA-NRCS (12 Classes)
            </span>
          </div>
        </div>

        {/* Detailed Provenance Explanation */}
        {extractedParams && (
          <div className="mt-3 pt-2 border-t border-surface-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-soil-primary shrink-0" />
              <span>
                <strong>{isMr ? "स्त्रोत:" : "Source:"}</strong> {extractedParams.sourceLabel}
                {extractedParams.reportNo ? ` (Report #${extractedParams.reportNo})` : ""}
              </span>
            </div>

            {extractedParams.sampleDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-text-light" />
                <span>
                  {isMr ? "दिनांक:" : "Date:"} {extractedParams.sampleDate}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Feedback / Status Banner */}
      {feedbackMessage && (
        <div
          className={`flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xs border ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : feedbackMessage.type === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedbackMessage.type === "warning" ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>

          {activeMode === "simulation" && (
            <button
              type="button"
              onClick={handleSyncFieldData}
              className="text-[11px] underline font-bold hover:text-black shrink-0"
            >
              {isMr ? "कार्ड मूल्यांवर परत जा" : "Re-sync to Field Card"}
            </button>
          )}
        </div>
      )}

      {/* Incomplete Parameters Message (Requirement 4) */}
      {integrationResult?.status === "incomplete" && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-rose-900">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Sand, silt, and clay data are incomplete for this soil sample. The soil texture cannot be calculated yet.</span>
          </div>
          <p className="text-xs text-rose-700">
            Missing parameters: <strong>{integrationResult.extractedParams.missingParameters.join(", ")}</strong>.
            Please verify the laboratory test record for Gat #{selectedGat}.
          </p>
          <div className="pt-1 flex items-center gap-2">
            <Link
              href={`/soil-health-card?gat=${selectedGat}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors"
            >
              <FileBadge className="w-3.5 h-3.5" />
              <span>View Available Soil Health Card Data</span>
            </Link>
          </div>
        </div>
      )}

      {/* 4. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Input Controls & Result Card (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* A. Inputs Panel */}
          <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-card space-y-5">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-soil-primary" />
                <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">
                  {t("soilTexture.inputsTitle") || "Particle Size Fractions"}
                </h2>
              </div>

              {/* Source Tag for Inputs */}
              <span className="text-[11px] font-mono font-bold text-text-muted">
                {activeMode === "field" ? "Card Values" : "Simulation"}
              </span>
            </div>

            {/* Numeric Inputs with Range Sliders */}
            <div className="space-y-4">
              {/* 1. Sand Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="sand-input" className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
                    <span>{t("soilTexture.sand") || "Sand"}</span>
                    <span className="text-[11px] text-text-muted font-normal">(0.05 – 2.0 mm)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="sand-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={sandInput}
                      onChange={(e) => {
                        setSandInput(e.target.value);
                        setActiveMode("simulation");
                      }}
                      className="w-16 px-2 py-1 text-right text-xs font-mono font-bold border border-surface-border rounded-lg bg-surface-subtle focus:outline-hidden focus:border-soil-primary focus:ring-1 focus:ring-soil-primary"
                    />
                    <span className="text-xs font-mono text-text-muted">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={parseFloat(sandInput) || 0}
                  onChange={(e) => {
                    setSandInput(e.target.value);
                    setActiveMode("simulation");
                  }}
                  className="w-full h-1.5 bg-surface-border rounded-lg appearance-none cursor-pointer accent-soil-primary"
                  aria-label="Sand percentage slider"
                />
              </div>

              {/* 2. Silt Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="silt-input" className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
                    <span>{t("soilTexture.silt") || "Silt"}</span>
                    <span className="text-[11px] text-text-muted font-normal">(0.002 – 0.05 mm)</span>
                    {extractedParams?.isSiltDerived && activeMode === "field" && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                        Derived
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="silt-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={siltInput}
                      onChange={(e) => {
                        setSiltInput(e.target.value);
                        setActiveMode("simulation");
                      }}
                      className="w-16 px-2 py-1 text-right text-xs font-mono font-bold border border-surface-border rounded-lg bg-surface-subtle focus:outline-hidden focus:border-soil-primary focus:ring-1 focus:ring-soil-primary"
                    />
                    <span className="text-xs font-mono text-text-muted">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={parseFloat(siltInput) || 0}
                  onChange={(e) => {
                    setSiltInput(e.target.value);
                    setActiveMode("simulation");
                  }}
                  className="w-full h-1.5 bg-surface-border rounded-lg appearance-none cursor-pointer accent-sky-600"
                  aria-label="Silt percentage slider"
                />
              </div>

              {/* 3. Clay Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="clay-input" className="text-xs font-bold text-text-main flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-800 inline-block" />
                    <span>{t("soilTexture.clay") || "Clay"}</span>
                    <span className="text-[11px] text-text-muted font-normal">(&lt; 0.002 mm)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="clay-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={clayInput}
                      onChange={(e) => {
                        setClayInput(e.target.value);
                        setActiveMode("simulation");
                      }}
                      className="w-16 px-2 py-1 text-right text-xs font-mono font-bold border border-surface-border rounded-lg bg-surface-subtle focus:outline-hidden focus:border-soil-primary focus:ring-1 focus:ring-soil-primary"
                    />
                    <span className="text-xs font-mono text-text-muted">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={parseFloat(clayInput) || 0}
                  onChange={(e) => {
                    setClayInput(e.target.value);
                    setActiveMode("simulation");
                  }}
                  className="w-full h-1.5 bg-surface-border rounded-lg appearance-none cursor-pointer accent-amber-800"
                  aria-label="Clay percentage slider"
                />
              </div>
            </div>

            {/* Total Percentage Status Bar */}
            <div className="pt-2 border-t border-surface-border space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-text-muted">
                  {t("soilTexture.total") || "Total Composition"}:
                </span>
                <span
                  className={`font-black text-sm px-2 py-0.5 rounded-md ${
                    validation.isValid
                      ? "text-emerald-800 bg-emerald-100 border border-emerald-300"
                      : "text-rose-800 bg-rose-100 border border-rose-300"
                  }`}
                >
                  {validation.total}%
                </span>
              </div>

              {/* Progress representation */}
              <div className="w-full h-2 rounded-full bg-surface-muted overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(100, Math.max(0, numericComposition.sand))}%` }}
                  className="bg-amber-600 transition-all duration-300"
                  title={`Sand: ${numericComposition.sand}%`}
                />
                <div
                  style={{ width: `${Math.min(100, Math.max(0, numericComposition.silt))}%` }}
                  className="bg-sky-600 transition-all duration-300"
                  title={`Silt: ${numericComposition.silt}%`}
                />
                <div
                  style={{ width: `${Math.min(100, Math.max(0, numericComposition.clay))}%` }}
                  className="bg-amber-800 transition-all duration-300"
                  title={`Clay: ${numericComposition.clay}%`}
                />
              </div>

              {/* Validation Feedback Messages */}
              {!validation.isValid ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      {t("soilTexture.mustEqual100") || "Percentages must total exactly 100%"}
                    </span>
                  </div>
                  <ul className="text-[11px] text-rose-700 list-disc list-inside space-y-0.5">
                    {validation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={handleAutoBalance}
                    className="mt-1 text-[11px] font-bold text-soil-primary hover:underline flex items-center gap-1"
                  >
                    <Scale className="w-3 h-3" />
                    <span>{t("soilTexture.balance") || "Auto-balance remaining to 100%"}</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200 font-medium">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t("soilTexture.validTotal") || "Valid Composition (Sums to 100%)"}</span>
                  </div>
                  <span className="font-mono font-bold">100.0%</span>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div className="pt-2 border-t border-surface-border">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">
                {t("soilTexture.presets") || "Reference Soil Presets"}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_SOIL_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-surface-muted border border-surface-border hover:bg-soil-primaryLight hover:text-soil-primary hover:border-soil-secondary/40 transition-colors"
                  >
                    {isMr ? preset.nameMr : preset.nameEn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* B. Live Classification Result Card */}
          {validation.isValid && classification && activeMetadata ? (
            <div className="bg-white rounded-2xl border border-surface-border p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-soil-primary" />
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {t("soilTexture.resultTitle") || "Classified Soil Texture"}
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-soil-cream text-soil-primary border border-soil-secondary/30">
                  {t("soilTexture.badge") || "USDA Classification"}
                </span>
              </div>

              {/* Big Prominent Class Name Header */}
              <div
                className="p-4 rounded-xl border flex items-center justify-between gap-3 shadow-2xs"
                style={{
                  backgroundColor: `${activeMetadata.colorHex}30`,
                  borderColor: activeMetadata.colorBorder,
                }}
              >
                <div>
                  <h4
                    className="text-xl sm:text-2xl font-black tracking-tight"
                    style={{ color: activeMetadata.colorDarkHex }}
                  >
                    {isMr ? activeMetadata.nameMr : activeMetadata.nameEn}
                  </h4>
                  <p className="text-xs font-semibold text-text-muted mt-0.5">
                    {activeMetadata.abbreviation} &bull; {activeMetadata.typicalRange}
                  </p>
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-base shadow-xs shrink-0"
                  style={{ backgroundColor: activeMetadata.colorDarkHex }}
                >
                  {activeMetadata.abbreviation}
                </div>
              </div>

              {/* Proportions Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-surface-subtle border border-surface-border">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">
                    {t("soilTexture.sand") || "Sand"}
                  </span>
                  <span className="text-base font-black font-mono text-text-main">
                    {numericComposition.sand}%
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-subtle border border-surface-border">
                  <span className="text-[10px] font-bold text-sky-800 uppercase block">
                    {t("soilTexture.silt") || "Silt"}
                  </span>
                  <span className="text-base font-black font-mono text-text-main">
                    {numericComposition.silt}%
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-surface-subtle border border-surface-border">
                  <span className="text-[10px] font-bold text-amber-900 uppercase block">
                    {t("soilTexture.clay") || "Clay"}
                  </span>
                  <span className="text-base font-black font-mono text-text-main">
                    {numericComposition.clay}%
                  </span>
                </div>
              </div>

              {/* Scientific Description */}
              <div className="p-3 bg-surface-subtle rounded-xl border border-surface-border space-y-1.5 text-xs text-text-main leading-relaxed">
                <p className="font-medium">
                  {isMr ? activeMetadata.descriptionMr : activeMetadata.descriptionEn}
                </p>
              </div>

              {/* Agricultural Properties & Management */}
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-surface-muted rounded-xl border border-surface-border space-y-1">
                    <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                      <Droplets className="w-3 h-3 text-sky-600" />
                      <span>{t("soilTexture.drainage") || "Drainage Speed"}</span>
                    </span>
                    <span className="font-bold text-text-main block">
                      {activeMetadata.drainageRate}
                    </span>
                  </div>
                  <div className="p-2.5 bg-surface-muted rounded-xl border border-surface-border space-y-1">
                    <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                      <Scale className="w-3 h-3 text-soil-primary" />
                      <span>{t("soilTexture.waterCapacity") || "Water Storage"}</span>
                    </span>
                    <span className="font-bold text-text-main block">
                      {activeMetadata.waterHoldingCapacity}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-soil-primaryLight/40 rounded-xl border border-soil-secondary/30 space-y-1 text-xs text-text-main">
                  <span className="font-bold text-soil-primary block text-[11px] uppercase tracking-wide">
                    {t("soilTexture.management") || "Agricultural Management Guidance"}
                  </span>
                  <p className="leading-relaxed">
                    {isMr ? activeMetadata.managementMr : activeMetadata.managementEn}
                  </p>
                </div>
              </div>

              {/* Data Source & Depth Tag */}
              <div className="pt-2 border-t border-surface-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-text-light shrink-0" />
                  <span className="font-medium truncate max-w-[240px]">
                    {activeMode === "field"
                      ? `${extractedParams?.sourceType || "Soil Health Card"} (Gat #${selectedGat})`
                      : "Manual User Simulation"}
                  </span>
                </div>
                <span className="font-semibold text-text-main bg-surface-muted px-2 py-0.5 rounded-md border border-surface-border">
                  {extractedParams?.depthInterval || "0–30 cm Root Zone"}
                </span>
              </div>

              {/* Direct Link to Soil Health Card */}
              <div className="pt-1">
                <Link
                  href={`/soil-health-card?gat=${selectedGat}`}
                  className="w-full py-2.5 px-3 rounded-xl bg-soil-primary text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-soil-primaryHover transition-colors shadow-2xs"
                >
                  <FileBadge className="w-4 h-4" />
                  <span>
                    {isMr
                      ? `गट क्र. ${selectedGat} चे संपूर्ण मृदा आरोग्य पत्रक पहा`
                      : `View Official Soil Health Card for Gat #${selectedGat}`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-surface-border p-6 shadow-card text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-text-main">
                {t("soilTexture.mustEqual100") || "Percentages must sum to 100% to classify"}
              </h4>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                {isMr
                  ? "कृपया डावीकडील मूल्ये तपासा किंवा त्रिकोणावर कुठेही क्लिक करून योग्य माती नमुना निवडा."
                  : "Check the values on the left or tap anywhere inside the interactive triangle on the right to select a valid sample point."}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive USDA Soil Texture Triangle & Legend (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Instructions banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-soil-primaryLight/50 rounded-xl border border-soil-secondary/30 text-xs text-text-main">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-soil-primary shrink-0" />
              <span className="font-semibold">
                {t("soilTexture.clickPrompt") ||
                  "Click or tap anywhere inside the triangle to inspect soil texture, or adjust the sliders on the left."}
              </span>
            </div>

            {/* Toggle Buttons */}
            <div className="flex items-center gap-2 text-[11px] ml-auto">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-text-muted hover:text-text-main">
                <input
                  type="checkbox"
                  checked={showGuideLines}
                  onChange={(e) => setShowGuideLines(e.target.checked)}
                  className="rounded text-soil-primary focus:ring-soil-primary"
                />
                <span>{t("soilTexture.showGuideLines") || "Guidelines"}</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-text-muted hover:text-text-main">
                <input
                  type="checkbox"
                  checked={showClassLabels}
                  onChange={(e) => setShowClassLabels(e.target.checked)}
                  className="rounded text-soil-primary focus:ring-soil-primary"
                />
                <span>{t("soilTexture.showLabels") || "Labels"}</span>
              </label>
            </div>
          </div>

          {/* Triangle Vector Visualization Component */}
          <SoilTextureTriangle
            composition={numericComposition}
            isValidComposition={validation.isValid}
            activeClassKey={classification?.classKey}
            onSelectComposition={handleTriangleSelect}
            showGuideLines={showGuideLines}
            showClassLabels={showClassLabels}
            language={language}
          />

          {/* Interactive Class Legend (12 USDA Classes) */}
          <div className="bg-white rounded-2xl border border-surface-border p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-surface-border pb-2">
              <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
                {t("soilTexture.legendTitle") || "USDA Soil Texture Classes (12 Classes)"}
              </h4>
              <span className="text-[10px] text-text-muted font-mono">12 Classes</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Object.values(USDA_CLASS_METADATA).map((meta) => {
                const isActive = classification?.classKey === meta.key;
                return (
                  <div
                    key={meta.key}
                    onClick={() => {
                      if (meta.key === "clay") handleTriangleSelect({ sand: 20, silt: 20, clay: 60 });
                      else if (meta.key === "silty_clay") handleTriangleSelect({ sand: 10, silt: 45, clay: 45 });
                      else if (meta.key === "sandy_clay") handleTriangleSelect({ sand: 50, silt: 10, clay: 40 });
                      else if (meta.key === "clay_loam") handleTriangleSelect({ sand: 35, silt: 30, clay: 35 });
                      else if (meta.key === "silty_clay_loam") handleTriangleSelect({ sand: 15, silt: 55, clay: 30 });
                      else if (meta.key === "sandy_clay_loam") handleTriangleSelect({ sand: 60, silt: 15, clay: 25 });
                      else if (meta.key === "loam") handleTriangleSelect({ sand: 40, silt: 40, clay: 20 });
                      else if (meta.key === "silt_loam") handleTriangleSelect({ sand: 20, silt: 65, clay: 15 });
                      else if (meta.key === "silt") handleTriangleSelect({ sand: 5, silt: 85, clay: 10 });
                      else if (meta.key === "sandy_loam") handleTriangleSelect({ sand: 65, silt: 25, clay: 10 });
                      else if (meta.key === "loamy_sand") handleTriangleSelect({ sand: 80, silt: 15, clay: 5 });
                      else if (meta.key === "sand") handleTriangleSelect({ sand: 92, silt: 5, clay: 3 });
                    }}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                      isActive
                        ? "bg-soil-primary text-white border-soil-primary shadow-xs font-bold"
                        : "bg-surface-subtle text-text-main border-surface-border hover:bg-surface-muted"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: meta.colorHex }}
                    />
                    <span className="truncate">{isMr ? meta.nameMr : meta.nameEn}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
