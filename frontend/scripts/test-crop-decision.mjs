/**
 * Phase 9 Crop Decision Engine & Multi-Criteria Ranking Verification Script.
 * Verifies decision-tier assignment, financial mathematical identities,
 * constraint precedence enforcement, and sensitivity scenario modeling.
 */

import assert from "node:assert";

console.log("=========================================================================");
console.log("Phase 9: Crop Comparison & Decision Engine Verification Suite");
console.log("=========================================================================\n");

const ACRE_TO_HA_RATIO = 0.404685642;

// 1. Mock CACP/MPKV verified benchmarks for Maharashtra Vertisols
const VERIFIED_BENCHMARKS = {
  CHANA: {
    crop_code: "CHANA",
    crop_name: "Bengal Gram (Chana)",
    season: "RABI",
    operational_cost_per_ha: 34500.0,
    total_cost_per_ha: 52000.0,
    yield_min_ha: 10.0,
    yield_expected_ha: 14.5,
    yield_max_ha: 19.0,
    water_req: "LOW",
  },
  ONION: {
    crop_code: "ONION",
    crop_name: "Onion (Kanda)",
    season: "RABI",
    operational_cost_per_ha: 78500.0,
    total_cost_per_ha: 115000.0,
    yield_min_ha: 140.0,
    yield_expected_ha: 210.0,
    yield_max_ha: 280.0,
    water_req: "MEDIUM",
  },
  WHEAT: {
    crop_code: "WHEAT",
    crop_name: "Wheat (Gahu)",
    season: "RABI",
    operational_cost_per_ha: 42000.0,
    total_cost_per_ha: 64500.0,
    yield_min_ha: 25.0,
    yield_expected_ha: 38.0,
    yield_max_ha: 48.0,
    water_req: "MEDIUM",
  },
  SUGARCANE: {
    crop_code: "SUGARCANE",
    crop_name: "Sugarcane (Suru)",
    season: "ANNUAL",
    operational_cost_per_ha: 135000.0,
    total_cost_per_ha: 215000.0,
    yield_min_ha: 850.0,
    yield_expected_ha: 1100.0,
    yield_max_ha: 1400.0,
    water_req: "VERY_HIGH",
  },
};

// 2. Financial calculation helper
function calculateFinancials({ cropCode, areaAcres, priceModal, priceLower, priceUpper }) {
  const bench = VERIFIED_BENCHMARKS[cropCode];
  if (!bench) {
    return { isAvailable: false, reason: "No benchmark found" };
  }

  const opCostAcre = Math.round(bench.operational_cost_per_ha * ACRE_TO_HA_RATIO * 100) / 100;
  const totCostAcre = Math.round(bench.total_cost_per_ha * ACRE_TO_HA_RATIO * 100) / 100;

  const yExpAcre = Math.round(bench.yield_expected_ha * ACRE_TO_HA_RATIO * 100) / 100;
  const yExpHa = bench.yield_expected_ha;

  if (!priceModal || priceModal <= 0) {
    return {
      isAvailable: true,
      reason: "Harvest price forecast unavailable",
      centralScenario: null,
    };
  }

  function makeScenario(price) {
    const grossRevAcre = Math.round(yExpAcre * price * 100) / 100;
    const grossRevHa = Math.round(yExpHa * price * 100) / 100;
    const grossRevField = Math.round(grossRevAcre * areaAcres * 100) / 100;

    const opCostField = Math.round(opCostAcre * areaAcres * 100) / 100;
    const totCostField = Math.round(totCostAcre * areaAcres * 100) / 100;

    const netOpAcre = Math.round((grossRevAcre - opCostAcre) * 100) / 100;
    const netOpHa = Math.round((grossRevHa - bench.operational_cost_per_ha) * 100) / 100;
    const netOpField = Math.round((grossRevField - opCostField) * 100) / 100;

    const bcRatio = Math.round((grossRevAcre / opCostAcre) * 100) / 100;

    return {
      price,
      grossRevAcre,
      grossRevHa,
      grossRevField,
      opCostAcre,
      opCostField,
      netOpAcre,
      netOpHa,
      netOpField,
      bcRatio,
      isProfitable: netOpAcre > 0,
    };
  }

  const pCentral = priceModal;
  const pLow = priceLower || Math.round(priceModal * 0.88 * 100) / 100;
  const pHigh = priceUpper || Math.round(priceModal * 1.12 * 100) / 100;

  return {
    isAvailable: true,
    costAcre: opCostAcre,
    yieldAcre: yExpAcre,
    centralScenario: makeScenario(pCentral),
    conservativeScenario: makeScenario(pLow),
    optimisticScenario: makeScenario(pHigh),
  };
}

// 3. Multi-Criteria Decision Tier Classifier
function classifyDecisionTier({
  suitabilityStatus,
  constraints = [],
  plantingWindowStatus,
  waterReq,
  irrigationVerified = false,
  overallReadiness = "DATA_AVAILABLE",
}) {
  if (overallReadiness === "INSUFFICIENT_DATA") {
    return { tier: "INSUFFICIENT_DATA", priority: 5 };
  }

  if (suitabilityStatus === "POTENTIAL_CONSTRAINT" || constraints.length > 0) {
    return { tier: "CONSTRAINED", priority: 4 };
  }

  if (plantingWindowStatus === "OFF_SEASON") {
    return { tier: "OFF_SEASON", priority: 3 };
  }

  if (
    (suitabilityStatus === "PRELIMINARY_SUITABLE" || (suitabilityStatus === "CONDITIONAL_SUITABILITY" && waterReq === "LOW")) &&
    ["OPTIMAL_NOW", "OPENING_SOON"].includes(plantingWindowStatus)
  ) {
    return { tier: "RECOMMENDED", priority: 1 };
  }

  return { tier: "CONDITIONALLY_SUITABLE", priority: 2 };
}

