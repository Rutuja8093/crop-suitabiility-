from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.gat_farmer import GatFarmersLookupResponse, VillageGatsResponse
from app.services.farmer_service import farmer_service

router = APIRouter(prefix="/farmers", tags=["Farmers"])


@router.get(
    "/by-gat",
    response_model=GatFarmersLookupResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Farmer Names Associated with a Cadastral Gat",
    description=(
        "Retrieves all registered farmer names for a specific Gat number in a given village. "
        "Preserves original Marathi Unicode names exactly as imported from official cadastral records."
    ),
)
def get_farmers_by_gat(
    gat_no: str = Query(..., description="Cadastral Gat Number (e.g. 124, 1, 222)"),
    village: Optional[str] = Query(None, description="Village name (e.g. 'Malegaon Khurd', 'Malegaon Kh')"),
    village_id: Optional[int] = Query(None, description="Database village ID (e.g. 87)"),
    taluka: Optional[str] = Query(None, description="Taluka name (e.g. 'Baramati')"),
    db: Session = Depends(get_db),
) -> GatFarmersLookupResponse:
    return farmer_service.get_farmers_by_gat(
        db,
        gat_no=gat_no,
        village_name=village,
        village_id=village_id,
        taluka=taluka,
    )


@router.get(
    "/gats",
    response_model=VillageGatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Available Gat Numbers with Farmer Counts for Village",
    description="Returns all cadastral Gat numbers available in the village with associated farmer count.",
)
def get_available_gats(
    village: Optional[str] = Query(None, description="Village name (e.g. 'Malegaon Khurd')"),
    village_id: Optional[int] = Query(None, description="Database village ID (e.g. 87)"),
    db: Session = Depends(get_db),
) -> VillageGatsResponse:
    return farmer_service.get_available_gats_for_village(
        db,
        village_name=village,
        village_id=village_id,
    )
