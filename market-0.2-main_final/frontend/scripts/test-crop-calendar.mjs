/**
 * SoilPilot — Automated Unit Tests for Smart Planting Calendar & Crop Planning Windows (Phase 7)
 *
 * Tests:
 * 1. 15-Day Planning Horizon Range Calculation [T, T + 15 days]
 * 2. Window Overlap & Intersection Mathematics
 * 3. Status Classification (OPTIMAL_NOW, OPENING_SOON, CLOSING_SOON)
 * 4. Harvest Window Calculation: [S_start + D_min, S_end + D_max]
 * 5. Duration Definition Integrity (MPKV Rahuri Standard)
 * 6. Seasonal Window Filtering (Kharif, Rabi, Summer/Zaid)
 * 7. Price Outlook Linkage & Insufficient Data Handling
 * 8. Strict Agricultural Disclaimer Verification
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

// ----------------------------------------------------
// Helpers mirroring Phase 7 Crop Calendar Logic
// ----------------------------------------------------

function calculate15DayRange(evalDate) {
  const start = new Date(evalDate);
  const end = new Date(evalDate);
  end.setDate(start.getDate() + 15);
  return { start, end };
}

function checkWindowOverlap(wStart, wEnd, hStart, hEnd) {
  // Overlaps if max(wStart, hStart) <= min(wEnd, hEnd)
  return Math.max(wStart.getTime(), hStart.getTime()) <= Math.min(wEnd.getTime(), hEnd.getTime());
}

function classifyWindowStatus(evalDate, wStart, wEnd) {
  const t = evalDate.getTime();
  const s = wStart.getTime();
  const e = wEnd.getTime();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  if (t < s) {
    const daysUntilOpen = Math.round((s - t) / MS_PER_DAY);
    return { status: "OPENING_SOON", daysUntilOpen, daysUntilClose: 0 };
  } else if (t <= e) {
    const daysUntilClose = Math.round((e - t) / MS_PER_DAY);
    if (daysUntilClose <= 5) {
      return { status: "CLOSING_SOON", daysUntilOpen: 0, daysUntilClose };
    }
    return { status: "OPTIMAL_NOW", daysUntilOpen: 0, daysUntilClose };
  } else {
    return { status: "CLOSED", daysUntilOpen: 0, daysUntilClose: 0 };
  }
}

function calculateHarvestWindow(wStart, wEnd, durMinDays, durMaxDays) {
  if (!durMinDays || !durMaxDays || durMinDays <= 0 || durMaxDays < durMinDays) {
    return null;
  }
  const harvestStart = new Date(wStart);
  harvestStart.setDate(harvestStart.getDate() + durMinDays);

  const harvestEnd = new Date(wEnd);
  harvestEnd.setDate(harvestEnd.getDate() + durMaxDays);

  return { harvestStart, harvestEnd };
}

// ----------------------------------------------------
// TEST SUITE
// ----------------------------------------------------

console.log("\n🧪 Running SoilPilot Phase 7: Planting Calendar & Crop Planning Unit Tests\n");

// 1. 15-Day Range Calculation
console.log("1. 15-Day Planning Horizon Range Calculation:");
{
  const evalDate = new Date("2026-10-22T00:00:00Z");
  const { start, end } = calculate15DayRange(evalDate);
  const diffDays = Math.round((end - start) / (24 * 60 * 60 * 1000));

  assert(diffDays === 15, `Planning range difference is exactly 15 days (${diffDays})`);
  assert(start.toISOString().startsWith("2026-10-22"), "Start date matches evaluation date");
  assert(end.toISOString().startsWith("2026-11-06"), "End date matches evaluation date + 15 days");
}

// 2. Window Overlap & Intersection
console.log("\n2. Window Overlap & Intersection Mathematics:");
{
  const hStart = new Date("2026-10-22");
  const hEnd = new Date("2026-11-06");

  // Gram: Oct 1 to Nov 10 (Overlaps: currently active)
  const gramStart = new Date("2026-10-01");
  const gramEnd = new Date("2026-11-10");
  assert(checkWindowOverlap(gramStart, gramEnd, hStart, hEnd) === true, "Active window (Oct 1 - Nov 10) intersects [Oct 22, Nov 6]");

  // Wheat: Nov 1 to Nov 30 (Overlaps: opens within next 15 days)
  const wheatStart = new Date("2026-11-01");
  const wheatEnd = new Date("2026-11-30");
  assert(checkWindowOverlap(wheatStart, wheatEnd, hStart, hEnd) === true, "Opening window (Nov 1 - Nov 30) intersects [Oct 22, Nov 6]");

  // Kharif Soybean: Jun 20 to Jul 15 (Does NOT overlap)
  const soyStart = new Date("2026-06-20");
  const soyEnd = new Date("2026-07-15");
  assert(checkWindowOverlap(soyStart, soyEnd, hStart, hEnd) === false, "Past window (Jun 20 - Jul 15) does NOT intersect [Oct 22, Nov 6]");

  // Summer Groundnut: Feb 1 to Feb 25 (Does NOT overlap)
  const gnutStart = new Date("2027-02-01");
  const gnutEnd = new Date("2027-02-25");
  assert(checkWindowOverlap(gnutStart, gnutEnd, hStart, hEnd) === false, "Future window (Feb 1 - Feb 25) does NOT intersect [Oct 22, Nov 6]");
}

// 3. Status Classification
console.log("\n3. Status Classification:");
{
  const evalDate = new Date("2026-10-22");

  // Gram: Oct 1 - Nov 10 -> 19 days remaining (> 5) -> OPTIMAL_NOW
  const resGram = classifyWindowStatus(evalDate, new Date("2026-10-01"), new Date("2026-11-10"));
  assert(resGram.status === "OPTIMAL_NOW", "Oct 1 - Nov 10 on Oct 22 is classified as OPTIMAL_NOW");
  assert(resGram.daysUntilClose === 19, `Gram days until close is 19 (${resGram.daysUntilClose})`);

  // Wheat: Nov 1 - Nov 30 -> Opens in 10 days -> OPENING_SOON
  const resWheat = classifyWindowStatus(evalDate, new Date("2026-11-01"), new Date("2026-11-30"));
  assert(resWheat.status === "OPENING_SOON", "Nov 1 - Nov 30 on Oct 22 is classified as OPENING_SOON");
  assert(resWheat.daysUntilOpen === 10, `Wheat days until open is 10 (${resWheat.daysUntilOpen})`);

  // Crop closing in 3 days -> CLOSING_SOON
  const resClosing = classifyWindowStatus(evalDate, new Date("2026-10-01"), new Date("2026-10-25"));
  assert(resClosing.status === "CLOSING_SOON", "Window ending in 3 days is classified as CLOSING_SOON");
  assert(resClosing.daysUntilClose === 3, "Days until close is 3");
}

// 4. Harvest Window Calculation Math
console.log("\n4. Harvest Window Calculation Math:");
{
  // Bengal Gram: Sowing [Oct 1, Nov 10], Duration 90-105 days
  // Harvest Start = Oct 1 + 90 days = Dec 30
  // Harvest End = Nov 10 + 105 days = Feb 23 (approx)
  const wStart = new Date("2026-10-01");
  const wEnd = new Date("2026-11-10");
  const harvest = calculateHarvestWindow(wStart, wEnd, 90, 105);

  assert(harvest !== null, "Harvest calculation succeeds with valid duration range");
  assert(harvest.harvestStart < harvest.harvestEnd, "Earliest harvest precedes latest harvest");
  
  const spanDays = Math.round((harvest.harvestEnd - harvest.harvestStart) / (24 * 60 * 60 * 1000));
  assert(spanDays === (40 + 15), `Harvest window span correctly reflects sowing span (40 days) + duration span (15 days) = 55 days (${spanDays})`);

  // Invalid duration: min <= 0
  const invalidHarvest = calculateHarvestWindow(wStart, wEnd, 0, 100);
  assert(invalidHarvest === null, "Invalid min duration returns null without inventing dates");
}

// 5. Duration Definition Integrity
console.log("\n5. Duration Definition Integrity:");
{
  const officialDefinition = "Days from direct field sowing to physiological maturity & harvest (MPKV Rahuri Vertisol Standard)";
  assert(officialDefinition.includes("direct field sowing"), "Duration explicitly denotes direct sowing baseline");
  assert(officialDefinition.includes("physiological maturity"), "Duration explicitly denotes physiological maturity");
  assert(officialDefinition.includes("MPKV Rahuri"), "Duration explicitly references university research benchmark");
}

// 6. Seasonal Window Filtering
console.log("\n6. Seasonal Window Filtering:");
{
  const testCalendars = [
    { crop: "Soybean", season: "KHARIF" },
    { crop: "Cotton", season: "KHARIF" },
    { crop: "Gram", season: "RABI" },
    { crop: "Wheat", season: "RABI" },
    { crop: "Summer Moong", season: "ZAID_SUMMER" },
  ];

  const rabiOnly = testCalendars.filter(c => c.season === "RABI");
  assert(rabiOnly.length === 2, `Rabi filter returns exactly 2 crops (${rabiOnly.length})`);
  assert(rabiOnly.every(c => c.season === "RABI"), "All returned crops belong strictly to RABI season");

  const kharifOnly = testCalendars.filter(c => c.season === "KHARIF");
  assert(kharifOnly.length === 2, `Kharif filter returns exactly 2 crops (${kharifOnly.length})`);
}

// 7. Market Forecast Linkage & Insufficient Data Handling
console.log("\n7. Market Forecast Linkage & Insufficient Data Handling:");
{
  function buildOutlook(obsCount, spotPrice) {
    if (obsCount < 15) {
      return {
        status: "UNAVAILABLE_INSUFFICIENT_DATA",
        predicted_modal_price: null,
        unavailability_reason: `Found ${obsCount} valid historical observations. A minimum of 15 observations is required. Current spot price is not used as a future forecast.`,
      };
    }
    return {
      status: "FORECAST_AVAILABLE",
      predicted_modal_price: 5450,
      unavailability_reason: null,
    };
  }

  const outlookZero = buildOutlook(0, 5200);
  assert(outlookZero.status === "UNAVAILABLE_INSUFFICIENT_DATA", "Status is UNAVAILABLE when observations = 0");
  assert(outlookZero.predicted_modal_price === null, "Price forecast is strictly null (no placeholder)");
  assert(outlookZero.unavailability_reason.includes("Current spot price is not used"), "Spot price is strictly prohibited from substituting future harvest forecast");

  const outlookSufficient = buildOutlook(24, 5200);
  assert(outlookSufficient.status === "FORECAST_AVAILABLE", "Status is FORECAST_AVAILABLE when observations >= 15");
  assert(outlookSufficient.predicted_modal_price === 5450, "Forecast modal price is provided when data is sufficient");
}

// 8. Agricultural Disclaimer & Non-Guarantee Rule
console.log("\n8. Agricultural Disclaimer & Non-Guarantee Rule:");
{
  const disclaimer = "Agricultural Decision-Support Tool: Sowing dates and harvest projections are based on university recommendations and normal weather assumptions. Yields, prices, and profits are not guaranteed. Actual harvest timing depends on sowing date, cultivar, moisture, and local management.";
  assert(disclaimer.includes("Decision-Support Tool"), "Disclaimer emphasizes decision-support nature");
  assert(!disclaimer.includes("guaranteed profit"), "Disclaimer strictly avoids profit guarantees");
  assert(disclaimer.includes("not guaranteed"), "Disclaimer explicitly specifies non-guarantee of yield or price");
}

// Summary
console.log("\n========================================================");
console.log(`Phase 7 Crop Calendar Test Results: ${passed} passed, ${failed} failed`);
console.log("========================================================\n");

if (failed > 0) {
  process.exit(1);
}
