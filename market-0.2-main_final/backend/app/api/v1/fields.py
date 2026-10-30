from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.field import FieldLookupResponse, AuthorizedFieldDetailResponse
from app.services.field_service import field_service
from app.services.auth_service import auth_service
from app.api.v1.auth import extract_token

router = APIRouter(prefix="/fields", tags=["Fields"])


@router.get(
    "/me",
    response_model=AuthorizedFieldDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Authenticated Farmer Field",
    description="Returns verified field details and GeoJSON geometry for the current authenticated farmer session.",
)
def get_authenticated_field(
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db),
) -> AuthorizedFieldDetailResponse:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No active session found. Please enter your farm details.",
        )
    session_payload = auth_service.verify_session_token(token)
    if not session_payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please enter your farm details again.",
        )
    return field_service.get_authenticated_field(db, session_payload)


@router.get(
    "/by-gat",
    response_model=FieldLookupResponse,
    status_code=status.HTTP_200_OK,
    summary="Lookup Field by Gat Number",
    description="Lookup a field parcel with strict administrative hierarchy validation (Maharashtra -> Pune -> Taluka -> Village -> Gat).",
)
def get_field_by_gat(
    gat_no: str = Query(..., description="Cadastral Gat Number (e.g. 123, 124/A)", min_length=1),
    village_id: Optional[int] = Query(None, description="Optional ID of the Village", gt=0),
    village: Optional[str] = Query(None, description="Optional name of the Village"),
    taluka: Optional[str] = Query(None, description="Optional name or ID of the Taluka (e.g. Baramati)"),
    db: Session = Depends(get_db),
) -> FieldLookupResponse:
    return field_service.get_field_by_gat(
        db,
        gat_no=gat_no,
        village_id=village_id,
        village_name=village,
        taluka=taluka,
    )


@router.get(
    "/geojson",
    status_code=status.HTTP_200_OK,
    summary="Get Farm Plot Boundaries GeoJSON",
    description="Returns normalized GeoJSON FeatureCollection of farm plot boundaries. Filters strictly by gat_no for authenticated farmers.",
)
def get_fields_geojson(
    village_id: Optional[int] = Query(None, description="Optional ID of the Village"),
    village: Optional[str] = Query(None, description="Optional name of the Village (e.g. Malegaon)"),
    taluka: Optional[str] = Query(None, description="Optional name of the Taluka (e.g. Baramati)"),
    gat_no: Optional[str] = Query(None, description="Optional cadastral Gat Number filter"),
    token: Optional[str] = Depends(extract_token),
    db: Session = Depends(get_db),
) -> dict:
    effective_gat = str(gat_no).strip() if gat_no else None

    return field_service.get_village_geojson(
        db,
        village_id=village_id,
        village_name=village,
        taluka_name=taluka,
        gat_no=effective_gat,
    )


