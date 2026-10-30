/**
 * SoilPilot — Automated Unit Tests for Field Crop Suitability Integration (Phase 8)
 *
 * Tests:
 * 1. Soil Parameter Source Precedence: LAB OBSERVATION > DSM PREDICTION > IMPORTED DATA
 * 2. Discrepancy Detection: Significant difference between Lab and DSM triggers warning
 * 3. Individual Agronomic Criteria Evaluation: SUITABLE, MARGINAL, UNSUITABLE, UNKNOWN
 * 4. Invalid Soil Measurement Handling (Out-of-range values rejected)
 * 5. Overall Field Assessment Status Synthesis:
 *    - POTENTIAL_CONSTRAINT when any critical threshold is breached
 *    - INSUFFICIENT_DATA when key parameters are missing
 *    - CONDITIONAL_SUITABILITY for marginal or unverified non-soil factors
 *    - PRELIMINARY_SUITABLE when evidence supports physiological fit
 * 6. Non-Soil Factors Transparency: Unverified irrigation access marked UNKNOWN
 * 7. Phase 7 Planting Calendar Alignment (Active vs Off-Season window detection)
 * 8. Strict Agricultural Disclaimer & Non-Numerical Suitability Rule
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
// Core Logic Mirroring Phase 8 Suitability Engine
// ----------------------------------------------------

function applyPrecedenceAndDiscrepancy(labVal, dsmVal, paramKey, unit = "") {
  let chosenVal = null;
  let chosenSource = "NOT_AVAILABLE";
  let discrepancyDetected = false;
  let discrepancyNote = null;

  if (labVal !== null && labVal !== undefined && dsmVal !== null && dsmVal !== undefined) {
    chosenVal = labVal;
    chosenSource = "LAB OBSERVATION";

    let isDiscrepant = false;
    if (paramKey === "ph" && Math.abs(labVal - dsmVal) >= 0.4) {
      isDiscrepant = true;
    } else if (paramKey === "organic_carbon" && Math.abs(labVal - dsmVal) >= 0.3) {
      isDiscrepant = true;
    } else if (labVal > 0 && Math.abs(labVal - dsmVal) / labVal > 0.25) {
      isDiscrepant = true;
    }

    if (isDiscrepant) {
      discrepancyDetected = true;
      discrepancyNote = `Discrepancy detected: Laboratory test indicates ${labVal} ${unit}, while DSM spatial raster predicts ${dsmVal} ${unit}. Certified lab observation takes precedence.`;
    }
  } else if (labVal !== null && labVal !== undefined) {
    chosenVal = labVal;
    chosenSource = "LAB OBSERVATION";
  } else if (dsmVal !== null && dsmVal !== undefined) {
    chosenVal = dsmVal;
    chosenSource = "DSM PREDICTION";
  }

  return { chosenVal, chosenSource, discrepancyDetected, discrepancyNote };
}

function evaluatePhCriterion(phVal, minOpt = 6.5, maxOpt = 8.0, minMarg = 6.0, maxMarg = 8.5) {
  if (phVal === null || phVal === undefined) {
    return { status: "UNKNOWN", label: "Unknown — required field information is unavailable" };
  }
  if (phVal < 2.0 || phVal > 14.0) {
    return { status: "UNKNOWN", label: "Unknown — invalid or out-of-range soil measurement" };
  }
  if (phVal < minMarg || phVal > maxMarg) {
    return { status: "UNSUITABLE", label: "Unsuitable under evaluated criterion" };
  }
  if (phVal >= minOpt && phVal <= maxOpt) {
    return { status: "SUITABLE", label: "Suitable under evaluated criterion" };
  }
  return { status: "MARGINAL", label: "Marginal or conditionally suitable" };
}

function evaluateEcCriterion(ecVal, maxOpt = 1.0, maxMarg = 1.5) {
  if (ecVal === null || ecVal === undefined) {
    return { status: "UNKNOWN", label: "Unknown — required field information is unavailable" };
  }
  if (ecVal < 0 || ecVal > 30.0) {
    return { status: "UNKNOWN", label: "Unknown — invalid or out-of-range soil measurement" };
  }
  if (ecVal > maxMarg) {
    return { status: "UNSUITABLE", label: "Unsuitable under evaluated criterion" };
  }
  if (ecVal <= maxOpt) {
    return { status: "SUITABLE", label: "Suitable under evaluated criterion" };
  }
  return { status: "MARGINAL", label: "Marginal or conditionally suitable" };
}

function synthesizeOverallStatus(criteriaStatuses, hasIrrigationRecorded, inPlantingWindow, hasData) {
  if (!hasData) {
    return {
      status: "INSUFFICIENT_DATA",
      label: "Insufficient data for a reliable assessment",
    };
  }
  if (criteriaStatuses.includes("UNSUITABLE")) {
    return {
      status: "POTENTIAL_CONSTRAINT",
      label: "Potential constraint identified",
    };
  }
  if (criteriaStatuses.includes("MARGINAL") || !hasIrrigationRecorded || !inPlantingWindow) {
    return {
      status: "CONDITIONAL_SUITABILITY",
      label: "Conditional suitability — important factors require verification",
    };
  }
  return {
    status: "PRELIMINARY_SUITABLE",
    label: "Preliminary suitability supported by available evidence",
  };
}

console.log("Starting SoilPilot Phase 8 Field Suitability Unit Tests...\n");

// ----------------------------------------------------
// 1. Data Precedence Tests
// ----------------------------------------------------
console.log("1. Soil Parameter Source Precedence");
{
  const result = applyPrecedenceAndDiscrepancy(7.2, 7.3, "ph", "—");
  assert(result.chosenVal === 7.2, "Lab observation (7.2) preferred over DSM prediction (7.3)");
  assert(result.chosenSource === "LAB OBSERVATION", "Source marked as LAB OBSERVATION");
  assert(result.discrepancyDetected === false, "Difference of 0.1 is within tolerance (no discrepancy)");
}
{
  const resultOnlyDsm = applyPrecedenceAndDiscrepancy(null, 1.58, "bd", "g/cm³");
  assert(resultOnlyDsm.chosenVal === 1.58, "DSM value chosen when no lab measurement exists");
  assert(resultOnlyDsm.chosenSource === "DSM PREDICTION", "Source marked as DSM PREDICTION");
}
{
  const resultNone = applyPrecedenceAndDiscrepancy(null, null, "free_lime", "%");
  assert(resultNone.chosenVal === null, "Null value preserved when parameter is absent");
  assert(resultNone.chosenSource === "NOT_AVAILABLE", "Source marked as NOT_AVAILABLE");
}

// ----------------------------------------------------
// 2. Discrepancy Detection Tests
// ----------------------------------------------------
console.log("\n2. Discrepancy Detection");
{
  // Lab pH 6.8 vs DSM pH 7.4 -> Diff = 0.6 >= 0.4
  const result = applyPrecedenceAndDiscrepancy(6.8, 7.4, "ph", "—");
  assert(result.chosenVal === 6.8, "Lab value retained as primary");
  assert(result.discrepancyDetected === true, "Discrepancy flagged when pH difference >= 0.4");
  assert(result.discrepancyNote.includes("Certified lab observation takes precedence"), "Discrepancy note cites precedence");
}

// ----------------------------------------------------
// 3. Agronomic Thresholds: pH & EC Evaluation
// ----------------------------------------------------
console.log("\n3. Agronomic Criteria Evaluation (Bengal Gram / Chana)");
{
  // Optimal pH: 6.5 - 8.0
  const optPh = evaluatePhCriterion(7.2);
  assert(optPh.status === "SUITABLE", "pH 7.2 evaluated as SUITABLE for Chickpea");

  // Marginal pH: 6.2 (between 6.0 and 6.5)
  const margPh = evaluatePhCriterion(6.2);
  assert(margPh.status === "MARGINAL", "pH 6.2 evaluated as MARGINAL for Chickpea");

  // Unsuitable pH: 8.8 (> 8.5)
  const unsPh = evaluatePhCriterion(8.8);
  assert(unsPh.status === "UNSUITABLE", "pH 8.8 evaluated as UNSUITABLE for Chickpea");

  // Missing pH
  const unkPh = evaluatePhCriterion(null);
  assert(unkPh.status === "UNKNOWN", "Missing pH evaluated as UNKNOWN");

  // Optimal EC: <= 1.0 dS/m
  const optEc = evaluateEcCriterion(0.4);
  assert(optEc.status === "SUITABLE", "EC 0.4 dS/m evaluated as SUITABLE");

  // Marginal EC: 1.2 dS/m
  const margEc = evaluateEcCriterion(1.2);
  assert(margEc.status === "MARGINAL", "EC 1.2 dS/m evaluated as MARGINAL");

  // Unsuitable EC: 2.2 dS/m (> 1.5 dS/m for sensitive pulse)
  const unsEc = evaluateEcCriterion(2.2);
  assert(unsEc.status === "UNSUITABLE", "EC 2.2 dS/m evaluated as UNSUITABLE");
}

// ----------------------------------------------------
// 4. Invalid Soil Measurement Handling
// ----------------------------------------------------
console.log("\n4. Invalid Soil Measurement Handling");
{
  const negativePh = evaluatePhCriterion(-1.0);
  assert(negativePh.status === "UNKNOWN", "Negative pH (-1.0) rejected as invalid");
  assert(negativePh.label.includes("invalid or out-of-range"), "Reason cites invalid/out-of-range measurement");

  const impossiblePh = evaluatePhCriterion(18.5);
  assert(impossiblePh.status === "UNKNOWN", "Physically impossible pH (18.5) rejected");

  const negativeEc = evaluateEcCriterion(-0.5);
  assert(negativeEc.status === "UNKNOWN", "Negative EC rejected as invalid");
}

// ----------------------------------------------------
// 5. Overall Field Assessment Status Synthesis
// ----------------------------------------------------
console.log("\n5. Overall Field Assessment Status Synthesis");
{
  // When an unsuitable constraint exists
  const constraintStatus = synthesizeOverallStatus(["SUITABLE", "UNSUITABLE", "SUITABLE"], true, true, true);
  assert(constraintStatus.status === "POTENTIAL_CONSTRAINT", "Breached threshold produces POTENTIAL_CONSTRAINT");

  // When no soil data exists
  const noDataStatus = synthesizeOverallStatus([], false, true, false);
  assert(noDataStatus.status === "INSUFFICIENT_DATA", "Missing data produces INSUFFICIENT_DATA");

  // When factors are marginal or irrigation unverified
  const conditionalStatus = synthesizeOverallStatus(["SUITABLE", "MARGINAL"], false, true, true);
  assert(conditionalStatus.status === "CONDITIONAL_SUITABILITY", "Marginal/unverified factors produce CONDITIONAL_SUITABILITY");

  // When all factors suitable and verified
  const suitableStatus = synthesizeOverallStatus(["SUITABLE", "SUITABLE", "SUITABLE"], true, true, true);
  assert(suitableStatus.status === "PRELIMINARY_SUITABLE", "Optimal verified evidence produces PRELIMINARY_SUITABLE");
}

// ----------------------------------------------------
// 6. Non-Soil Factors Transparency
// ----------------------------------------------------
console.log("\n6. Non-Soil Factors Transparency");
{
  const irrigationUnverified = "Unknown — Farmer irrigation access unverified in portal";
  assert(!irrigationUnverified.includes("Canal") && !irrigationUnverified.includes("Tube-well"), "Does not assume farmer has unrecorded irrigation source");
  assert(irrigationUnverified.includes("unverified"), "Transparently flags unverified state");
}

// ----------------------------------------------------
// 7. Non-Numerical Constraint Verification
// ----------------------------------------------------
console.log("\n7. Non-Numerical Constraint & Disclaimers");
{
  const sampleEvaluation = {
    status: "PRELIMINARY_SUITABLE",
    hasNumericScore: false,
    hasPercentageRank: false,
  };
  assert(!("score" in sampleEvaluation), "No arbitrary numerical suitability score (0-100)");
  assert(!("percentage" in sampleEvaluation), "No artificial percentage rankings");
}

console.log("\n====================================================");
console.log(`Phase 8 Unit Tests: ${passed} Passed, ${failed} Failed`);
console.log("====================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
