from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.field import Field


class Farmer(Base):
    """Farmer entity representing field landholders."""
    __tablename__ = "farmers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    farmer_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    mobile_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="mr", nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="farmer", nullable=False)
    gat_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
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

    # Relationships: One farmer can have one or more fields
    fields: Mapped[List["Field"]] = relationship("Field", back_populates="farmer")

    def __repr__(self) -> str:
        return f"<Farmer(id={self.id}, code='{self.farmer_code}', name='{self.full_name}')>"
