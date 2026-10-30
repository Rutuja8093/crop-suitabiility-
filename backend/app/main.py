from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.logging import logger
from app.api.v1.router import api_v1_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Digital Soil Mapping & Soil Health Portal API - Backend Foundation",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.on_event("startup")
def auto_seed_if_empty():
    """Ensure database has official Pune geographic hierarchy seeded on startup."""
    from app.db.session import SessionLocal
    from app.models.geography import State
    db = SessionLocal()
    try:
        if db.query(State).count() == 0:
            logger.info("Database is empty. Automatically seeding official Pune hierarchy...")
            import sys
            from pathlib import Path
            root_dir = Path(__file__).resolve().parent.parent.parent
            scripts_dir = root_dir / "scripts" / "database"
            if str(scripts_dir) not in sys.path:
                sys.path.insert(0, str(scripts_dir))
            from seed_demo_data import seed_demo_data
            seed_demo_data()
    except Exception as e:
        logger.warning(f"Auto-seed check: {e}")
    finally:
        db.close()


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log incoming requests and responses for observability."""
    logger.info(f"{request.method} {request.url.path}")
    response = await call_next(request)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to avoid leaking stack traces or internal paths to clients."""
    logger.error(f"Unhandled error on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": "An internal server error occurred. Please try again later.",
        },
    )


# Mount versioned API router under /api/v1
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Root"])
@app.get("/api/health", tags=["Root"])
@app.get("/api/health/", tags=["Root"])
async def health_alias():
    """Health check alias for probes."""
    return {"status": "ok", "service": settings.PROJECT_NAME}


@app.get("/api/farms", tags=["Root"])
@app.get("/api/farms/", tags=["Root"])
async def farms_alias():
    """Compatibility alias for farm probes."""
    return {"status": "ok", "data": []}


@app.get("/", tags=["Root"])
async def root():
    """Root info endpoint."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health",
    }
