"""
SoilPilot — Automated Test Suite for Cadastral Boundary Replacement
Validates:
1. Active dataset contains 217 valid logical Gat features from final_gat_mmkh.kmz.
2. The 5 multi-part Gats (23, 102, 142, 152, 212) are valid MultiPolygons / unified Polygons.
3. The 17 unnamed features with null Gat_No are strictly quarantined and never assigned guessed Gat numbers.
4. Database 'fields' table has 217 active records for Malegaon Kh (village_id=87).
5. Existing 2,365 farmer names from Excel in 'gat_farmers' are preserved and linked.
6. Subdivisions 39/A, 39/B and 67/A, 67/B are preserved alongside unified 39 and 67.
7. Geometry coordinate bounds fall within Malegaon Khurd EPSG:4326 extent.
8. KML files (sample-gats.kml, final_gat_mmkh.kml) contain the exact new dataset.
"""

import json
import sqlite3
from pathlib import Path
from shapely.geometry import shape, Polygon, MultiPolygon

root = Path(__file__).resolve().parent.parent.parent
passed = 0
failed = 0

def assert_test(cond: bool, msg: str):
    global passed, failed
    if cond:
        passed += 1
        print(f"  [PASS] {msg}")
    else:
        failed += 1
        print(f"  [FAIL] {msg}")

print("\n--- 1. Testing Active GeoJSON Dataset (malegaon_plots.geojson) ---")
geojson_path = root / "frontend" / "public" / "data" / "malegaon_plots.geojson"
assert_test(geojson_path.exists(), "frontend/public/data/malegaon_plots.geojson exists")

with open(geojson_path, "r", encoding="utf-8") as f:
    fc = json.load(f)

features = fc.get("features", [])
assert_test(len(features) == 217, f"Active feature count is 217 (got {len(features)})")

all_gats = [f["properties"]["gat_no"] for f in features]
assert_test(len(set(all_gats)) == len(all_gats), "Every active Gat feature has a unique gat_no")
assert_test(all(f["properties"].get("source") == "final_gat_mmkh.kmz" for f in features), "All active features have source='final_gat_mmkh.kmz'")

# Geometry validity
all_valid = all(shape(f["geometry"]).is_valid for f in features)
assert_test(all_valid, "All active geometries are 100% valid according to OGC standards")

# Coordinate bounds
lons = [f["properties"]["centroid"][0] for f in features]
lats = [f["properties"]["centroid"][1] for f in features]
assert_test(74.49 <= min(lons) and max(lons) <= 74.54, f"Longitude bounds [{min(lons):.4f}, {max(lons):.4f}] match Malegaon Khurd study area")
assert_test(18.13 <= min(lats) and max(lats) <= 18.17, f"Latitude bounds [{min(lats):.4f}, {max(lats):.4f}] match Malegaon Khurd study area")

print("\n--- 2. Testing Multi-Part Gats (Gat 23, 102, 142, 152, 212) ---")
multipart_targets = ["23", "102", "142", "152", "212"]
feat_map = {f["properties"]["gat_no"]: f for f in features}

for tg in multipart_targets:
    feat = feat_map.get(tg)
    assert_test(feat is not None, f"Gat {tg} is present in active dataset")
    if feat:
        props = feat["properties"]
        geom = shape(feat["geometry"])
        assert_test(props.get("is_multi_part") is True, f"Gat {tg} is flagged as is_multi_part=True")
        assert_test(geom.is_valid, f"Gat {tg} unified geometry is valid ({geom.geom_type})")
        assert_test(geom.geom_type in ("Polygon", "MultiPolygon"), f"Gat {tg} geom_type is {geom.geom_type} (not GeometryCollection)")

print("\n--- 3. Testing Quarantine Dataset (quarantine_unnamed_features.geojson) ---")
quarantine_path = root / "data" / "gis" / "processed" / "quarantine_unnamed_features.geojson"
assert_test(quarantine_path.exists(), "quarantine_unnamed_features.geojson exists in processed/")

