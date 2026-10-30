"""Database models for Soil Health Reports and Test Parameters.
SoilPilot Phase 7
"""
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional, List
from sqlalchemy import String, Boolean, DateTime, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.field import Field

class SoilReport(Base):
    """Official laboratory soil test report associated with an agricultural field."""
    __tablename__ = "soil_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    field_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("fields.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    report_no: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    receipt_no: Mapped[str] = mapped_column(String(50), nullable=False)
    sample_name: Mapped[str] = mapped_column(String(100), default="Surface Soil (0-15 cm)", nullable=False)
    sample_date: Mapped[str] = mapped_column(String(20), nullable=False)
    report_date: Mapped[str] = mapped_column(String(20), nullable=False)
    crop_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    laboratory_name: Mapped[str] = mapped_column(
        String(150),
        default="SoilPilot Soil Testing & Diagnostic Laboratory",
        nullable=False
    )
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    overall_health_index: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    field: Mapped["Field"] = relationship("Field", backref="soil_reports")
    parameters: Mapped[List["SoilParameterValue"]] = relationship(
        "SoilParameterValue",
        back_populates="report",
        cascade="all, delete-orphan"
    )

class SoilParameterValue(Base):
    """Specific parameter value within a soil test report."""
    __tablename__ = "soil_parameter_values"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    report_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("soil_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    sr_no: Mapped[int] = mapped_column(Integer, nullable=False)
    parameter_key: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    parameter_name: Mapped[str] = mapped_column(String(100), nullable=False)
    parameter_name_mr: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="Primary", nullable=False)
    value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    interpretation_en: Mapped[str] = mapped_column(String(50), nullable=False)
    interpretation_mr: Mapped[str] = mapped_column(String(50), nullable=False)
    reference_range: Mapped[str] = mapped_column(String(100), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="LAB OBSERVATION", nullable=False)

    report: Mapped["SoilReport"] = relationship("SoilReport", back_populates="parameters")
