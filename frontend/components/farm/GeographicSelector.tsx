"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/i18n/useI18n";
import {
  geographyService,
  VillageItem,
  PUNE_OFFICIAL_TALUKAS,
} from "@/services/geographyService";
import { fieldService, FieldResult } from "@/services/fieldService";
import {
  MapPin,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";
import { translateGeoName, translateFarmerName } from "@/i18n/marathiHelper";

interface GeographicSelectorProps {
  onFieldSelected?: (field: FieldResult) => void;
  className?: string;
}

export const GeographicSelector: React.FC<GeographicSelectorProps> = ({
  onFieldSelected,
  className = "",
}) => {
  const { t, locale } = useI18n();

  // Permanently fixed administrative levels (Maharashtra -> Pune)
  const fixedState = t("geo.fixedState");
  const fixedDistrict = t("geo.fixedDistrict");

  // Selection states
  const [selectedTaluka, setSelectedTaluka] = useState<string>("");
  const [selectedVillageId, setSelectedVillageId] = useState<number | "">("");
  const [selectedVillageName, setSelectedVillageName] = useState<string>("");
  const [gatNo, setGatNo] = useState<string>("");

  // Village search/filter text
  const [villageSearch, setVillageSearch] = useState<string>("");

  // Data lists
  const talukas = PUNE_OFFICIAL_TALUKAS;
  const [villages, setVillages] = useState<VillageItem[]>([]);

  // Loading & searching states
  const [loadingVillages, setLoadingVillages] = useState<boolean>(false);
  const [searchingField, setSearchingField] = useState<boolean>(false);

  // Errors & Result
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldResult, setFieldResult] = useState<FieldResult | null>(null);

  // Fetch villages whenever selected Taluka changes
  const fetchVillagesForTaluka = async (talukaName: string) => {
    if (!talukaName) {
      setVillages([]);
      return;
    }
    setLoadingVillages(true);
    setErrorMessage(null);

    try {
      const data = await geographyService.getVillages(talukaName);
      setVillages(data);
    } catch (err: any) {
      setErrorMessage(t("geo.errorLoadingVillages"));
    } finally {
      setLoadingVillages(false);
    }
  };

  // Handler: Taluka Change
  const handleTalukaChange = (newTaluka: string) => {
    setSelectedTaluka(newTaluka);
    // Clear downstream Village and Gat Number
    setSelectedVillageId("");
    setSelectedVillageName("");
    setVillageSearch("");
    setGatNo("");
    setFieldResult(null);
    setErrorMessage(null);

    if (newTaluka) {
      fetchVillagesForTaluka(newTaluka);
    } else {
      setVillages([]);
    }
  };

  // Handler: Village Change
  const handleVillageChange = (vIdString: string) => {
    const vId = vIdString ? Number(vIdString) : "";
    setSelectedVillageId(vId);

    const found = villages.find((v) => v.id === vId);
    setSelectedVillageName(found ? found.name : "");

    // Clear Gat Number and previous field search result
    setGatNo("");
    setFieldResult(null);
    setErrorMessage(null);
  };

  // Filtered villages based on search query
  const filteredVillages = useMemo(() => {
    if (!villageSearch.trim()) return villages;
    const query = villageSearch.trim().toLowerCase();
    return villages.filter((v) => v.name.toLowerCase().includes(query));
  }, [villages, villageSearch]);

  // Handler: Find My Farm
  const handleFindFarm = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validations
    if (!selectedTaluka) {
      setErrorMessage(t("geo.pleaseSelectTaluka"));
      return;
    }
    if (!selectedVillageId && !selectedVillageName) {
      setErrorMessage(t("geo.pleaseSelectVillage"));
      return;
    }
    const cleanGat = gatNo.trim();
    if (!cleanGat) {
      setErrorMessage(t("geo.pleaseEnterGat"));
      return;
    }

    setSearchingField(true);
    setErrorMessage(null);
    setFieldResult(null);

    try {
      const field = await fieldService.getFieldByGat({
        gatNo: cleanGat,
        villageId: typeof selectedVillageId === "number" ? selectedVillageId : undefined,
        villageName: selectedVillageName || undefined,
        taluka: selectedTaluka,
      });

      setFieldResult(field);
      if (onFieldSelected) {
        onFieldSelected(field);
      }
    } catch (err: any) {
      const serverDetail = err?.response?.data?.detail;
      setErrorMessage(serverDetail || err.message || t("geo.fieldNotFound"));
    } finally {
      setSearchingField(false);
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-6 ${className}`}>
      {/* Card Header */}
      <div className="flex items-center gap-3 border-b border-surface-border pb-4">
        <div className="w-10 h-10 rounded-lg bg-soil-primaryLight text-soil-primary flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-main">
            {t("geo.selectFarmTitle")}
          </h2>
          <p className="text-xs text-text-muted">
            {t("geo.selectFarmSubtitle")}
          </p>
        </div>
      </div>

      {/* Cascading Form */}
      <form onSubmit={handleFindFarm} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. State (Permanently fixed to Maharashtra) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-main flex items-center justify-between">
              <span>{t("geo.state")}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={fixedState}
                disabled
                readOnly
                aria-label={t("geo.state")}
                className="w-full rounded-lg border border-surface-border bg-surface-muted px-3 py-2 text-sm font-medium text-text-main cursor-not-allowed select-none shadow-none"
              />
            </div>
          </div>

          {/* 2. District (Permanently fixed to Pune) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-main flex items-center justify-between">
              <span>{t("geo.district")}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={fixedDistrict}
                disabled
                readOnly
                aria-label={t("geo.district")}
                className="w-full rounded-lg border border-surface-border bg-surface-muted px-3 py-2 text-sm font-medium text-text-main cursor-not-allowed select-none shadow-none"
              />
            </div>
          </div>

          {/* 3. Taluka Dropdown (16 Pune Talukas) */}
          <div className="space-y-1.5">
            <label htmlFor="taluka-select" className="text-xs font-semibold text-text-main flex items-center justify-between">
              <span>{t("geo.taluka")}</span>
            </label>
            <select
              id="taluka-select"
              value={selectedTaluka}
              onChange={(e) => handleTalukaChange(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text-main focus:border-soil-primary focus:ring-1 focus:ring-soil-primary cursor-pointer"
            >
              <option value="">{t("geo.selectTaluka")}</option>
              {talukas.map((tName) => (
                <option key={tName} value={tName}>
                  {locale === "mr" ? translateGeoName(tName) : tName}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Village Dropdown (Dependent on Taluka) */}
          <div className="space-y-1.5">
            <label htmlFor="village-select" className="text-xs font-semibold text-text-main flex items-center justify-between">
              <span>{t("geo.village")}</span>
              {loadingVillages && <Loader2 className="w-3.5 h-3.5 text-soil-primary animate-spin" />}
            </label>
            <select
              id="village-select"
              value={selectedVillageId}
              onChange={(e) => handleVillageChange(e.target.value)}
              disabled={!selectedTaluka || loadingVillages || villages.length === 0}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text-main focus:border-soil-primary focus:ring-1 focus:ring-soil-primary disabled:bg-surface-muted disabled:text-text-light cursor-pointer"
            >
              <option value="">
                {loadingVillages
                  ? t("geo.loadingVillages")
                  : !selectedTaluka
                  ? t("geo.selectVillage")
                  : villages.length === 0
                  ? t("geo.noVillagesFound")
                  : t("geo.selectVillage")}
              </option>
              {filteredVillages.map((v) => (
                <option key={v.id} value={v.id}>
                  {locale === "mr" ? translateGeoName(v.name) : v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optional Quick Village Search Filter (when taluka has many villages) */}
        {selectedTaluka && villages.length > 5 && (
          <div className="flex items-center gap-2 pt-1 max-w-sm">
            <input
              type="text"
              value={villageSearch}
              onChange={(e) => setVillageSearch(e.target.value)}
              placeholder={t("geo.searchVillagePlaceholder")}
              className="w-full rounded-md border border-surface-border bg-surface-subtle px-2.5 py-1 text-xs text-text-main placeholder-text-light focus:border-soil-primary focus:ring-1 focus:ring-soil-primary"
            />
            {villageSearch && (
              <button
                type="button"
                onClick={() => setVillageSearch("")}
                className="text-[11px] text-text-muted hover:text-text-main underline px-1"
              >
                {locale === "mr" ? "साफ करा" : "Clear"}
              </button>
            )}
          </div>
        )}

        {/* 5. Gat Number Input & Find My Farm Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-end gap-3">
          <div className="w-full sm:w-72 space-y-1.5">
            <label htmlFor="gat-no-input" className="text-xs font-semibold text-text-main">
              {t("geo.gatNo")}
            </label>
            <input
              id="gat-no-input"
              type="text"
              value={gatNo}
              onChange={(e) => setGatNo(e.target.value)}
              disabled={!selectedVillageId}
              placeholder={t("geo.enterGatPlaceholder")}
              className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text-main placeholder-text-light focus:border-soil-primary focus:ring-1 focus:ring-soil-primary disabled:bg-surface-muted disabled:text-text-light"
            />
          </div>

          <button
            type="submit"
            disabled={!selectedVillageId || !gatNo.trim() || searchingField}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-soil-primary text-white text-sm font-semibold hover:bg-soil-primaryHover transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {searchingField ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t("geo.searching")}</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>{t("geo.findMyFarm")}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Validation & Error State Banner */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start justify-between gap-2 animate-in fade-in duration-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("geo.errorTitle")}</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
          {selectedTaluka && (
            <button
              type="button"
              onClick={() => fetchVillagesForTaluka(selectedTaluka)}
              className="px-2.5 py-1 rounded bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs font-medium shrink-0 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t("geo.retry")}</span>
            </button>
          )}
        </div>
      )}

      {/* Found Field Result Preview Card */}
      {fieldResult && (
        <div className="mt-4 p-5 rounded-xl bg-soil-primaryLight/50 border border-soil-secondary/50 space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-soil-secondary/30 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-soil-primary" />
              <h3 className="font-bold text-base text-text-main">
                {t("geo.fieldFoundTitle")}
              </h3>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-soil-cream text-soil-primary border border-soil-secondary/40">
              {t("common.demoData")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-white rounded-lg border border-surface-border">
              <span className="text-text-muted block">{t("geo.gatNo")}</span>
              <span className="font-bold text-sm text-text-main mt-0.5 block">
                {fieldResult.gat_no}
              </span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-surface-border">
              <span className="text-text-muted block">{t("geo.fieldArea")}</span>
              <span className="font-bold text-sm text-text-main mt-0.5 block">
                {fieldResult.area
                  ? `${(fieldResult.area_unit?.toLowerCase().includes("acre") || fieldResult.area_unit?.toLowerCase() === "ac"
                      ? fieldResult.area
                      : Number((fieldResult.area * 2.47105).toFixed(2))
                    )} ${locale === "mr" ? "एकर" : "acres"}`
                  : "N/A"}
              </span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-surface-border">
              <span className="text-text-muted block">{t("geo.farmerName")}</span>
              <span className="font-bold text-sm text-text-main mt-0.5 block truncate">
                {fieldResult.farmer?.full_name ? (locale === "mr" ? translateFarmerName(fieldResult.farmer.full_name) : fieldResult.farmer.full_name) : t("geo.unassigned")}
              </span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-surface-border">
              <span className="text-text-muted block">{t("geo.locationHierarchy") || (locale === "mr" ? "स्थान रचना" : "Location Hierarchy")}</span>
              <span className="font-semibold text-xs text-text-main mt-0.5 block truncate">
                {(locale === "mr" ? translateGeoName(fieldResult.village?.taluka_name || selectedTaluka) : (fieldResult.village?.taluka_name || selectedTaluka))} • {(locale === "mr" ? translateGeoName(fieldResult.village?.name || "") : fieldResult.village?.name)}
              </span>
            </div>
          </div>

          {/* Cadastral Parcel & Geometry Status */}
          {fieldResult.geometry_wkt && (
            <div className="p-3 bg-white rounded-lg border border-surface-border text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-soil-secondary shrink-0" />
                <span className="text-text-main font-medium">
                  {t("geo.geometryReady")}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-surface-muted rounded text-text-muted">
                EPSG:4326 (WGS84)
              </span>
            </div>
          )}

          <div className="p-3 bg-surface-subtle rounded-lg border border-surface-border text-xs text-text-muted flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-soil-secondary shrink-0 mt-0.5" />
            <span>
              {t("geo.phase2SuccessNotice")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
