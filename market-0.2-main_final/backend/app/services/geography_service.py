from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.geography import State, District, Taluka, Village
from app.repositories.geography_repository import geography_repository


class GeographyService:
    """Business logic for administrative hierarchy lookup with strict validation."""

    def list_states(self, db: Session) -> List[State]:
        return geography_repository.get_states(db)

    def list_districts(self, db: Session, state_id: int) -> List[District]:
        # Validate state exists
        state = geography_repository.get_state_by_id(db, state_id)
        if not state:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"State with ID {state_id} not found"
            )
        return geography_repository.get_districts_by_state(db, state_id)

    def list_talukas(self, db: Session, district_id: Optional[int] = None) -> List[Taluka]:
        if district_id:
            district = geography_repository.get_district_by_id(db, district_id)
            if not district:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"District with ID {district_id} not found"
                )
            return geography_repository.get_talukas_by_district(db, district_id)
        # Default to Pune district talukas
        talukas = geography_repository.get_talukas_for_pune(db)
        if not talukas:
            # Fallback: return all talukas if Pune not filtered
            talukas = db.query(Taluka).filter(Taluka.is_active == True).order_by(Taluka.name.asc()).all()
        return talukas

    def list_villages(
        self,
        db: Session,
        taluka_id: Optional[int] = None,
        taluka_name: Optional[str] = None
    ) -> List[Village]:
        if taluka_id:
            taluka = geography_repository.get_taluka_by_id(db, taluka_id)
            if not taluka:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Taluka with ID {taluka_id} not found"
                )
            return geography_repository.get_villages_by_taluka(db, taluka_id)
        elif taluka_name:
            taluka = geography_repository.get_taluka_by_name(db, taluka_name)
            if not taluka:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Taluka '{taluka_name}' not found under Pune District"
                )
            return geography_repository.get_villages_by_taluka(db, taluka.id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either taluka_id or taluka must be provided"
            )


geography_service = GeographyService()
