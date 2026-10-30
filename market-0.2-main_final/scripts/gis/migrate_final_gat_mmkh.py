"""
SoilPilot — Cadastral Boundary Migration Pipeline
Replaces active Gat boundary dataset with validated geometries from final_gat_mmkh.kmz.

Preserves all unrelated data (farmer names, soil health cards, raster layers, etc.).
Quarantines unverified/unnamed features (17 features with null Gat_No).
Combines legitimate multi-part features (Gat 23, 102, 142, 152, 212) into valid MultiPolygons.
"""

import os
import sys
import json
import re
import math
import shutil
import zipfile
import sqlite3
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional

import shapely
from shapely.geometry import Polygon, MultiPolygon, mapping, shape
from shapely.validation import make_valid, explain_validity
from shapely.ops import unary_union


def normalize_gat_number(raw_val: str) -> str:
    """
    Safely normalizes a Gat number for lookup without altering original metadata.
    Handles 'Gat 22', 'Gat No. 22', '22.0', 'Gat 67/A', '67/B', '22', etc.
    """
    if raw_val is None:
        return ""
    s = str(raw_val).strip()
    # Check for subdivision like 67/A, 39/B
    sub_m = re.search(r'(\d+/[A-Za-z0-9]+)', s)
    if sub_m:
        return sub_m.group(1).upper()
    # Check if decimal like 22.0
    dec_m = re.match(r'^(\d+)\.0+$', s)
    if dec_m:
        return dec_m.group(1)
    # Extract integer number
    num_m = re.search(r'\d+', s)
    if num_m:
        return num_m.group(0)
    return s


def calculate_polygon_area_ha_geodesic(geom) -> float:
    """
    Calculates polygon area in hectares using geodesic projection at lat ~18.15 (Baramati / Malegaon Khurd).
    """
    lat0 = 18.15 * math.pi / 180.0
    m_per_deg_lat = 111132.954 - 559.822 * math.cos(2 * lat0)
    m_per_deg_lon = 111412.84 * math.cos(lat0)

    def ring_area(coords):
        if len(coords) < 3:
            return 0.0
        m_pts = [(c[0] * m_per_deg_lon, c[1] * m_per_deg_lat) for c in coords]
        a = 0.0
        for i in range(len(m_pts) - 1):
            a += m_pts[i][0] * m_pts[i + 1][1] - m_pts[i + 1][0] * m_pts[i][1]
        return abs(a) / 2.0

    total_m2 = 0.0
    if isinstance(geom, Polygon):
        total_m2 += ring_area(list(geom.exterior.coords))
        for interior in geom.interiors:
            total_m2 -= ring_area(list(interior.coords))
    elif isinstance(geom, MultiPolygon):
        for poly in geom.geoms:
            total_m2 += ring_area(list(poly.exterior.coords))
            for interior in poly.interiors:
                total_m2 -= ring_area(list(interior.coords))

    return round(max(0.0, total_m2) / 10000.0, 2)


def calculate_bbox_and_centroid(geom) -> Tuple[List[float], List[float]]:
    """Calculates [min_lon, min_lat, max_lon, max_lat] and [centroid_lon, centroid_lat]."""
    bounds = list(geom.bounds)  # minx, miny, maxx, maxy -> min_lon, min_lat, max_lon, max_lat
    c = geom.centroid
    return bounds, [round(c.x, 6), round(c.y, 6)]


