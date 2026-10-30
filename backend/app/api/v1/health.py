from fastapi import APIRouter, status
from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="API Health Check",
    description="Returns the operational health status of the SoilPilot API service.",
)
async def get_health() -> HealthResponse:
    """Service liveness probe endpoint."""
    return HealthResponse(
        status="ok",
        service="SoilPilot API",
    )
