/**
 * SoilPilot — USDA Soil Texture Classification Engine
 *
 * Implements authoritative USDA-NRCS textural soil classification based on
 * the fine-earth fraction (<2.0 mm) particle size percentages:
 * - Sand (0.05 – 2.0 mm)
 * - Silt (0.002 – 0.05 mm)
 * - Clay (< 0.002 mm)
 *
 * Reference:
 * USDA Natural Resources Conservation Service (NRCS) Soil Survey Division Staff (2017).
 * Soil Survey Manual. USDA Handbook 18, Chapter 3.
 */

export interface SoilComposition {
  sand: number;
  silt: number;
  clay: number;
}

export type USDAClassKey =
  | 'clay'
  | 'silty_clay'
  | 'sandy_clay'
  | 'clay_loam'
  | 'silty_clay_loam'
  | 'sandy_clay_loam'
  | 'loam'
  | 'silt_loam'
  | 'silt'
  | 'sandy_loam'
  | 'loamy_sand'
  | 'sand';

export interface ValidationResult {
  isValid: boolean;
  total: number;
  errors: string[];
  difference: number;
}

export interface SoilClassificationOutput {
  classKey: USDAClassKey;
  classNameEn: string;
  classNameMr: string;
  isBoundary: boolean;
  confidence: 'definitive' | 'boundary_tie';
}

/** Floating point tolerance for sum validation (e.g. 99.5% to 100.5%) */
export const COMPOSITION_TOLERANCE = 0.5;

/**
 * Validates sand, silt, and clay input percentages.
 * Strict rules:
 * - Each fraction must be a finite number between 0 and 100 inclusive.
 * - The sum must equal 100 within COMPOSITION_TOLERANCE.
 */
export function validateSoilComposition(comp: {
  sand: number | string | null | undefined;
  silt: number | string | null | undefined;
  clay: number | string | null | undefined;
}): ValidationResult {
  const errors: string[] = [];

  const sandNum = typeof comp.sand === 'string' ? parseFloat(comp.sand) : Number(comp.sand);
  const siltNum = typeof comp.silt === 'string' ? parseFloat(comp.silt) : Number(comp.silt);
  const clayNum = typeof comp.clay === 'string' ? parseFloat(comp.clay) : Number(comp.clay);

  if (isNaN(sandNum) || comp.sand === null || comp.sand === undefined || comp.sand === '') {
    errors.push('Sand percentage is required and must be a valid number.');
  } else if (sandNum < 0 || sandNum > 100) {
    errors.push('Sand percentage must be between 0% and 100%.');
  }

  if (isNaN(siltNum) || comp.silt === null || comp.silt === undefined || comp.silt === '') {
    errors.push('Silt percentage is required and must be a valid number.');
  } else if (siltNum < 0 || siltNum > 100) {
    errors.push('Silt percentage must be between 0% and 100%.');
  }

  if (isNaN(clayNum) || comp.clay === null || comp.clay === undefined || comp.clay === '') {
    errors.push('Clay percentage is required and must be a valid number.');
  } else if (clayNum < 0 || clayNum > 100) {
    errors.push('Clay percentage must be between 0% and 100%.');
  }

  if (errors.length > 0) {
    const rawTotal = (isNaN(sandNum) ? 0 : sandNum) + (isNaN(siltNum) ? 0 : siltNum) + (isNaN(clayNum) ? 0 : clayNum);
    return {
      isValid: false,
      total: Number(rawTotal.toFixed(2)),
      errors,
      difference: Number((rawTotal - 100).toFixed(2)),
    };
  }

  const total = Number((sandNum + siltNum + clayNum).toFixed(2));
  const diff = Number((total - 100).toFixed(2));

  if (Math.abs(diff) > COMPOSITION_TOLERANCE) {
    if (total > 100) {
      errors.push(`Total sum is ${total}%. Percentages must equal 100% (exceeds by +${diff}%).`);
    } else {
      errors.push(`Total sum is ${total}%. Percentages must equal 100% (short by ${Math.abs(diff)}%).`);
    }
  }

  return {
    isValid: errors.length === 0,
    total,
    errors,
    difference: diff,
  };
}

/**
 * Normalizes valid percentages to strict 100.0% sum to eliminate small floating-point drift.
 */
