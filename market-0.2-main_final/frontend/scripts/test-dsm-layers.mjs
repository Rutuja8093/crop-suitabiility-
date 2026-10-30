import assert from "node:assert";
import fs from "node:fs";

console.log("==================================================");
console.log("SOIL MAP LAYERS VERIFICATION SUITE");
console.log("==================================================");

// Read dsmLayers.ts to verify layer order without needing path aliases
const dsmLayersPath = new URL("../lib/gis/dsmLayers.ts", import.meta.url);
const dsmLayersCode = fs.readFileSync(dsmLayersPath, "utf8");

// Extract DSM_LAYER_ORDER array
const matchOrder = dsmLayersCode.match(/export const DSM_LAYER_ORDER:\s*DSMLayerId\[\]\s*=\s*\[([\s\S]*?)\];/);
assert.ok(matchOrder, "DSM_LAYER_ORDER must be defined in dsmLayers.ts");

const orderIds = matchOrder[1]
  .split("\n")
  .map(line => line.trim())
  .filter(line => line.startsWith('"'))
  .map(line => line.replace(/[",]/g, ""));

console.log(`1. Total layers count: ${orderIds.length}`);
assert.strictEqual(orderIds.length, 20, "Total layers in DSM_LAYER_ORDER must be exactly 20");

// 2. kharif_rgb and rabi_rgb are NOT in DSM_LAYER_ORDER
console.log("2. Checking that kharif_rgb and rabi_rgb are removed from DSM_LAYER_ORDER...");
assert.strictEqual(orderIds.includes("kharif_rgb"), false, "kharif_rgb must NOT be in DSM_LAYER_ORDER");
assert.strictEqual(orderIds.includes("rabi_rgb"), false, "rabi_rgb must NOT be in DSM_LAYER_ORDER");
console.log("   ✓ kharif_rgb and rabi_rgb are absent from DSM_LAYER_ORDER");

// 3. Category 3 Land Use & Multi-Spectral Indices has exactly 8 layers
const landUseInOrder = orderIds.filter(id => 
  ["lulc", "ndvi", "evi", "savi", "ndmi", "ndre", "bsi", "ndwi"].includes(id)
);
console.log(`3. Land Use & Multi-Spectral Indices count: ${landUseInOrder.length}`);
assert.strictEqual(landUseInOrder.length, 8, "Land Use category must have exactly 8 layers");
console.log("   Layers in Land Use category:", landUseInOrder);
console.log("   ✓ Exactly 8 layers present in Land Use & Multi-Spectral Indices");

// 4. Manifest verification
const manifestPath = new URL("../public/data/dsm/manifest.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
console.log(`4. Manifest layers count: ${manifest.layers.length}`);
assert.strictEqual(manifest.layers.length, 20, "manifest.json must contain exactly 20 layers");
const manifestIds = manifest.layers.map(l => l.id);
assert.strictEqual(manifestIds.includes("kharif_rgb"), false, "kharif_rgb must NOT be in manifest");
assert.strictEqual(manifestIds.includes("rabi_rgb"), false, "rabi_rgb must NOT be in manifest");
console.log("   ✓ manifest.json strictly contains only 20 layers without kharif_rgb or rabi_rgb");

// 5. DSMLayerSelector code check
const layerSelectorPath = new URL("../components/map/DSMLayerSelector.tsx", import.meta.url);
const layerSelectorCode = fs.readFileSync(layerSelectorPath, "utf8");
assert.ok(layerSelectorCode.includes('"kharif_rgb", "rabi_rgb"'), "excludedLayerIds must include kharif_rgb and rabi_rgb");
assert.ok(!layerSelectorCode.includes('case "kharif_rgb":'), "DSMLayerSelector must not have case kharif_rgb");
assert.ok(!layerSelectorCode.includes('case "rabi_rgb":'), "DSMLayerSelector must not have case rabi_rgb");
assert.ok(!layerSelectorCode.includes('22 Layers'), "DSMLayerSelector must not hardcode 22 Layers");
console.log("   ✓ DSMLayerSelector filters kharif_rgb and rabi_rgb, and dynamically reflects 20 layers");

console.log("\n==================================================");
console.log("ALL SOIL MAP LAYER CHECKS PASSED SUCCESSFULLY!");
console.log("==================================================");
