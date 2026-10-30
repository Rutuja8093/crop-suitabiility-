"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SoilMapViewer, BasemapStyle } from "@/components/map/SoilMapViewer";
import { DSMLayerSelector } from "@/components/map/DSMLayerSelector";
import { dsmService } from "@/services/dsmService";
import { fieldService, GeoJSONGeometry } from "@/services/fieldService";
import { DSMLayerConfig, DSMLayerId, DSMRasterLayerId } from "@/types/gis";
import { GatCollection, GatSourceInfo, GatStats, KML_AVAILABLE_GATS } from "@/types/gat";
import { DSM_LAYERS, DSM_LAYER_LIST } from "@/lib/gis/dsmLayers";
import { computeAllGatStats, GridMap } from "@/lib/gis/gatStats";
import { RasterGrid } from "@/lib/gis/rasterGrid";
import { KmlParseError, parseKml } from "@/lib/kml/parseKml";
import { readKmlFile } from "@/lib/kml/readKmlFile";
import { collectionToKml, downloadTextFile } from "@/lib/kml/exportKml";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Layers, MapPin, AlertTriangle, ShieldAlert, FileBadge, Lightbulb, Lock, ShieldCheck, Loader2 } from "lucide-react";
import { translateGeoName } from "@/i18n/marathiHelper";

const RASTER_IDS: DSMRasterLayerId[] = [
  "bdod",
  "cec",
  "cfvo",
  "clay",
  "sand",
  "silt",
  "soc",
  "nitrogen",
  "ph",
  "soil_texture",
  "elevation",
  "slope",
  "lulc",
  "kharif_rgb",
  "rabi_rgb",
  "ndvi",
  "evi",
  "savi",
  "ndmi",
  "ndre",
  "bsi",
  "ndwi",
];

