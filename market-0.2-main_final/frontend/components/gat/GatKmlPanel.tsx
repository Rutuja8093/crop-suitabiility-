"use client";

import React, { useRef, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { GatCollection, GatSourceInfo } from "@/types/gat";
import {
  AlertTriangle,
  FileDown,
  Loader2,
  MapPinned,
  RotateCcw,
  Search,
  Star,
  Upload,
  Layers,
  Building2,
  CheckCircle2,
} from "lucide-react";

export type KmlSourceOption = "trial" | "village" | "upload";

interface GatKmlPanelProps {
  gats: GatCollection | null;
  info: GatSourceInfo | null;
  loading: boolean;
  error: string | null;
  selectedGatId: string | null;
  myGatId?: string | null;
  activeSource?: KmlSourceOption;
  onSelectSource?: (source: KmlSourceOption) => void;
  onSelectGat: (gatId: string | null) => void;
  onUploadFile: (file: File) => void;
  onUseSample: () => void;
  onExport: () => void;
  className?: string;
}

const ACCEPT = ".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz,application/xml,text/xml";

export const GatKmlPanel: React.FC<GatKmlPanelProps> = ({
  gats,
  info,
  loading,
  error,
  selectedGatId,
  myGatId,
  activeSource = "trial",
  onSelectSource,
  onSelectGat,
  onUploadFile,
  onUseSample,
  onExport,
  className = "",
}) => {
  const { t, locale } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");

  const features = gats?.features ?? [];
  const q = query.trim().toLowerCase();
  const visible = q ? features.filter((f) => f.properties.name.toLowerCase().includes(q)) : features;

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      onSelectSource?.("upload");
      onUploadFile(file);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border border-surface-border p-4 shadow-card ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 border-b border-surface-border/60 pb-2.5">
        <div className="w-7 h-7 rounded-lg bg-soil-primaryLight flex items-center justify-center text-soil-primary">
          <MapPinned className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-text-main">
              {t("gat.panel.title") || (locale === "mr" ? "गट भूखंड व KML" : "Gat Parcels & KML")}
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-surface-border text-text-muted">
              {features.length} {locale === "mr" ? "भूखंड" : (features.length === 1 ? "parcel" : "parcels")}
            </span>
          </div>
          <p className="text-[11px] text-text-muted truncate">
            {info?.fileName ? info.fileName : "final_gat_mmkh.kmz & malegaonkh_final1.kml"}
          </p>
        </div>
      </div>

      {/* KML Source Switcher Tabs */}
      <div className="mb-3">
        <label className="text-[10px] font-bold text-text-light uppercase tracking-wider block mb-1.5">
          {locale === "mr" ? "KML स्तर फाइल निवडा" : "Select KML Layer File"}
        </label>
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-surface-subtle border border-surface-border/80">
          <button
            type="button"
            onClick={() => onSelectSource?.("trial")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
              activeSource === "trial"
                ? "bg-white text-soil-primary shadow-xs border border-surface-border"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="truncate">{locale === "mr" ? "माळेगाव गट (KMZ)" : "Malegaon Gats (KMZ)"}</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSource?.("village")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
              activeSource === "village"
                ? "bg-white text-soil-primary shadow-xs border border-surface-border"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate">{locale === "mr" ? "गाव सीमा (माळेगाव)" : "Village (malegaon)"}</span>
          </button>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-2.5 text-center transition-colors ${
          dragging ? "border-soil-primary bg-soil-primaryLight/50" : "border-surface-borderStrong/70 bg-surface-subtle/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-soil-primary hover:bg-soil-primaryHover text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{locale === "mr" ? "KML अपलोड करा" : "Upload KML"}</span>
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={features.length === 0}
            title={locale === "mr" ? "KML निर्यात करा" : "Export KML"}
            className="p-1.5 rounded-lg border border-surface-border bg-white hover:bg-surface-subtle text-text-muted hover:text-text-main transition-colors disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div role="alert" className="mt-2.5 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {!error && info && info.warnings.length > 0 && (
        <div className="mt-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {info.warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
        </div>
      )}

      {/* Gat list */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-text-main uppercase tracking-wide">
            {activeSource === "village"
              ? (locale === "mr" ? "गाव सीमा" : "Boundary")
              : (locale === "mr" ? "उपलब्ध गट" : "Available Gats")} ({features.length})
          </span>
          {selectedGatId && (
            <button
              type="button"
              onClick={() => onSelectGat(null)}
              className="text-[11px] font-semibold text-soil-primary hover:underline"
            >
              {locale === "mr" ? "संपूर्ण हीटमॅप दाखवा" : "Show Full Heatmap"}
            </button>
          )}
        </div>

        {features.length > 4 && (
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-text-light absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={locale === "mr" ? "गट क्र. शोधा (उदा. १२, १४)..." : "Search Gat No. (e.g. 12, 14)..."}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-surface-border bg-surface-subtle focus:bg-white"
            />
          </div>
        )}

        <div className="max-h-56 overflow-y-auto space-y-1 pr-1" role="listbox" aria-label="Gat list">
          {loading && features.length === 0 && (
            <div className="space-y-1.5" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded-lg bg-surface-muted animate-pulse" />
              ))}
            </div>
          )}
          {visible.map((f) => {
            const isSel = f.id === selectedGatId;
            return (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => onSelectGat(isSel ? null : f.id)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-left transition-all ${
                  isSel
                    ? "bg-soil-primaryLight/70 border-soil-primary ring-1 ring-soil-primary/30"
                    : "bg-surface-subtle/50 hover:bg-surface-subtle border-surface-border/80"
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-xs font-bold truncate ${isSel ? "text-soil-primary" : "text-text-main"}`}>
                    {f.properties.is_village_boundary ? "" : (locale === "mr" ? "गट क्र. " : "Gat No. ")} {f.properties.name}
                  </span>
                  {f.id === myGatId && <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-text-muted">
                    {f.properties.area_ha} {locale === "mr" ? "हेक्टर" : "Ha"}
                  </span>
                  {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-soil-primary" />}
                </div>
              </button>
            );
          })}
          {!loading && visible.length === 0 && (
            <p className="text-[11px] text-text-muted py-2 text-center">
              {locale === "mr" ? "कोणतेही जुळणारे गट आढळले नाहीत." : "No matching Gats found."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
