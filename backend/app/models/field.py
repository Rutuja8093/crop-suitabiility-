from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Boolean, DateTime, Integer, Float, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator, Text
from geoalchemy2 import Geometry
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.farmer import Farmer
    from app.models.geography import Village


class GeometryOrText(TypeDecorator):
    """PostGIS Geometry on PostgreSQL, WKT Text on SQLite."""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(
                Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True)
            )
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if dialect.name != "postgresql" and value is not None:
            return str(value)
        return value


class Field(Base):
    """Agricultural field / parcel entity identified by cadastral Gat Number."""
    __tablename__ = "fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    farmer_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("farmers.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    village_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("villages.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    # Gat number stored as a string to preserve nuances (e.g. "124/A", "45/2", "123")
    gat_no: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    area: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    area_unit: Mapped[str] = mapped_column(String(20), default="hectare", nullable=False)

    # PostGIS MultiPolygon geometry in WGS84 (SRID 4326) / WKT text
    geometry = mapped_column(GeometryOrText(), nullable=True)

    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    farmer: Mapped[Optional["Farmer"]] = relationship("Farmer", back_populates="fields")
    village: Mapped["Village"] = relationship("Village", back_populates="fields")

    # Important Business Constraint:
    # A Gat number is UNIQUE within a village, NOT globally unique across the state.
    __table_args__ = (
        UniqueConstraint("village_id", "gat_no", name="uq_field_village_gat"),
        Index("ix_fields_village_gat", "village_id", "gat_no"),
    )

    def __repr__(self) -> str:
        return f"<Field(id={self.id}, village_id={self.village_id}, gat_no='{self.gat_no}', area={self.area})>"
