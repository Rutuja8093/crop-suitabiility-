"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from "leaflet";
import { Plus, Minus, Crosshair } from "lucide-react";

export type BasemapType = "satellite" | "street" | "topo";

interface CropSuitabilityMapProps {
  geoJsonData: any;
  selectedGatNo: string | null;
  onSelectGat: (gatNo: string | null) => void;
  cropName: string;
  className?: string;
  focusSelectedOnly?: boolean;
}

const CLASS_COLORS: Record<string, { fill: string; border: string; label: string; labelMr: string }> = {
  S1: { fill: "#16a34a", border: "#15803d", label: "Highly Suitable", labelMr: "उच्च अनुकूल" },
  S2: { fill: "#eab308", border: "#ca8a04", label: "Moderately Suitable", labelMr: "मध्यम अनुकूल" },
  S3: { fill: "#f97316", border: "#ea580c", label: "Marginally Suitable", labelMr: "किमान अनुकूल" },
  N: { fill: "#dc2626", border: "#b91c1c", label: "Not Suitable", labelMr: "अनुकूल नाही" },
  UNCERTAIN: { fill: "#9ca3af", border: "#6b7280", label: "Uncertain / Missing", labelMr: "अपूर्ण माहिती" },
};

export const CropSuitabilityMap: React.FC<CropSuitabilityMapProps> = ({
  geoJsonData,
  selectedGatNo,
  onSelectGat,
  cropName,
  className = "",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const geojsonLayerRef = useRef<LeafletGeoJSON | null>(null);
  const tileLayerRef = useRef<any>(null);
  const [basemap, setBasemap] = useState<BasemapType>("satellite");
  const [isolateSelected, setIsolateSelected] = useState<boolean>(true);

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let map = mapInstanceRef.current;
    if (!map) {
      import("leaflet").then((L) => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        // Create Leaflet instance centered on Malegaon Khurd
        map = L.map(mapContainerRef.current, {
          center: [18.146, 74.512],
          zoom: 14,
          minZoom: 12,
          maxZoom: 21,
          zoomControl: false,
        });

        // Initial satellite tile layer (Google Satellite - crisp at high zoom up to zoom 21)
        const tile = L.tileLayer(
          "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
          {
            maxZoom: 21,
            subdomains: ["mt0", "mt1", "mt2", "mt3"],
            attribution: "&copy; Google Satellite",
          }
        ).addTo(map);

        tileLayerRef.current = tile;
        mapInstanceRef.current = map;
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Basemap Switch
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }

      let url = "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
      let attr = "&copy; Google Satellite";
      let subdomains: string[] | undefined = ["mt0", "mt1", "mt2", "mt3"];
      let maxZoom = 21;

      if (basemap === "street") {
        url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        attr = "&copy; OpenStreetMap contributors";
        subdomains = ["a", "b", "c"];
        maxZoom = 19;
      } else if (basemap === "topo") {
        url = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
        attr = "&copy; OpenTopoMap";
        subdomains = ["a", "b", "c"];
        maxZoom = 17;
      }

      const newTile = L.tileLayer(url, { maxZoom, subdomains, attribution: attr }).addTo(map);
      tileLayerRef.current = newTile;

      if (geojsonLayerRef.current) {
        geojsonLayerRef.current.bringToFront();
      }
    });
  }, [basemap]);

  // Update GeoJSON Layer when data or selection changes
  useEffect(() => {
    if (!mapInstanceRef.current || !geoJsonData || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      if (geojsonLayerRef.current) {
        map.removeLayer(geojsonLayerRef.current);
        geojsonLayerRef.current = null;
      }

      const layer = L.geoJSON(geoJsonData, {
        style: (feature: any) => {
          const props = feature?.properties || {};
          const gatNo = String(props.gat_no || "").trim();
          const sClass = props.suitability_class || "UNCERTAIN";
          const colorCfg = CLASS_COLORS[sClass] || CLASS_COLORS.UNCERTAIN;
          const isSelected = selectedGatNo && String(selectedGatNo).trim() === gatNo;

          // When a Gat is selected and isolateSelected is active: highlight ONLY the selected Gat
          if (selectedGatNo && isolateSelected) {
            if (isSelected) {
              return {
                fillColor: colorCfg.fill,
                fillOpacity: 0.85,
                color: "#ffffff",
                weight: 4,
                dashArray: "",
              };
            }
            // Hide other parcels completely or leave invisible click hitboxes
            return {
              fillColor: "transparent",
              fillOpacity: 0,
              color: "rgba(255, 255, 255, 0.08)",
              weight: 0.5,
              dashArray: "2, 2",
            };
          }

          // Full village overview mode:
          if (isSelected) {
            return {
              fillColor: colorCfg.fill,
              fillOpacity: 0.9,
              color: "#ffffff",
              weight: 3.5,
              dashArray: "",
            };
          }

          return {
            fillColor: colorCfg.fill,
            fillOpacity: 0.65,
            color: colorCfg.border,
            weight: 1.2,
            dashArray: "",
          };
        },
        onEachFeature: (feature: any, featureLayer: any) => {
          const props = feature?.properties || {};
          const gatNo = props.gat_no;
          const sClass = props.suitability_class || "UNCERTAIN";
          const score = props.suitability_score;
          const area = props.area_ha ? `${props.area_ha} ha` : "";
          const colorCfg = CLASS_COLORS[sClass] || CLASS_COLORS.UNCERTAIN;

          // Tooltip on hover
          featureLayer.bindTooltip(
            `
            <div style="font-family: inherit; font-size: 12px; line-height: 1.3;">
              <strong style="color: #0f172a; font-size: 13px;">Gat ${gatNo}</strong> ${area ? `(${area})` : ""}
              <div style="margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colorCfg.fill};"></span>
                <strong>${sClass}</strong>: ${colorCfg.label}
              </div>
              ${score ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Score: <strong>${score}%</strong></div>` : ""}
            </div>
            `,
            { sticky: true, opacity: 0.95, direction: "top", offset: [0, -10] }
          );

          // Click handler
          featureLayer.on("click", (e: any) => {
            L.DomEvent.stopPropagation(e);
            onSelectGat(gatNo);
          });
        },
      }).addTo(map);

      geojsonLayerRef.current = layer;

      // If a Gat is selected, zoom/pan tightly to it
      if (selectedGatNo) {
        layer.eachLayer((l: any) => {
          if (String(l.feature?.properties?.gat_no).trim() === String(selectedGatNo).trim() && l.getBounds) {
            map.fitBounds(l.getBounds(), { maxZoom: 18, padding: [60, 60] });
          }
        });
      }
    });
  }, [geoJsonData, selectedGatNo, onSelectGat, isolateSelected]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleResetView = () => {
    if (geojsonLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(geojsonLayerRef.current.getBounds(), { padding: [30, 30] });
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([18.146, 74.512], 14);
    }
  };

  return (
    <div className={`relative w-full h-full min-h-[520px] rounded-2xl overflow-hidden border border-surface-border shadow-subtle ${className}`}>
      {/* The Leaflet Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[520px] z-0" />

      {/* Top Right: Active Crop Pill */}
      <div className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-subtle border border-surface-border/80 flex items-center gap-2 text-xs font-semibold text-text-main">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>Evaluating Crop: <strong className="text-soil-primary">{cropName}</strong></span>
      </div>

      {/* Bottom Left: Suitability Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur-md rounded-xl shadow-subtle border border-surface-border/80 p-3 max-w-[240px]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center justify-between">
          <span>Suitability Classes</span>
          <span className="text-[10px] font-normal lowercase">(FAO S1-N)</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-emerald-600 shadow-xs shrink-0" />
              <span className="font-semibold text-text-main">S1: Highly Suitable</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700">80–100%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-yellow-500 shadow-xs shrink-0" />
              <span className="font-semibold text-text-main">S2: Moderately Suitable</span>
            </div>
            <span className="text-[11px] font-bold text-yellow-700">60–&lt;80%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-orange-500 shadow-xs shrink-0" />
              <span className="font-semibold text-text-main">S3: Marginally Suitable</span>
            </div>
            <span className="text-[11px] font-bold text-orange-700">40–&lt;60%</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm bg-red-600 shadow-xs shrink-0" />
              <span className="font-semibold text-text-main">N: Not Suitable</span>
            </div>
            <span className="text-[11px] font-bold text-red-700">&lt;40%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
