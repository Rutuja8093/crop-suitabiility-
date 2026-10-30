from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class GatFarmer(Base):
    """
    Landholder record mapped to a cadastral Gat Number within a specific village.
    Preserves authoritative land records (e.g. from 7/12 extract / official Gat register).
    """
    __tablename__ = "gat_farmers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    village_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("villages.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    village_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    gat_no: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    farmer_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_file: Mapped[str] = mapped_column(
        String(255),
        default="Malegaon_Khurd_Gat_and_Farmer_Names.xlsx",
        nullable=False
    )
    source_row: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    village = relationship("Village", backref="gat_farmers")

    __table_args__ = (
        # Ensure idempotent import: one farmer name per Gat in a given village
        UniqueConstraint("village_id", "gat_no", "farmer_name", name="uq_gat_farmer_record"),
        Index("ix_gat_farmers_village_gat", "village_id", "gat_no"),
        Index("ix_gat_farmers_village_name_gat", "village_name", "gat_no"),
    )

    def __repr__(self) -> str:
        return f"<GatFarmer(id={self.id}, village='{self.village_name}', gat='{self.gat_no}', name='{self.farmer_name}')>"
