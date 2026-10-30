"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useI18n } from "@/i18n/useI18n";
import { farmerService } from "@/services/farmerService";
import { AssociatedFarmerItem, GatOptionItem } from "@/types/farmer";
import { useSelectedFarmer } from "@/context/FarmerContext";
import {
  Users,
  Search,
  Loader2,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  Building2,
  FileSpreadsheet,
  X,
  UserCheck,
  Check,
} from "lucide-react";
import { formatGatLabel, translateGeoName, translateFarmerName } from "@/i18n/marathiHelper";

interface GatFarmersSectionProps {
  initialGatNo: string;
  villageName: string;
  villageId?: number;
  taluka?: string;
  onGatChange?: (newGat: string) => void;
  className?: string;
}

export const GatFarmersSection: React.FC<GatFarmersSectionProps> = ({
  initialGatNo,
  villageName,
  villageId,
  taluka,
  onGatChange,
  className = "",
}) => {
  const { t, locale } = useI18n();
  const isMr = locale === "mr";

  // Shared active farmer selection
  const { selectedFarmer, selectFarmer, clearSelectedFarmer } = useSelectedFarmer();

  // Current Gat being viewed
  const [activeGat, setActiveGat] = useState<string>(initialGatNo || "124");
  const [farmers, setFarmers] = useState<AssociatedFarmerItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search query within current Gat list
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Available Gats for dropdown / quick selection
  const [availableGats, setAvailableGats] = useState<GatOptionItem[]>([]);
  const [showGatDropdown, setShowGatDropdown] = useState<boolean>(false);
  const [gatSearchFilter, setGatSearchFilter] = useState<string>("");

  // Farmer selection dropdown state
  const [showFarmerDropdown, setShowFarmerDropdown] = useState<boolean>(false);
  const [farmerDropdownFilter, setFarmerDropdownFilter] = useState<string>("");

  // Track latest request to avoid race conditions with rapid switching
  const requestSeqRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const farmerDropdownRef = useRef<HTMLDivElement | null>(null);

  // Check if current selected farmer belongs to this active Gat
  const cleanActiveGat = String(activeGat).replace(/[^\d]/g, "");
  const currentGatFarmer = useMemo(() => {
    if (!selectedFarmer) return null;
    const farmerGat = String(selectedFarmer.gat_no).replace(/[^\d]/g, "");
    return farmerGat === cleanActiveGat ? selectedFarmer : null;
  }, [selectedFarmer, cleanActiveGat]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowGatDropdown(false);
      }
      if (farmerDropdownRef.current && !farmerDropdownRef.current.contains(target)) {
        setShowFarmerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync with prop changes if parent updates initialGatNo
  useEffect(() => {
    if (initialGatNo && initialGatNo !== activeGat) {
      setActiveGat(initialGatNo);
    }
  }, [initialGatNo, activeGat]);

  // Load list of available Gats for the village once on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchGats() {
      try {
        const data = await farmerService.getAvailableGats(villageName, villageId);
        if (isMounted && data?.gats?.length > 0) {
          setAvailableGats(data.gats);
        }
      } catch (err) {
        // Non-critical: dropdown will fallback to typed input
      }
    }
    fetchGats();
    return () => {
      isMounted = false;
    };
  }, [villageName, villageId]);

  // Primary data loader for farmers in active Gat
  const loadFarmers = useCallback(
    async (targetGat: string) => {
      // Cancel any ongoing in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const currentSeq = ++requestSeqRef.current;

      setLoading(true);
      setError(null);
      // Clear old list immediately while new records load to prevent stale display
      setFarmers([]);
      setTotalCount(0);
      setSearchQuery("");
      setShowFarmerDropdown(false);

      try {
        const cleanGat = targetGat.replace(/[^\d]/g, "") || targetGat;
        const res = await farmerService.getFarmersByGat(
          {
            gatNo: cleanGat,
            village: villageName,
            villageId: villageId,
            taluka: taluka,
          },
          undefined,
          controller.signal
        );

        // Ignore response if a newer request was dispatched in the meantime
        if (currentSeq !== requestSeqRef.current) return;

        setFarmers(res.farmers || []);
        setTotalCount(res.total || 0);
      } catch (err: any) {
        if (err?.name === "CanceledError" || err?.name === "AbortError") {
          return; // Ignore aborted requests
        }
        if (currentSeq !== requestSeqRef.current) return;

        console.error("Failed to load Gat farmers:", err);
        setError(
          t("gatFarmers.errorLoading") ||
            "Could not load farmer records. Please check connection and retry."
        );
      } finally {
        if (currentSeq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [villageName, villageId, taluka, t]
  );

  // Fetch whenever activeGat changes
  useEffect(() => {
    if (activeGat) {
      loadFarmers(activeGat);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [activeGat, loadFarmers]);

  // Handle switching Gat
  const handleSelectGat = (newGat: string) => {
    const clean = newGat.trim();
    if (!clean || clean === activeGat) {
      setShowGatDropdown(false);
      return;
    }
    setActiveGat(clean);
    setShowGatDropdown(false);
    setShowFarmerDropdown(false);
    setGatSearchFilter("");

    // Notify parent & store in localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("soilpilot_selected_gat", clean);
      window.dispatchEvent(new Event("soilpilot_gat_changed"));
    }
    if (onGatChange) {
      onGatChange(clean);
    }
  };

  // Select farmer action
  const handleSelectFarmer = (item: AssociatedFarmerItem) => {
    selectFarmer({
      id: item.id,
      name: item.name,
      gat_no: activeGat,
      village: villageName,
      village_id: villageId,
      source_row: item.source_row,
    });
    setShowFarmerDropdown(false);
    setFarmerDropdownFilter("");
  };

  // Filter farmers by search query (supports searching in Marathi or English)
  const filteredFarmers = useMemo(() => {
    if (!searchQuery.trim()) return farmers;
    const q = searchQuery.toLowerCase().trim();
    return farmers.filter((f) => {
      const mrName = f.name.toLowerCase();
      const enName = translateFarmerName(f.name, false).toLowerCase();
      return mrName.includes(q) || enName.includes(q);
    });
  }, [farmers, searchQuery]);

  // Filter farmers inside dropdown search
  const filteredDropdownFarmers = useMemo(() => {
    if (!farmerDropdownFilter.trim()) return farmers;
    const q = farmerDropdownFilter.toLowerCase().trim();
    return farmers.filter((f) => {
      const mrName = f.name.toLowerCase();
      const enName = translateFarmerName(f.name, false).toLowerCase();
      return mrName.includes(q) || enName.includes(q);
    });
  }, [farmers, farmerDropdownFilter]);

  // Filter available Gats for the switcher dropdown
  const filteredGatOptions = useMemo(() => {
    if (!gatSearchFilter.trim()) return availableGats;
    const q = gatSearchFilter.toLowerCase().trim();
    return availableGats.filter((g) => g.gat_no.toLowerCase().includes(q));
  }, [availableGats, gatSearchFilter]);

  const displayVillage = villageName || "Malegaon Khurd";

  return (
    <section
      id="gat-farmers-section"
      className={`bg-white rounded-2xl border border-surface-border shadow-card overflow-hidden transition-all duration-200 ${className}`}
      aria-label="Farmers Associated with This Gat"
    >
      {/* 1. SECTION HEADER */}
      <div className="p-5 sm:p-6 border-b border-surface-border bg-gradient-to-r from-surface-subtle to-white space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Icon */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-soil-primaryLight border border-soil-secondary/30 text-soil-primary flex items-center justify-center shadow-xs shrink-0">
              <Users className="w-5 h-5 text-soil-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-text-main tracking-tight">
                  {t("gatFarmers.title") || "Farmers Associated with This Gat"}
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-soil-cream text-soil-primary border border-soil-secondary/30">
                  {t("gatFarmers.officialCadastralSource") || "7/12 Register"}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {t("gatFarmers.subtitle") || "Landholder records mapped to this cadastral parcel."}
              </p>
            </div>
          </div>

          {/* Total Record Badge & Gat Switcher */}
          <div className="flex items-center gap-2 relative" ref={dropdownRef}>
            {/* Total Badge */}
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-soil-primaryLight text-soil-primary font-bold text-xs border border-soil-secondary/30 shadow-xs"
              title={`Total ${totalCount} records`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-soil-primary" />
              <span>
                {loading
                  ? "..."
                  : isMr
                  ? `${totalCount} खातेदार`
                  : `${totalCount} records`}
              </span>
            </span>

            {/* Quick Gat Switcher Button */}
            <button
              type="button"
              onClick={() => setShowGatDropdown((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-subtle hover:bg-surface-muted text-text-main border border-surface-border transition-colors cursor-pointer"
              title="Switch Gat Number"
              aria-expanded={showGatDropdown}
            >
              <span>{formatGatLabel(activeGat, isMr)}</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>

            {/* Gat Switcher Dropdown */}
            {showGatDropdown && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl border border-surface-border shadow-elevated z-30 p-2 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={gatSearchFilter}
                    onChange={(e) => setGatSearchFilter(e.target.value)}
                    placeholder={isMr ? "गट शोधा..." : "Search Gat (1–222)..."}
                    className="w-full pl-8 pr-2.5 py-1 text-xs border border-surface-border rounded-md focus:outline-none focus:ring-1 focus:ring-soil-primary text-text-main bg-surface-subtle"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  {filteredGatOptions.length > 0 ? (
                    filteredGatOptions.map((opt) => (
                      <button
                        key={opt.gat_no}
                        type="button"
                        onClick={() => handleSelectGat(opt.gat_no)}
                        className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md flex items-center justify-between transition-colors cursor-pointer ${
                          opt.gat_no === activeGat
                            ? "bg-soil-primary text-white font-bold"
                            : "hover:bg-surface-subtle text-text-main"
                        }`}
                      >
                        <span>{formatGatLabel(opt.gat_no, isMr)}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            opt.gat_no === activeGat
                              ? "bg-white/20 text-white"
                              : "bg-surface-muted text-text-muted"
                          }`}
                        >
                          {opt.farmer_count}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="py-2 text-center text-xs text-text-muted">
                      {gatSearchFilter ? (
                        <button
                          type="button"
                          onClick={() => handleSelectGat(gatSearchFilter)}
                          className="text-soil-primary font-bold hover:underline cursor-pointer"
                        >
                          {isMr ? `गट #${gatSearchFilter} उघडा` : `Select Gat #${gatSearchFilter}`}
                        </button>
                      ) : (
                        "No Gats found"
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Cadastral Meta Bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs pt-1">
          <div className="flex items-center gap-1.5 text-text-muted bg-white px-2.5 py-1 rounded-lg border border-surface-border">
            <Building2 className="w-3.5 h-3.5 text-soil-primary" />
            <span>
              {t("gatFarmers.village") || "Village"}:{" "}
              <strong className="text-text-main font-semibold">
                {translateGeoName(displayVillage, isMr)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-text-muted bg-white px-2.5 py-1 rounded-lg border border-surface-border">
            <FileSpreadsheet className="w-3.5 h-3.5 text-soil-primary" />
            <span>
              {t("gatFarmers.gatNo") || "Gat No."}:{" "}
              <strong className="text-soil-primary font-bold">
                {formatGatLabel(activeGat, isMr)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-text-muted bg-white px-2.5 py-1 rounded-lg border border-surface-border">
            <span>
              {t("gatFarmers.totalRecords") || "Total records"}:{" "}
              <strong className="text-text-main font-semibold">
                {loading ? "..." : totalCount}
              </strong>
            </span>
          </div>
        </div>

        {/* FARMER SELECTION CONTROL */}
        <div className="pt-2 border-t border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="farmer-selection-dropdown-btn"
              className="text-xs font-bold text-text-main flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4 text-soil-primary" />
              <span>{t("gatFarmers.selectFarmer") || "Select Farmer"}:</span>
            </label>
          </div>

          <div className="relative flex-1 max-w-full sm:max-w-md" ref={farmerDropdownRef}>
            {currentGatFarmer ? (
              <div className="flex items-center gap-2 w-full">
                <button
                  id="farmer-selection-dropdown-btn"
                  type="button"
                  onClick={() => setShowFarmerDropdown((prev) => !prev)}
                  className="flex-1 text-left px-3 py-1.5 text-xs bg-emerald-50 text-soil-primary font-semibold border border-soil-primary/40 rounded-xl hover:bg-emerald-100/60 transition-colors flex items-center justify-between gap-2 shadow-2xs cursor-pointer"
                  title="Click to switch farmer"
                  aria-expanded={showFarmerDropdown}
                >
                  <span className="truncate flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-soil-primary shrink-0" />
                    <strong className="font-bold text-soil-primary">
                      {translateFarmerName(currentGatFarmer.name, isMr)}
                    </strong>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-soil-primary text-white">
                      {t("gatFarmers.selectedBadge") || "Selected"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-soil-primary" />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={clearSelectedFarmer}
                  className="px-2.5 py-1.5 text-[11px] font-semibold text-text-muted hover:text-red-700 bg-surface-subtle hover:bg-red-50 border border-surface-border rounded-xl transition-colors cursor-pointer shrink-0"
                  title={t("gatFarmers.clearSelection") || "Clear Selection"}
                >
                  {t("gatFarmers.clearSelection") || "Clear"}
                </button>
              </div>
            ) : (
              <button
                id="farmer-selection-dropdown-btn"
                type="button"
                disabled={loading || totalCount === 0}
                onClick={() => setShowFarmerDropdown((prev) => !prev)}
                className="w-full text-left px-3 py-1.5 text-xs bg-white text-text-muted border border-surface-border rounded-xl hover:border-soil-primary focus:outline-none focus:ring-2 focus:ring-soil-primary/20 transition-colors flex items-center justify-between gap-2 disabled:opacity-50 cursor-pointer"
                aria-expanded={showFarmerDropdown}
              >
                <span className="truncate">
                  {loading
                    ? (t("gatFarmers.loading") || "Loading...")
                    : totalCount === 0
                    ? (t("gatFarmers.noRecordsFound") || "No farmers in this Gat")
                    : (t("gatFarmers.selectFarmerPrompt") || "-- Select Farmer --")}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
              </button>
            )}

            {/* Farmer Selection Dropdown Menu */}
            {showFarmerDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-surface-border shadow-elevated z-30 p-2 space-y-1.5 max-h-72 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
                {farmers.length > 5 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={farmerDropdownFilter}
                      onChange={(e) => setFarmerDropdownFilter(e.target.value)}
                      placeholder={t("gatFarmers.searchFarmers") || "Search farmer in list..."}
                      className="w-full pl-8 pr-2.5 py-1 text-xs border border-surface-border rounded-md focus:outline-none focus:ring-1 focus:ring-soil-primary text-text-main bg-surface-subtle"
                      autoFocus
                    />
                  </div>
                )}

                <div className="overflow-y-auto max-h-56 divide-y divide-surface-border/40 pr-1">
                  {filteredDropdownFarmers.length > 0 ? (
                    filteredDropdownFarmers.map((f, idx) => {
                      const isSelected = currentGatFarmer?.id === f.id || currentGatFarmer?.name === f.name;
                      return (
                        <button
                          key={`${f.id}-${idx}`}
                          type="button"
                          onClick={() => handleSelectFarmer(f)}
                          className={`w-full text-left px-2.5 py-2 text-xs rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-soil-primary text-white font-bold"
                              : "hover:bg-soil-cream/60 text-text-main"
                          }`}
                        >
                          <span className="truncate pr-2">
                            {translateFarmerName(f.name, isMr)}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white shrink-0">
                              ✓ {t("gatFarmers.selectedBadge") || "Selected"}
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-3 text-center text-xs text-text-muted">
                      {farmerDropdownFilter
                        ? (isMr ? "कोणतेही नाव सापडले नाही" : "No matching farmer found")
                        : (t("gatFarmers.noRecordsFound") || "No records")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Filter Input */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pt-1" />
          <input
            id="farmer-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={loading || totalCount === 0}
            placeholder={
              t("gatFarmers.searchPlaceholder") ||
              "Search farmer names..."
            }
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-soil-primary/30 focus:border-soil-primary text-text-main placeholder:text-text-light transition-all disabled:opacity-50"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pt-1 text-text-muted hover:text-text-main p-1 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. BODY CONTENT: FARMER NAMES LIST / TABLE */}
      <div className="p-0">
        {/* Loading State */}
        {loading && (
          <div className="p-8 sm:p-12 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-soil-primaryLight border border-soil-secondary/30 text-soil-primary flex items-center justify-center animate-spin">
              <Loader2 className="w-5 h-5 text-soil-primary" />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-text-main">
              {t("gatFarmers.loading") || "Loading associated farmers..."}
            </p>
            <p className="text-[11px] text-text-muted">
              {formatGatLabel(activeGat, isMr)} • {translateGeoName(displayVillage, isMr)}
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-6 sm:p-8 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <AlertCircle className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-amber-900">{error}</p>
            <button
              type="button"
              onClick={() => loadFarmers(activeGat)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-soil-primary text-white text-xs font-semibold rounded-lg hover:bg-soil-primaryHover transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t("gatFarmers.retry") || "Retry"}</span>
            </button>
          </div>
        )}

        {/* Empty State (No records found for Gat) */}
        {!loading && !error && totalCount === 0 && (
          <div className="p-8 sm:p-12 text-center space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-surface-subtle text-text-muted flex items-center justify-center border border-surface-border">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-text-main">
              {t("gatFarmers.noRecordsFound") || "No farmer names found for this Gat."}
            </p>
            <p className="text-[11px] text-text-muted max-w-sm mx-auto">
              {isMr
                ? `गट क्र. ${activeGat} साठी महसूल नोंदी उपलब्ध नाहीत. कृपया दुसरा गट निवडा.`
                : `No official landholder records registered for Gat #${activeGat} in ${displayVillage}.`}
            </p>
          </div>
        )}

        {/* Empty Filter State (Search query didn't match) */}
        {!loading && !error && totalCount > 0 && filteredFarmers.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs sm:text-sm font-semibold text-text-muted">
              {t("gatFarmers.noMatchesFound")
                ? t("gatFarmers.noMatchesFound").replace("{query}", searchQuery)
                : `No matching farmer names found for "${searchQuery}".`}
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-soil-primary font-bold hover:underline cursor-pointer"
            >
              {isMr ? "शोध साफ करा" : "Clear search filter"}
            </button>
          </div>
        )}

        {/* Results List / Table */}
        {!loading && !error && filteredFarmers.length > 0 && (
          <div className="space-y-0">
            {/* Filter Count Feedback (if searching) */}
            {searchQuery && (
              <div className="px-4 sm:px-6 py-2 bg-surface-subtle border-b border-surface-border text-[11px] text-text-muted flex items-center justify-between">
                <span>
                  {t("gatFarmers.showingCount")
                    ? t("gatFarmers.showingCount")
                        .replace("{shown}", String(filteredFarmers.length))
                        .replace("{total}", String(totalCount))
                    : `Showing ${filteredFarmers.length} of ${totalCount} farmers`}
                </span>
                <span className="font-mono text-soil-primary font-semibold">
                  &ldquo;{searchQuery}&rdquo;
                </span>
              </div>
            )}

            {/* Scrollable Table Container */}
            <div
              className={`overflow-y-auto divide-y divide-surface-border ${
                totalCount > 6 ? "max-h-80 sm:max-h-96" : "max-h-none"
              }`}
            >
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-subtle sticky top-0 z-10 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-surface-border shadow-xs">
                  <tr>
                    <th scope="col" className="py-2.5 px-4 sm:px-6 w-16 sm:w-20 text-right">
                      {t("gatFarmers.tableNo") || "No."}
                    </th>
                    <th scope="col" className="py-2.5 px-4 sm:px-6">
                      {t("gatFarmers.tableFarmerName") || "Farmer Name"}
                    </th>
                    <th scope="col" className="py-2.5 px-4 sm:px-6 w-28 sm:w-36 text-right">
                      {t("gatFarmers.selectFarmer") || "Select"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border bg-white text-xs sm:text-sm">
                  {filteredFarmers.map((item, index) => {
                    const isSelected =
                      currentGatFarmer?.id === item.id || currentGatFarmer?.name === item.name;
                    return (
                      <tr
                        key={`${item.id}-${index}`}
                        onClick={() => handleSelectFarmer(item)}
                        className={`transition-colors cursor-pointer group ${
                          isSelected
                            ? "bg-emerald-50/70 hover:bg-emerald-100/60 font-semibold"
                            : "hover:bg-soil-cream/40"
                        }`}
                        title={
                          isSelected
                            ? (isMr ? "निवडलेले शेतकरी" : "Currently selected farmer")
                            : (isMr ? "या शेतकऱ्याची निवड करा" : "Click to select this farmer")
                        }
                      >
                        {/* Index Number */}
                        <td className="py-2.5 px-4 sm:px-6 text-right font-mono text-xs text-text-muted group-hover:text-soil-primary align-middle w-16 sm:w-20">
                          {index + 1}
                        </td>

                        {/* Farmer Name (English in EN mode, Marathi in MR mode) */}
                        <td className="py-2.5 px-4 sm:px-6 text-text-main font-medium leading-relaxed align-middle">
                          <div className="flex items-center gap-2">
                            <span
                              className={`block break-words select-text tracking-normal text-xs sm:text-sm ${
                                isSelected ? "text-soil-primary font-bold" : "text-slate-900"
                              }`}
                            >
                              {translateFarmerName(item.name, isMr)}
                            </span>
                          </div>
                        </td>

                        {/* Action / Selection Column */}
                        <td className="py-2.5 px-4 sm:px-6 text-right align-middle w-28 sm:w-36">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-soil-primary text-white shadow-2xs">
                              <Check className="w-3 h-3" />
                              <span>{t("gatFarmers.selectedBadge") || "Selected"}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-text-muted group-hover:text-soil-primary group-hover:bg-soil-primaryLight transition-colors">
                              {t("gatFarmers.clickToSelect") || "Select"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Summary */}
            <div className="px-4 sm:px-6 py-2.5 bg-surface-subtle border-t border-surface-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
              <span>
                {isMr
                  ? `गट क्र. ${activeGat} मधील एकूण ${totalCount} खातेदार नोंदणीकृत आहेत.`
                  : `Total ${totalCount} landholder records registered for Gat #${activeGat}.`}
              </span>
              <span className="text-soil-primary font-semibold">
                {displayVillage} • Baramati
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
