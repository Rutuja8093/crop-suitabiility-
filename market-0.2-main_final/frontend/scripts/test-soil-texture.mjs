/**
 * SoilPilot — Automated Unit Tests for Soil Texture Triangle
 *
 * Tests:
 * 1. Scientific USDA classification of all 12 classes
 * 2. Canonical Loam test (40% sand, 40% silt, 20% clay)
 * 3. Pure 100% vertices
 * 4. Boundary cases & tie-breaking rules
 * 5. Percentage validation (valid, sums >100, sums <100, negatives, missing, decimals)
 * 6. Barycentric coordinate transformations (forward & inverse)
 * 7. Gridline generation & polygon consistency
 */

import {
  classifyUSDA,
  validateSoilComposition,
  normalizeComposition,
} from '../lib/soilTexture/soilTextureClassification.ts';

import {
  compositionToSvgPoint,
  svgPointToComposition,
  DEFAULT_GEOMETRY,
  USDA_POLYGONS,
  generateClayGridLines,
  generateSiltGridLines,
  generateSandGridLines,
} from '../lib/soilTexture/soilTextureCoordinates.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n--- 1. Canonical Loam & Standard 12 USDA Classes ---');
{
  const loam = classifyUSDA({ sand: 40, silt: 40, clay: 20 });
  assert(loam.classKey === 'loam', '40% sand, 40% silt, 20% clay must classify as Loam');
  assert(loam.classNameEn === 'Loam', 'Class name (en) is Loam');
  assert(loam.classNameMr === 'पोयट', 'Class name (mr) has Marathi scientific name पोयट');

  const testCases = [
    { name: 'Clay', comp: { sand: 20, silt: 20, clay: 60 }, expected: 'clay' },
    { name: 'Silty Clay', comp: { sand: 10, silt: 45, clay: 45 }, expected: 'silty_clay' },
    { name: 'Sandy Clay', comp: { sand: 50, silt: 10, clay: 40 }, expected: 'sandy_clay' },
    { name: 'Clay Loam', comp: { sand: 35, silt: 30, clay: 35 }, expected: 'clay_loam' },
    { name: 'Silty Clay Loam', comp: { sand: 15, silt: 55, clay: 30 }, expected: 'silty_clay_loam' },
    { name: 'Sandy Clay Loam', comp: { sand: 60, silt: 15, clay: 25 }, expected: 'sandy_clay_loam' },
    { name: 'Loam', comp: { sand: 40, silt: 40, clay: 20 }, expected: 'loam' },
    { name: 'Silt Loam', comp: { sand: 20, silt: 65, clay: 15 }, expected: 'silt_loam' },
    { name: 'Silt', comp: { sand: 5, silt: 85, clay: 10 }, expected: 'silt' },
    { name: 'Sandy Loam', comp: { sand: 65, silt: 25, clay: 10 }, expected: 'sandy_loam' },
    { name: 'Loamy Sand', comp: { sand: 80, silt: 15, clay: 5 }, expected: 'loamy_sand' },
    { name: 'Sand', comp: { sand: 92, silt: 5, clay: 3 }, expected: 'sand' },
  ];

  for (const tc of testCases) {
    const res = classifyUSDA(tc.comp);
    assert(res.classKey === tc.expected, `Representative sample for ${tc.name} classified as ${tc.expected}`);
  }
}

console.log('\n--- 2. Pure 100% Vertices ---');
{
  assert(classifyUSDA({ sand: 0, silt: 0, clay: 100 }).classKey === 'clay', '100% Clay vertex is Clay');
  assert(classifyUSDA({ sand: 100, silt: 0, clay: 0 }).classKey === 'sand', '100% Sand vertex is Sand');
  assert(classifyUSDA({ sand: 0, silt: 100, clay: 0 }).classKey === 'silt', '100% Silt vertex is Silt');
}

console.log('\n--- 3. Boundary & Tie-Breaking Robustness ---');
{
  // Boundary point between clay & sandy clay
  const b1 = classifyUSDA({ sand: 45, silt: 0, clay: 55 });
  assert(b1.classKey === 'clay' || b1.classKey === 'sandy_clay', 'Sand 45, Silt 0, Clay 55 resolves validly');

  // Boundary between loam and sandy clay loam (Clay 20, Silt 28, Sand 52)
  const b2 = classifyUSDA({ sand: 52, silt: 28, clay: 20 });
  assert(b2.classKey === 'loam', 'Sand 52, Silt 28, Clay 20 resolves cleanly as Loam');

  // Boundary point (Sand 20, Silt 40, Clay 40)
  const b3 = classifyUSDA({ sand: 20, silt: 40, clay: 40 });
  assert(['clay', 'silty_clay', 'clay_loam'].includes(b3.classKey), 'Three-way vertex resolves cleanly');
}

