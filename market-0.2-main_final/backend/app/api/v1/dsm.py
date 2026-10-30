"""Digital Soil Mapping (DSM) API Endpoints.
Provides layer catalogs, live GeoTIFF pixel probe, KML Gat parcel access,
per-Gat zonal statistics, and dynamic heatmap raster rendering.
"""

from fastapi import APIRouter, HTTPException, status, Depends, Query, Response
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.dsm_service import dsm_service

from app.api.v1.auth import extract_token
from app.services.auth_service import auth_service
from app.services.field_service import normalize_gat_number

router = APIRouter(prefix="/soil-layers", tags=["Digital Soil Mapping"])


@router.get("", response_model=List[Dict[str, Any]])
def get_soil_layers():
    """List all registered Digital Soil Mapping (DSM) layers and their status."""
    return dsm_service.get_layers()


@router.get("/point-probe", response_model=Dict[str, Any])
def probe_raster_point(
    lat: float = Query(..., description="Latitude in decimal degrees"),
    lon: float = Query(..., description="Longitude in decimal degrees"),
    layer_id: Optional[str] = Query(None, description="Optional specific layer ID to probe (e.g. ph, ndvi, all)"),
):
    """Directly queries the underlying GeoTIFF raster cell value at (lat, lon)."""
    return dsm_service.probe_point(lat, lon, layer_id)


@router.get("/kml/files", response_model=List[Dict[str, Any]])
def list_kml_files():
    """List available local KML boundary files (e.g. trial.kml and malegaonkh_final1.kml)."""
    return dsm_service.get_kml_files()


@router.get("/kml/gats", response_model=Dict[str, Any])
def get_kml_gats(
    file: Optional[str] = Query(None, description="Optional filter by KML filename (e.g. trial.kml, malegaonkh_final1.kml)"),
    gat_no: Optional[str] = Query(None, description="Optional filter by specific Gat Number (e.g. 123, 456)"),
    token: Optional[str] = Depends(extract_token),
):
    """Returns normalized GeoJSON FeatureCollection of Gat cadastral parcels and boundaries.
    For regular authenticated farmers, strictly filters and returns ONLY their registered Gat parcel from the backend.
    Admin users can view all Gats or filter by any specific Gat."""
    session_payload = auth_service.verify_session_token(token) if token else None
    user_role = session_payload.get("role") if session_payload else None
    user_gat = session_payload.get("gat_no") if session_payload else None
    is_admin = user_role == "admin" or (user_gat and str(user_gat).lower() == "admin")

    target_gat = None
    if not is_admin and user_gat:
        # Non-admin farmer is strictly restricted to their own registered Gat Number
        target_gat = str(user_gat).strip()
    elif gat_no:
        # Explicit filter requested by caller / admin
        target_gat = str(gat_no).strip()

    if target_gat:
        clean_target = normalize_gat_number(target_gat)
        gat_entry = dsm_service.get_kml_gat_detail(clean_target)
        if gat_entry:
            features = [{
                "type": "Feature",
                "id": str(gat_entry["id"]),
                "properties": {
                    "gat_no": gat_entry["gat_no"],
                    "name": gat_entry["name"],
                    "area_ha": gat_entry["area_ha"],
                    "source_file": gat_entry.get("source_file", "cadastral"),
                    "is_village_boundary": False,
                    "taluka": gat_entry.get("taluka", "Baramati"),
                    "district": gat_entry.get("district", "Pune"),
                    "state": gat_entry.get("state", "Maharashtra"),
                    "village": gat_entry.get("village", "Malegaon Kh."),
                    "centroid": gat_entry.get("centroid"),
                    "bounds": gat_entry.get("bounds"),
                    "attributes": gat_entry.get("attributes", {}),
                },
                "geometry": gat_entry["geometry"],
            }]
        else:
            features = []

        return {
            "type": "FeatureCollection",
            "name": f"kml_gat_{clean_target}",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": features,
        }

    # Admin view with no target_gat: return all Gats
    gats = dsm_service.get_kml_gats(file_filter=file)
    features = []
    for g in gats:
        features.append({
            "type": "Feature",
            "id": g["id"],
            "properties": {
                "gat_no": g["gat_no"],
                "name": g["name"],
                "area_ha": g["area_ha"],
                "source_file": g["source_file"],
                "is_village_boundary": g.get("is_village_boundary", False),
                "taluka": g.get("taluka", "Baramati"),
                "district": g.get("district", "Pune"),
                "state": g.get("state", "Maharashtra"),
                "village": g.get("village", "Malegaon Kh."),
                "centroid": g.get("centroid"),
                "bounds": g.get("bounds"),
                "attributes": g.get("attributes", {}),
            },
            "geometry": g["geometry"],
        })

    return {
        "type": "FeatureCollection",
        "name": "kml_gats",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
    }


