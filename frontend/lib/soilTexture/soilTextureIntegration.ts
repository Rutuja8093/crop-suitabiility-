import type { SoilComposition } from "./soilTextureClassification";

export interface ExtractedTextureParameters {
  sand: number | null;
  silt: number | null;
  clay: number | null;
  sourceType: string;
  sourceLabel?: string;
  missingParameters: string[];
  isDemo?: boolean;
  village?: string;
  farmerName?: string;
  depthInterval?: string;
  reportNo?: string;
  sampleDate?: string;
  isSiltDerived?: boolean;
}

export interface IntegratedSoilTextureResult {
  status: "valid" | "warning_tolerance" | "incomplete";
  activeComposition: SoilComposition | null;
  normalizedFineEarthComposition: SoilComposition | null;
  rawComposition: {
    sand: number;
    silt: number;
    clay: number;
    total: number;
  };
  extractedParams: ExtractedTextureParameters;
}

export function extractTextureParametersFromReport(report: any): ExtractedTextureParameters {
  if (!report || !Array.isArray(report.parameters)) {
    return {
      sand: null,
      silt: null,
      clay: null,
      sourceType: "NOT AVAILABLE",
      sourceLabel: "Unavailable",
      missingParameters: ["sand", "silt", "clay"],
      isDemo: false,
    };
  }

  let sand: number | null = null;
  let silt: number | null = null;
  let clay: number | null = null;
  let sourceType = "LABORATORY TEST";
  let isSiltDerived = false;

  for (const param of report.parameters) {
    const key = (param.key || param.parameter_key || "").toLowerCase();
    const name = (param.name || param.parameter_name || "").toLowerCase();
    const val = typeof param.value === "number" ? param.value : parseFloat(String(param.value));

    if (key.includes("sand") || name.includes("sand") || name.includes("वाळू")) {
      if (!isNaN(val)) sand = val;
      if (param.source || param.source_type) sourceType = param.source || param.source_type;
    } else if (key.includes("silt") || name.includes("silt") || name.includes("गाळ")) {
      if (!isNaN(val)) silt = val;
      if (param.source || param.source_type) sourceType = param.source || param.source_type;
    } else if (key.includes("clay") || name.includes("clay") || name.includes("चिकण")) {
      if (!isNaN(val)) clay = val;
      if (param.source || param.source_type) sourceType = param.source || param.source_type;
    }
  }

  // If sand & clay are present but silt is missing, calculate silt derived
  if (sand !== null && clay !== null && silt === null) {
    silt = Math.max(0, Number((100 - sand - clay).toFixed(2)));
    isSiltDerived = true;
  }

  const missing: string[] = [];
  if (sand === null) missing.push("sand");
  if (silt === null) missing.push("silt");
  if (clay === null) missing.push("clay");

  return {
    sand,
    silt,
    clay,
    sourceType,
    sourceLabel: report.laboratory_name || report.source || "DSM Official Calibration Station",
    missingParameters: missing,
    isDemo: report.is_demo ?? true,
    village: report.field?.village || "Malegaon Kh.",
    farmerName: report.farmer?.name || "Ramesh Patil",
    depthInterval: "0–30 cm Root Zone",
    reportNo: report.report_no || report.report_number || "SHC-2026-001",
    sampleDate: report.sample_date || report.report_date || "2026-03-15",
    isSiltDerived,
  };
}

export function processSoilTextureIntegration(
  extracted: ExtractedTextureParameters
): IntegratedSoilTextureResult {
  const missing = extracted.missingParameters;
  if (missing.length > 0 || extracted.sand === null || extracted.silt === null || extracted.clay === null) {
    return {
      status: "incomplete",
      activeComposition: null,
      normalizedFineEarthComposition: null,
      rawComposition: {
        sand: extracted.sand ?? 0,
        silt: extracted.silt ?? 0,
        clay: extracted.clay ?? 0,
        total: (extracted.sand ?? 0) + (extracted.silt ?? 0) + (extracted.clay ?? 0),
      },
      extractedParams: extracted,
    };
  }

  const s = extracted.sand;
  const si = extracted.silt;
  const c = extracted.clay;
  const sum = Number((s + si + c).toFixed(2));

  // If sum is exactly or very close to 100% (within ±1%)
  if (Math.abs(sum - 100) <= 1.0) {
    const comp: SoilComposition = { sand: s, silt: si, clay: c };
    return {
      status: "valid",
      activeComposition: comp,
      normalizedFineEarthComposition: comp,
      rawComposition: { sand: s, silt: si, clay: c, total: sum },
      extractedParams: extracted,
    };
  }

  // If sum is within acceptable tolerance (e.g. 95% - 105%), normalize fine-earth fraction
  if (sum > 0) {
    const normSand = Number(((s / sum) * 100).toFixed(2));
    const normSilt = Number(((si / sum) * 100).toFixed(2));
    const normClay = Number((100 - normSand - normSilt).toFixed(2));

    const normComp: SoilComposition = {
      sand: normSand,
      silt: normSilt,
      clay: normClay,
    };

    return {
      status: "warning_tolerance",
      activeComposition: normComp,
      normalizedFineEarthComposition: normComp,
      rawComposition: { sand: s, silt: si, clay: c, total: sum },
      extractedParams: extracted,
    };
  }

  return {
    status: "incomplete",
    activeComposition: null,
    normalizedFineEarthComposition: null,
    rawComposition: { sand: s, silt: si, clay: c, total: sum },
    extractedParams: extracted,
  };
}
