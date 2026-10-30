"""Digital Soil Mapping (DSM) catalog and layer service.
Integrates live GeoTIFF rasters and Gat-level spatial zonal statistics.
"""

from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.gis.raster_service import raster_service, DSM_CONFIG
from app.gis.kml_service import kml_service
from app.models.field import Field
from app.models.geography import Village

DSM_LAYERS_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "farm_boundary",
        "name": "Farm Boundary",
        "name_mr": "शेताची हद्द",
        "short_name": "Boundary",
        "unit": "Cadastral",
        "source_type": "KML CADASTRE",
        "source_label": "Official / Demo Cadastral Data",
        "status": "available",
        "is_default": True,
        "description": "Verified cadastral boundary polygon of the selected farm.",
    },
    {
        "id": "ph",
        "name": "Soil pH",
        "name_mr": "सामू (pH)",
        "short_name": "pH",
        "unit": "pH",
        "source_type": "DSM PREDICTION",
        "source_label": "High-Resolution DSM GeoTIFF",
        "status": "available",
        "is_default": False,
        "min": 7.0,
        "max": 7.3,
        "description": "Spatial acidity and alkalinity variations (optimal: 6.5 - 7.8).",
    },
    {
        "id": "soc",
        "name": "Soil Organic Carbon",
        "name_mr": "मातीतील सेंद्रिय कर्ब",
        "short_name": "SOC",
        "unit": "%",
        "source_type": "DSM PREDICTION",
        "source_label": "High-Resolution DSM GeoTIFF",
        "status": "available",
        "is_default": False,
        "min": 1.20,
        "max": 2.13,
        "description": "Soil organic carbon concentration as a percentage in topsoil.",
    },
    {
        "id": "nitrogen",
        "name": "Available Nitrogen",
        "name_mr": "उपलब्ध नत्र (N)",
        "short_name": "N",
        "unit": "mg/kg",
        "source_type": "DSM PREDICTION",
        "source_label": "High-Resolution DSM GeoTIFF",
        "status": "available",
        "is_default": False,
        "min": 12.0,
        "max": 15.69,
        "description": "Soil available nitrogen availability in mg/kg (factor x20 = kg/ha).",
    },
    {
        "id": "bd",
        "name": "Bulk Density",
        "name_mr": "मातीची घनता",
        "short_name": "BD",
        "unit": "g/cm³",
        "source_type": "DSM PREDICTION",
        "source_label": "High-Resolution DSM GeoTIFF",
        "status": "available",
        "is_default": False,
        "min": 1.51,
        "max": 1.59,
        "description": "Soil compaction and root penetration resistance metric.",
    },
    {
        "id": "elevation",
        "name": "Elevation / DEM",
        "name_mr": "उंची / स्थलाकृति",
        "short_name": "DEM",
        "unit": "m",
        "source_type": "DSM PREDICTION",
        "source_label": "Digital Elevation Model GeoTIFF",
        "status": "available",
        "is_default": False,
        "min": 539.0,
        "max": 598.7,
        "description": "Topographical elevation above sea level in meters.",
    },
    {
        "id": "ndvi",
        "name": "NDVI Vegetation Index",
        "name_mr": "वनस्पती निर्देशांक",
        "short_name": "NDVI",
        "unit": "index",
        "source_type": "SATELLITE DERIVED",
        "source_label": "Sentinel-2 Multi-temporal GeoTIFF",
        "status": "available",
        "is_default": False,
        "min": -0.13,
        "max": 0.84,
        "description": "Normalized Difference Vegetation Index measuring green vigor.",
    },
    {
        "id": "evi",
        "name": "EVI Vegetation Index",
        "name_mr": "वर्धित वनस्पती निर्देशांक (EVI)",
        "short_name": "EVI",
        "unit": "index",
        "source_type": "SATELLITE DERIVED",
        "source_label": "Enhanced Vegetation Index GeoTIFF",
        "status": "available",
        "is_default": False,
        "min": -0.02,
        "max": 0.69,
        "description": "Enhanced Vegetation Index with reduced soil background interference.",
    },
    {
        "id": "uncertainty",
        "name": "DSM Prediction Uncertainty",
        "name_mr": "मॉडेल अनिश्चितता (Uncertainty)",
        "short_name": "Uncertainty",
        "unit": "% error",
        "source_type": "DSM PREDICTION",
        "source_label": "QRF Prediction Error GeoTIFF",
        "status": "available",
        "is_default": False,
        "min": 5.24,
        "max": 12.47,
        "description": "Quantile Regression Forest 90% prediction interval error.",
    },
]


