/**
 * SoilPilot — USDA Soil Texture Triangle Geometry & Coordinates
 *
 * Mathematically rigorous ternary/barycentric coordinate transformation
 * between Soil Compositions (Sand%, Silt%, Clay%) and 2D SVG coordinates.
 *
 * Convention:
 * - Top Apex: 100% Clay, 0% Sand, 0% Silt
 * - Bottom-Left Vertex: 100% Sand, 0% Silt, 0% Clay
 * - Bottom-Right Vertex: 100% Silt, 0% Sand, 0% Clay
 *
 * Axis directions:
 * - Clay (%): 0 at bottom edge to 100 at top apex (horizontal gridlines).
 * - Silt (%): 0 at left edge to 100 at bottom-right (gridlines parallel to Sand-Clay edge).
 * - Sand (%): 0 at right edge to 100 at bottom-left (gridlines parallel to Silt-Clay edge).
 */

import type { SoilComposition, USDAClassKey } from './soilTextureClassification';

export interface SvgPoint {
  x: number;
  y: number;
}

export interface TriangleGeometry {
  width: number;
  height: number;
  clayVertex: SvgPoint;  // Top
  sandVertex: SvgPoint;  // Bottom-Left
  siltVertex: SvgPoint;  // Bottom-Right
}

/**
 * Standard SVG canvas configuration.
 * Wide enough for labels, ticks, and clear margins.
 */
export const DEFAULT_GEOMETRY: TriangleGeometry = {
  width: 650,
  height: 560,
  // Top apex (Clay 100%)
  clayVertex: { x: 325, y: 45 },
  // Bottom-left vertex (Sand 100%)
  sandVertex: { x: 60, y: 504.42 },
  // Bottom-right vertex (Silt 100%)
  siltVertex: { x: 590, y: 504.42 },
};

/**
 * Converts a soil composition (Sand, Silt, Clay percentages)
 * into exact SVG (x, y) coordinates via barycentric interpolation.
 *
 * P = (sand/100)*V_sand + (silt/100)*V_silt + (clay/100)*V_clay
 */
export function compositionToSvgPoint(
  comp: SoilComposition,
  geo: TriangleGeometry = DEFAULT_GEOMETRY
): SvgPoint {
  const sum = comp.sand + comp.silt + comp.clay;
  const s = sum > 0 ? comp.sand / sum : 1 / 3;
  const z = sum > 0 ? comp.silt / sum : 1 / 3;
  const c = sum > 0 ? comp.clay / sum : 1 / 3;

  const x = s * geo.sandVertex.x + z * geo.siltVertex.x + c * geo.clayVertex.x;
  const y = s * geo.sandVertex.y + z * geo.siltVertex.y + c * geo.clayVertex.y;

  return {
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
  };
}

/**
 * Inverse transformation:
 * Converts an SVG point (x, y) into a valid SoilComposition (Sand%, Silt%, Clay%)
 * summing strictly to 100%. Clamps points slightly outside the triangle.
 */
export function svgPointToComposition(
  point: SvgPoint,
  geo: TriangleGeometry = DEFAULT_GEOMETRY
): SoilComposition {
  const yBottom = geo.sandVertex.y; // sand and silt share same y
  const yTop = geo.clayVertex.y;
  const height = yBottom - yTop;

  // 1. Clay fraction is directly proportional to vertical height from base
  let c = (yBottom - point.y) / height;

  // 2. Silt fraction from x position along the horizontal cross-section
  // Along any line of constant clay c:
  // x_left (silt=0) = (1-c)*sand.x + c*clay.x
  // x_right (sand=0) = (1-c)*silt.x + c*clay.x
  const xLeft = (1 - c) * geo.sandVertex.x + c * geo.clayVertex.x;
  const xRight = (1 - c) * geo.siltVertex.x + c * geo.clayVertex.x;
  const span = xRight - xLeft;

  let z = span > 0.001 ? ((point.x - xLeft) / span) * (1 - c) : 0;
  let s = 1 - c - z;

  // Clamp fractions to [0, 1]
  c = Math.max(0, Math.min(1, c));
  z = Math.max(0, Math.min(1, z));
  s = Math.max(0, Math.min(1, s));

  // Renormalize so sum is strictly 100.0%
  const sum = s + z + c;
  if (sum > 0) {
    s = s / sum;
    z = z / sum;
    c = c / sum;
  } else {
    s = 1 / 3;
    z = 1 / 3;
    c = 1 / 3;
  }

  // Round to nearest integer or 1 decimal place with sum preservation
  const sandPct = Math.round(s * 100);
  const clayPct = Math.round(c * 100);
  const siltPct = 100 - sandPct - clayPct;

  return {
    sand: Math.max(0, sandPct),
    silt: Math.max(0, siltPct),
    clay: Math.max(0, clayPct),
  };
}