def parse_kml_placemarks(kml_bytes: bytes) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parses all Placemarks from KML bytes.
    Returns:
      valid_named_records: list of dicts with valid Gat labels
      quarantine_records: list of dicts with unverified / empty names
      repair_logs: list of geometry repairs performed
    """
    root = ET.fromstring(kml_bytes)
    pms = [elem for elem in root.iter() if elem.tag.endswith('Placemark')]

    named_records = []
    quarantine_records = []
    repair_logs = []

    for idx, pm in enumerate(pms):
        name_el = [c for c in pm if c.tag.endswith('name')]
        raw_name = name_el[0].text.strip() if name_el and name_el[0].text else ''

        desc_el = [c for c in pm if c.tag.endswith('description')]
        desc = desc_el[0].text.strip() if desc_el and desc_el[0].text else ''

        # Attributes from HTML description table
        area_m = re.search(r'<td>SHAPE_Area</td>\s*<td>(.*?)</td>', desc)
        table_area_m2 = float(area_m.group(1)) if area_m and area_m.group(1) not in ('&lt;Null&gt;', '<Null>', '') else None

        len_m = re.search(r'<td>SHAPE_Length</td>\s*<td>(.*?)</td>', desc)
        table_len_m = float(len_m.group(1)) if len_m and len_m.group(1) not in ('&lt;Null&gt;', '<Null>', '') else None

        gat_no_m = re.search(r'<td>Gat_No</td>\s*<td>(.*?)</td>', desc)
        table_gat_no = gat_no_m.group(1).strip() if gat_no_m and gat_no_m.group(1) not in ('&lt;Null&gt;', '<Null>', '') else None

        effective_name = raw_name or table_gat_no or ''
        is_empty_or_null = (not effective_name) or effective_name.lower() in ('<null>', '&lt;null&gt;', 'null')

        # Extract all Polygons in Placemark (handles MultiGeometry)
        poly_elements = [e for e in pm.iter() if e.tag.endswith('Polygon')]
        poly_objs = []

        for pe in poly_elements:
            outer_el = [e for e in pe.iter() if e.tag.endswith('outerBoundaryIs')]
            if not outer_el:
                continue
            outer_coords_el = [e for e in outer_el[0].iter() if e.tag.endswith('coordinates')]
            if not outer_coords_el or not outer_coords_el[0].text:
                continue

            outer_pts = []
            for token in outer_coords_el[0].text.strip().split():
                parts = token.split(',')
                if len(parts) >= 2:
                    lon = float(parts[0])
                    lat = float(parts[1])
                    outer_pts.append((lon, lat))

            if len(outer_pts) < 3:
                continue
            if outer_pts[0] != outer_pts[-1]:
                outer_pts.append(outer_pts[0])

            # Inner rings / holes
            inner_rings = []
            inner_els = [e for e in pe.iter() if e.tag.endswith('innerBoundaryIs')]
            for ie in inner_els:
                in_coords_el = [e for e in ie.iter() if e.tag.endswith('coordinates')]
                if in_coords_el and in_coords_el[0].text:
                    in_pts = []
                    for token in in_coords_el[0].text.strip().split():
                        parts = token.split(',')
                        if len(parts) >= 2:
                            in_pts.append((float(parts[0]), float(parts[1])))
                    if len(in_pts) >= 3:
                        if in_pts[0] != in_pts[-1]:
                            in_pts.append(in_pts[0])
                        inner_rings.append(in_pts)

            p_obj = Polygon(outer_pts, inner_rings)
            poly_objs.append(p_obj)

        if not poly_objs:
            print(f"Warning: Placemark #{idx} has no valid polygon elements. Skipping.")
            continue

        if len(poly_objs) == 1:
            geom = poly_objs[0]
        else:
            geom = MultiPolygon(poly_objs)

        if not geom.is_valid:
            reason = explain_validity(geom)
            geom_repaired = make_valid(geom)
            repair_logs.append({
                "index": idx,
                "name": effective_name or f"Unnamed_PM_{idx}",
                "reason": reason,
                "repaired": geom_repaired.is_valid
            })
            geom = geom_repaired

        record = {
            "index": idx,
            "raw_name": effective_name,
            "table_gat_no": table_gat_no,
            "table_area_m2": table_area_m2,
            "table_len_m": table_len_m,
            "geom": geom
        }

        if is_empty_or_null:
            record["quarantine_reason"] = "Empty name and null Gat_No attribute in source KMZ"
            quarantine_records.append(record)
        else:
            record["gat_no"] = normalize_gat_number(effective_name)
            named_records.append(record)

    return named_records, quarantine_records, repair_logs


def build_active_features(named_records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, Any]]:
    """
    Groups valid named records into logical Gat boundaries.
    Combines multi-part features (Gat 23, 102, 142, 152, 212) into clean MultiPolygons.
    Also creates combined base features for 39 and 67 (while preserving 39/A, 39/B, 67/A, 67/B).
    """
    gat_groups: Dict[str, List[Dict[str, Any]]] = {}
    for r in named_records:
        gn = r["gat_no"]
        if gn not in gat_groups:
            gat_groups[gn] = []
        gat_groups[gn].append(r)

    multi_part_report = {}
    for gn, items in gat_groups.items():
        if len(items) > 1:
            multi_part_report[gn] = {
                "count": len(items),
                "source_indices": [it["index"] for it in items],
                "source_names": [it["raw_name"] for it in items],
                "areas_m2": [it["table_area_m2"] for it in items]
            }

    # Also handle base Gat numbers for subdivisions (e.g. 39 for 39/A & 39/B, 67 for 67/A & 67/B)
    subdivision_bases: Dict[str, List[str]] = {}
    for gn in list(gat_groups.keys()):
        if "/" in gn:
            base = gn.split("/")[0]
            if base not in subdivision_bases:
                subdivision_bases[base] = []
            subdivision_bases[base].append(gn)

    for base, sub_list in subdivision_bases.items():
        if base not in gat_groups:
            combined_records = []
            for sub in sub_list:
                combined_records.extend(gat_groups[sub])
            gat_groups[base] = combined_records

    # Sort gats numerically then alphabetically
    def sort_key(k):
        num_m = re.match(r'^(\d+)', k)
        val = int(num_m.group(1)) if num_m else 9999
        return (val, k)

    sorted_gats = sorted(gat_groups.keys(), key=sort_key)
    features = []

    for gn in sorted_gats:
        items = gat_groups[gn]
        geoms = [it["geom"] for it in items]

        if len(geoms) == 1:
            final_geom = geoms[0]
        else:
            flat_polys = []
            for g in geoms:
                if isinstance(g, Polygon):
                    flat_polys.append(g)
                elif isinstance(g, MultiPolygon):
                    flat_polys.extend(g.geoms)
            # Use unary_union to merge touching or adjacent parcels cleanly
            final_geom = unary_union(flat_polys)

        if not final_geom.is_valid:
            final_geom = make_valid(final_geom)

        if final_geom.geom_type == "GeometryCollection":
            polys = []
            for g in final_geom.geoms:
                if isinstance(g, Polygon):
                    polys.append(g)
                elif isinstance(g, MultiPolygon):
                    polys.extend(g.geoms)
            final_geom = unary_union(polys)

        calc_ha = calculate_polygon_area_ha_geodesic(final_geom)
        table_areas = [it["table_area_m2"] for it in items if it["table_area_m2"] is not None]
        if table_areas:
            sum_table_m2 = sum(table_areas)
            area_ha = round(sum_table_m2 / 10000.0, 2)
            area_sqm = round(sum_table_m2)
        else:
            area_ha = calc_ha
            area_sqm = round(calc_ha * 10000.0)

        area_acres = round(area_ha * 2.47105, 2)
        raw_source_names = list(dict.fromkeys(it["raw_name"] for it in items if it["raw_name"]))
        source_name = ", ".join(raw_source_names) or f"Gat {gn}"
        bbox, centroid = calculate_bbox_and_centroid(final_geom)

        feature = {
            "type": "Feature",
            "id": str(gn),
            "properties": {
                "gat_no": str(gn),
                "source_name": source_name,
                "village": "Malegaon Kh.",
                "taluka": "Baramati",
                "district": "Pune",
                "state": "Maharashtra",
                "area": area_ha,
                "area_ha": area_ha,
                "area_acres": area_acres,
                "area_sqm": area_sqm,
                "centroid": centroid,
                "bounds": bbox,
                "source": "final_gat_mmkh.kmz",
                "is_demo": False,
                "plot_count": len(items),
                "is_multi_part": len(items) > 1,
                "source_pm_indices": [it["index"] for it in items]
            },
            "geometry": mapping(final_geom)
        }
        features.append(feature)

    return features, sorted_gats, multi_part_report


def build_quarantine_features(quarantine_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Builds GeoJSON features for quarantined unnamed features."""
    features = []
    for r in quarantine_records:
        geom = r["geom"]
        calc_ha = calculate_polygon_area_ha_geodesic(geom)
        table_m2 = r["table_area_m2"]
        area_ha = round(table_m2 / 10000.0, 2) if table_m2 else calc_ha
        area_sqm = round(table_m2) if table_m2 else round(calc_ha * 10000.0)
        area_acres = round(area_ha * 2.47105, 2)
        bbox, centroid = calculate_bbox_and_centroid(geom)

        f = {
            "type": "Feature",
            "id": f"quarantine_{r['index']}",
            "properties": {
                "source_index": r["index"],
                "raw_name": None,
                "gat_no": None,
                "quarantine_reason": r.get("quarantine_reason", "Unverified Gat number"),
                "village": "Malegaon Kh.",
                "taluka": "Baramati",
                "district": "Pune",
                "state": "Maharashtra",
                "area_ha": area_ha,
                "area_acres": area_acres,
                "area_sqm": area_sqm,
                "table_length_m": r["table_len_m"],
                "centroid": centroid,
                "bounds": bbox,
                "source": "final_gat_mmkh.kmz",
                "status": "QUARANTINED"
            },
            "geometry": mapping(geom)
        }
        features.append(f)
    return features


