from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from app.models.field import Field


class FieldRepository:
    """Repository handling database queries for fields and parcels."""

    def get_by_id(self, db: Session, field_id: int) -> Optional[Field]:
        return (
            db.query(Field)
            .options(joinedload(Field.village), joinedload(Field.farmer))
            .filter(Field.id == field_id)
            .first()
        )

    def get_by_village_and_gat(
        self, db: Session, village_id: int, gat_no: str, active_only: bool = True
    ) -> Optional[Field]:
        """Finds a field by its village ID and Gat number (case-insensitive)."""
        clean_gat = str(gat_no).strip()
        query = (
            db.query(Field)
            .options(joinedload(Field.village), joinedload(Field.farmer))
            .filter(Field.village_id == village_id, Field.gat_no.ilike(clean_gat))
        )
        if active_only:
            query = query.filter(Field.is_active == True)
        return query.first()

    def get_by_village(
        self, db: Session, village_id: int, active_only: bool = True
    ) -> List[Field]:
        """Retrieves all fields in a given village."""
        query = (
            db.query(Field)
            .options(joinedload(Field.village), joinedload(Field.farmer))
            .filter(Field.village_id == village_id)
        )
        if active_only:
            query = query.filter(Field.is_active == True)
        return query.order_by(Field.gat_no.asc()).all()

    def get_by_farmer_id(self, db: Session, farmer_id: int) -> List[Field]:
        """Retrieves all fields owned or managed by a given farmer."""
        return (
            db.query(Field)
            .options(joinedload(Field.village))
            .filter(Field.farmer_id == farmer_id, Field.is_active == True)
            .order_by(Field.gat_no.asc())
            .all()
        )


field_repository = FieldRepository()
