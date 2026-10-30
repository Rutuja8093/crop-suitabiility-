from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.field import Field


class State(Base):
    """Administrative State entity (e.g. Maharashtra)."""
    __tablename__ = "states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False, index=True)
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
    districts: Mapped[List["District"]] = relationship("District", back_populates="state", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<State(id={self.id}, name='{self.name}', code='{self.code}')>"


class District(Base):
    """Administrative District entity (e.g. Pune), belonging to exactly one State."""
    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    state_id: Mapped[int] = mapped_column(Integer, ForeignKey("states.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)
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
    state: Mapped["State"] = relationship("State", back_populates="districts")
    talukas: Mapped[List["Taluka"]] = relationship("Taluka", back_populates="district", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<District(id={self.id}, name='{self.name}', state_id={self.state_id})>"


class Taluka(Base):
    """Administrative Taluka/Tehsil/Block entity (e.g. Baramati, Haveli)."""
    __tablename__ = "talukas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    district_id: Mapped[int] = mapped_column(Integer, ForeignKey("districts.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)
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
    district: Mapped["District"] = relationship("District", back_populates="talukas")
    villages: Mapped[List["Village"]] = relationship("Village", back_populates="taluka", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Taluka(id={self.id}, name='{self.name}', district_id={self.district_id})>"


class Village(Base):
    """Administrative Village entity (e.g. Malegaon, Wagholi)."""
    __tablename__ = "villages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    taluka_id: Mapped[int] = mapped_column(Integer, ForeignKey("talukas.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, index=True)
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
    taluka: Mapped["Taluka"] = relationship("Taluka", back_populates="villages")
    fields: Mapped[List["Field"]] = relationship("Field", back_populates="village")

    def __repr__(self) -> str:
        return f"<Village(id={self.id}, name='{self.name}', taluka_id={self.taluka_id})>"