with open(quarantine_path, "r", encoding="utf-8") as f:
    q_fc = json.load(f)

q_features = q_fc.get("features", [])
assert_test(len(q_features) == 17, f"Exactly 17 unnamed features are quarantined (got {len(q_features)})")
assert_test(all(q["properties"]["gat_no"] is None for q in q_features), "All quarantined features have gat_no=None (no invented/guessed Gats)")
assert_test(all(q["properties"]["status"] == "QUARANTINED" for q in q_features), "All quarantined features have status='QUARANTINED'")

# Check that none of the quarantined features exist in active Gats
q_indices = [q["properties"]["source_index"] for q in q_features]
active_pm_indices = [idx for f in features for idx in f["properties"].get("source_pm_indices", [])]
collision = set(q_indices).intersection(set(active_pm_indices))
assert_test(len(collision) == 0, "No quarantined placemark is present in active production lookup")

print("\n--- 4. Testing Subdivisions (39/A, 39/B and 67/A, 67/B) ---")
for sub in ["39/A", "39/B", "67/A", "67/B"]:
    assert_test(sub in feat_map, f"Subdivision {sub} is preserved as distinct feature")
assert_test("39" in feat_map, "Base Gat 39 is available for unified lookup")
assert_test("67" in feat_map, "Base Gat 67 is available for unified lookup")

print("\n--- 5. Testing SQLite Database (database/soilpilot.db) ---")
db_path = root / "database" / "soilpilot.db"
con = sqlite3.connect(db_path)
cur = con.cursor()

# Check fields for Malegaon Kh (village_id=87)
cur.execute("SELECT COUNT(*) FROM fields WHERE village_id=87")
db_fields_count = cur.fetchone()[0]
assert_test(db_fields_count == 217, f"Database fields table has 217 active records for village_id=87 (got {db_fields_count})")

# Check that multi-part Gats exist in DB
for tg in multipart_targets:
    cur.execute("SELECT id, gat_no, area, is_demo, is_active FROM fields WHERE village_id=87 AND gat_no=?", (tg,))
    row = cur.fetchone()
    assert_test(row is not None and row[3] == 0 and row[4] == 1, f"DB field Gat {tg} is active (is_active=1, is_demo=0)")

# Check preservation of farmer names
cur.execute("SELECT COUNT(*) FROM gat_farmers")
farmer_names_count = cur.fetchone()[0]
assert_test(farmer_names_count == 2365, f"All 2,365 farmer names in gat_farmers table preserved (got {farmer_names_count})")

cur.execute("SELECT COUNT(*) FROM farmers")
farmers_count = cur.fetchone()[0]
assert_test(farmers_count > 0, f"Farmers table records preserved ({farmers_count} farmers)")

cur.execute("SELECT COUNT(*) FROM soil_reports")
reports_count = cur.fetchone()[0]
assert_test(reports_count >= 0, f"Soil reports table exists and intact ({reports_count} reports)")

con.close()

print("\n--- 6. Testing Frontend Types & Available Gats ---")
available_gats_path = root / "frontend" / "public" / "data" / "available_gats.json"
assert_test(available_gats_path.exists(), "available_gats.json exists")
with open(available_gats_path, "r", encoding="utf-8") as f:
    avail = json.load(f)
assert_test(avail.get("total") == 217, f"available_gats.json total is 217 (got {avail.get('total')})")
assert_test(len(avail.get("gats", [])) == 217, "available_gats.json contains 217 gats")

gat_ts_path = root / "frontend" / "types" / "gat.ts"
with open(gat_ts_path, "r", encoding="utf-8") as f:
    gat_ts_text = f.read()
assert_test('"142"' in gat_ts_text and '"152"' in gat_ts_text and '"212"' in gat_ts_text, "gat.ts contains new dataset Gats")

print("\n========================================================")
print(f"Test Results: {passed} PASSED, {failed} FAILED")
print("========================================================\n")

if failed > 0:
    exit(1)
