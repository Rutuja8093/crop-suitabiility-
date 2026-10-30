"""Database model for Field Crop Decision Plans and Multi-Criteria Rankings.
SoilPilot Phase 9 - Crop Ranking & Decision Engine
"""

from datetime import datetime, date, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import String, DateTime, Date, Integer, Float, ForeignKey, Text, JSON, Numeric, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class FieldCropDecisionPlan(Base):
    """
    Persisted field-level crop decision plan and multi-criteria comparison.
    Preserves candidate crop evaluations, multi-criteria decision tiers,
    financial scenarios (per-acre, per-ha, field total), constraints,
    assumptions, and rule versions for traceability and reproducibility.
    Provides decision support without guaranteeing profits or yields.
    """
    __tablename__ = "field_crop_decision_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    field_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("fields.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Cadastral field foreign key when available"
    )
    farmer_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("farmers.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    gat_no: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Cadastral Gat/Survey Number"
    )
    planning_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Date the planning evaluation was performed for"
    )
    planning_horizon: Mapped[str] = mapped_column(
        String(30),
        default="IMMEDIATE_15_DAYS",
        nullable=False,
        comment="IMMEDIATE_15_DAYS or SEASONAL"
    )
    season: Mapped[str] = mapped_column(
        String(30),
        default="RABI",
        nullable=False,
        index=True,
        comment="Planning season: RABI, KHARIF, ZAID_SUMMER, ANNUAL"
    )
    area_evaluated: Mapped[float] = mapped_column(
        Numeric(10, 2),
        default=1.0,
        nullable=False,
        comment="Area of parcel evaluated"
    )
    area_unit: Mapped[str] = mapped_column(
        String(20),
        default="ACRE",
        nullable=False,
        comment="ACRE or HECTARE"
    )

    # Auditable JSON payloads
    evaluated_crops: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False,
        comment="Full snapshot of evaluated crops with suitability, planting window, financials, and tiers"
    )
    decision_tier_summary: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="Summary counts: recommended, conditional, off_season, constrained, insufficient_data"
    )
    planning_context: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="Context snapshot: village, taluka, district, soil summary, market used"
    )

    engine_version: Mapped[str] = mapped_column(
        String(50),
        default="SOILPILOT_DECISION_ENGINE_2026_V1",
        nullable=False,
        comment="Decision engine rule and benchmark version"
    )
    disclaimer: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Agricultural decision support disclaimer"
    )

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
    field = relationship("Field", backref="decision_plans")
    farmer = relationship("Farmer", backref="decision_plans")

    __table_args__ = (
        Index("ix_field_crop_decision_plans_lookup", "gat_no", "planning_date", "season"),
        Index("ix_field_crop_decision_plans_field", "field_id", "planning_date"),
    )

    def __repr__(self) -> str:
        return (
            f"<FieldCropDecisionPlan(id={self.id}, gat_no='{self.gat_no}', "
            f"season='{self.season}', horizon='{self.planning_horizon}')>"
        )
