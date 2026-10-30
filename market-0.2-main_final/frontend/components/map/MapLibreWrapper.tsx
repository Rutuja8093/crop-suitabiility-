"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { Map as LeafletMap, ImageOverlay, GeoJSON, Marker as LeafletMarker, TileLayer } from "leaflet";
import { GeoJSONGeometry } from "@/services/fieldService";
import { useI18n } from "@/i18n/useI18n";
import { Plus, Minus, Focus, Satellite, Map as StreetIcon } from "lucide-react";
import { DSMLayerConfig } from "@/types/gis";
import { generateParcelLayerCanvas } from "./SoilMapViewer";

interface MapLibreWrapperProps {
  geometry: GeoJSONGeometry;
  gatNo: string;
  villageName?: string;
  talukaName?: string;
  districtName?: string;
  areaText?: string;
  className?: string;
  interactive?: boolean;
  allPlotsGeoJSON?: any;
  dsmLayer?: DSMLayerConfig | null;
  dsmOpacity?: number;
}

// Bounding box calculator for GeoJSON Polygon / MultiPolygon [minLng, minLat, maxLng, maxLat]
function computeBounds(geom: GeoJSONGeometry): [number, number, number, number] | null {
  if (!geom || !geom.coordinates) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const traverse = (coords: any) => {
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) {
      for (const item of coords) {
        traverse(item);
      }
    }
  };

  traverse(geom.coordinates);

  if (minLng === Infinity || minLat === Infinity) return null;
  return [minLng, minLat, maxLng, maxLat];
}

