import { BBox, DSMRasterLayerId, RasterGridMeta } from "@/types/gis";

export interface RasterGrid {
  id: DSMRasterLayerId;
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
  pxW: number;
  pxH: number;
  meta: RasterGridMeta;
  data: Uint16Array;
}

/**
 * Creates and decodes a RasterGrid instance from binary uint16 buffer and georeferenced bounds.
 */
export function createGrid(
  id: DSMRasterLayerId,
  meta: RasterGridMeta,
  bounds: BBox,
  buf: ArrayBuffer
): RasterGrid {
  const [west, south, east, north] = bounds;
  // Fall back to cols / rows if width / height not provided directly
  const width = meta.width ?? (meta as any).cols ?? 250;
  const height = meta.height ?? (meta as any).rows ?? 178;

  const pxW = (east - west) / width;
  const pxH = (north - south) / height;

  const data = new Uint16Array(buf);

  return {
    id,
    west,
    south,
    east,
    north,
    width,
    height,
    pxW,
    pxH,
    meta,
    data,
  };
}

/**
 * Samples a continuous physical value at (lng, lat) from the RasterGrid.
 * Returns null if out-of-bounds or nodata.
 */
export function sampleGrid(
  grid: RasterGrid,
  lng: number,
  lat: number
): number | null {
  if (
    lng < grid.west ||
    lng > grid.east ||
    lat < grid.south ||
    lat > grid.north
  ) {
    return null;
  }

  const col = Math.floor((lng - grid.west) / grid.pxW);
  const row = Math.floor((grid.north - lat) / grid.pxH);

  if (col < 0 || col >= grid.width || row < 0 || row >= grid.height) {
    return null;
  }

  const idx = row * grid.width + col;
  const raw = grid.data[idx];

  const nodata = grid.meta.nodata ?? 65535;
  if (raw === nodata || raw === undefined) {
    return null;
  }

  // De-quantise value
  const offset = grid.meta.offset ?? ((grid.meta as any).min ?? 0);
  const scale = grid.meta.scale ?? 1.0;

  // In export_dsm_darker.py:
  // step = (raw_max - raw_min) / 65534; raw = round((val - raw_min)/step)
  // so val = raw_min + raw * step
  if (grid.meta.offset !== undefined) {
    return offset + raw * scale;
  }

  // If manifest format specifies min, max and scale:
  if (scale > 0) {
    return raw / scale;
  }

  return raw;
}
