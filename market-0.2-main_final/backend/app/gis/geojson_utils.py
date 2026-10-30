"""GeoJSON conversion and geometry utilities for SoilPilot Phase 5."""

import json
from typing import Optional, Dict, Any
from shapely import wkt
from shapely.geometry import mapping, shape


def geometry_to_geojson(geom: Any) -> Optional[Dict[str, Any]]:
    """
    Converts various geometry representations (WKT string, GeoAlchemy2 Geometry element,
    or Shapely geometry) into a clean GeoJSON geometry dict.
    Returns None if geometry is invalid or missing.
    """
    if geom is None:
        return None

    # If already a valid dict with type & coordinates
    if isinstance(geom, dict) and "type" in geom and "coordinates" in geom:
        return geom

    # If it is a string (e.g. WKT or GeoJSON string)
    if isinstance(geom, str):
        clean_str = geom.strip()
        if not clean_str:
            return None
        # Try JSON parse first
        if clean_str.startswith("{"):
            try:
                data = json.loads(clean_str)
                if isinstance(data, dict) and "coordinates" in data:
                    return data
            except Exception:
                pass
        # Try WKT parse
        try:
            shapely_geom = wkt.loads(clean_str)
            return mapping(shapely_geom)
        except Exception:
            return None

    # Try GeoAlchemy2 shape conversion
    try:
        from geoalchemy2.shape import to_shape
        shapely_geom = to_shape(geom)
        return mapping(shapely_geom)
    except Exception:
        pass

    # Try string conversion fallback
    try:
        shapely_geom = wkt.loads(str(geom))
        return mapping(shapely_geom)
    except Exception:
        return None
