"""KML Ingestion & Parsing Service for SoilPilot Cadastral Gats.
Reads local KML files (trial.kml with Gat parcels and malegaonkh_final1.kml with village boundary),
normalizes geometries, extracts metadata, computes areas in hectares,
and provides seamless querying for spatial zonal statistics and heat map overlays.
"""

import os
import re
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from shapely.geometry import Polygon, MultiPolygon, Point, mapping
from shapely import wkt

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BASE_DIR.parent
LAYERS_DIR = PROJECT_ROOT / "layers"
KML_DIR = PROJECT_ROOT / "kml"
FRONTEND_DATA_DIR = PROJECT_ROOT / "frontend" / "public" / "data"


def calculate_polygon_area_ha(coords: List[Tuple[float, float]]) -> float:
    """Calculates polygon area in hectares using geodesic projection around Baramati lat (18.15 N)."""
    if len(coords) < 4:
        return 0.0

    lat0 = 18.15 * math.pi / 180.0
    m_per_deg_lat = 111132.954 - 559.822 * math.cos(2 * lat0)
    m_per_deg_lon = 111412.84 * math.cos(lat0)

    area = 0.0
    n = len(coords)
    for i in range(n - 1):
        x1 = coords[i][0] * m_per_deg_lon
        y1 = coords[i][1] * m_per_deg_lat
        x2 = coords[i + 1][0] * m_per_deg_lon
        y2 = coords[i + 1][1] * m_per_deg_lat
        area += (x1 * y2 - x2 * y1)

    area_sq_m = abs(area) / 2.0
    return round(area_sq_m / 10000.0, 2)


def generate_gat_polygon(gat_no_str: str, base_lon: float = 74.5065, base_lat: float = 18.1655) -> Tuple[List[Tuple[float, float]], float, List[float], List[float]]:
    """Generates a deterministic, realistic parcel polygon in Malegaon Kh for any custom Gat number."""
    try:
        num = int(re.sub(r'[^\d]', '', str(gat_no_str)) or '123')
    except Exception:
        num = 123

    # Small deterministic offset inside village boundary
    offset_x = (((num * 37) % 21) - 10) * 0.00065
    offset_y = (((num * 53) % 19) - 9) * 0.00055

    c_lon = base_lon + offset_x
    c_lat = base_lat + offset_y

    dx = 0.00075
    dy = 0.00065

    coords = [
        (round(c_lon - dx, 8), round(c_lat - dy, 8)),
        (round(c_lon + dx * 0.95, 8), round(c_lat - dy * 0.9, 8)),
        (round(c_lon + dx, 8), round(c_lat + dy, 8)),
        (round(c_lon - dx * 0.9, 8), round(c_lat + dy * 1.05, 8)),
        (round(c_lon - dx, 8), round(c_lat - dy, 8)),
    ]
    area_ha = calculate_polygon_area_ha(coords) or 2.48
    centroid = [c_lon, c_lat]
    bounds = [c_lon - dx, c_lat - dy, c_lon + dx, c_lat + dy * 1.05]
    return coords, area_ha, centroid, bounds


def clean_tag_name(elem: ET.Element) -> str:
    """Strip XML namespace."""
    if elem is None or not hasattr(elem, "tag"):
        return ""
    return elem.tag.split("}")[-1].lower()


def parse_html_table(html_str: str) -> Dict[str, str]:
    """Extract key-value pairs from HTML description table often found in KML."""
    attrs: Dict[str, str] = {}
    if not html_str:
        return attrs
    # Look for <tr><td>key</td><td>val</td></tr>
    matches = re.findall(r"<tr>\s*<td>([^<]+)</td>\s*<td>([^<]*)</td>\s*</tr>", html_str, re.IGNORECASE)
    for k, v in matches:
        attrs[k.strip()] = v.strip()
    return attrs


