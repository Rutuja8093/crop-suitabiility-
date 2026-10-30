from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.geography import State, District, Taluka, Village


class GeographyRepository:
    """Repository handling database operations for administrative geography."""

    def get_states(self, db: Session, active_only: bool = True) -> List[State]:
        query = db.query(State)
        if active_only:
            query = query.filter(State.is_active == True)
        return query.order_by(State.name.asc()).all()

    def get_state_by_id(self, db: Session, state_id: int) -> Optional[State]:
        return db.query(State).filter(State.id == state_id).first()

    def get_districts_by_state(self, db: Session, state_id: int, active_only: bool = True) -> List[District]:
        query = db.query(District).filter(District.state_id == state_id)
        if active_only:
            query = query.filter(District.is_active == True)
        return query.order_by(District.name.asc()).all()

    def get_district_by_id(self, db: Session, district_id: int) -> Optional[District]:
        return db.query(District).filter(District.id == district_id).first()

    def get_talukas_by_district(self, db: Session, district_id: int, active_only: bool = True) -> List[Taluka]:
        query = db.query(Taluka).filter(Taluka.district_id == district_id)
        if active_only:
            query = query.filter(Taluka.is_active == True)
        return query.order_by(Taluka.name.asc()).all()

    def get_talukas_for_pune(self, db: Session, active_only: bool = True) -> List[Taluka]:
        query = db.query(Taluka).join(District, Taluka.district_id == District.id).filter(District.name == "Pune")
        if active_only:
            query = query.filter(Taluka.is_active == True)
        return query.order_by(Taluka.name.asc()).all()

    def get_taluka_by_id(self, db: Session, taluka_id: int) -> Optional[Taluka]:
        return db.query(Taluka).filter(Taluka.id == taluka_id).first()

    def get_taluka_by_name(self, db: Session, taluka_name: str) -> Optional[Taluka]:
        return db.query(Taluka).filter(Taluka.name.ilike(taluka_name.strip())).first()

    def get_villages_by_taluka(self, db: Session, taluka_id: int, active_only: bool = True) -> List[Village]:
        query = db.query(Village).filter(Village.taluka_id == taluka_id)
        if active_only:
            query = query.filter(Village.is_active == True)
        return query.order_by(Village.name.asc()).all()

    def get_villages_by_taluka_name(self, db: Session, taluka_name: str, active_only: bool = True) -> List[Village]:
        taluka = self.get_taluka_by_name(db, taluka_name)
        if not taluka:
            return []
        return self.get_villages_by_taluka(db, taluka.id, active_only=active_only)

    def get_village_by_id(self, db: Session, village_id: int) -> Optional[Village]:
        return db.query(Village).filter(Village.id == village_id).first()

    def get_village_by_name_and_taluka(self, db: Session, village_name: str, taluka_id: int) -> Optional[Village]:
        return db.query(Village).filter(
            Village.taluka_id == taluka_id,
            Village.name.ilike(village_name.strip())
        ).first()


geography_repository = GeographyRepository()