console.log('\n--- 4. Percentage Validation Engine ---');
{
  // Valid total 100%
  const v1 = validateSoilComposition({ sand: 40, silt: 40, clay: 20 });
  assert(v1.isValid === true && v1.errors.length === 0, '40/40/20 is valid');

  // Invalid total 110% (from prompt example)
  const v2 = validateSoilComposition({ sand: 50, silt: 30, clay: 30 });
  assert(v2.isValid === false, '50/30/30 (total 110%) rejected as invalid');
  assert(v2.errors.some((e) => e.includes('110')), 'Error mentions total 110%');

  // Invalid total 90%
  const v3 = validateSoilComposition({ sand: 30, silt: 30, clay: 30 });
  assert(v3.isValid === false, '30/30/30 (total 90%) rejected as invalid');

  // Negative input
  const v4 = validateSoilComposition({ sand: -10, silt: 60, clay: 50 });
  assert(v4.isValid === false, 'Negative sand rejected');

  // Input > 100%
  const v5 = validateSoilComposition({ sand: 120, silt: -10, clay: -10 });
  assert(v5.isValid === false, 'Sand > 100% rejected');

  // Missing / empty input
  const v6 = validateSoilComposition({ sand: '', silt: 40, clay: 20 });
  assert(v6.isValid === false, 'Empty string percentage rejected');

  // Floating point rounding within tolerance (e.g. 33.33 + 33.33 + 33.34 = 100.0)
  const v7 = validateSoilComposition({ sand: 33.33, silt: 33.33, clay: 33.34 });
  assert(v7.isValid === true, 'Floating point decimal sum 100.0 is valid');
}

console.log('\n--- 5. Triangle Geometry & Coordinate Transformation ---');
{
  const geo = DEFAULT_GEOMETRY;

  // 1. Apex (100% clay)
  const pClay = compositionToSvgPoint({ sand: 0, silt: 0, clay: 100 }, geo);
  assert(Math.abs(pClay.x - geo.clayVertex.x) < 0.1 && Math.abs(pClay.y - geo.clayVertex.y) < 0.1, '100% Clay maps to top apex');

  // 2. Sand vertex (100% sand)
  const pSand = compositionToSvgPoint({ sand: 100, silt: 0, clay: 0 }, geo);
  assert(Math.abs(pSand.x - geo.sandVertex.x) < 0.1 && Math.abs(pSand.y - geo.sandVertex.y) < 0.1, '100% Sand maps to bottom-left vertex');

  // 3. Silt vertex (100% silt)
  const pSilt = compositionToSvgPoint({ sand: 0, silt: 100, clay: 0 }, geo);
  assert(Math.abs(pSilt.x - geo.siltVertex.x) < 0.1 && Math.abs(pSilt.y - geo.siltVertex.y) < 0.1, '100% Silt maps to bottom-right vertex');

  // 4. Midpoint of bottom edge (Sand 50, Silt 50, Clay 0)
  const pMid = compositionToSvgPoint({ sand: 50, silt: 50, clay: 0 }, geo);
  assert(Math.abs(pMid.x - 325) < 0.1 && Math.abs(pMid.y - 504.42) < 0.1, 'Sand 50, Silt 50 maps to base center');

  // 5. Inversion (SVG coordinate to Composition)
  const roundtripTest = [
    { sand: 40, silt: 40, clay: 20 },
    { sand: 20, silt: 20, clay: 60 },
    { sand: 70, silt: 20, clay: 10 },
  ];

  for (const c of roundtripTest) {
    const pt = compositionToSvgPoint(c, geo);
    const inverted = svgPointToComposition(pt, geo);
    const sum = inverted.sand + inverted.silt + inverted.clay;
    assert(sum === 100, `Inverted composition sums strictly to 100% (got ${sum}%)`);
    assert(Math.abs(inverted.sand - c.sand) <= 1, `Inverted Sand matches original ±1% (${c.sand} vs ${inverted.sand})`);
    assert(Math.abs(inverted.clay - c.clay) <= 1, `Inverted Clay matches original ±1% (${c.clay} vs ${inverted.clay})`);
  }
}

console.log('\n--- 6. Gridlines & Polygons Check ---');
{
  const clayLines = generateClayGridLines();
  assert(clayLines.length === 9, '9 Clay gridlines generated (10% to 90%)');
  // Clay gridlines must be horizontal (p1.y === p2.y)
  const horizontalCheck = clayLines.every((l) => Math.abs(l.p1.y - l.p2.y) < 0.01);
  assert(horizontalCheck, 'All Clay gridlines are strictly horizontal');

  const siltLines = generateSiltGridLines();
  assert(siltLines.length === 9, '9 Silt gridlines generated (10% to 90%)');

  const sandLines = generateSandGridLines();
  assert(sandLines.length === 9, '9 Sand gridlines generated (10% to 90%)');

  assert(USDA_POLYGONS.length === 12, 'All 12 USDA class polygons defined');
  // All polygon vertices must sum to 100
  let allVerticesValid = true;
  for (const poly of USDA_POLYGONS) {
    for (const v of poly.vertices) {
      if (Math.abs(v.sand + v.silt + v.clay - 100) > 0.001) {
        allVerticesValid = false;
        console.error(`Invalid vertex in ${poly.name}:`, v);
      }
    }
  }
  assert(allVerticesValid, 'Every vertex of all 12 class polygons sums strictly to 100%');
}

console.log(`\n========================================`);
console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
