"""
SoilPilot KMZ to Normalized GeoJSON Preprocessing Pipeline.

Extracts doc.kml from Malegaon_Gat_Map_Final.kmz,
inspects Placemark attributes and exact cadastral geometry,
validates and repairs polygons using Shapely,
combines multi-part plots into MultiPolygons,
calculates accurate geodesic areas in hectares and acres,
and exports clean GeoJSON files for backend APIs and frontend maps.

Source file: Malegaon_Gat_Map_Final.kmz (remains completely unmodified).
"""

import os
import sys
import json
import re
import shutil
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

import shapely
from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.validation import make_valid, explain_validity
from shapely.ops import unary_union


def normalize_gat_number(raw_val: str) -> str:
    """
    Safely normalizes a Gat number for lookup without altering original metadata.
    Handles 'Gat 22', 'Gat No. 22', '22.0', 'Gat 67/A', '22', etc.
    """
    if raw_val is None:
        return ""
    s = str(raw_val).strip()
    # Check for subdivision like 67/A or 39/B
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
    Calculates polygon area in hectares using geodesic projection at lat ~18.15.
    """
    import math
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
        # Outer ring minus holes
        total_m2 += ring_area(list(geom.exterior.coords))
        for interior in geom.interiors:
            total_m2 -= ring_area(list(interior.coords))
    elif isinstance(geom, MultiPolygon):
        for poly in geom.geoms:
            total_m2 += ring_area(list(poly.exterior.coords))
            for interior in poly.interiors:
                total_m2 -= ring_area(list(interior.coords))

    return round(max(0.0, total_m2) / 10000.0, 2)


def process_kmz_to_geojson(kmz_path: Path):
    """
    Extracts doc.kml from KMZ and creates normalized GeoJSON features.
    """
    with zipfile.ZipFile(kmz_path, 'r') as z:
        kml_bytes = z.read('doc.kml')

    root = ET.fromstring(kml_bytes)
    pms = [elem for elem in root.iter() if elem.tag.endswith('Placemark')]

    records = []
    repair_logs = []

    for idx, pm in enumerate(pms):
        name_el = [c for c in pm if c.tag.endswith('name')]
        raw_name = name_el[0].text.strip() if name_el and name_el[0].text else ''

        desc_el = [c for c in pm if c.tag.endswith('description')]
        desc = desc_el[0].text if desc_el and desc_el[0].text else ''

        area_m = re.search(r'<td>SHAPE_Area</td>\s*<td>(.*?)</td>', desc)
        table_area_m2 = float(area_m.group(1)) if area_m and area_m.group(1) != '&lt;Null&gt;' else None

        gat_name_m = re.search(r'<td>Gat_name</td>\s*<td>(.*?)</td>', desc)
        table_gat_name = gat_name_m.group(1).strip() if gat_name_m and gat_name_m.group(1) != '&lt;Null&gt;' else None

        effective_name = raw_name or table_gat_name or ''
        if not effective_name or effective_name.lower() == '<null>':
            normalized_gat = None
        else:
            normalized_gat = normalize_gat_number(effective_name)

        # Extract Polygons
        poly_elements = [e for e in pm.iter() if e.tag.endswith('Polygon')]
        if not poly_elements:
            continue

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

            # Inner rings
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
            continue

        if len(poly_objs) == 1:
            geom = poly_objs[0]
        else:
            geom = MultiPolygon(poly_objs)

        if not geom.is_valid:
            reason = explain_validity(geom)
            geom_repaired = make_valid(geom)
            repair_logs.append({
                "gat": effective_name,
                "reason": reason,
                "repaired": geom_repaired.is_valid
            })
            geom = geom_repaired

        records.append({
            "index": idx,
            "raw_name": effective_name,
            "gat_no": normalized_gat,
            "table_area_m2": table_area_m2,
            "geom": geom
        })

    # Group by Gat Number for MultiPolygons / duplicate parts
    gat_groups = {}
    for r in records:
        gn = r["gat_no"]
        if not gn:
            continue
        if gn not in gat_groups:
            gat_groups[gn] = []
        gat_groups[gn].append(r)

    features = []

    # Also check base gat numbers for subdivisions e.g. '67' for '67/A' and '67/B'
    subdivision_bases = {}
    for gn in gat_groups.keys():
        if "/" in gn:
            base = gn.split("/")[0]
            if base not in subdivision_bases:
                subdivision_bases[base] = []
            subdivision_bases[base].append(gn)

    # For each base that doesn't have a standalone record, create combined MultiPolygon
    for base, sub_list in subdivision_bases.items():
        if base not in gat_groups:
            combined_records = []
            for sub in sub_list:
                combined_records.extend(gat_groups[sub])
            gat_groups[base] = combined_records

    # Sort gat numbers: numeric first, then alphanumeric
    def sort_key(k):
        num_m = re.match(r'^(\d+)', k)
        val = int(num_m.group(1)) if num_m else 9999
        return (val, k)

    sorted_gats = sorted(gat_groups.keys(), key=sort_key)

    for gn in sorted_gats:
        items = gat_groups[gn]
        geoms = [it["geom"] for it in items]

        # Combine polygons if multiple
        if len(geoms) == 1:
            final_geom = geoms[0]
        else:
            # Flatten into list of Polygons
            flat_polys = []
            for g in geoms:
                if isinstance(g, Polygon):
                    flat_polys.append(g)
                elif isinstance(g, MultiPolygon):
                    flat_polys.extend(g.geoms)
            final_geom = MultiPolygon(flat_polys)

        if not final_geom.is_valid:
            final_geom = make_valid(final_geom)

        # Calculate area
        calc_ha = calculate_polygon_area_ha_geodesic(final_geom)
        
        # If table area m2 exists, compare
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
                "source": "Malegaon_Gat_Map_Final.kmz",
                "is_demo": False,
                "plot_count": len(items)
            },
            "geometry": mapping(final_geom)
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "name": "malegaon_gat_boundaries",
        "crs": {
            "type": "name",
            "properties": {
                "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
            }
        },
        "features": features
    }

    return geojson, records, repair_logs, sorted_gats


def main():
    root_dir = Path(__file__).resolve().parent.parent.parent

    # Locate source KMZ (prioritize final_gat_mmkh.kmz)
    kmz_path = root_dir / "final_gat_mmkh.kmz"
    if not kmz_path.exists():
        kmz_path = root_dir / "data" / "gis" / "source" / "final_gat_mmkh.kmz"
    if not kmz_path.exists():
        kmz_path = root_dir / "Malegaon_Gat_Map_Final.kmz"
    if not kmz_path.exists():
        kmz_path = root_dir / "data" / "gis" / "source" / "Malegaon_Gat_Map_Final.kmz"
    if not kmz_path.exists():
        print(f"Error: KMZ source not found at {kmz_path}")
        sys.exit(1)

    print(f"[GIS PIPELINE] Source KMZ: {kmz_path}")

    # Copy to data/gis/source/ for safe storage
    source_dir = root_dir / "data" / "gis" / "source"
    source_dir.mkdir(parents=True, exist_ok=True)
    if kmz_path.name == "final_gat_mmkh.kmz" and kmz_path != source_dir / "final_gat_mmkh.kmz":
        shutil.copyfile(kmz_path, source_dir / "final_gat_mmkh.kmz")

    geojson, raw_records, repair_logs, sorted_gats = process_kmz_to_geojson(kmz_path)

    # 1. Output processed GeoJSON
    processed_dir = root_dir / "data" / "gis" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    out_file = processed_dir / "malegaon_plots.geojson"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    print(f"[GIS PIPELINE] Wrote {len(geojson['features'])} Gat features to {out_file}")

    out_file_named = processed_dir / "malegaon_gat_boundaries.geojson"
    with open(out_file_named, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    print(f"[GIS PIPELINE] Wrote copy to {out_file_named}")

    # 2. Sync to frontend public data folder
    frontend_data_dir = root_dir / "frontend" / "public" / "data"
    frontend_data_dir.mkdir(parents=True, exist_ok=True)
    frontend_out_file = frontend_data_dir / "malegaon_plots.geojson"
    with open(frontend_out_file, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    print(f"[GIS PIPELINE] Synced to frontend public data: {frontend_out_file}")

    # 3. Write available Gats list for frontend dropdowns
    available_gats_file = frontend_data_dir / "available_gats.json"
    with open(available_gats_file, "w", encoding="utf-8") as f:
        json.dump({
            "total": len(sorted_gats),
            "gats": sorted_gats,
            "min": sorted_gats[0],
            "max": [g for g in sorted_gats if g.isdigit()][-1] if any(g.isdigit() for g in sorted_gats) else ""
        }, f, indent=2)
    print(f"[GIS PIPELINE] Wrote available Gats ({len(sorted_gats)}) to {available_gats_file}")

    # 4. Extract clean doc.kml to frontend public sample-gats.kml & dsm/sample-gats.kml
    with zipfile.ZipFile(kmz_path, 'r') as z:
        kml_bytes = z.read('doc.kml')

    sample_kml_frontend = frontend_data_dir / "sample-gats.kml"
    with open(sample_kml_frontend, "wb") as f:
        f.write(kml_bytes)
    print(f"[GIS PIPELINE] Wrote extracted doc.kml to {sample_kml_frontend}")

    dsm_data_dir = frontend_data_dir / "dsm"
    dsm_data_dir.mkdir(parents=True, exist_ok=True)
    sample_kml_dsm = dsm_data_dir / "sample-gats.kml"
    with open(sample_kml_dsm, "wb") as f:
        f.write(kml_bytes)
    print(f"[GIS PIPELINE] Wrote extracted doc.kml to {sample_kml_dsm}")

    # 5. Print Summary
    print("\n================= KMZ PROCESSING SUMMARY =================")
    print(f"Total Placemarks processed: {len(raw_records)}")
    print(f"Total Unique Gat Features generated: {len(geojson['features'])}")
    print(f"Repairs logged ({len(repair_logs)}): {repair_logs}")
    print(f"First 10 Gats: {sorted_gats[:10]}")
    print(f"Last 10 Gats: {sorted_gats[-10:]}")
    print("==========================================================\n")


if __name__ == "__main__":
    main()
