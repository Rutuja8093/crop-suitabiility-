"""Database model for Field Crop Suitability Assessments.
SoilPilot Phase 8 - Field Suitability Integration
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class FieldCropSuitabilityAssessment(Base):
    """
    Persisted field-level agronomic suitability assessment for a specific crop.
    Preserves input soil parameter snapshots, source provenance (Lab vs DSM),
    evaluated agronomic criteria, constraint explanations, and MPKV/ICAR rule versions.
    Does NOT store speculative yield, revenue, or economic rankings.
    """
    __tablename__ = "field_crop_suitability_assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    field_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("fields.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Cadastral field foreign key when available"
    )
    gat_no: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Cadastral Gat/Survey Number"
    )
    commodity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("commodities.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    assessment_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="PRELIMINARY_SUITABLE, CONDITIONAL_SUITABILITY, POTENTIAL_CONSTRAINT, INSUFFICIENT_DATA"
    )
    overall_summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Clear human-readable agronomic explanation of overall field fit"
    )

    # Auditable JSON snapshots
    evaluated_criteria: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False,
        comment="List of evaluated criteria with thresholds, measured values, and per-criterion statuses"
    )
    soil_values_snapshot: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        comment="Snapshot of input soil values, units, and source labels (LAB OBSERVATION vs DSM PREDICTION)"
    )
    missing_factors: Mapped[List[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Explicit list of unrecorded or unavailable soil / non-soil factors"
    )
    identified_constraints: Mapped[List[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Specific agronomic constraints identified (e.g., high free lime, salinity hazard)"
    )
    agronomic_sources: Mapped[List[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Authoritative agronomic literature references (MPKV Rahuri, ICAR, etc.)"
    )

    rule_engine_version: Mapped[str] = mapped_column(
        String(50),
        default="MPKV_RAHURI_2026_V1",
        nullable=False,
        comment="Identifies specific rule set and threshold definitions used for auditability"
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
    field = relationship("Field", backref="crop_suitability_assessments")
    commodity = relationship("Commodity", backref="crop_suitability_assessments")

    __table_args__ = (
        Index("ix_field_suitability_gat_comm", "gat_no", "commodity_id"),
        Index("ix_field_suitability_status", "assessment_status"),
    )

    def __repr__(self) -> str:
        return f"<FieldCropSuitabilityAssessment(id={self.id}, gat='{self.gat_no}', comm_id={self.commodity_id}, status='{self.assessment_status}')>"
