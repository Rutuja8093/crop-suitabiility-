import { api } from "@/lib/api/client";
import {
  BBox,
  ColorStop,
  DSMLayerConfig,
  DSMLayerId,
  DSMManifest,
  DSMManifestLayer,
  DSMRasterLayerId,
} from "@/types/gis";
import { GatCollection, GatSourceInfo } from "@/types/gat";
import { DSM_LAYERS, DSM_LAYER_LIST, DSM_LAYER_ORDER } from "@/lib/gis/dsmLayers";
import { RasterGrid, createGrid } from "@/lib/gis/rasterGrid";
import { parseKml } from "@/lib/kml/parseKml";

/**
 * Where the DSM bundle (manifest.json, layers/*.png, grids/*.bin, sample-gats.kml) is served from.
 * Defaults to the Next.js public folder; point NEXT_PUBLIC_DSM_DATA_URL at a CDN / bucket to host it elsewhere.
 */
export const DSM_DATA_URL = (process.env.NEXT_PUBLIC_DSM_DATA_URL || "/data/dsm").replace(/\/+$/, "");

const url = (relative: string) => `${DSM_DATA_URL}/${relative.replace(/^\/+/, "")}`;

export interface GatOverlayInfo {
  url: string;
  bounds: [number, number, number, number]; // [w, s, e, n]
  latLngBounds: [[number, number], [number, number]];
  grid?: {
    rows: number;
    cols: number;
    bounds: [[number, number], [number, number]];
    values: (number | null)[][];
  };
}

export interface GatStatInfo {
  mean: number;
  min: number;
  max: number;
  std: number;
  p10: number;
  p90: number;
  classification: {
    status: string;
    color: string;
    advice: string;
  };
}

export interface GatDataFull {
  gat_id: string;
  name: string;
  village: string;
  taluka: string;
  district: string;
  area_acres: number;
  area_ha: number;
  area_sqm: number;
  centroid: [number, number];
  bounds: number[][];
  stats: Record<string, GatStatInfo>;
  overlays: Record<string, GatOverlayInfo>;
}

let manifestPromise: Promise<DSMManifest> | null = null;
let gatDataPromise: Promise<Record<string, GatDataFull>> | null = null;
const gridCache = new Map<DSMRasterLayerId, Promise<RasterGrid>>();

