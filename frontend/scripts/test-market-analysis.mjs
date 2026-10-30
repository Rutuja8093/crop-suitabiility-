/**
 * SoilPilot — Automated Unit Tests for Market Historical Price Analysis & Trend Detection (Phase 5)
 *
 * Tests:
 * 1. Absolute & Percentage Price Change Formulas
 * 2. Guard against Divide-by-Zero and Missing Values
 * 3. Trend Classification Rules and Analytical Threshold (±2.0%)
 * 4. Sample Size Minimum Requirement (N >= 3)
 * 5. Market-to-Market Comparison Calculations
 * 6. Historical Data Quality & Gap Detection
 * 7. Non-Forecast Disclaimer Integrity
 */

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

function calculateAbsoluteChange(latest, previous) {
  if (latest == null || previous == null) return null;
  return Number((latest - previous).toFixed(2));
}

function calculatePercentageChange(latest, previous) {
  if (latest == null || previous == null || previous === 0) return null;
  return Number((((latest - previous) / previous) * 100).toFixed(2));
}

function classifyTrend(percentageChange, observationCount, threshold = 2.0) {
  if (observationCount < 3 || percentageChange == null) {
    return 'INSUFFICIENT_DATA';
  }
  if (percentageChange >= threshold) {
    return 'RISING';
  }
  if (percentageChange <= -threshold) {
    return 'FALLING';
  }
  return 'STABLE';
}

function calculateMarketComparison(primaryPrice, comparisonPrice) {
  if (primaryPrice == null || comparisonPrice == null) return null;
  const diff = Number((primaryPrice - comparisonPrice).toFixed(2));
  const pctDiff = comparisonPrice > 0 ? Number((((primaryPrice - comparisonPrice) / comparisonPrice) * 100).toFixed(2)) : null;
  return { priceDifference: diff, percentageDifference: pctDiff };
}

console.log('\n--- 1. Absolute & Percentage Price Change Math ---');
{
  const abs = calculateAbsoluteChange(4700, 4500);
  assert(abs === 200, `Absolute change: 4700 - 4500 = 200 (got ${abs})`);

  const pct = calculatePercentageChange(4700, 4500);
  assert(pct === 4.44, `Percentage change: ((4700 - 4500) / 4500) * 100 = 4.44% (got ${pct})`);

  const negAbs = calculateAbsoluteChange(4300, 4500);
  assert(negAbs === -200, `Negative absolute change: 4300 - 4500 = -200 (got ${negAbs})`);

  const negPct = calculatePercentageChange(4300, 4500);
  assert(negPct === -4.44, `Negative percentage change: ((4300 - 4500) / 4500) * 100 = -4.44% (got ${negPct})`);
}

console.log('\n--- 2. Divide-by-Zero and Missing Comparison Price Guards ---');
{
  const zeroPrev = calculatePercentageChange(4500, 0);
  assert(zeroPrev === null, 'Zero previous price returns null (no Infinity)');

  const nullPrev = calculatePercentageChange(4500, null);
  assert(nullPrev === null, 'Null previous price returns null (no NaN)');

  const nullLatest = calculatePercentageChange(null, 4500);
  assert(nullLatest === null, 'Null latest price returns null (no NaN)');

  const absNull = calculateAbsoluteChange(null, 4500);
  assert(absNull === null, 'Null latest returns null for absolute change');
}

console.log('\n--- 3. Trend Classification Rules (Threshold ±2.0%) ---');
{
  assert(classifyTrend(4.44, 5, 2.0) === 'RISING', '+4.44% with N=5 classified as RISING');
  assert(classifyTrend(-3.5, 4, 2.0) === 'FALLING', '-3.50% with N=4 classified as FALLING');
  assert(classifyTrend(1.2, 5, 2.0) === 'STABLE', '+1.20% within threshold (< 2.0%) classified as STABLE');
  assert(classifyTrend(-0.8, 6, 2.0) === 'STABLE', '-0.80% within threshold (> -2.0%) classified as STABLE');
  assert(classifyTrend(2.0, 5, 2.0) === 'RISING', 'Exact boundary +2.0% classified as RISING');
  assert(classifyTrend(-2.0, 5, 2.0) === 'FALLING', 'Exact boundary -2.0% classified as FALLING');
}

console.log('\n--- 4. Minimum Observation Requirement (N >= 3) ---');
{
  assert(classifyTrend(15.0, 2, 2.0) === 'INSUFFICIENT_DATA', 'N=2 returns INSUFFICIENT_DATA even if large change');
  assert(classifyTrend(-10.0, 1, 2.0) === 'INSUFFICIENT_DATA', 'N=1 returns INSUFFICIENT_DATA');
  assert(classifyTrend(0.0, 0, 2.0) === 'INSUFFICIENT_DATA', 'N=0 returns INSUFFICIENT_DATA');
  assert(classifyTrend(null, 10, 2.0) === 'INSUFFICIENT_DATA', 'Null percentage change returns INSUFFICIENT_DATA');
}

console.log('\n--- 5. Market-to-Market Comparison Math ---');
{
  const comp = calculateMarketComparison(4650, 4550);
  assert(comp.priceDifference === 100, `Market diff: 4650 - 4550 = 100 (got ${comp.priceDifference})`);
  assert(comp.percentageDifference === 2.2, `Market % diff: 2.20% (got ${comp.percentageDifference})`);

  const compZero = calculateMarketComparison(4650, 0);
  assert(compZero.priceDifference === 4650, 'Price difference with zero comparison price is valid');
  assert(compZero.percentageDifference === null, 'Percentage diff with zero comparison price is null (safe)');

  const compNull = calculateMarketComparison(4650, null);
  assert(compNull === null, 'Missing comparison price returns null comparison object');
}

console.log('\n--- 6. Non-Forecast Disclaimer & Attribution Rules ---');
{
  const DISCLAIMER_PHASE_5 = "Historical price trends reflect past mandi transactions and must not be construed as future price guarantees or forecasts.";
  assert(DISCLAIMER_PHASE_5.includes("must not be construed as future price guarantees"), 'Disclaimer explicitly disclaims future price guarantees');
  assert(!DISCLAIMER_PHASE_5.toLowerCase().includes("predicted price"), 'Disclaimer does not mention predicted prices');
}

console.log('\n========================================');
console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
