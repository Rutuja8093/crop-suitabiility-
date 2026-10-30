from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.db.session import get_db
from app.services.recommendation_service import recommendation_service

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

@router.get("/field/{field_id}", response_model=Dict[str, Any])
def get_field_recommendations(field_id: str, db: Session = Depends(get_db)):
    """Retrieve field-specific rule-based soil recommendations."""
    recs = recommendation_service.get_recommendations_for_field(db, field_id)
    return recs

@router.get("/{field_id}", response_model=Dict[str, Any])
def get_field_recommendations_alias(field_id: str, db: Session = Depends(get_db)):
    """Alias for /field/{field_id}."""
    return get_field_recommendations(field_id, db)
