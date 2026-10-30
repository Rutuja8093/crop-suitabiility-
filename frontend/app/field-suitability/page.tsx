"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import {
  cropSuitabilityService,
  CropItem,
  CropAllGatsResponse,
  GatSuitabilityResponse,
} from "@/services/cropSuitabilityService";
import {
  Sprout,
  Download,
  RefreshCw,
  Compass,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

// Dynamically import Leaflet Map to avoid SSR window errors
const CropSuitabilityMap = dynamic(
  () => import("@/components/map/CropSuitabilityMap").then((m) => m.CropSuitabilityMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[520px] bg-surface-subtle flex flex-col items-center justify-center rounded-2xl border border-surface-border animate-pulse text-text-muted">
        <Compass className="w-8 h-8 animate-spin text-soil-primary mb-2" />
        <span className="text-sm font-semibold">Loading GIS Suitability Map...</span>
      </div>
    ),
  }
);

export default function FieldSuitabilityPage() {
  const { language } = useI18n();
  const searchParams = useSearchParams();
  const { field: authField, farmer: authFarmer, isAuthenticated } = useAuth();

  // Determine user's active Gat: Use logged in user's Gat first, fallback to search param or Gat 1
  const userGatNo = useMemo(() => {
    if (authField?.gat_no) return String(authField.gat_no).trim();
    const queryGat = searchParams?.get("gat");
    if (queryGat) return queryGat.trim();
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("soilpilot_selected_gat");
      if (stored) return stored.trim();
    }
    return "1";
  }, [authField, searchParams]);

  // State
  const [crops, setCrops] = useState<CropItem[]>([]);
  const [selectedCropCode, setSelectedCropCode] = useState<string>("sugarcane");
  const [selectedGatNo, setSelectedGatNo] = useState<string>(userGatNo);
  const irrigationAvailable = true;

  // Sync selectedGatNo with user's authenticated Gat
  useEffect(() => {
    if (userGatNo) {
      setSelectedGatNo(userGatNo);
    }
  }, [userGatNo]);

  // Data states
  const [cropSummary, setCropSummary] = useState<CropAllGatsResponse | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [gatDetail, setGatDetail] = useState<GatSuitabilityResponse | null>(null);

  // UI state
  const [loadingMap, setLoadingMap] = useState<boolean>(true);
  const [loadingGat, setLoadingGat] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"criteria" | "comparison">("criteria");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // 1. Initial Load: Crops list
  useEffect(() => {
    cropSuitabilityService.getCrops().then((cList) => {
      setCrops(cList);
      if (cList.length > 0 && !selectedCropCode) {
        setSelectedCropCode(cList[0].crop_code);
      }
    });
  }, []);

  // 2. Load Crop Data & GeoJSON when selected crop or irrigation changes
  useEffect(() => {
    if (!selectedCropCode) return;
    setLoadingMap(true);

    Promise.all([
      cropSuitabilityService.getCropAllGats(selectedCropCode, irrigationAvailable),
      cropSuitabilityService.getCropGeoJSON(selectedCropCode, irrigationAvailable),
    ])
      .then(([summary, geojson]) => {
        setCropSummary(summary);
        setGeoJsonData(geojson);
      })
      .finally(() => setLoadingMap(false));
  }, [selectedCropCode, irrigationAvailable]);

  // 3. Load Gat Suitability Details for logged-in Gat
  useEffect(() => {
    if (!selectedGatNo) {
      setGatDetail(null);
      return;
    }
    setLoadingGat(true);
    cropSuitabilityService
      .getGatSuitability(selectedGatNo, irrigationAvailable)
      .then((data) => setGatDetail(data))
      .catch(() => setGatDetail(null))
      .finally(() => setLoadingGat(false));
  }, [selectedGatNo, irrigationAvailable]);

  // Active Crop Object
  const activeCrop = useMemo(() => {
    return crops.find((c) => c.crop_code === selectedCropCode);
  }, [crops, selectedCropCode]);

  // Active Gat Evaluation for selected crop
  const activeGatEvaluation = useMemo(() => {
    if (!gatDetail) return null;
    return gatDetail.evaluations.find((e) => e.crop_code === selectedCropCode) || null;
  }, [gatDetail, selectedCropCode]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await cropSuitabilityService.refreshCache();
      const [summary, geojson] = await Promise.all([
        cropSuitabilityService.getCropAllGats(selectedCropCode, irrigationAvailable),
        cropSuitabilityService.getCropGeoJSON(selectedCropCode, irrigationAvailable),
      ]);
      setCropSummary(summary);
      setGeoJsonData(geojson);
      if (selectedGatNo) {
        const gd = await cropSuitabilityService.getGatSuitability(selectedGatNo, irrigationAvailable);
        setGatDetail(gd);
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-soil-primary/10 via-soil-cream/40 to-surface-muted p-5 rounded-2xl border border-soil-primary/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-subtle">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
            {language === "mr" ? "पीक उपयुक्तता" : "Crop Suitability"}
          </h1>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={cropSuitabilityService.getExportCsvUrl(selectedCropCode, selectedGatNo || undefined)}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-text-main border border-surface-border text-xs font-semibold hover:bg-surface-subtle transition-all shadow-xs"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5 text-soil-primary" />
            <span>Export CSV</span>
          </a>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-soil-primary text-white text-xs font-semibold hover:bg-soil-primaryHover transition-all shadow-xs disabled:opacity-50"
            title="Recalculate suitability results"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Refreshing..." : "Recalculate"}</span>
          </button>
        </div>
      </div>

      {/* 2. Crop Selector & Irrigation Option */}
      <div className="bg-white p-4 rounded-2xl border border-surface-border shadow-subtle space-y-3">
        <div className="flex items-center gap-2">
          <Sprout className="w-5 h-5 text-soil-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
            {language === "mr" ? `गट ${selectedGatNo} साठी पीक निवडा:` : `Select Crop to Evaluate for Gat ${selectedGatNo}:`}
          </span>
        </div>

        {/* 10 Crop Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
          {crops.map((c) => {
            const isSelected = c.crop_code === selectedCropCode;
            return (
              <button
                key={c.crop_code}
                type="button"
                onClick={() => setSelectedCropCode(c.crop_code)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all ${
                  isSelected
                    ? "bg-soil-primary text-white shadow-sm ring-2 ring-soil-primary/30"
                    : "bg-surface-subtle text-text-main hover:bg-surface-muted hover:border-surface-border border border-transparent"
                }`}
              >
                <span className="text-xs font-bold tracking-tight">
                  {language === "mr" ? c.crop_name_mr : c.crop_name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Main Two-Column GIS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: GIS Suitability Map focused on logged-in Gat (7 Columns) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="h-[580px]">
            <CropSuitabilityMap
              geoJsonData={geoJsonData}
              selectedGatNo={selectedGatNo}
              onSelectGat={(gat) => {
                // If user clicks own Gat or explores
                if (gat) setSelectedGatNo(gat);
              }}
              cropName={activeCrop?.crop_name || selectedCropCode}
              className="h-full"
            />
          </div>
        </div>

        {/* RIGHT: Gat Details & Limiting Factors Drawer (5 Columns) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-surface-border shadow-subtle overflow-hidden">
          {/* Drawer Body */}
          {loadingGat ? (
            <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
              <Compass className="w-7 h-7 animate-spin text-soil-primary" />
              <span className="text-xs font-semibold">Evaluating Gat parameters...</span>
            </div>
          ) : activeGatEvaluation ? (
            <div className="p-4 space-y-4">
              {/* Overall Suitability Badge & Score Card */}
              <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-bold text-text-muted">
                    {language === "mr" ? `${activeCrop?.crop_name_mr || activeGatEvaluation.crop_name} साठी उपयुक्तता` : `Suitability For ${activeGatEvaluation.crop_name}`}
                  </div>
                  <div className="text-lg font-black text-text-main mt-0.5 flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold text-white ${
                        activeGatEvaluation.final_suitability_class === "S1"
                          ? "bg-emerald-600"
                          : activeGatEvaluation.final_suitability_class === "S2"
                          ? "bg-yellow-500"
                          : activeGatEvaluation.final_suitability_class === "S3"
                          ? "bg-orange-500"
                          : "bg-red-600"
                      }`}
                    >
                      {activeGatEvaluation.final_suitability_class}
                    </span>
                    <span>
                      {language === "mr"
                        ? (activeGatEvaluation.class_title_mr || activeGatEvaluation.class_title)
                        : activeGatEvaluation.class_title}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    {activeGatEvaluation.tolerance}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-text-muted">
                    {language === "mr" ? "उपयुक्तता गुण" : "Suitability Score"}
                  </div>
                  <div className="text-2xl font-black text-soil-primary">
                    {activeGatEvaluation.suitability_score}%
                  </div>
                  <div className="text-[10px] text-text-muted font-medium">
                    {language === "mr" ? "निकषांनुसार गुणांकन" : "Weighted Criteria"}
                  </div>
                </div>
              </div>

              {/* Limiting Factors Alert Box */}
              {activeGatEvaluation.limiting_factors.length > 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{language === "mr" ? "सीमा मर्यादा घटक:" : "Identified Limiting Factors:"}</span>
                  </div>
                  <ul className="space-y-1 pl-5 list-disc text-amber-800">
                    {activeGatEvaluation.limiting_factors.map((lf, idx) => (
                      <li key={idx}>
                        <strong>{lf.parameter}</strong>: {lf.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {language === "mr"
                      ? `${activeCrop?.crop_name_mr || activeGatEvaluation.crop_name} साठी अनुकूल परिस्थिती आहे.`
                      : `No limiting factors identified. Optimum conditions for ${activeGatEvaluation.crop_name}.`}
                  </span>
                </div>
              )}

              {/* Sub-Tabs: Criteria Breakdown, 10-Crop Comparison */}
              <div className="border-b border-surface-border flex gap-4 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("criteria")}
                  className={`pb-2 border-b-2 transition-all ${
                    activeTab === "criteria"
                      ? "border-soil-primary text-soil-primary font-bold"
                      : "border-transparent text-text-muted hover:text-text-main"
                  }`}
                >
                  {language === "mr" ? `तपासलेले निकष (${activeGatEvaluation.evaluated_criteria.length})` : `Evaluated Criteria (${activeGatEvaluation.evaluated_criteria.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("comparison")}
                  className={`pb-2 border-b-2 transition-all ${
                    activeTab === "comparison"
                      ? "border-soil-primary text-soil-primary font-bold"
                      : "border-transparent text-text-muted hover:text-text-main"
                  }`}
                >
                  {language === "mr" ? "१० पिकांची तुलना" : "10 Crops Comparison"}
                </button>
              </div>

              {/* TAB 1: Criteria Breakdown */}
              {activeTab === "criteria" && (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {activeGatEvaluation.evaluated_criteria.map((crit) => {
                    const sClass = crit.suitability_class;
                    return (
                      <div
                        key={crit.parameter_key}
                        className="p-2.5 rounded-xl border border-surface-border bg-surface-subtle/50 hover:bg-surface-subtle transition-all flex items-center justify-between text-xs gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-text-main flex items-center gap-1.5">
                            <span>{crit.parameter_name}</span>
                            <span className="text-[10px] text-text-muted font-normal">
                              ({crit.weight}%)
                            </span>
                          </div>
                          <div className="text-[11px] text-text-muted">
                            Observed:{" "}
                            <strong className="text-text-main">
                              {crit.value !== null ? `${crit.value} ${crit.unit}` : "Not Recorded"}
                            </strong>{" "}
                            • <span className="text-[10px] italic">{crit.source}</span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold shrink-0 ${
                            sClass === "S1"
                              ? "bg-emerald-100 text-emerald-800"
                              : sClass === "S2"
                              ? "bg-yellow-100 text-yellow-800"
                              : sClass === "S3"
                              ? "bg-orange-100 text-orange-800"
                              : sClass === "N"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {sClass}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: 10 Crops Comparison Matrix */}
              {activeTab === "comparison" && gatDetail && (
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  <div className="text-[11px] text-text-muted mb-2 font-medium">
                    Comparative suitability across all 10 supported crops for Gat {selectedGatNo}:
                  </div>
                  {gatDetail.evaluations.map((ev) => (
                    <div
                      key={ev.crop_code}
                      onClick={() => setSelectedCropCode(ev.crop_code)}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        ev.crop_code === selectedCropCode
                          ? "bg-soil-primary/10 border-soil-primary/40 ring-1 ring-soil-primary/20"
                          : "bg-surface-subtle border-surface-border hover:bg-surface-muted"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-text-main">
                          {language === "mr" ? ev.crop_name_mr : ev.crop_name}
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {language === "mr"
                            ? `गुण: ${ev.suitability_score}% • ${ev.limiting_factors.length} मर्यादा घटक`
                            : `Score: ${ev.suitability_score}% • ${ev.limiting_factors.length} limiting factor(s)`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-black text-white ${
                            ev.final_suitability_class === "S1"
                              ? "bg-emerald-600"
                              : ev.final_suitability_class === "S2"
                              ? "bg-yellow-500"
                              : ev.final_suitability_class === "S3"
                              ? "bg-orange-500"
                              : "bg-red-600"
                          }`}
                        >
                          {ev.final_suitability_class}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-text-muted">
              <Compass className="w-8 h-8 mx-auto text-soil-primary/40 mb-2" />
              <p className="text-xs">No evaluation available for this Gat.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