@router.get("/kml/gats/{gat_no}", response_model=Dict[str, Any])
def get_kml_gat_detail(
    gat_no: str,
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(extract_token),
):
    """Get single Gat parcel geometry and metadata from KML file or cadastral database."""
    session_payload = auth_service.verify_session_token(token) if token else None
    user_role = session_payload.get("role") if session_payload else None
    user_gat = session_payload.get("gat_no") if session_payload else None
    is_admin = user_role == "admin" or (user_gat and str(user_gat).lower() == "admin")

    clean_req_gat = normalize_gat_number(gat_no)
    if not is_admin and user_gat:
        clean_user_gat = normalize_gat_number(user_gat)
        if clean_req_gat != clean_user_gat:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. You are only authorized to view your registered Gat ({clean_user_gat}).",
            )

    gat = dsm_service.get_kml_gat_detail(clean_req_gat, db=db)
    if not gat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Gat '{gat_no}' not found in local KML files or cadastral database.",
        )
    return gat


@router.get("/gat-stats/{gat_no}", response_model=Dict[str, Any])
def get_gat_statistics(
    gat_no: str,
    village: Optional[str] = Query(None, description="Optional village name filter"),
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db),
):
    """Retrieves masked GeoTIFF statistical summary (mean, min, max, std, classification)
    across all 8 soil layers for the given Gat cadastral parcel (from Database or KML).
    """
    session_payload = auth_service.verify_session_token(token) if token else None
    user_role = session_payload.get("role") if session_payload else None
    user_gat = session_payload.get("gat_no") if session_payload else None
    is_admin = user_role == "admin" or (user_gat and str(user_gat).lower() == "admin")

    clean_req = normalize_gat_number(gat_no)
    if not is_admin and user_gat:
        clean_user = normalize_gat_number(user_gat)
        if clean_req != clean_user:
            clean_req = clean_user

    stats = dsm_service.get_gat_stats(clean_req, db, village_name=village)
    if not stats:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No spatial raster statistics found for Gat '{clean_req}' in database or KML layers.",
        )
    return stats


@router.get("/{layer_id}/heatmap")
def get_layer_heatmap(
    layer_id: str,
    gat_no: Optional[str] = Query(None, description="Optional Gat number to clip/mask heatmap specifically to that parcel"),
    opacity: float = Query(1.0, ge=0.0, le=1.0, description="Heatmap opacity from 0.0 to 1.0"),
    crop: bool = Query(True, description="Crop returned image to the Gat bounding box (default True: Gat extent)"),
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db),
):
    """Renders dynamic color-ramped RGBA PNG heatmap directly from the GeoTIFF raster in layers/.
    Masks and clips the output specifically to the requested/authorized Gat cadastral polygon.
    All pixels outside the selected Gat are fully transparent (alpha=0).
    """
    session_payload = auth_service.verify_session_token(token) if token else None
    user_role = session_payload.get("role") if session_payload else None
    user_gat = session_payload.get("gat_no") if session_payload else None
    is_admin = user_role == "admin" or (user_gat and str(user_gat).lower() == "admin")

    effective_gat = None
    if not is_admin and user_gat:
        effective_gat = str(user_gat).strip()
    elif gat_no:
        effective_gat = str(gat_no).strip()

    if effective_gat:
        effective_gat = normalize_gat_number(effective_gat)

    png_bytes, meta = dsm_service.render_heatmap(
        layer_id=layer_id,
        gat_no=effective_gat,
        opacity=opacity,
        crop=crop if effective_gat else False,
        db=db,
    )
    if not png_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not render heatmap for layer '{layer_id}'. Raster file may be missing.",
        )

    headers = {
        "X-Raster-Layer": meta.get("layer_id", layer_id),
        "X-Raster-Unit": meta.get("unit", ""),
        "X-Raster-Min": str(meta.get("min", "")),
        "X-Raster-Max": str(meta.get("max", "")),
        "X-Raster-Width": str(meta.get("width", "")),
        "X-Raster-Height": str(meta.get("height", "")),
        "X-Raster-Bounds": ",".join(str(b) for b in meta.get("bounds", [])),
        "X-Gat-Number": str(effective_gat or "all"),
        "Cache-Control": "public, max-age=3600",
    }
    return Response(content=png_bytes, media_type="image/png", headers=headers)


@router.get("/{layer_id}", response_model=Dict[str, Any])
def get_soil_layer(layer_id: str):
    """Get detailed layer configuration and metadata by layer ID."""
    layer = dsm_service.get_layer_by_id(layer_id)
    if not layer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Soil layer '{layer_id}' not found in DSM catalog.",
        )
    return layer
