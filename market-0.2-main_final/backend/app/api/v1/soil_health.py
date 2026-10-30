from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from app.db.session import get_db
from app.services.soil_health_service import soil_health_service

router = APIRouter(prefix="/soil-health", tags=["Soil Health Card"])

@router.get("/field/{field_id}", response_model=Dict[str, Any])
def get_field_soil_report(field_id: str, db: Session = Depends(get_db)):
    """Retrieve full official laboratory Soil Health Report for a given field."""
    report = soil_health_service.get_report_for_field(db, field_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field with ID {field_id} not found."
        )
    return report

@router.get("/field/{field_id}/summary", response_model=Dict[str, Any])
def get_field_soil_summary(field_id: str, db: Session = Depends(get_db)):
    """Retrieve quick Soil Health summary parameters for dashboard display."""
    summary = soil_health_service.get_summary_for_field(db, field_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Field with ID {field_id} not found."
        )
    return summary