export const MapLibreWrapper: React.FC<MapLibreWrapperProps> = ({
  geometry,
  gatNo,
  villageName = "Malegaon",
  talukaName = "Baramati",
  districtName = "Pune",
  areaText,
  className = "h-[560px]",
  interactive = true,
  allPlotsGeoJSON,
  dsmLayer,
  dsmOpacity = 0.75,
}) => {
  const { t, language } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<any>(null);

  // Layers
  const tileLayerRef = useRef<TileLayer | null>(null);
  const farmLayerRef = useRef<GeoJSON | null>(null);
  const allPlotsLayerRef = useRef<GeoJSON | null>(null);
  const centerMarkerRef = useRef<LeafletMarker | null>(null);
  const sampleDotMarkerRef = useRef<any>(null);
  const dsmLayerRef = useRef<ImageOverlay | TileLayer | null>(null);

  const [activeBasemap, setActiveBasemap] = useState<"satellite" | "street">("satellite");
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);

  // Farmer-friendly popup HTML
  const createPopupHTML = useCallback(
    (props: any, isSelected: boolean) => {
      const plotGat = props.gat_no || gatNo;
      const plotVillage = props.village || villageName || "Malegaon";
      const plotTaluka = props.taluka || talukaName || "Baramati";
      const plotDistrict = props.district || districtName || "Pune";
      const areaNum = props.area ? Number(props.area) : null;
      const isAcre = props.area_unit?.toLowerCase().includes("acre") || props.area_unit?.toLowerCase() === "ac";
      const areaInAcres = areaNum && !isNaN(areaNum)
        ? (isAcre ? areaNum : Number((areaNum * 2.47105).toFixed(2)))
        : null;
      const plotArea = areaInAcres !== null
        ? `${areaInAcres} ${language === "mr" ? "एकर" : "Acres"}`
        : areaText || (language === "mr" ? "उपलब्ध नाही" : "Not Available");
      const plotSource = props.source || "Demo GIS Data";

      const titleText = isSelected
        ? language === "mr"
          ? "🌱 तुमचे शेत"
          : "🌱 Your Farm"
        : language === "mr"
        ? "भूखंड तपशील"
        : "Plot Details";

      const gatLabel = language === "mr" ? "गट क्रमांक" : "Gat No.";
      const villageLabel = language === "mr" ? "गाव" : "Village";
      const talukaLabel = language === "mr" ? "तालुका" : "Taluka";
      const districtLabel = language === "mr" ? "जिल्हा" : "District";
      const areaLabel = language === "mr" ? "क्षेत्रफळ" : "Area";
      const sourceLabel = language === "mr" ? "स्रोत" : "Source";
      const viewButtonText = language === "mr" ? "शेताचा तपशील पहा" : "View Farm Details";
      const badgeText = language === "mr" ? "निवडलेले" : "Selected";

      return `
      <div style="font-family: inherit; padding: 12px 14px; min-width: 220px; color: #1e293b;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 8px;">
          <span style="font-weight: 800; font-size: 13px; color: #2A7C13;">
            ${titleText}
          </span>
          ${isSelected ? `<span style="font-size: 10px; font-weight: 700; background: #2A7C13; color: white; padding: 2px 6px; border-radius: 4px;">${badgeText}</span>` : ""}
        </div>
        <div style="font-size: 12px; line-height: 1.6;">
          <div style="display: flex; justify-content: space-between; gap: 8px;">
            <span style="color: #64748b;">${gatLabel}:</span>
            <span style="font-weight: 700; color: #0f172a;">${plotGat}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px;">
            <span style="color: #64748b;">${villageLabel}:</span>
            <span style="font-weight: 600;">${plotVillage}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px;">
            <span style="color: #64748b;">${talukaLabel}, ${districtLabel}:</span>
            <span>${plotTaluka}, ${plotDistrict}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px; margin-top: 2px;">
            <span style="color: #64748b;">${areaLabel}:</span>
            <span style="font-weight: 700; color: #2A7C13;">${plotArea}</span>
          </div>
        </div>
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #94a3b8;">
          <span>${sourceLabel}: ${plotSource}</span>
          ${isSelected ? `<a href="/my-farm" style="color: #2A7C13; font-weight: 700; text-decoration: none;">${viewButtonText} →</a>` : ""}
        </div>
      </div>
    `;
    },
    [gatNo, villageName, talukaName, districtName, areaText, language]
  );

  // Fit camera smoothly to the field boundary
  const fitToFarm = useCallback(() => {
    const map = mapRef.current;
    const farmLayer = farmLayerRef.current;
    if (!map) return;

    if (farmLayer && farmLayer.getBounds().isValid()) {
      map.fitBounds(farmLayer.getBounds(), {
        padding: [60, 60],
        maxZoom: 18,
        animate: true,
      });
      return;
    }

    const bounds = computeBounds(geometry);
    if (bounds) {
      map.fitBounds(
        [
          [bounds[1], bounds[0]],
          [bounds[3], bounds[2]],
        ],
        {
          padding: [60, 60],
          maxZoom: 18,
          animate: true,
        }
      );
    }
  }, [geometry]);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let isMounted = true;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;
      leafletRef.current = L;

      // Clean up previous instance if any
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const initialBounds = computeBounds(geometry);
      const centerLat = initialBounds ? (initialBounds[1] + initialBounds[3]) / 2 : 18.166;
      const centerLng = initialBounds ? (initialBounds[0] + initialBounds[2]) / 2 : 74.505;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
        fadeAnimation: true,
        zoomAnimation: true,
      });

      // Google Satellite Tile Layer (Crisp, seamless, maxZoom 21)
      const tile = L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        maxZoom: 21,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
      }).addTo(map);
      tileLayerRef.current = tile;

      // Attribution
      L.control
        .attribution({
          prefix: false,
          position: "bottomright",
        })
        .addAttribution('&copy; Google &mdash; Esri')
        .addTo(map);

      mapRef.current = map;
      setMapLoaded(true);
    })();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Basemap Switcher (Satellite <-> Street)
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapLoaded) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (activeBasemap === "satellite") {
      tileLayerRef.current = L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
        maxZoom: 21,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
      }).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
    }

    // Ensure tile layer stays at the back
    tileLayerRef.current?.bringToBack();
  }, [activeBasemap, mapLoaded]);

  // 3. Render Parcel Polygon, Centered Badge & Neighbor Plots
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapLoaded) return;

    // Clean up previous layers
    if (allPlotsLayerRef.current) {
      map.removeLayer(allPlotsLayerRef.current);
      allPlotsLayerRef.current = null;
    }
    if (farmLayerRef.current) {
      map.removeLayer(farmLayerRef.current);
      farmLayerRef.current = null;
    }
    if (centerMarkerRef.current) {
      map.removeLayer(centerMarkerRef.current);
      centerMarkerRef.current = null;
    }
    if (sampleDotMarkerRef.current) {
      map.removeLayer(sampleDotMarkerRef.current);
      sampleDotMarkerRef.current = null;
    }

    // A. Background Neighbor Plots (if provided for Admin)
    if (allPlotsGeoJSON && allPlotsGeoJSON.features && allPlotsGeoJSON.features.length > 0) {
      const neighborLayer = L.geoJSON(allPlotsGeoJSON, {
        style: () => ({
          color: "#00e676",
          weight: 1.6,
          opacity: 0.55,
          fillColor: "#76C457",
          fillOpacity: 0.05,
          lineJoin: "round",
          lineCap: "round",
        }),
        onEachFeature: (feature: any, layer: any) => {
          if (interactive && feature.properties) {
            layer.bindPopup(createPopupHTML(feature.properties, false));
          }
        },
      }).addTo(map);
      allPlotsLayerRef.current = neighborLayer;
    }

    // B. Selected Farmer Plot (Bright Neon Green Boundary Overlay)
    if (geometry) {
      const featureData = {
        type: "Feature",
        properties: {
          gat_no: gatNo,
          village: villageName,
          taluka: talukaName,
          district: districtName,
          area: areaText?.replace(/[^0-9.]/g, "") || null,
          source: "Demo GIS Data",
        },
        geometry: geometry,
      };

      const farmLayer = L.geoJSON(featureData as any, {
        style: () => ({
          color: "#00e676", // Vibrant neon green matching reference
          weight: 3.8, // Prominent cadastral boundary line
          opacity: 1.0,
          fillColor: "#00e676",
          fillOpacity: 0.14, // Subtle translucent green highlight
          lineJoin: "round",
          lineCap: "round",
        }),
      }).addTo(map);
      farmLayerRef.current = farmLayer;

      // Bring selected parcel to front
      farmLayer.bringToFront();

      // C. Centered Badge inside Farm Polygon: "Gat No. 13"
      const bounds = farmLayer.getBounds();
      if (bounds.isValid()) {
        const center = bounds.getCenter();
        const badgeHtml = `
          <div style="display: inline-flex; align-items: center; justify-content: center; width: auto; max-width: max-content; white-space: nowrap; padding: 4px 12px; border-radius: 6px; background: rgba(15, 23, 42, 0.90); color: #ffffff; font-size: 13px; font-weight: 700; border: 1.5px solid rgba(245, 158, 11, 0.95); box-shadow: 0 4px 14px rgba(0,0,0,0.55); pointer-events: none; user-select: none;">
            Gat No. ${gatNo}
          </div>
        `;

        const badgeIcon = L.divIcon({
          className: "soilpilot-custom-gat-marker",
          html: badgeHtml,
          iconSize: [100, 30],
          iconAnchor: [50, 15],
        });

        const marker = L.marker(center, {
          icon: badgeIcon,
          interactive: false,
          zIndexOffset: 1000,
        }).addTo(map);
        centerMarkerRef.current = marker;

        // Auto-fit bounds to the selected Gat
        map.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 17,
          animate: true,
        });

        // D. Interactive Popup on Parcel Click
        if (interactive) {
          farmLayer.on("click", (e: any) => {
            L.popup({
              offset: [0, -10],
              closeButton: true,
              className: "soilpilot-popup-card",
            })
              .setLatLng(e.latlng)
              .setContent(
                createPopupHTML(
                  {
                    gat_no: gatNo,
                    village: villageName,
                    taluka: talukaName,
                    district: districtName,
                    area: areaText?.replace(/[^0-9.]/g, "") || null,
                    source: "Demo GIS Data",
                  },
                  true
                )
              )
              .openOn(map);
          });
        }
      }
    }
  }, [
    geometry,
    gatNo,
    villageName,
    talukaName,
    districtName,
    areaText,
    allPlotsGeoJSON,
    interactive,
    mapLoaded,
    createPopupHTML,
  ]);

  // 4. Dynamic DSM Layer Handling (if passed to FarmMap)
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !mapLoaded) return;

    if (dsmLayerRef.current) {
      map.removeLayer(dsmLayerRef.current);
      dsmLayerRef.current = null;
    }

    if (!dsmLayer || dsmLayer.id === "farm_boundary") return;

    // Check if we have polygon geometry to generate crisp clipped parcel canvas
    let outerRing: [number, number][] = [];
    if (geometry) {
      if (geometry.type === "Polygon") {
        outerRing = (geometry.coordinates[0] || []) as [number, number][];
      } else if (geometry.type === "MultiPolygon") {
        outerRing = (geometry.coordinates[0]?.[0] || []) as [number, number][];
      }
    }

    const b = computeBounds(geometry);
    if (outerRing.length >= 3 && b) {
      const [minLng, minLat, maxLng, maxLat] = b;
      const bounds = { minLng, maxLng, minLat, maxLat };
      const overlayUrl = generateParcelLayerCanvas(outerRing, dsmLayer, null, bounds);
      if (overlayUrl) {
        const overlay = L.imageOverlay(overlayUrl, [[minLat, minLng], [maxLat, maxLng]], {
          opacity: dsmOpacity,
          interactive: false,
          zIndex: 5,
        }).addTo(map);
        dsmLayerRef.current = overlay;

        const dLng = maxLng - minLng || 0.0001;
        const dLat = maxLat - minLat || 0.0001;
        const clipPoints = outerRing.map(([lng, lat]) => {
          const x = Math.max(0, Math.min(100, ((lng - minLng) / dLng) * 100));
          const y = Math.max(0, Math.min(100, ((maxLat - lat) / dLat) * 100));
          return `${x.toFixed(4)}% ${y.toFixed(4)}%`;
        });
        const clipPathCss = `polygon(${clipPoints.join(", ")})`;

        const applyClip = () => {
          const el = overlay.getElement();
          if (el) {
            el.style.clipPath = clipPathCss;
            el.style.webkitClipPath = clipPathCss;
          }
        };

        applyClip();
        overlay.on("load", applyClip);
        map.on("zoomend", applyClip);
        map.on("viewreset", applyClip);

        if (farmLayerRef.current) farmLayerRef.current.bringToFront();
        return;
      }
    }

    if (dsmLayer.rasterTileUrl) {
      const dsmLayerObj = L.tileLayer(dsmLayer.rasterTileUrl, {
        opacity: dsmOpacity,
        maxZoom: 21,
      }).addTo(map);
      dsmLayerRef.current = dsmLayerObj;
    } else if (dsmLayer.rasterImageUrl && dsmLayer.rasterBounds) {
      const [w, s, e, n] = dsmLayer.rasterBounds;
      const overlay = L.imageOverlay(dsmLayer.rasterImageUrl, [[s, w], [n, e]], {
        opacity: dsmOpacity,
        interactive: false,
        zIndex: 5,
      }).addTo(map);
      dsmLayerRef.current = overlay;
    }

    // Keep raster under the boundary layer
    if (farmLayerRef.current) {
      farmLayerRef.current.bringToFront();
    }
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setZIndexOffset(1000);
    }
    if (sampleDotMarkerRef.current) {
      sampleDotMarkerRef.current.setZIndexOffset(1500);
    }
  }, [dsmLayer, dsmOpacity, mapLoaded]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden shadow-card border border-surface-border bg-slate-900 ${className}`}
    >
      {/* Map Canvas Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Top Left: Farmer Context Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl shadow-md border border-surface-border/80 flex items-center gap-2 text-xs font-semibold text-text-main">
          <span className="w-2.5 h-2.5 rounded-full bg-soil-primary animate-pulse" />
          <span>
            {villageName ? `${villageName} • ` : ""}
            {t("geo.gatNo")} {gatNo}
          </span>
          {areaText && (
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-soil-primaryLight font-bold text-soil-primary">
              {areaText}
            </span>
          )}
        </div>
      </div>

      {/* Top Right: Basemap Switcher */}
      {interactive && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-surface-border/80 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveBasemap("satellite")}
              aria-label={t("map.satellite") || "Satellite"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeBasemap === "satellite"
                  ? "bg-soil-primary text-white shadow-xs"
                  : "text-text-muted hover:text-text-main hover:bg-surface-subtle"
              }`}
            >
              <Satellite className="w-3.5 h-3.5" />
              <span>{t("map.satellite") || "Satellite"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveBasemap("street")}
              aria-label={t("map.street") || "Street"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeBasemap === "street"
                  ? "bg-soil-primary text-white shadow-xs"
                  : "text-text-muted hover:text-text-main hover:bg-surface-subtle"
              }`}
            >
              <StreetIcon className="w-3.5 h-3.5" />
              <span>{t("map.street") || "Street"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Left: Navigation & Fit-to-Farm Controls */}
      {interactive && (
        <div className="absolute bottom-6 left-4 z-10 flex flex-col gap-1.5">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-surface-border/80 p-1 flex flex-col gap-1">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label={t("myFarm.zoomIn") || "Zoom in"}
              title={t("myFarm.zoomIn") || "Zoom in"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-surface-subtle active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="w-full h-px bg-surface-border" />
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label={t("myFarm.zoomOut") || "Zoom out"}
              title={t("myFarm.zoomOut") || "Zoom out"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-main hover:bg-surface-subtle active:scale-95 transition-all cursor-pointer"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={fitToFarm}
            aria-label={t("map.fitToFarm") || "Fit to farm"}
            title={t("map.fitToFarm") || "Fit to farm"}
            className="w-10 h-10 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-surface-border/80 flex items-center justify-center text-soil-primary hover:bg-soil-primaryLight/50 active:scale-95 transition-all cursor-pointer"
          >
            <Focus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