class DSMService:
    @staticmethod
    def get_layers() -> List[Dict[str, Any]]:
        for layer in DSM_LAYERS_CATALOG:
            lid = layer["id"]
            if lid != "farm_boundary":
                layer["status"] = "available" if raster_service.is_raster_available(lid) else "pending"
        return DSM_LAYERS_CATALOG

    @staticmethod
    def get_layer_by_id(layer_id: str) -> Optional[Dict[str, Any]]:
        for layer in DSM_LAYERS_CATALOG:
            if layer["id"].lower() == layer_id.lower():
                layer["status"] = "available" if raster_service.is_raster_available(layer["id"]) else "pending"
                return layer
        return None

    @staticmethod
    def probe_point(lat: float, lon: float, layer_id: Optional[str] = None) -> Dict[str, Any]:
        """Probes raster value at (lat, lon) directly from GeoTIFF."""
        if layer_id and layer_id.lower() != "all":
            val = raster_service.get_pixel_value(layer_id, lat, lon)
            cfg = DSM_CONFIG.get(layer_id.lower(), {})
            cls = raster_service.classify_value(layer_id, val) if val is not None else None
            return {
                "layer_id": layer_id,
                "lat": lat,
                "lon": lon,
                "value": val,
                "unit": cfg.get("unit", ""),
                "name": cfg.get("name", layer_id),
                "classification": cls
            }
        else:
            return {
                "lat": lat,
                "lon": lon,
                "layers": raster_service.probe_all_layers(lat, lon)
            }

    @staticmethod
    def get_gat_stats(gat_no: str, db: Optional[Session] = None, village_name: Optional[str] = None) -> Dict[str, Any]:
        """Calculates zonal statistics across all GeoTIFF layers for the given Gat.
        Queries database first, falling back to local KML files (trial.kml / malegaonkh_final1.kml).
        """
        clean_gat = str(gat_no).strip()
        target_field = None
        stats = {}

        # 1. Try Database lookup if db session provided
        if db is not None:
            fields = db.query(Field).filter(Field.gat_no == clean_gat).all()
            for f in fields:
                if not f.geometry:
                    continue
                if village_name:
                    v = db.query(Village).filter(Village.id == f.village_id).first()
                    if v and village_name.lower() in v.name.lower():
                        s = raster_service.get_gat_raster_stats(f.geometry, area_ha=f.area)
                        if s:
                            target_field = f
                            stats = s
                            break
                s = raster_service.get_gat_raster_stats(f.geometry, area_ha=f.area)
                if s:
                    target_field = f
                    stats = s
                    break

        if target_field and stats:
            unc = stats.get("uncertainty", {}).get("mean")
            confidence = round(max(85.0, 100.0 - unc), 1) if unc is not None else 92.0
            tot_ha = target_field.area
            tot_ac = round(tot_ha * 2.47105, 2) if tot_ha is not None else None
            canopy_stats = stats.get("ndvi", {}).get("canopy_statistics")
            return {
                "gat_no": clean_gat,
                "field_id": target_field.id,
                "area_ha": target_field.area,
                "total_area_hectares": tot_ha,
                "total_area_acres": tot_ac,
                "village_id": target_field.village_id,
                "source": "Database Cadastre",
                "confidence": confidence,
                "canopy_statistics": canopy_stats,
                "layers": stats,
                **stats
            }

        # 2. Fallback to KML files (trial.kml or malegaonkh_final1.kml)
        kml_gat = kml_service.get_gat_by_no(clean_gat)
        if kml_gat:
            tot_ha = kml_gat.get("area_ha")
            tot_ac = round(tot_ha * 2.47105, 2) if tot_ha is not None else None
            kml_stats = raster_service.get_gat_raster_stats(kml_gat["geometry_wkt"], area_ha=tot_ha)
            if kml_stats:
                unc = kml_stats.get("uncertainty", {}).get("mean")
                confidence = round(max(85.0, 100.0 - unc), 1) if unc is not None else 92.0
                canopy_stats = kml_stats.get("ndvi", {}).get("canopy_statistics")
                return {
                    "gat_no": kml_gat["gat_no"],
                    "name": kml_gat["name"],
                    "field_id": None,
                    "area_ha": kml_gat["area_ha"],
                    "total_area_hectares": tot_ha,
                    "total_area_acres": tot_ac,
                    "village": kml_gat.get("village", "Malegaon"),
                    "taluka": kml_gat.get("taluka", "Baramati"),
                    "district": kml_gat.get("district", "Pune"),
                    "state": kml_gat.get("state", "Maharashtra"),
                    "centroid": kml_gat["centroid"],
                    "bounds": kml_gat["bounds"],
                    "geometry": kml_gat["geometry"],
                    "source": f"KML ({kml_gat['source_file']})",
                    "confidence": confidence,
                    "canopy_statistics": canopy_stats,
                    "layers": kml_stats,
                    **kml_stats
                }

        return {}

    @staticmethod
    def get_kml_files() -> List[Dict[str, Any]]:
        """Returns metadata about available KML files."""
        return kml_service.get_available_kml_files()

    @staticmethod
    def get_kml_gats(file_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns list of all Gats parsed from KML files."""
        return kml_service.get_all_gats(file_filter=file_filter)

    @staticmethod
    def get_kml_gat_detail(gat_no: str, db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
        """Returns specific Gat details from KML or cadastral database."""
        gat = kml_service.get_gat_by_no(gat_no, generate_fallback=False)
        if not gat and db is not None:
            clean_gat = str(gat_no).strip()
            f = db.query(Field).filter(Field.gat_no == clean_gat).first()
            if f and f.geometry:
                tot_ha = f.area
                tot_ac = round(tot_ha * 2.47105, 2) if tot_ha is not None else None
                from app.gis.raster_service import raster_service
                shapely_geom = raster_service._resolve_geometry(f.geometry)
                if shapely_geom:
                    from shapely.geometry import mapping
                    return {
                        "id": f.id,
                        "gat_no": f.gat_no,
                        "name": f"Gat {f.gat_no}",
                        "source_file": "Database Cadastre",
                        "is_village_boundary": False,
                        "area_ha": tot_ha,
                        "total_area_hectares": tot_ha,
                        "total_area_acres": tot_ac,
                        "village": f.village.name if f.village else "Malegaon Kh.",
                        "taluka": f.village.taluka.name if f.village and f.village.taluka else "Baramati",
                        "district": "Pune",
                        "state": "Maharashtra",
                        "centroid": [round(shapely_geom.centroid.x, 6), round(shapely_geom.centroid.y, 6)],
                        "bounds": list(shapely_geom.bounds),
                        "geometry": mapping(shapely_geom),
                        "geometry_wkt": shapely_geom.wkt,
                        "attributes": {},
                    }
        return gat

    @staticmethod
    def render_heatmap(
        layer_id: str,
        gat_no: Optional[str] = None,
        opacity: float = 1.0,
        crop: bool = False,
        db: Optional[Session] = None,
    ) -> Tuple[Optional[bytes], Dict[str, Any]]:
        """Renders color-ramped heatmap RGBA PNG directly from the GeoTIFF layer.
        If gat_no is provided, masks or crops the output specifically to the Gat geometry.
        """
        geom = None
        if gat_no:
            # 1. Canonical cadastral Gat geometry from KML service
            geom = kml_service.get_gat_geometry(str(gat_no).strip())
            # 2. Check DB field geometry if overlapping DSM area
            if not geom and db:
                f = db.query(Field).filter(Field.gat_no == str(gat_no).strip()).first()
                if f and f.geometry:
                    geom = f.geometry

        return raster_service.render_heatmap_png(
            layer_key=layer_id,
            geom_input=geom,
            opacity=opacity,
            crop_to_geom=crop
        )


dsm_service = DSMService()