class KMLService:
    """Manages discovering, caching, and querying KML parcel & village boundary layers."""

    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._files: Dict[str, Path] = {}
        self._loaded = False
        self._refresh()

    def _refresh(self):
        self._discover_files()
        self._load_all()

    def _discover_files(self):
        candidates = [
            ("final_gat_mmkh.kml", KML_DIR / "final_gat_mmkh.kml"),
            ("final_gat_mmkh.kml", LAYERS_DIR / "final_gat_mmkh.kml"),
            ("final_gat_mmkh.kml", FRONTEND_DATA_DIR / "final_gat_mmkh.kml"),
            ("final_gat_mmkh.kml", FRONTEND_DATA_DIR / "dsm" / "final_gat_mmkh.kml"),
            ("sample-gats.kml", FRONTEND_DATA_DIR / "dsm" / "sample-gats.kml"),
            ("sample-gats.kml", FRONTEND_DATA_DIR / "sample-gats.kml"),
            ("malegaonkh_final1.kml", KML_DIR / "malegaonkh_final1.kml"),
            ("malegaonkh_final1.kml", FRONTEND_DATA_DIR / "malegaonkh_final1.kml"),
            ("malegaonkh_final1.kml", FRONTEND_DATA_DIR / "dsm" / "malegaonkh_final1.kml"),
        ]
        for name, path in candidates:
            if path.exists() and name not in self._files:
                self._files[name] = path

    def _load_all(self):
        self._cache.clear()
        for filename, filepath in self._files.items():
            try:
                self._parse_file(filename, filepath)
            except Exception as e:
                print(f"Error parsing KML {filepath}: {e}")
        self._loaded = True

    def _parse_file(self, filename: str, filepath: Path):
        tree = ET.parse(filepath)
        root = tree.getroot()

        pms = [e for e in root.iter() if clean_tag_name(e) == "placemark"]
        for idx, pm in enumerate(pms):
            name_el = next((c for c in pm if clean_tag_name(c) == "name"), None)
            raw_name = name_el.text.strip() if name_el is not None and name_el.text else ""

            desc_el = next((c for c in pm if clean_tag_name(c) == "description"), None)
            desc_text = desc_el.text.strip() if desc_el is not None and desc_el.text else ""
            table_attrs = parse_html_table(desc_text)
            table_gat = table_attrs.get("Gat_No") or table_attrs.get("Gat_name")
            if table_gat and table_gat.lower() in ("<null>", "&lt;null&gt;", "null"):
                table_gat = None

            effective_name = raw_name or table_gat or ""
            # Quarantine/skip unnamed or null features from Gat-based lookup
            if not effective_name or effective_name.lower() in ("<null>", "&lt;null&gt;", "null"):
                continue

            name = effective_name

            # Polygons inside this placemark
            polys = []
            for poly_el in pm.iter():
                if clean_tag_name(poly_el) == "polygon":
                    outer = next((c for c in poly_el if clean_tag_name(c) == "outerboundaryis"), None)
                    if outer is None:
                        continue
                    coords_el = next((c for c in outer.iter() if clean_tag_name(c) == "coordinates"), None)
                    if coords_el is None or not coords_el.text:
                        continue
                    ring = []
                    for pt in coords_el.text.strip().split():
                        parts = pt.split(",")
                        if len(parts) >= 2:
                            try:
                                ring.append((float(parts[0]), float(parts[1])))
                            except ValueError:
                                continue
                    if len(ring) >= 3:
                        if ring[0] != ring[-1]:
                            ring.append(ring[0])
                        polys.append(Polygon(ring))

            if not polys:
                continue

            shapely_geom = polys[0] if len(polys) == 1 else MultiPolygon(polys)
            if not shapely_geom.is_valid:
                from shapely.validation import make_valid
                shapely_geom = make_valid(shapely_geom)
            if shapely_geom.geom_type == "GeometryCollection":
                from shapely.ops import unary_union
                shapely_geom = unary_union([g for g in shapely_geom.geoms if isinstance(g, (Polygon, MultiPolygon))])

            geojson_geom = mapping(shapely_geom)
            bounds = list(shapely_geom.bounds)  # [minx, miny, maxx, maxy]
            centroid = [round(shapely_geom.centroid.x, 6), round(shapely_geom.centroid.y, 6)]

            # Determine area
            exterior_coords = list(shapely_geom.exterior.coords) if isinstance(shapely_geom, Polygon) else list(shapely_geom.geoms[0].exterior.coords)
            area_ha = calculate_polygon_area_ha(exterior_coords)

            # Gat normalization key
            norm_gat = name.strip()
            # If name is village boundary e.g. "Malegaon Kh."
            is_village_boundary = "malegaon" in norm_gat.lower() and ("boundary" in norm_gat.lower() or "final1" in filename)
            
            clean_num_m = re.search(r'(\d+/[A-Za-z0-9]+)', norm_gat)
            if clean_num_m:
                clean_gat = clean_num_m.group(1).upper()
            else:
                num_m = re.search(r'\d+', norm_gat)
                clean_gat = num_m.group(0) if num_m else norm_gat

            item_id = clean_gat if not is_village_boundary else "malegaon_kh"

            # Merge if multi-part Gat (e.g. Gat 23, 102, 142, 152, 212)
            if item_id.lower() in self._cache and not is_village_boundary:
                from shapely.geometry import shape as s_shape
                from shapely.ops import unary_union
                existing = self._cache[item_id.lower()]
                existing_geom = s_shape(existing["geometry"])
                merged_geom = unary_union([existing_geom, shapely_geom])
                existing["geometry"] = mapping(merged_geom)
                existing["geometry_wkt"] = merged_geom.wkt
                existing["bounds"] = list(merged_geom.bounds)
                existing["centroid"] = [round(merged_geom.centroid.x, 6), round(merged_geom.centroid.y, 6)]
                existing["area_ha"] = round(existing.get("area_ha", 0) + area_ha, 2)
                continue

            entry = {
                "id": item_id,
                "gat_no": clean_gat,
                "name": name,
                "source_file": filename,
                "is_village_boundary": is_village_boundary,
                "area_ha": area_ha,
                "bounds": bounds,
                "centroid": centroid,
                "geometry": geojson_geom,
                "geometry_wkt": shapely_geom.wkt,
                "attributes": table_attrs,
                "taluka": table_attrs.get("SUB_DIST", "Baramati"),
                "district": table_attrs.get("DISTRICT", "Pune"),
                "state": table_attrs.get("STATE", "Maharashtra"),
                "village": table_attrs.get("NAME", "Malegaon Kh."),
            }

            self._cache[item_id.lower()] = entry
            self._cache[clean_gat.lower()] = entry
            self._cache[norm_gat.lower()] = entry

    def get_available_kml_files(self) -> List[Dict[str, Any]]:
        if not self._loaded:
            self._refresh()
        files_info = []
        for name, path in self._files.items():
            gats = [v for v in self._cache.values() if v["source_file"] == name]
            files_info.append({
                "filename": name,
                "path": str(path),
                "feature_count": len(gats),
                "features": [g["gat_no"] for g in gats],
                "description": "Cadastral Gat Parcels" if ("malegaon" in name.lower() or "sample" in name.lower() or "gat" in name.lower()) and "final1" not in name.lower() else "Village Boundary",
            })
        return files_info

    def get_all_gats(self, file_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self._loaded:
            self._refresh()
        results = []
        seen = set()
        for v in self._cache.values():
            if file_filter and v["source_file"].lower() != file_filter.lower():
                continue
            if v["id"] in seen:
                continue
            seen.add(v["id"])
            results.append(v)
        return results

    def get_gat_by_no(self, gat_no: str, generate_fallback: bool = False) -> Optional[Dict[str, Any]]:
        if not self._loaded:
            self._refresh()
        clean = str(gat_no).strip().lower()
        clean = re.sub(r'^(gat\s*no\.?|gat\s*number|gat|survey\s*no\.?|survey|गट\s*क्र\.?|गट)\s*[:\-]?\s*', '', clean).strip()

        # Direct match
        if clean in self._cache:
            return self._cache[clean]

        # Alias match for village boundary
        if clean in ["malegaon", "malegaon kh", "malegaon kh.", "malegaon_kh", "malegaon-kh"]:
            return self._cache.get("malegaon_kh")

        # Fuzzy match
        for k, v in self._cache.items():
            if k == clean or v["gat_no"].lower() == clean:
                return v

        # If not in local KML, do NOT generate fake/approximate boundary
        return None

    def get_gat_geometry(self, gat_no: str):
        g = self.get_gat_by_no(gat_no, generate_fallback=False)
        if not g:
            return None
        try:
            return wkt.loads(g["geometry_wkt"])
        except Exception:
            return None


kml_service = KMLService()
