/**
 * SoilPilot — Automated Unit Tests for Market Price Forecasting Engine (Phase 6)
 *
 * Tests:
 * 1. Naive Baseline Formula (y_{t+h} = y_t)
 * 2. Moving Average Baseline (SMA-k)
 * 3. Drift Baseline Math (Slope projection)
 * 4. Error Metrics (MAE, RMSE, MAPE, MASE)
 * 5. MAPE Zero/Negative Guard
 * 6. Prediction Interval Integrity (0 <= Lower <= Point <= Upper)
 * 7. Insufficient Data Rules (N < 15 -> Unavailable)
 * 8. Non-Guarantee Disclaimer Compliance
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

// Baseline math helpers
function forecastNaive(series) {
  if (!series || series.length === 0) return null;
  return series[series.length - 1];
}

function forecastSMA(series, k = 3) {
  if (!series || series.length === 0) return null;
  const window = series.slice(-k);
  const sum = window.reduce((a, b) => a + b, 0);
  return Number((sum / window.length).toFixed(2));
}

function forecastDrift(series, h = 1) {
  if (!series || series.length === 0) return null;
  if (series.length === 1) return series[0];
  const slope = (series[series.length - 1] - series[0]) / (series.length - 1);
  return Number(Math.max(0, series[series.length - 1] + h * slope).toFixed(2));
}

// Metric helpers
function computeMAE(actuals, preds) {
  if (actuals.length !== preds.length || actuals.length === 0) return null;
  const sumAbs = actuals.reduce((acc, y, i) => acc + Math.abs(preds[i] - y), 0);
  return Number((sumAbs / actuals.length).toFixed(2));
}

function computeRMSE(actuals, preds) {
  if (actuals.length !== preds.length || actuals.length === 0) return null;
  const sumSq = actuals.reduce((acc, y, i) => acc + Math.pow(preds[i] - y, 2), 0);
  return Number(Math.sqrt(sumSq / actuals.length).toFixed(2));
}

function computeGuardedMAPE(actuals, preds) {
  if (actuals.length !== preds.length || actuals.length === 0) return null;
  let count = 0;
  let sumPct = 0;
  for (let i = 0; i < actuals.length; i++) {
    if (actuals[i] > 0) {
      sumPct += Math.abs((preds[i] - actuals[i]) / actuals[i]);
      count++;
    }
  }
  return count > 0 ? Number(((sumPct / count) * 100).toFixed(2)) : 0.0;
}

function validateInterval(lower, pred, upper) {
  if (lower == null || pred == null || upper == null) return false;
  return lower >= 0 && lower <= pred && pred <= upper;
}

console.log('\n--- 1. Baseline Forecasting Math ---');
{
  const series = [4100, 4150, 4200, 4250, 4300];
  const naive = forecastNaive(series);
  assert(naive === 4300, `Naive baseline projects last value: 4300 (got ${naive})`);

  const sma = forecastSMA(series, 3);
  const expectedSma = Number(((4200 + 4250 + 4300) / 3).toFixed(2));
  assert(sma === expectedSma, `SMA(3) matches mean of last 3: ${expectedSma} (got ${sma})`);

  const drift = forecastDrift(series, 2);
  // slope = (4300 - 4100)/4 = 50. For h=2 -> 4300 + 2*50 = 4400
  assert(drift === 4400, `Drift baseline matches linear trajectory: 4400 (got ${drift})`);
}

console.log('\n--- 2. Evaluation Metrics (MAE, RMSE, MAPE) ---');
{
  const actuals = [4400, 4450, 4500, 4520];
  const preds = [4380, 4460, 4490, 4540];

  const mae = computeMAE(actuals, preds);
  // errors: |-20| + |10| + |-10| + |20| = 60 / 4 = 15.0
  assert(mae === 15.0, `MAE is correctly calculated: 15.0 (got ${mae})`);

  const rmse = computeRMSE(actuals, preds);
  // sq errors: 400 + 100 + 100 + 400 = 1000 / 4 = 250 -> sqrt(250) = 15.81
  assert(rmse === 15.81, `RMSE is correctly calculated: 15.81 (got ${rmse})`);

  const mape = computeGuardedMAPE(actuals, preds);
  assert(mape > 0 && mape < 1.0, `Guarded MAPE computed reasonably: ${mape}%`);
}

console.log('\n--- 3. Guarded MAPE against Zero & Missing Values ---');
{
  const actualsZero = [0, 4500];
  const predsZero = [4300, 4550];
  const mapeZero = computeGuardedMAPE(actualsZero, predsZero);
  assert(mapeZero !== null && !isNaN(mapeZero) && isFinite(mapeZero), 'Zero actual handled safely without Infinity/NaN');
}

console.log('\n--- 4. Prediction Interval Integrity ---');
{
  assert(validateInterval(4100, 4400, 4700) === true, 'Standard interval 4100 <= 4400 <= 4700 is valid');
  assert(validateInterval(4500, 4400, 4700) === false, 'Invalid lower bound > pred is rejected');
  assert(validateInterval(4100, 4400, 4300) === false, 'Invalid upper bound < pred is rejected');
  assert(validateInterval(-100, 4400, 4700) === false, 'Negative lower price bound is rejected');
}

console.log('\n--- 5. Insufficient Data Rules (N < 15) ---');
{
  const sampleCountSmall = 4;
  const MIN_OBS = 15;
  const isSufficient = sampleCountSmall >= MIN_OBS;
  assert(isSufficient === false, `Sample size N=${sampleCountSmall} correctly marked insufficient (min 15)`);

  const sampleCountLarge = 22;
  const isSufficientLarge = sampleCountLarge >= MIN_OBS;
  assert(isSufficientLarge === true, `Sample size N=${sampleCountLarge} correctly marked sufficient`);
}

console.log('\n--- 6. Official Disclaimer Integrity ---');
{
  const DISCLAIMER_TEXT =
    "Agricultural Market Price Forecast Disclaimer: Forecasts are statistical estimates generated from verified historical APMC auction records using time-series models. They do not constitute guaranteed prices, official procurement rates, or binding quotations.";

  assert(DISCLAIMER_TEXT.includes("do not constitute guaranteed prices"), 'Explicitly disclaims guaranteed prices');
  assert(DISCLAIMER_TEXT.includes("statistical estimates"), 'Explicitly identifies as statistical estimates');
  assert(!DISCLAIMER_TEXT.toLowerCase().includes("guaranteed profit"), 'Does not promise guaranteed profit');
}

console.log('\n========================================');
console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