def update_sqlite_database(db_path: Path, active_features: List[Dict[str, Any]]) -> int:
    """
    Safely updates the fields table in soilpilot.db for Malegaon Khurd (village_id = 87).
    Preserves all other village records, farmer data, and soil health records.
    """
    if not db_path.exists():
        print(f"Warning: Database {db_path} not found. Skipping SQLite update.")
        return 0

    con = sqlite3.connect(db_path)
    cur = con.cursor()

    # Find Malegaon Kh village_id
    cur.execute("SELECT id, name FROM villages WHERE name LIKE '%Malegaon Kh%'")
    row = cur.fetchone()
    if not row:
        print("Error: Village 'Malegaon Kh' not found in database!")
        con.close()
        return 0

    village_id = row[0]
    village_name = row[1]
    print(f"[DB UPDATE] Found target village: id={village_id}, name='{village_name}'")

    # Count existing fields for this village
    cur.execute("SELECT COUNT(*) FROM fields WHERE village_id = ?", (village_id,))
    old_count = cur.fetchone()[0]
    print(f"[DB UPDATE] Old fields count for {village_name} (village_id={village_id}): {old_count}")

    # Delete ONLY the old field boundaries for this specific village
    cur.execute("DELETE FROM fields WHERE village_id = ?", (village_id,))
    print(f"[DB UPDATE] Removed {old_count} old field records for {village_name}.")

    inserted = 0
    now_str = "2026-10-15 06:00:00"

    for feat in active_features:
        props = feat["properties"]
        gat_no = props["gat_no"]
        area_ha = props["area_ha"]
        geom_dict = feat["geometry"]
        shapely_obj = shape(geom_dict)

        # Ensure MULTIPOLYGON in WKT
        if isinstance(shapely_obj, Polygon):
            shapely_multi = MultiPolygon([shapely_obj])
        elif isinstance(shapely_obj, MultiPolygon):
            shapely_multi = shapely_obj
        else:
            continue

        geom_wkt = shapely_multi.wkt

        cur.execute("""
            INSERT INTO fields (
                village_id, gat_no, area, area_unit, geometry, is_demo, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            village_id,
            gat_no,
            area_ha,
            "hectare",
            geom_wkt,
            0,  # is_demo = False (authoritative survey dataset)
            1,  # is_active = True
            now_str,
            now_str
        ))
        inserted += 1

    con.commit()
    print(f"[DB UPDATE] Successfully inserted {inserted} new field records for {village_name}.")
    con.close()
    return inserted


def main():
    root = Path(__file__).resolve().parent.parent.parent
    kmz_path = root / "final_gat_mmkh.kmz"
    if not kmz_path.exists():
        kmz_path = root.parent / "final_gat_mmkh.kmz"
    if not kmz_path.exists():
        print(f"Error: {kmz_path} not found!")
        sys.exit(1)

    print(f"[MIGRATION] Reading KMZ dataset: {kmz_path}")

    with zipfile.ZipFile(kmz_path, 'r') as z:
        kml_bytes = z.read('doc.kml')

    named_records, quarantine_records, repair_logs = parse_kml_placemarks(kml_bytes)
    print(f"[MIGRATION] Parsed {len(named_records)} valid named records, {len(quarantine_records)} quarantined unnamed records.")
    print(f"[MIGRATION] Repairs logged: {len(repair_logs)}")

    active_features, sorted_gats, multi_part_report = build_active_features(named_records)
    quarantine_features = build_quarantine_features(quarantine_records)

    print(f"[MIGRATION] Active logical Gat features created: {len(active_features)}")
    print(f"[MIGRATION] Multi-part Gats handled: {list(multi_part_report.keys())}")
    print(f"[MIGRATION] Quarantined features: {len(quarantine_features)}")

    # 1. Output staging files
    staging_dir = root / "data" / "gis" / "staging"
    staging_dir.mkdir(parents=True, exist_ok=True)

    staging_active_geojson = {
        "type": "FeatureCollection",
        "name": "malegaon_gat_boundaries_v2",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
        },
        "features": active_features
    }

    with open(staging_dir / "malegaon_plots.geojson", "w", encoding="utf-8") as f:
        json.dump(staging_active_geojson, f, indent=2)

    staging_quarantine_geojson = {
        "type": "FeatureCollection",
        "name": "malegaon_unnamed_quarantine",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
        },
        "features": quarantine_features
    }

    with open(staging_dir / "quarantine_unnamed_features.geojson", "w", encoding="utf-8") as f:
        json.dump(staging_quarantine_geojson, f, indent=2)

    with open(staging_dir / "available_gats.json", "w", encoding="utf-8") as f:
        json.dump({
            "dataset_version": "final_gat_mmkh_2026",
            "total": len(sorted_gats),
            "gats": sorted_gats,
            "min": sorted_gats[0],
            "max": [g for g in sorted_gats if g.isdigit()][-1] if any(g.isdigit() for g in sorted_gats) else ""
        }, f, indent=2)

    print(f"[MIGRATION] Staging files successfully written to {staging_dir}")

    # 2. Validation & Quality Checks
    print("\n--- VALIDATION CHECKS ---")
    valid_geoms = all(shape(f["geometry"]).is_valid for f in active_features)
    print(f"All active geometries valid: {valid_geoms}")

    lons = [f["properties"]["centroid"][0] for f in active_features]
    lats = [f["properties"]["centroid"][1] for f in active_features]
    print(f"Longitude extent: [{min(lons):.6f}, {max(lons):.6f}] (EPSG:4326)")
    print(f"Latitude extent:  [{min(lats):.6f}, {max(lats):.6f}] (EPSG:4326)")

    # 3. Activation: Write to production paths
    # a. data/gis/processed
    processed_dir = root / "data" / "gis" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    with open(processed_dir / "malegaon_plots.geojson", "w", encoding="utf-8") as f:
        json.dump(staging_active_geojson, f, indent=2)
    with open(processed_dir / "malegaon_gat_boundaries.geojson", "w", encoding="utf-8") as f:
        json.dump(staging_active_geojson, f, indent=2)
    with open(processed_dir / "quarantine_unnamed_features.geojson", "w", encoding="utf-8") as f:
        json.dump(staging_quarantine_geojson, f, indent=2)

    # b. frontend/public/data
    frontend_data_dir = root / "frontend" / "public" / "data"
    frontend_data_dir.mkdir(parents=True, exist_ok=True)
    with open(frontend_data_dir / "malegaon_plots.geojson", "w", encoding="utf-8") as f:
        json.dump(staging_active_geojson, f, indent=2)

    with open(frontend_data_dir / "available_gats.json", "w", encoding="utf-8") as f:
        json.dump({
            "dataset_version": "final_gat_mmkh_2026",
            "total": len(sorted_gats),
            "gats": sorted_gats,
            "min": sorted_gats[0],
            "max": [g for g in sorted_gats if g.isdigit()][-1] if any(g.isdigit() for g in sorted_gats) else ""
        }, f, indent=2)

    # c. Extracted clean KML files
    sample_kml_frontend = frontend_data_dir / "sample-gats.kml"
    with open(sample_kml_frontend, "wb") as f:
        f.write(kml_bytes)

    dsm_data_dir = frontend_data_dir / "dsm"
    dsm_data_dir.mkdir(parents=True, exist_ok=True)
    sample_kml_dsm = dsm_data_dir / "sample-gats.kml"
    with open(sample_kml_dsm, "wb") as f:
        f.write(kml_bytes)

    # Also update kml/ and layers/
    kml_dir = root / "kml"
    kml_dir.mkdir(parents=True, exist_ok=True)
    with open(kml_dir / "malegaon_gat_map_final.kml", "wb") as f:
        f.write(kml_bytes)
    with open(kml_dir / "final_gat_mmkh.kml", "wb") as f:
        f.write(kml_bytes)

    layers_dir = root / "layers"
    layers_dir.mkdir(parents=True, exist_ok=True)
    with open(layers_dir / "malegaon_gat_map_final.kml", "wb") as f:
        f.write(kml_bytes)
    with open(layers_dir / "final_gat_mmkh.kml", "wb") as f:
        f.write(kml_bytes)

    # d. Update frontend/types/gat.ts with the new authoritative array
    gat_ts_path = root / "frontend" / "types" / "gat.ts"
    if gat_ts_path.exists():
        with open(gat_ts_path, "r", encoding="utf-8") as f:
            ts_content = f.read()

        formatted_gats_lines = []
        chunk_size = 10
        for i in range(0, len(sorted_gats), chunk_size):
            chunk = sorted_gats[i:i + chunk_size]
            formatted_gats_lines.append("  " + ", ".join(f'"{g}"' for g in chunk) + ",")

        new_array_block = "export const KML_AVAILABLE_GATS = [\n" + "\n".join(formatted_gats_lines) + "\n] as const;"
        updated_ts = re.sub(
            r'export const KML_AVAILABLE_GATS = \[[\s\S]*?\] as const;',
            new_array_block,
            ts_content
        )
        with open(gat_ts_path, "w", encoding="utf-8") as f:
            f.write(updated_ts)
        print(f"[MIGRATION] Updated KML_AVAILABLE_GATS in {gat_ts_path}")

    # e. Update database
    db_path = root / "database" / "soilpilot.db"
    inserted = update_sqlite_database(db_path, active_features)

    # f. Write Comprehensive Validation Report
    report = {
        "dataset": "final_gat_mmkh.kmz",
        "migration_date": "2026-10-15T11:40:00+05:30",
        "summary": {
            "total_raw_placemarks": len(named_records) + len(quarantine_records),
            "valid_named_placemarks": len(named_records),
            "unique_raw_labels": len(set(r["raw_name"] for r in named_records)),
            "active_logical_gats": len(active_features),
            "multi_part_gats_combined": len(multi_part_report),
            "quarantined_unnamed_placemarks": len(quarantine_records),
            "geometry_repairs_performed": len(repair_logs),
            "database_fields_updated": inserted
        },
        "multi_part_gats": multi_part_report,
        "repairs": repair_logs,
        "quarantined_features": [
            {
                "index": q["index"],
                "table_area_m2": q["table_area_m2"],
                "table_length_m": q["table_len_m"]
            }
            for q in quarantine_records
        ],
        "active_gat_list": sorted_gats
    }

    report_file = root / "data" / "gis" / "final_gat_mmkh_validation_report.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"[MIGRATION] Validation report written to {report_file}")

    print("\n================ MIGRATION COMPLETE ================")
    print(f"Total Placemarks processed: {len(named_records) + len(quarantine_records)}")
    print(f"Active Gats activated: {len(active_features)}")
    print(f"Quarantined unnamed features: {len(quarantine_features)}")
    print(f"Database rows updated: {inserted}")
    print("====================================================\n")


if __name__ == "__main__":
    main()
