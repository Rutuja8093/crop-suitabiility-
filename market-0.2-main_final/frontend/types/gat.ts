/**
 * Gat (cadastral parcel) types used by the KML importer and the soil map.
 */
import type { BBox, DSMRasterLayerId } from "@/types/gis";

/** Authoritative Gat parcel numbers available in the Malegaon_Gat_Map_Final.kmz dataset. */
export const KML_AVAILABLE_GATS = [
  "1", "2", "4", "5", "6", "7", "8", "9", "10", "11",
  "13", "14", "15", "16", "17", "18", "19", "20", "21", "22",
  "23", "24", "25", "26", "28", "29", "30", "31", "32", "33",
  "34", "35", "37", "38", "39", "39/A", "39/B", "40", "41", "42",
  "43", "44", "45", "46", "47", "48", "49", "50", "51", "52",
  "53", "54", "55", "56", "57", "58", "59", "60", "61", "62",
  "63", "64", "65", "66", "67", "67/A", "67/B", "68", "69", "70",
  "71", "72", "73", "74", "75", "76", "77", "78", "79", "80",
  "81", "82", "83", "84", "85", "86", "87", "88", "89", "90",
  "91", "92", "93", "94", "95", "96", "97", "98", "99", "100",
  "101", "102", "104", "105", "106", "107", "108", "109", "110", "111",
  "112", "113", "114", "115", "116", "117", "118", "119", "120", "121",
  "122", "123", "124", "125", "126", "127", "128", "129", "130", "131",
  "132", "133", "134", "135", "136", "137", "138", "139", "140", "141",
  "142", "143", "144", "145", "146", "147", "148", "149", "150", "151",
  "152", "153", "154", "155", "156", "157", "159", "160", "161", "162",
  "163", "164", "165", "166", "167", "168", "169", "170", "171", "172",
  "173", "174", "175", "176", "177", "179", "180", "181", "182", "183",
  "184", "185", "186", "187", "188", "189", "190", "191", "192", "193",
  "194", "195", "196", "197", "198", "200", "201", "202", "203", "204",
  "205", "206", "207", "208", "209", "210", "211", "212", "213", "214",
  "215", "217", "218", "219", "220", "221", "222",
] as const;
export type KmlAvailableGat = (typeof KML_AVAILABLE_GATS)[number];

export type Position = [number, number]; // [lng, lat]

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: Position[][];
}

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: Position[][][];
}

export type GatGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface GatProperties {
  /** Unique id within the collection (Placemark name, de-duplicated). */
  gat_id: string;
  name: string;
  description: string | null;
  area_sqm: number;
  area_ha: number;
  area_acres: number;
  centroid: Position;
  bounds: BBox;
  source: "sample" | "upload" | "backend-kml";
  is_village_boundary?: boolean;
  /** Any ExtendedData / SimpleData found on the Placemark. */
  attributes: Record<string, string>;
}

export interface GatFeature {
  type: "Feature";
  id: string;
  properties: GatProperties;
  geometry: GatGeometry;
}

export interface GatCollection {
  type: "FeatureCollection";
  features: GatFeature[];
}

export interface GatSourceInfo {
  kind: "sample" | "upload";
  label: string;
  fileName?: string;
  count: number;
  skipped: number;
  warnings: string[];
}

export interface SoilClassification {
  status: string;
  statusMr: string;
  color: string;
  rating: string;
  advice: string;
  adviceMr: string;
}

export interface ParamStat {
  layerId: DSMRasterLayerId;
  mean: number;
  median: number;
  min: number;
  max: number;
  std: number;
  p10: number;
  p90: number;
  /** Number of raster cells inside the polygon. */
  count: number;
  classification: SoilClassification;
}

export interface GatStats {
  gatId: string;
  params: Partial<Record<DSMRasterLayerId, ParamStat>>;
  /** 100 - mean model uncertainty (floored at 85), when the uncertainty layer is loaded. */
  confidence: number | null;
}