async function fetchOk(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${input}`);
  return res;
}

function toLayerConfig(m: DSMManifestLayer, bounds: BBox, base?: DSMLayerConfig): DSMLayerConfig {
  const local = base ?? DSM_LAYERS[m.id as DSMLayerId];
  const span = m.max - m.min;
  const colorStops: ColorStop[] = m.legendStops.map((s) => ({
    value: Number(s.value.toFixed(3)),
    color: s.color,
    label: s.label,
  }));
  return {
    ...(local || {}),
    id: m.id as DSMLayerId,
    nameKey: local?.nameKey || `dsm.layers.${m.id}.name`,
    shortName: local?.shortName || m.id.toUpperCase(),
    descriptionKey: local?.descriptionKey || `dsm.layers.${m.id}.desc`,
    sourceType: local?.sourceType || "SATELLITE DERIVED",
    sourceLabel: local?.sourceLabel || "Malegaon Khurd DSM",
    isDefault: local?.isDefault,
    name: m.name,
    unit: m.unit,
    status: "available",
    min: Number(m.min.toFixed(3)),
    max: Number(m.max.toFixed(3)),
    step: span > 0 ? span / 100 : undefined,
    colorStops,
    rasterBounds: bounds,
    rasterImageUrl: url(m.image),
    rasterGridUrl: url(m.grid.file),
    gridMeta: m.grid,
    category: m.category,
    categoryLabel: m.categoryLabel || local?.categoryLabel,
    categoryLabelMr: m.categoryLabelMr || local?.categoryLabelMr,
    marathiName: m.marathiName,
    description: m.description,
    mean: m.mean,
    std: m.std,
  };
}

export function createCustomGatFeature(gatNoStr: string) {
  // Disallowed by policy: No synthetic or fake boundaries.
  // The authoritative KMZ (final_gat_mmkh.kmz) is the single source of truth.
  return null;
}

export function getOrCreateGatEntry(data: Record<string, GatDataFull>, gatId: string): GatDataFull | null {
  const clean = gatId.replace(/[^\d]/g, "") || gatId;
  if (data[clean]) return data[clean];
  if (data[gatId]) return data[gatId];
  return null;
}

export const dsmService = {
  /** Fetch (and cache) the DSM manifest that lists every raster layer. */
  getManifest(): Promise<DSMManifest> {
    if (!manifestPromise) {
      manifestPromise = fetchOk(url("manifest.json"), { cache: "no-cache" })
        .then((r) => r.json() as Promise<DSMManifest>)
        .catch((err) => {
          manifestPromise = null; // allow retry
          throw err;
        });
    }
    return manifestPromise;
  },

  /**
   * Fetches every Digital Soil Mapping (DSM) layer.
   *  1. Layer catalogue from the backend (`/soil-layers`), falling back to the local list.
   *  2. Raster data (PNG overlay + value grid + colour ramp) from the DSM manifest.
   * Layers present in the manifest become "available"; the rest keep the backend / local status.
   * Never throws: if the manifest cannot be loaded the catalogue is returned with `manifestError` set.
   */
  async getLayers(): Promise<{ layers: DSMLayerConfig[]; manifestError: string | null }> {
    const byId = new Map<DSMLayerId, DSMLayerConfig>(DSM_LAYER_LIST.map((l) => [l.id, { ...l }]));

    // 1. Backend catalogue (optional)
    try {
      const response = await api.get<any[]>("/soil-layers");
      if (Array.isArray(response.data)) {
        for (const item of response.data) {
          const local = byId.get(item.id as DSMRasterLayerId);
          if (!local) continue;
          byId.set(local.id, {
            ...local,
            status: item.status ?? local.status,
            unit: item.unit ?? local.unit,
            min: item.min ?? local.min,
            max: item.max ?? local.max,
          });
        }
      }
    } catch {
      // Backend unavailable — local catalogue is fine
    }

    // 2. Raster manifest
    let manifestError: string | null = null;
    try {
      const manifest = await this.getManifest();
      for (const m of manifest.layers) {
        byId.set(m.id, toLayerConfig(m, manifest.bounds, byId.get(m.id)));
      }
    } catch (e) {
      manifestError = e instanceof Error ? e.message : "Could not load DSM manifest";
    }

    const layers = DSM_LAYER_ORDER.map((id) => byId.get(id)).filter((l): l is DSMLayerConfig => Boolean(l));
    return { layers, manifestError };
  },

  async getLayerById(layerId: string): Promise<DSMLayerConfig | null> {
    const { layers } = await this.getLayers();
    return layers.find((l) => l.id === layerId) ?? null;
  },

  /** Download + decode the value grid of one raster layer (cached). */
  loadGrid(layer: DSMLayerConfig): Promise<RasterGrid> {
    if (layer.id === "farm_boundary" || !layer.gridMeta || !layer.rasterGridUrl || !layer.rasterBounds) {
      return Promise.reject(new Error(`Layer "${layer.id}" has no raster grid`));
    }
    const id = layer.id as DSMRasterLayerId;
    let p = gridCache.get(id);
    if (!p) {
      const meta = layer.gridMeta;
      const bounds = layer.rasterBounds;
      p = fetchOk(layer.rasterGridUrl)
        .then((r) => r.arrayBuffer())
        .then((buf) => createGrid(id, meta, bounds, buf))
        .catch((err) => {
          gridCache.delete(id);
          throw err;
        });
      gridCache.set(id, p);
    }
    return p;
  },
  /** Load the bundled sample Gat boundaries (trial.kml / sample-gats.kml) and parse them. */
  async loadSampleGats(): Promise<{ collection: GatCollection; info: GatSourceInfo }> {
    let parsed: any = null;
    let fileName = "final_gat_mmkh.kml";
    let label = "Malegaon Khurd Plots (final_gat_mmkh.kmz)";

    try {
      const manifest = await this.getManifest();
      fileName = manifest.sampleKml?.file || "final_gat_mmkh.kml";
      label = manifest.sampleKml?.label || "Malegaon Khurd Plots";
      const text = await (await fetchOk(url(fileName))).text();
      parsed = parseKml(text, "sample");
    } catch (err) {
      console.warn("Could not load KML from manifest path:", err);
    }

    // Fall back to /data/final_gat_mmkh.kml or /data/sample-gats.kml
    if (!parsed || parsed.features.length <= 1) {
      try {
        const altText = await (await fetchOk("/data/final_gat_mmkh.kml")).text();
        const altParsed = parseKml(altText, "sample");
        if (altParsed.features.length > (parsed?.features?.length || 0)) {
          parsed = altParsed;
          fileName = "final_gat_mmkh.kml";
        }
      } catch (altErr) {
        try {
          const fallbackText = await (await fetchOk("/data/sample-gats.kml")).text();
          const fallbackParsed = parseKml(fallbackText, "sample");
          if (fallbackParsed.features.length > (parsed?.features?.length || 0)) {
            parsed = fallbackParsed;
            fileName = "sample-gats.kml";
          }
        } catch (fbErr) {
          console.warn("Could not load fallback KML:", fbErr);
        }
      }
    }

    // If still <= 1 feature, load /data/malegaon_plots.geojson
    if (!parsed || parsed.features.length <= 1) {
      try {
        const geoRes = await fetchOk("/data/malegaon_plots.geojson");
        const geojson = await geoRes.json();
        if (geojson?.features && geojson.features.length > 0) {
          const features = geojson.features.map((f: any) => ({
            type: "Feature" as const,
            id: f.properties?.gat_no || f.id,
            properties: {
              ...f.properties,
              gat_id: f.properties?.gat_no || f.id,
              name: f.properties?.source_name || `Gat ${f.properties?.gat_no || f.id}`,
              area_ha: f.properties?.area || 2.0,
            },
            geometry: f.geometry,
          }));
          parsed = {
            features,
            skipped: 0,
            warnings: [],
          };
          fileName = "malegaon_plots.geojson";
        }
      } catch (geoErr) {
        console.warn("Could not load /data/malegaon_plots.geojson:", geoErr);
      }
    }

    const featureList = parsed?.features || [];

    return {
      collection: { type: "FeatureCollection", features: featureList },
      info: {
        kind: "sample",
        label,
        fileName,
        count: featureList.length,
        skipped: parsed?.skipped || 0,
        warnings: parsed?.warnings || [],
      },
    };
  },

  /** Load the village boundary KML (malegaonkh_final1.kml) and parse it. */
  async loadVillageBoundaryKml(): Promise<{ collection: GatCollection; info: GatSourceInfo }> {
    let text = "";
    try {
      text = await (await fetchOk("/data/malegaonkh_final1.kml")).text();
    } catch {
      try {
        text = await (await fetchOk(url("malegaonkh_final1.kml"))).text();
      } catch {
        // Fallback to backend API
        return this.loadBackendKmlGats("malegaonkh_final1.kml");
      }
    }
    const parsed = parseKml(text, "sample");
    return {
      collection: { type: "FeatureCollection", features: parsed.features },
      info: {
        kind: "sample",
        label: "Malegaon Kh. Village Boundary",
        fileName: "malegaonkh_final1.kml",
        count: parsed.features.length,
        skipped: parsed.skipped,
        warnings: parsed.warnings,
      },
    };
  },

  /** Load Gats parsed directly by backend from layers/trial.kml and kml/malegaonkh_final1.kml. */
  async loadBackendKmlGats(file?: string, gatNo?: string): Promise<{ collection: GatCollection; info: GatSourceInfo }> {
    const q: string[] = [];
    if (file) q.push(`file=${encodeURIComponent(file)}`);
    if (gatNo) q.push(`gat_no=${encodeURIComponent(gatNo)}`);
    const params = q.length > 0 ? `?${q.join("&")}` : "";
    const res = await api.get<any>(`/soil-layers/kml/gats${params}`);
    const fc = res.data;
    const features = (fc.features || []).map((f: any) => ({
      type: "Feature" as const,
      id: f.id || f.properties.gat_no,
      properties: {
        gat_id: f.id || f.properties.gat_no,
        name: f.properties.name || f.properties.gat_no,
        area_ha: f.properties.area_ha || 0,
        area_acres: Number(((f.properties.area_ha || 0) * 2.47105).toFixed(2)),
        centroid: f.properties.centroid || [74.505, 18.16],
        bounds: f.properties.bounds || [74.49, 18.13, 74.54, 18.17],
        source: "backend-kml",
        attributes: f.properties.attributes || {},
      },
      geometry: f.geometry,
    }));
    return {
      collection: { type: "FeatureCollection", features },
      info: {
        kind: "sample",
        label: file ? `KML (${file})` : "Cadastral Gats & Boundary",
        fileName: file || "kml-layers",
        count: features.length,
        skipped: 0,
        warnings: [],
      },
    };
  },

  /** Load the full precomputed Gat dataset (contour overlays, stats, and grids) */
  getGatDataFull(): Promise<Record<string, GatDataFull>> {
    if (!gatDataPromise) {
      gatDataPromise = fetchOk(url("gat_data_full.json"), { cache: "no-cache" })
        .then((r) => r.json() as Promise<Record<string, GatDataFull>>)
        .then((data) => {
          // If a custom Gat is stored in localStorage, ensure it exists in data
          if (typeof window !== "undefined") {
            const activeGat = localStorage.getItem("soilpilot_selected_gat");
            if (activeGat) {
              getOrCreateGatEntry(data, activeGat);
            }
          }
          return data;
        })
        .catch((err) => {
          gatDataPromise = null;
          throw err;
        });
    }
    return gatDataPromise;
  },

  sampleKmlUrl(): string {
    return "/data/final_gat_mmkh.kml";
  },

  sampleKmzUrl(): string {
    return "/data/final_gat_mmkh.kmz";
  },

  villageKmlUrl(): string {
    return "/data/malegaonkh_final1.kml";
  },
};