/**
 * 12 USDA Class Region Polygon Vertices in (Sand, Silt, Clay) space.
 * Each vertex satisfies Sand + Silt + Clay = 100.
 */
export interface ClassPolygonDef {
  key: USDAClassKey;
  name: string;
  shortLabel: string;
  vertices: SoilComposition[];
  labelOffset?: { dx: number; dy: number };
}

export const USDA_POLYGONS: ClassPolygonDef[] = [
  {
    key: 'clay',
    name: 'Clay',
    shortLabel: 'Clay',
    vertices: [
      { sand: 0, silt: 0, clay: 100 },
      { sand: 0, silt: 40, clay: 60 },
      { sand: 20, silt: 40, clay: 40 },
      { sand: 45, silt: 15, clay: 40 },
      { sand: 45, silt: 0, clay: 55 },
    ],
    labelOffset: { dx: 0, dy: -10 },
  },
  {
    key: 'silty_clay',
    name: 'Silty Clay',
    shortLabel: 'SiCl',
    vertices: [
      { sand: 0, silt: 40, clay: 60 },
      { sand: 0, silt: 60, clay: 40 },
      { sand: 20, silt: 40, clay: 40 },
    ],
    labelOffset: { dx: 0, dy: 0 },
  },
  {
    key: 'sandy_clay',
    name: 'Sandy Clay',
    shortLabel: 'SaCl',
    vertices: [
      { sand: 45, silt: 0, clay: 55 },
      { sand: 45, silt: 20, clay: 35 },
      { sand: 65, silt: 0, clay: 35 },
    ],
    labelOffset: { dx: -5, dy: 0 },
  },
  {
    key: 'clay_loam',
    name: 'Clay Loam',
    shortLabel: 'ClLo',
    vertices: [
      { sand: 20, silt: 40, clay: 40 },
      { sand: 45, silt: 15, clay: 40 },
      { sand: 45, silt: 28, clay: 27 },
      { sand: 20, silt: 53, clay: 27 },
    ],
    labelOffset: { dx: 0, dy: 0 },
  },
  {
    key: 'silty_clay_loam',
    name: 'Silty Clay Loam',
    shortLabel: 'SiClLo',
    vertices: [
      { sand: 0, silt: 60, clay: 40 },
      { sand: 0, silt: 73, clay: 27 },
      { sand: 20, silt: 53, clay: 27 },
      { sand: 20, silt: 40, clay: 40 },
    ],
    labelOffset: { dx: 0, dy: 0 },
  },
  {
    key: 'sandy_clay_loam',
    name: 'Sandy Clay Loam',
    shortLabel: 'SaClLo',
    vertices: [
      { sand: 65, silt: 0, clay: 35 },
      { sand: 45, silt: 20, clay: 35 },
      { sand: 45, silt: 28, clay: 27 },
      { sand: 52, silt: 28, clay: 20 },
      { sand: 80, silt: 0, clay: 20 },
    ],
    labelOffset: { dx: -5, dy: 0 },
  },
  {
    key: 'loam',
    name: 'Loam',
    shortLabel: 'Loam',
    vertices: [
      { sand: 45, silt: 28, clay: 27 },
      { sand: 23, silt: 50, clay: 27 },
      { sand: 43, silt: 50, clay: 7 },
      { sand: 52, silt: 41, clay: 7 },
      { sand: 52, silt: 28, clay: 20 },
    ],
    labelOffset: { dx: 0, dy: 0 },
  },
  {
    key: 'silt_loam',
    name: 'Silt Loam',
    shortLabel: 'SiLo',
    vertices: [
      { sand: 0, silt: 73, clay: 27 },
      { sand: 20, silt: 53, clay: 27 },
      { sand: 23, silt: 50, clay: 27 },
      { sand: 43, silt: 50, clay: 7 },
      { sand: 50, silt: 50, clay: 0 },
      { sand: 20, silt: 80, clay: 0 },
      { sand: 8, silt: 80, clay: 12 },
      { sand: 0, silt: 88, clay: 12 },
    ],
    labelOffset: { dx: 0, dy: 5 },
  },
  {
    key: 'silt',
    name: 'Silt',
    shortLabel: 'Silt',
    vertices: [
      { sand: 0, silt: 88, clay: 12 },
      { sand: 8, silt: 80, clay: 12 },
      { sand: 20, silt: 80, clay: 0 },
      { sand: 0, silt: 100, clay: 0 },
    ],
    labelOffset: { dx: 0, dy: 0 },
  },
  {
    key: 'sandy_loam',
    name: 'Sandy Loam',
    shortLabel: 'SaLo',
    vertices: [
      { sand: 80, silt: 0, clay: 20 },
      { sand: 52, silt: 28, clay: 20 },
      { sand: 52, silt: 41, clay: 7 },
      { sand: 43, silt: 50, clay: 7 },
      { sand: 50, silt: 50, clay: 0 },
      { sand: 70, silt: 30, clay: 0 },
      { sand: 85, silt: 0, clay: 15 },
    ],
    labelOffset: { dx: 0, dy: 0 },
  },
  {
    key: 'loamy_sand',
    name: 'Loamy Sand',
    shortLabel: 'LoSa',
    vertices: [
      { sand: 85, silt: 0, clay: 15 },
      { sand: 70, silt: 30, clay: 0 },
      { sand: 85, silt: 15, clay: 0 },
      { sand: 90, silt: 0, clay: 10 },
    ],
    labelOffset: { dx: 0, dy: 0 },
  },
  {
    key: 'sand',
    name: 'Sand',
    shortLabel: 'Sand',
    vertices: [
      { sand: 100, silt: 0, clay: 0 },
      { sand: 85, silt: 15, clay: 0 },
      { sand: 90, silt: 0, clay: 10 },
    ],
    labelOffset: { dx: 0, dy: 0 },
  },
];