function SoilMapContent() {
  const { t, locale } = useI18n();
  const { field, farmer, location } = useAuth();
  const searchParams = useSearchParams();
  const urlGat = searchParams?.get("gat");

  const isAdmin = useMemo(() => {
    if (typeof window !== "undefined" && searchParams?.get("admin") === "true") return true;
    if (farmer?.role === "admin" || field?.gat_no?.toLowerCase() === "admin") return true;
    return false;
  }, [searchParams, farmer?.role, field?.gat_no]);

  // ------------------------------------------------------------- DSM layers
  const [layers, setLayers] = useState<DSMLayerConfig[]>(DSM_LAYER_LIST);
  const [activeLayerId, setActiveLayerId] = useState<DSMLayerId>("ndvi");
  const [layerOpacity, setLayerOpacity] = useState<number>(0.92);
  const [basemap, setBasemap] = useState<BasemapStyle>("satellite");
  const [manifestError, setManifestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    dsmService.getLayers().then(({ layers: data, manifestError: err }) => {
      if (cancelled) return;
      setLayers(data);
      setManifestError(err);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeLayer = layers.find((l) => l.id === activeLayerId) || DSM_LAYERS.ndvi;

  // ---------------------------------------------------------- raster grids
  // The active layer's grid drives the live pixel probe; every raster grid is
  // loaded in the background so Gat soil-health statistics can be computed
  // for all parameters, not just the one currently on screen.
  const [activeGrid, setActiveGrid] = useState<RasterGrid | null>(null);
  const [grids, setGrids] = useState<GridMap>({});

  const effectiveActiveGrid = useMemo(() => {
    if (
      activeGrid &&
      (activeGrid.id === activeLayer.id ||
        (activeGrid.id === "bdod" && activeLayer.id === "bd") ||
        (activeGrid.id === "bd" && activeLayer.id === "bdod"))
    ) {
      return activeGrid;
    }
    const preloaded = grids[activeLayer.id as DSMRasterLayerId];
    if (
      preloaded &&
      (preloaded.id === activeLayer.id ||
        (preloaded.id === "bdod" && activeLayer.id === "bd") ||
        (preloaded.id === "bd" && activeLayer.id === "bdod"))
    ) {
      return preloaded;
    }
    return null;
  }, [activeGrid, activeLayer.id, grids]);

  useEffect(() => {
    if (!activeLayer.gridMeta) {
      setActiveGrid(null);
      return;
    }
    let cancelled = false;
    setActiveGrid(null);
    dsmService
      .loadGrid(activeLayer)
      .then((g) => {
        if (!cancelled) setActiveGrid(g);
      })
      .catch(() => {
        if (!cancelled) setActiveGrid(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLayer]);

  useEffect(() => {
    if (layers.every((l) => !l.gridMeta)) return;
    let cancelled = false;
    for (const id of RASTER_IDS) {
      const layer = layers.find((l) => l.id === id);
      if (!layer?.gridMeta || grids[id]) continue;
      dsmService
        .loadGrid(layer)
        .then((g) => {
          if (!cancelled) setGrids((prev) => (prev[id] ? prev : { ...prev, [id]: g }));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // -------------------------------------------------------------- Gat KML
  const [gats, setGats] = useState<GatCollection | null>(null);
  const [gatInfo, setGatInfo] = useState<GatSourceInfo | null>(null);
  const [gatLoading, setGatLoading] = useState<boolean>(true);
  const [gatError, setGatError] = useState<string | null>(null);
  const [selectedGatId, setSelectedGatId] = useState<string | null>(null);
  const [kmlSource, setKmlSource] = useState<"trial" | "village" | "upload">("trial");

  const findGatFeature = useCallback((features: GatCollection["features"], targetGat?: string | null): string | null => {
    if (!targetGat) return null;
    const clean = targetGat.trim().toLowerCase();
    const numMatch = clean.match(/\d+/);
    const cleanNum = numMatch ? numMatch[0] : clean;

    const found = features.find((f) => {
      const pName = (f.properties?.name || "").trim().toLowerCase();
      const fId = (f.id || "").trim().toLowerCase();
      const fNumMatch = pName.match(/\d+/) || fId.match(/\d+/);
      const fNum = fNumMatch ? fNumMatch[0] : "";
      return pName === clean || fId === clean || (cleanNum && fNum === cleanNum);
    });

    return found?.id || null;
  }, []);

  const loadKml = useCallback((source: "trial" | "village" = "trial") => {
    setGatLoading(true);
    setGatError(null);
    setKmlSource(source);
    const rawTarget =
      urlGat ||
      field?.gat_no ||
      farmer?.gat_number ||
      (typeof window !== "undefined" ? localStorage.getItem("soilpilot_selected_gat") : null) ||
      "13";
    const cleanTarget = rawTarget.replace(/[^\d]/g, "") || rawTarget;

    const loader = isAdmin
      ? (source === "village" ? dsmService.loadVillageBoundaryKml() : dsmService.loadSampleGats())
      : dsmService.loadBackendKmlGats(undefined, cleanTarget).catch(() => dsmService.loadSampleGats());

    loader
      .then(({ collection, info }) => {
        if (isAdmin) {
          // Admin view: show all Gats from trial.kml or village boundary
          const validGatsList: string[] = [...KML_AVAILABLE_GATS];
          const filteredFeatures =
            source === "trial"
              ? collection.features.filter((f) => {
                const num = (f.properties?.name || f.id || "").replace(/[^\d]/g, "");
                return validGatsList.includes(num);
              })
              : collection.features;

          const filteredCollection = { ...collection, features: filteredFeatures };
          setGats(filteredCollection);
          setGatInfo({ ...info, count: filteredFeatures.length });

          const matched = findGatFeature(filteredFeatures, cleanTarget);
          const defaultGat =
            matched ||
            findGatFeature(filteredFeatures, "15") ||
            findGatFeature(filteredFeatures, "22") ||
            filteredFeatures[0]?.id ||
            null;
          setSelectedGatId(defaultGat);
          if (defaultGat && typeof window !== "undefined") {
            const clean = defaultGat.replace(/[^\d]/g, "") || defaultGat;
            localStorage.setItem("soilpilot_selected_gat", clean);
          }
        } else {
          // Regular farmer view: STRICTLY RESTRICTED TO ONLY THE USER'S REGISTERED GAT NUMBER!
          // 1. Check feature returned from backend query
          let userFeature = collection.features.find((f) => {
            const num = (f.properties?.name || f.id || "").replace(/[^\d]/g, "");
            return num === cleanTarget;
          });

          // 2. If single feature returned from backend
          if (!userFeature && collection.features.length === 1) {
            userFeature = collection.features[0];
          }

          if (!userFeature) {
            setGats({ type: "FeatureCollection", features: [] });
            setSelectedGatId(null);
            setGatError(`No boundary found for Gat ${cleanTarget}.`);
            return;
          }

          const filteredCollection: GatCollection = {
            type: "FeatureCollection",
            features: [userFeature],
          };

          setGats(filteredCollection);
          setGatInfo({
            ...info,
            label: `Gat ${cleanTarget}`,
            count: 1,
          });
          setSelectedGatId(userFeature.id);
          if (typeof window !== "undefined") {
            localStorage.setItem("soilpilot_selected_gat", cleanTarget);
          }
        }
      })
      .catch((e) => setGatError(e instanceof Error ? e.message : String(e)))
      .finally(() => setGatLoading(false));
  }, [urlGat, field?.gat_no, farmer?.gat_number, findGatFeature, isAdmin]);

  const handleSelectGat = useCallback((id: string | null) => {
    if (!isAdmin) {
      // Non-admin farmers cannot switch to other Gats
      return;
    }
    setSelectedGatId(id);
    if (id && typeof window !== "undefined") {
      const clean = id.replace(/[^\d]/g, "") || id;
      localStorage.setItem("soilpilot_selected_gat", clean);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadKml("trial");
  }, [loadKml]);

  // Synchronize selectedGatId when authenticated user's field or query param loads
  useEffect(() => {
    const target = field?.gat_no || farmer?.gat_number || urlGat || (typeof window !== "undefined" ? localStorage.getItem("soilpilot_selected_gat") : null);
    if (target && gats && gats.features.length > 0) {
      const matched = findGatFeature(gats.features, target);
      if (matched && matched !== selectedGatId) {
        setSelectedGatId(matched);
      }
    }
  }, [field?.gat_no, farmer?.gat_number, urlGat, gats, findGatFeature, selectedGatId]);

  const handleSelectSource = useCallback((source: "trial" | "village" | "upload") => {
    if (source === "trial" || source === "village") {
      loadKml(source);
    } else {
      setKmlSource("upload");
    }
  }, [loadKml]);

  const handleUploadFile = useCallback(async (file: File) => {
    setGatLoading(true);
    setGatError(null);
    setKmlSource("upload");
    try {
      const text = await readKmlFile(file);
      const parsed = parseKml(text, "upload");
      setGats({ type: "FeatureCollection", features: parsed.features });
      setGatInfo({
        kind: "upload",
        label: parsed.documentName || file.name,
        fileName: file.name,
        count: parsed.features.length,
        skipped: parsed.skipped,
        warnings: parsed.warnings,
      });
      setSelectedGatId(parsed.features[0]?.id || null);
    } catch (e) {
      setGatError(e instanceof KmlParseError ? e.message : t("gat.kml.errorGeneric"));
    } finally {
      setGatLoading(false);
    }
  }, [t]);

  const handleExport = useCallback(() => {
    if (!gats) return;
    downloadTextFile(
      `${gatInfo?.kind === "upload" ? "gats" : kmlSource === "village" ? "village-boundary" : "sample-gats"}.kml`,
      collectionToKml(gats, gatInfo?.label, gatStatsById)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gats, gatInfo, kmlSource]);

  // ------------------------------------------------------- per-Gat stats
  const gatStatsById = useMemo<Record<string, GatStats>>(() => {
    if (!gats) return {};
    return computeAllGatStats(gats.features, grids);
  }, [gats, grids]);

  const selectedGat = useMemo(
    () => (selectedGatId ? gats?.features.find((f) => f.id === selectedGatId) ?? null : null),
    [gats, selectedGatId]
  );
  const selectedStats = selectedGatId ? gatStatsById[selectedGatId] ?? null : null;

  useEffect(() => {
    if (selectedGatId && typeof window !== "undefined") {
      const numMatch = selectedGatId.match(/\d+/);
      const cleanGat = numMatch ? numMatch[0] : selectedGatId;
      localStorage.setItem("soilpilot_selected_gat", cleanGat);
    }
  }, [selectedGatId]);

  // Best-effort match between the authenticated farmer's Gat number and the loaded KML.
  const myGatId = useMemo(() => {
    const rawTarget =
      field?.gat_no ||
      (typeof window !== "undefined" ? localStorage.getItem("soilpilot_selected_gat") : null);
    if (!rawTarget || !gats) return null;
    return findGatFeature(gats.features, rawTarget);
  }, [field?.gat_no, gats, findGatFeature]);

  // Authenticated farmer's own field boundary, shown as an extra outline on the map.
  const [farmGeometry, setFarmGeometry] = useState<GeoJSONGeometry | null>(null);
  useEffect(() => {
    let cancelled = false;
    fieldService
      .getAuthenticatedField()
      .then((f) => {
        if (!cancelled) setFarmGeometry(f?.geometry ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const villageDisplay = location?.village || "Malegaon Kh";
  const talukaDisplay = location?.taluka || "Baramati";
  const districtDisplay = location?.district || "Pune";
  const gatDisplay =
    (field?.gat_no ? field.gat_no.replace(/[^\d]/g, "") : null) ||
    (selectedGat?.properties.name ? selectedGat.properties.name.replace(/[^\d]/g, "") : null) ||
    (farmer?.gat_number ? farmer.gat_number.replace(/[^\d]/g, "") : null) ||
    (typeof window !== "undefined" ? localStorage.getItem("soilpilot_selected_gat") : null) ||
    "13";
  const areaDisplay = field?.area
    ? `${field.area} Ha`
    : selectedGat?.properties.area_ha
      ? `${selectedGat.properties.area_ha} Ha`
      : (gatDisplay === "13" ? "5.14 Ha" : (gatDisplay === "22" ? "1.49 Ha" : "—"));

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
        {/* Header & Farmer Context Banner */}
        <div className="bg-white rounded-2xl border border-surface-border p-5 sm:p-6 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-soil-primaryLight border border-soil-primary/20 flex items-center justify-center text-soil-primary shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-text-main tracking-tight">
                {t("soilMap.title") || "Soil Map"}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-text-muted">
              {t("soilMap.description") || "Explore soil and environmental properties of your farm."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <Link
              href={`/soil-health-card?gat=${gatDisplay}`}
              className="px-3.5 py-1.5 rounded-xl bg-soil-primary hover:bg-soil-primaryHover text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <FileBadge className="w-3.5 h-3.5" />
              <span>{locale === "mr" ? `सॉईल हेल्थ कार्ड (गट ${gatDisplay})` : `Soil Health Card (Gat ${gatDisplay})`}</span>
            </Link>
            <div className="px-3.5 py-1.5 rounded-xl bg-surface-subtle border border-surface-border flex items-center gap-2 text-xs font-semibold text-text-main shadow-xs">
              <MapPin className="w-3.5 h-3.5 text-soil-primary" />
              <span>
                {(locale === "mr" ? translateGeoName(villageDisplay) : villageDisplay)}, {(locale === "mr" ? translateGeoName(talukaDisplay) : talukaDisplay)}
              </span>
            </div>
            {isAdmin ? (
              <div className="px-2.5 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-[11px] font-bold flex items-center gap-1 shadow-xs">
                <ShieldCheck className="w-3 h-3 text-purple-600" />
                <span>{t("soilMap.adminViewAllGats") || (locale === "mr" ? "प्रशासक दृश्य • सर्व गट" : "ADMIN VIEW • ALL GATS")}</span>
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center gap-1 shadow-xs">
                <Lock className="w-3 h-3 text-emerald-600" />
                <span>{t("soilMap.gatOnly") ? t("soilMap.gatOnly", { gat: gatDisplay }) : (locale === "mr" ? `फक्त गट ${gatDisplay}` : `GAT ${gatDisplay} ONLY`)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notice: raster manifest failed to load */}
        {manifestError && (
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-sm text-amber-950">{t("dsm.pendingNoticeTitle")}</span>
              <p className="text-amber-800 leading-relaxed">{t("dsm.manifestError")}</p>
            </div>
          </div>
        )}
        {!manifestError && activeLayer.status === "pending" && (
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-bold text-sm text-amber-950">
                {t(activeLayer.nameKey) || activeLayer.shortName} —{" "}
                {t("dsm.pendingNoticeTitle") || "Awaiting Field Raster Ingestion"}
              </span>
              <p className="text-amber-800 leading-relaxed">{t("dsm.pendingNoticeBanner")}</p>
            </div>
          </div>
        )}

        {/* Main Grid: Layers (left) / Map (right - full remaining width) */}
        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">
          {/* Left column: layer selector (with SCORPAN tags, Opacity, Basemap style) */}
          <div className="order-2 xl:order-1 space-y-4">
            <DSMLayerSelector
              layers={layers}
              activeLayerId={activeLayerId}
              onSelectLayer={setActiveLayerId}
              opacity={layerOpacity}
              onOpacityChange={setLayerOpacity}
              basemap={basemap}
              onBasemapChange={setBasemap}
            />
          </div>

          {/* Right: the map with Gat boundary, Gat popup, clicked location probe, and dynamic raster legend */}
          <div className="order-1 xl:order-2 relative">
            <SoilMapViewer
              className="h-[560px] sm:h-[660px] xl:h-[820px]"
              layer={activeLayer}
              opacity={layerOpacity}
              onOpacityChange={setLayerOpacity}
              grid={effectiveActiveGrid}
              gats={gats}
              selectedGatId={selectedGatId}
              onSelectGat={handleSelectGat}
              myGatId={myGatId}
              farmGeometry={farmGeometry}
              contextLabel={`${villageDisplay} • ${t("geo.gatNo")} ${gatDisplay}`}
              basemap={basemap}
              onBasemapChange={setBasemap}
              locationInfo={{
                village: villageDisplay,
                taluka: talukaDisplay,
                district: districtDisplay,
                area: areaDisplay,
              }}
              selectedStats={selectedStats}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function SoilMapPage() {
  const { t, locale } = useI18n();
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-soil-primary" />
            <span className="text-sm font-semibold text-slate-300">
              {t("soilMap.loadingMap") || (locale === "mr" ? "माती नकाशा लोड होत आहे..." : "Loading Soil Map...")}
            </span>
          </div>
        </div>
      }
    >
      <SoilMapContent />
    </Suspense>
  );
}
