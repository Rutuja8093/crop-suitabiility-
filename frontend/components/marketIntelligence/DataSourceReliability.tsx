"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  ShieldAlert,
  Database,
  Building2,
  Calendar,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { marketService, DataSourceItem } from "@/services/marketService";

interface DataSourceReliabilityProps {
  selectedMarket: string;
}

export const DataSourceReliability: React.FC<DataSourceReliabilityProps> = ({
  selectedMarket,
}) => {
  const { language } = useI18n();
  const isMr = language === "mr";
  const [sources, setSources] = useState<DataSourceItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    marketService
      .getDataSources()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setSources(data);
        }
      })
      .catch((e) => console.warn("Could not fetch data sources:", e));
    return () => {
      isMounted = false;
    };
  }, []);

  const agmarknet = sources.find((s) => s.code === "AGMARKNET") || null;

  return (
    <div className="bg-white rounded-2xl border border-surface-border p-5 sm:p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-soil-primaryLight border border-soil-secondary/30 text-soil-primary flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-text-main tracking-tight">
              {isMr
                ? "माहिती स्त्रोत, विश्वासार्हता व कार्यप्रणाली"
                : "Data Provenance, Reliability & Audit Trail"}
            </h3>
            <p className="text-xs text-text-muted">
              {isMr
                ? "बाजार भाव आणि कृषी माहितीची अचूकता, संकलन वेळ आणि स्त्रोत पडताळणी"
                : "Verification metadata, observation timestamps, and data-source reliability status"}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
            agmarknet?.operational_status === "ACTIVE"
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : "bg-amber-50 text-amber-800 border-amber-300"
          }`}
        >
          {agmarknet?.operational_status === "ACTIVE"
            ? isMr
              ? "थेट जोडणी: सक्रिय (Active)"
              : "Live Ingestion: Active"
            : isMr
            ? "थेट जोडणी: सुसज्ज (Ready)"
            : "Live Ingestion: Ready"}
        </span>
      </div>

      {/* Grid of Provenance Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Source 1: Market Data Provider */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            {isMr ? "प्राथमिक बाजार स्त्रोत" : "Primary Market Source"}
          </span>
          <p className="font-bold text-text-main">
            {agmarknet?.name || "AGMARKNET / OGD India"}
          </p>
          <p className="text-[11px] text-text-muted leading-tight">
            {isMr
              ? "कृषी व शेतकरी कल्याण मंत्रालय, भारत सरकार (data.gov.in API)"
              : "Ministry of Agriculture & Farmers Welfare (data.gov.in API)"}
          </p>
          <div className="pt-1 text-[10px] text-soil-primary font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-soil-primary" />
            <span>
              {agmarknet?.operational_status === "ACTIVE"
                ? isMr
                  ? "स्थिती: पडताळणीकृत दर संकलित"
                  : "Status: Verified Mandi Feeds"
                : isMr
                ? "स्थिती: API की / बुलेटिन सुसज्ज"
                : "Status: API Key / Bulletin Ingestion Ready"}
            </span>
          </div>
        </div>

        {/* Source 2: Enterprise Budgets & Agronomy */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            {isMr ? "लागवड खर्च व विद्यापीठ निकष" : "Cultivation Cost & Yield Norms"}
          </span>
          <p className="font-bold text-text-main">MPKV Rahuri / Agri Dept MH</p>
          <p className="text-[11px] text-text-muted leading-tight">
            {isMr
              ? "महात्मा फुले कृषी विद्यापीठ, राहुरी खर्च अंदाज"
              : "State Agricultural University Enterprise Budgets"}
          </p>
          <div className="pt-1 text-[10px] text-amber-700 font-semibold">
            {isMr ? "स्थिती: संदर्भ तक्ता तयार (Phase 5)" : "Status: Reference Norms Planned (Phase 5)"}
          </div>
        </div>

        {/* Source 3: Field Soil Diagnostics */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            {isMr ? "शेत जमीन माती परीक्षण" : "Gat Field Soil Diagnostic"}
          </span>
          <p className="font-bold text-text-main">SoilPilot DSM & Laboratory</p>
          <p className="text-[11px] text-text-muted leading-tight">
            {isMr
              ? "गट-स्तरीय ०-३० सेंमी रास्टर व प्रयोगशाळा अहवाल"
              : "Cadastral Gat Zonal Rasters & Lab Observations"}
          </p>
          <div className="pt-1 text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>{isMr ? "स्थिती: कार्यक्षम (Active)" : "Status: Active & Reusable"}</span>
          </div>
        </div>

        {/* Source 4: Update Frequency & Timestamps */}
        <div className="p-3.5 rounded-xl bg-surface-subtle border border-surface-border space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            {isMr ? "डेटा अद्ययावत वारंवारता" : "Sync Schedule & Frequency"}
          </span>
          <p className="font-bold text-text-main">Daily at 19:00 IST</p>
          <p className="text-[11px] text-text-muted leading-tight">
            {isMr
              ? "बाजार समिती कामकाज संपल्यानंतर सायंकाळी"
              : "Daily automated run following evening mandi closing"}
          </p>
          <div className="pt-1 text-[10px] text-stone-600 font-semibold">
            {agmarknet?.last_successful_retrieval_at
              ? `${isMr ? "शेवटचे संकलन:" : "Last Sync:"} ${new Date(
                  agmarknet.last_successful_retrieval_at
                ).toLocaleDateString("en-IN")}`
              : isMr
              ? "स्थिती: स्वयंचलित शेड्युलर सज्ज"
              : "Status: Automated Pipeline Ready"}
          </div>
        </div>
      </div>

      {/* Freshness & Integrity Policy Warning */}
      <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 text-xs flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong className="text-stone-900 font-semibold">
            {isMr ? "माहिती पारदर्शकता धोरण:" : "Data Provenance & Reliability Policy:"}
          </strong>{" "}
          {isMr
            ? "सॉईलपायलट कोणत्याही परिस्थितीत जुनी किंवा अनुपलब्ध माहिती बनावट आकड्यांनी भरत नाही. जर एखाद्या दिवशी बाजार समितीकडून दर प्राप्त झाले नाहीत, तर स्पष्टपणे 'माहिती उपलब्ध नाही' असा संदेश दिला जाईल."
            : "SoilPilot enforces strict data integrity: missing, delayed, or unverified market prices are never replaced with simulated or fabricated approximations. If a trading day has no records, the system displays an explicit missing-data notice."}
        </p>
      </div>
    </div>
  );
};