// =========================================================================
// RUN TEST CASES
// =========================================================================

// Test 1: Mathematical identities
console.log("Test 1: Mathematical identities of revenue, costs, and net return...");
const finChana = calculateFinancials({
  cropCode: "CHANA",
  areaAcres: 2.48,
  priceModal: 5500.0,
});
assert.strictEqual(finChana.isAvailable, true);
const sc = finChana.centralScenario;
assert(sc !== null, "Central scenario must exist");

// Gross Revenue = Yield * Price
const expectedRevAcre = Math.round(finChana.yieldAcre * 5500.0 * 100) / 100;
assert.strictEqual(sc.grossRevAcre, expectedRevAcre, "Per acre revenue identity mismatch");

// Net Return = Revenue - Cost
const expectedNetAcre = Math.round((sc.grossRevAcre - sc.opCostAcre) * 100) / 100;
assert.strictEqual(sc.netOpAcre, expectedNetAcre, "Per acre net return identity mismatch");

// Whole Field scaling
const expectedFieldRev = Math.round(sc.grossRevAcre * 2.48 * 100) / 100;
assert.strictEqual(sc.grossRevField, expectedFieldRev, "Field total revenue mismatch");
console.log("✓ Test 1 passed: Exact mathematical identities confirmed.\n");

// Test 2: Biological soil constraint cannot be overridden by high price
console.log("Test 2: Critical agronomic constraint overrides high financial returns...");
const constrainedResult = classifyDecisionTier({
  suitabilityStatus: "POTENTIAL_CONSTRAINT",
  constraints: ["Salinity Hazard: EC (2.4 dS/m) exceeds critical tolerance"],
  plantingWindowStatus: "OPTIMAL_NOW",
  waterReq: "LOW",
});
assert.strictEqual(constrainedResult.tier, "CONSTRAINED", "Constraint must force CONSTRAINED tier");
assert.strictEqual(constrainedResult.priority, 4, "CONSTRAINED priority must be 4");
console.log("✓ Test 2 passed: Biological soil constraint strictly blocks top recommendation.\n");

// Test 3: Recommended Option classification
console.log("Test 3: Recommended option requirements...");
const recommendedResult = classifyDecisionTier({
  suitabilityStatus: "PRELIMINARY_SUITABLE",
  constraints: [],
  plantingWindowStatus: "OPTIMAL_NOW",
  waterReq: "LOW",
});
assert.strictEqual(recommendedResult.tier, "RECOMMENDED");
assert.strictEqual(recommendedResult.priority, 1);
console.log("✓ Test 3 passed: Optimal edaphic & sowing window achieves RECOMMENDED tier.\n");

// Test 4: Off-season crop classification
console.log("Test 4: Off-season timing classification...");
const offSeasonResult = classifyDecisionTier({
  suitabilityStatus: "PRELIMINARY_SUITABLE",
  constraints: [],
  plantingWindowStatus: "OFF_SEASON",
  waterReq: "LOW",
});
assert.strictEqual(offSeasonResult.tier, "OFF_SEASON");
assert.strictEqual(offSeasonResult.priority, 3);
console.log("✓ Test 4 passed: Off-season crop placed in Priority 3 tier.\n");

// Test 5: Missing soil evidence
console.log("Test 5: Zero soil test data handling...");
const noSoilResult = classifyDecisionTier({
  overallReadiness: "INSUFFICIENT_DATA",
  suitabilityStatus: "NOT_EVALUATED",
  plantingWindowStatus: "OPTIMAL_NOW",
  waterReq: "LOW",
});
assert.strictEqual(noSoilResult.tier, "INSUFFICIENT_DATA");
assert.strictEqual(noSoilResult.priority, 5);
console.log("✓ Test 5 passed: Unrecorded soil test cleanly placed in INSUFFICIENT_DATA tier.\n");

// Test 6: Sensitivity analysis: Conservative vs Central vs Optimistic
console.log("Test 6: Price sensitivity scenario analysis...");
assert(finChana.conservativeScenario.grossRevAcre < finChana.centralScenario.grossRevAcre);
assert(finChana.centralScenario.grossRevAcre < finChana.optimisticScenario.grossRevAcre);
assert.strictEqual(finChana.conservativeScenario.opCostAcre, finChana.centralScenario.opCostAcre);
console.log("✓ Test 6 passed: Price sensitivity monotonicity verified.\n");

// Test 7: Missing harvest price forecast
console.log("Test 7: Missing harvest-period price forecast handling...");
const finNoPrice = calculateFinancials({
  cropCode: "CHANA",
  areaAcres: 2.48,
  priceModal: null, // No forecast
});
assert.strictEqual(finNoPrice.isAvailable, true);
assert.strictEqual(finNoPrice.centralScenario, null, "Scenario must be null when price is missing");
console.log("✓ Test 7 passed: Missing forecast does not fabricate numerical revenue or net return.\n");

console.log("=========================================================================");
console.log("ALL 7 FRONTEND DECISION ENGINE VERIFICATION CHECKS PASSED!");
console.log("=========================================================================\n");