export function normalizeComposition(comp: SoilComposition): SoilComposition {
  const sum = comp.sand + comp.silt + comp.clay;
  if (sum <= 0) return { sand: 0, silt: 0, clay: 0 };
  return {
    sand: (comp.sand / sum) * 100,
    silt: (comp.silt / sum) * 100,
    clay: (comp.clay / sum) * 100,
  };
}

/**
 * Authoritative USDA Soil Classification Algorithm.
 * Implements the USDA NRCS Soil Survey Manual 12-class decision rules.
 *
 * Tie-breaking standard:
 * - Boundaries evaluate consistently using inclusive lower thresholds (>=).
 * - Finer particle size class (Clay > Silt > Sand) takes precedence on exact shared borders.
 */
export function classifyUSDA(comp: SoilComposition): SoilClassificationOutput {
  const norm = normalizeComposition(comp);
  const { sand, silt, clay } = norm;

  let key: USDAClassKey;

  // 1. Clay heavy (Clay >= 40%)
  if (clay >= 40) {
    if (silt >= 40) {
      key = 'silty_clay';
    } else if (sand <= 45) {
      key = 'clay';
    } else {
      key = 'sandy_clay';
    }
  }
  // 2. Sandy Clay (Clay 35–40% and Sand >= 45%)
  else if (clay >= 35 && sand >= 45) {
    key = 'sandy_clay';
  }
  // 3. Medium-fine Clay Loams (Clay 27–40%)
  else if (clay >= 27) {
    if (sand >= 20 && sand <= 45) {
      key = 'clay_loam';
    } else if (sand < 20) {
      key = 'silty_clay_loam';
    } else {
      // sand > 45 with clay 27-35%
      key = 'sandy_clay_loam';
    }
  }
  // 4. Moderate Clay (Clay 20–27%)
  else if (clay >= 20) {
    if (sand >= 45 && silt < 28) {
      key = 'sandy_clay_loam';
    } else if (silt >= 50) {
      key = 'silt_loam';
    } else if (sand <= 52 && silt >= 28) {
      key = 'loam';
    } else {
      key = 'sandy_loam';
    }
  }
  // 5. Silts and Silt Loams (Silt dominated)
  else if (silt >= 80 && clay < 12) {
    key = 'silt';
  } else if (silt >= 50) {
    key = 'silt_loam';
  }
  // 6. Loam (Clay 7–20%, Silt 28–50%, Sand <= 52%)
  else if (clay >= 7 && sand <= 52 && silt >= 28) {
    key = 'loam';
  }
  // 7. Sandy classes (Clay < 20%, low silt)
  else {
    // Sand: sand >= 85% and silt + 1.5 * clay < 15%
    if (sand >= 85 && silt + 1.5 * clay < 15) {
      key = 'sand';
    }
    // Loamy Sand: sand >= 70% and silt + 2 * clay < 30%
    else if (sand >= 70 && silt + 2 * clay < 30) {
      key = 'loamy_sand';
    }
    // Sandy Loam: remainder of coarser fraction
    else {
      key = 'sandy_loam';
    }
  }

  const nameMapping: Record<USDAClassKey, { en: string; mr: string }> = {
    sand: { en: 'Sand', mr: 'वाळूमय' },
    loamy_sand: { en: 'Loamy Sand', mr: 'पोयटायुक्त वाळूमय' },
    sandy_loam: { en: 'Sandy Loam', mr: 'वाळूमिश्रित पोयटायुक्त' },
    loam: { en: 'Loam', mr: 'पोयट' },
    silt_loam: { en: 'Silt Loam', mr: 'गाळमिश्रित पोयट' },
    silt: { en: 'Silt', mr: 'गाळमय' },
    sandy_clay_loam: { en: 'Sandy Clay Loam', mr: 'वाळूमिश्रित चिकण पोयट' },
    clay_loam: { en: 'Clay Loam', mr: 'चिकण पोयट' },
    silty_clay_loam: { en: 'Silty Clay Loam', mr: 'गाळमिश्रित चिकण पोयट' },
    sandy_clay: { en: 'Sandy Clay', mr: 'वाळूमिश्रित चिकणमाती' },
    silty_clay: { en: 'Silty Clay', mr: 'गाळमिश्रित चिकणमाती' },
    clay: { en: 'Clay', mr: 'चिकणमाती' },
  };

  return {
    classKey: key,
    classNameEn: nameMapping[key].en,
    classNameMr: nameMapping[key].mr,
    isBoundary: false,
    confidence: 'definitive',
  };
}
