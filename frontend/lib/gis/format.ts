/**
 * Utility functions for formatting GIS raster, nutrient, and measurement values.
 */

export function formatValue(
  value: number | null | undefined,
  precision: number = 2
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "—";
  }
  // Check if it's an integer
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return Number(value.toFixed(precision)).toString();
}

export function formatArea(areaHa: number | null | undefined): { ha: string; acres: string } {
  if (areaHa === null || areaHa === undefined || isNaN(areaHa)) {
    return { ha: "—", acres: "—" };
  }
  const acres = areaHa * 2.47105;
  return {
    ha: `${areaHa.toFixed(2)} Ha`,
    acres: `${acres.toFixed(2)} Acres`,
  };
}