/**
 * Returns an SVG polygon points string ("x1,y1 x2,y2 ...") for a class polygon.
 */
export function getPolygonSvgPoints(
  poly: ClassPolygonDef,
  geo: TriangleGeometry = DEFAULT_GEOMETRY
): string {
  return poly.vertices
    .map((v) => {
      const pt = compositionToSvgPoint(v, geo);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');
}

/**
 * Computes polygon centroid in SVG coordinates for text label positioning.
 */
export function getPolygonCentroid(
  poly: ClassPolygonDef,
  geo: TriangleGeometry = DEFAULT_GEOMETRY
): SvgPoint {
  const points = poly.vertices.map((v) => compositionToSvgPoint(v, geo));
  let sx = 0;
  let sy = 0;
  for (const pt of points) {
    sx += pt.x;
    sy += pt.y;
  }
  const cx = sx / points.length + (poly.labelOffset?.dx || 0);
  const cy = sy / points.length + (poly.labelOffset?.dy || 0);
  return { x: Number(cx.toFixed(1)), y: Number(cy.toFixed(1)) };
}

/**
 * Gridline segments for 10%, 20%, ..., 90%
 */
export interface GridLine {
  value: number; // percentage (10, 20, ...)
  p1: SvgPoint;
  p2: SvgPoint;
}

export function generateClayGridLines(geo: TriangleGeometry = DEFAULT_GEOMETRY): GridLine[] {
  const lines: GridLine[] = [];
  for (let clay = 10; clay <= 90; clay += 10) {
    // Left edge (silt=0): sand = 100 - clay
    const pLeft = compositionToSvgPoint({ sand: 100 - clay, silt: 0, clay }, geo);
    // Right edge (sand=0): silt = 100 - clay
    const pRight = compositionToSvgPoint({ sand: 0, silt: 100 - clay, clay }, geo);
    lines.push({ value: clay, p1: pLeft, p2: pRight });
  }
  return lines;
}

export function generateSiltGridLines(geo: TriangleGeometry = DEFAULT_GEOMETRY): GridLine[] {
  const lines: GridLine[] = [];
  for (let silt = 10; silt <= 90; silt += 10) {
    // Bottom edge (clay=0): sand = 100 - silt
    const pBottom = compositionToSvgPoint({ sand: 100 - silt, silt, clay: 0 }, geo);
    // Right edge (sand=0): clay = 100 - silt
    const pRight = compositionToSvgPoint({ sand: 0, silt, clay: 100 - silt }, geo);
    lines.push({ value: silt, p1: pBottom, p2: pRight });
  }
  return lines;
}

export function generateSandGridLines(geo: TriangleGeometry = DEFAULT_GEOMETRY): GridLine[] {
  const lines: GridLine[] = [];
  for (let sand = 10; sand <= 90; sand += 10) {
    // Bottom edge (clay=0): silt = 100 - sand
    const pBottom = compositionToSvgPoint({ sand, silt: 100 - sand, clay: 0 }, geo);
    // Left edge (silt=0): clay = 100 - sand
    const pLeft = compositionToSvgPoint({ sand, silt: 0, clay: 100 - sand }, geo);
    lines.push({ value: sand, p1: pBottom, p2: pLeft });
  }
  return lines;
}
