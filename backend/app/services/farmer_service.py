import logging
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.geography import Village, Taluka
from app.models.gat_farmer import GatFarmer
from app.schemas.gat_farmer import (
    AssociatedFarmerItem,
    GatFarmersLookupResponse,
    GatOptionItem,
    VillageGatsResponse,
)
from app.services.field_service import normalize_gat_number

logger = logging.getLogger(__name__)


class FarmerService:
    """Service handling Gat-wise farmer lookup and queries."""

    def resolve_village(
        self,
        db: Session,
        village_id: Optional[int] = None,
        village_name: Optional[str] = None,
        taluka: Optional[str] = None,
    ) -> Village:
        """Resolve village entity using ID or Name with robust alias handling."""
        if village_id:
            village = db.query(Village).filter(Village.id == village_id).first()
            if not village:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Village with ID {village_id} not found."
                )
            return village

        if village_name:
            clean_v = village_name.strip()
            # 1. Exact match
            v = db.query(Village).filter(Village.name.ilike(clean_v)).first()
            if v:
                return v

            # 2. Handle Malegaon Khurd / Malegaon Kh alias
            v_lower = clean_v.lower()
            if "malegaon" in v_lower:
                if "kh" in v_lower or "khurd" in v_lower:
                    # Look up Malegaon Kh in Baramati taluka
                    baramati = db.query(Taluka).filter(Taluka.name.ilike("Baramati")).first()
                    query = db.query(Village).filter(
                        Village.name.ilike("Malegaon Kh%") | Village.name.ilike("Malegaon Khurd%")
                    )
                    if baramati:
                        query = query.filter(Village.taluka_id == baramati.id)
                    v = query.first()
                    if v:
                        return v
                elif "bk" in v_lower or "budruk" in v_lower:
                    v = db.query(Village).filter(Village.name.ilike("Malegaon Bk%")).first()
                    if v:
                        return v

            # 3. Partial ILIKE match
            v = db.query(Village).filter(Village.name.ilike(f"%{clean_v}%")).first()
            if v:
                return v

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Village '{village_name}' not found."
            )

        # Default fallback to Malegaon Khurd (ID 87)
        v = db.query(Village).filter(Village.id == 87).first()
        if not v:
            v = db.query(Village).filter(Village.name.ilike("Malegaon Kh%")).first()
        if v:
            return v

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Village identifier or village name must be specified."
        )

    def get_farmers_by_gat(
        self,
        db: Session,
        gat_no: str,
        village_name: Optional[str] = None,
        village_id: Optional[int] = None,
        taluka: Optional[str] = None,
    ) -> GatFarmersLookupResponse:
        """
        Lookup all farmer names associated with a specific Gat number in a given village.
        Preserves Marathi Unicode characters, handles Gat number normalization,
        and isolates results strictly by village.
        """
        # 1. Normalize Gat number
        clean_gat = normalize_gat_number(gat_no)
        if not clean_gat:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Gat number cannot be empty."
            )

        # 2. Resolve village
        village = self.resolve_village(
            db,
            village_id=village_id,
            village_name=village_name,
            taluka=taluka,
        )

        # Display name formatted nicely for user
        village_display = (
            "Malegaon Khurd"
            if village.name.lower().startswith("malegaon kh")
            else village.name
        )

        # 3. Query farmers strictly for (village_id, gat_no)
        records = (
            db.query(GatFarmer)
            .filter(
                GatFarmer.village_id == village.id,
                GatFarmer.gat_no == clean_gat,
                GatFarmer.is_active == True,
            )
            .order_by(GatFarmer.source_row.asc(), GatFarmer.id.asc())
            .all()
        )

        farmer_items = [
            AssociatedFarmerItem(
                id=r.id,
                name=r.farmer_name,
                source_row=r.source_row,
            )
            for r in records
        ]

        total_count = len(farmer_items)
        status_msg = (
            f"Successfully found {total_count} farmer record(s) for Gat {clean_gat}."
            if total_count > 0
            else f"No farmer names found for Gat {clean_gat} in {village_display}."
        )

        return GatFarmersLookupResponse(
            village=village_display,
            village_id=village.id,
            gat_no=clean_gat,
            total=total_count,
            farmers=farmer_items,
            message=status_msg,
        )

    def get_available_gats_for_village(
        self,
        db: Session,
        village_name: Optional[str] = None,
        village_id: Optional[int] = None,
    ) -> VillageGatsResponse:
        """
        Returns list of all available Gats in a village with their farmer count.
        Useful for dropdowns, search autocomplete, and verification.
        """
        village = self.resolve_village(db, village_id=village_id, village_name=village_name)
        village_display = (
            "Malegaon Khurd"
            if village.name.lower().startswith("malegaon kh")
            else village.name
        )

        query = (
            db.query(
                GatFarmer.gat_no,
                func.count(GatFarmer.id).label("farmer_count"),
            )
            .filter(
                GatFarmer.village_id == village.id,
                GatFarmer.is_active == True,
            )
            .group_by(GatFarmer.gat_no)
            .all()
        )

        # Sort Gats numerically where possible, otherwise string sort
        def sort_key(item):
            g = item[0]
            try:
                return (0, int(g))
            except ValueError:
                return (1, g)

        sorted_rows = sorted(query, key=sort_key)
        gat_options = [
            GatOptionItem(gat_no=r[0], farmer_count=r[1])
            for r in sorted_rows
        ]

        total_farmers = sum(opt.farmer_count for opt in gat_options)

        return VillageGatsResponse(
            village=village_display,
            village_id=village.id,
            total_gats=len(gat_options),
            total_farmers=total_farmers,
            gats=gat_options,
        )


farmer_service = FarmerService()
