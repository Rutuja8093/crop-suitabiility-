from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.geography import router as geography_router
from app.api.v1.fields import router as fields_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dsm import router as dsm_router
from app.api.v1.soil_health import router as soil_health_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.reports import router as reports_router
from app.api.v1.farmers import router as farmers_router
from app.api.v1.market_intelligence import router as market_intelligence_router
from app.api.v1.crop_suitability import router as crop_suitability_router

api_v1_router = APIRouter()

# Core v1 health check endpoint
api_v1_router.include_router(health_router)

# Phase 2 Geography and Field lookup endpoints
api_v1_router.include_router(geography_router)
api_v1_router.include_router(fields_router)

# Phase 3 Gat-Based Farmer Access / Auth endpoints
api_v1_router.include_router(auth_router)

# Gat-Wise Farmer Names integration
api_v1_router.include_router(farmers_router)

# Phase 4 Market Intelligence & Crop Planner endpoints
api_v1_router.include_router(market_intelligence_router)

# Phase 6 Digital Soil Mapping (DSM) layer endpoints
api_v1_router.include_router(dsm_router)

# Phase 7 Soil Health Card & Soil Test Report endpoints
api_v1_router.include_router(soil_health_router)

# Phase 8 Soil-Based Farmer Recommendations endpoints
api_v1_router.include_router(recommendations_router)

# Phase 9 Reports & PDF Generation endpoints
api_v1_router.include_router(reports_router)

# GIS-Based Multi-Criteria Crop Suitability endpoints
api_v1_router.include_router(crop_suitability_router)

