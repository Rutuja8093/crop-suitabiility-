from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.geography import (
    StateResponse,
    DistrictResponse,
    TalukaResponse,
    VillageResponse,
)
from app.services.geography_service import geography_service

router = APIRouter(prefix="/geography", tags=["Geography"])


@router.get(
    "/states",
    response_model=List[StateResponse],
    status_code=status.HTTP_200_OK,
    summary="List Active States",
    description="Retrieve list of all active administrative states (e.g. Maharashtra).",
)
def get_states(db: Session = Depends(get_db)) -> List[StateResponse]:
    return geography_service.list_states(db)


@router.get(
    "/districts",
    response_model=List[DistrictResponse],
    status_code=status.HTTP_200_OK,
    summary="List Districts by State",
    description="Retrieve districts belonging to the selected State ID.",
)
def get_districts(
    state_id: int = Query(..., description="ID of the State", gt=0),
    db: Session = Depends(get_db),
) -> List[DistrictResponse]:
    return geography_service.list_districts(db, state_id)


@router.get(
    "/talukas",
    response_model=List[TalukaResponse],
    status_code=status.HTTP_200_OK,
    summary="List Talukas",
    description="Retrieve talukas for Pune district (or specific District ID if provided).",
)
def get_talukas(
    district_id: Optional[int] = Query(None, description="Optional ID of the District (defaults to Pune)"),
    db: Session = Depends(get_db),
) -> List[TalukaResponse]:
    return geography_service.list_talukas(db, district_id=district_id)


@router.get(
    "/villages",
    response_model=List[VillageResponse],
    status_code=status.HTTP_200_OK,
    summary="List Villages by Taluka",
    description="Retrieve villages belonging to the selected Taluka ID or Taluka name.",
)
def get_villages(
    taluka_id: Optional[int] = Query(None, description="ID of the Taluka", gt=0),
    taluka: Optional[str] = Query(None, description="Name of the Taluka (e.g. Baramati, Daund, Haveli)"),
    db: Session = Depends(get_db),
) -> List[VillageResponse]:
    return geography_service.list_villages(db, taluka_id=taluka_id, taluka_name=taluka)
