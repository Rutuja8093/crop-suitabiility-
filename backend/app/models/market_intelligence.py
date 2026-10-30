"""SQLAlchemy ORM models for Market Intelligence & Crop Planner.
SoilPilot Phase 3: Market Data, Historical Prices, Crop Planning & Decision Support.

Entities:
- DataSourceRegistry (data_sources)
- Commodity (commodities)
- MarketApmc (markets)
- CommodityMarketMapping (commodity_market_mappings)
- MarketPriceObservation (market_price_observations)
- CropCalendar (crop_calendars)
- PriceForecast (price_forecasts)
- CropCostEstimate (crop_cost_estimates)
"""

from datetime import date, datetime, timezone
from typing import List, Optional, Any, Dict
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    Date,
    Integer,
    Float,
    Numeric,
    ForeignKey,
    UniqueConstraint,
    Index,
    CheckConstraint,
    Text,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class DataSourceRegistry(Base):
    """
    Registry of authorised agricultural market-data sources.
    Tracks official sources (e.g. AGMARKNET, MSAMB, MPKV Rahuri) and their data-provenance metadata.
    """
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="GOVERNMENT_PORTAL, STATE_APMC_BOARD, AGRICULTURAL_UNIVERSITY, RESEARCH_INSTITUTE"
    )
    official_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    access_method: Mapped[str] = mapped_column(
        String(50),
        default="REST_API",
        nullable=False,
        comment="REST_API, OPEN_DATA_PORTAL, CSV_PUBLICATION, OFFICIAL_BULLETIN"
    )
    licensing_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    update_frequency: Mapped[str] = mapped_column(
        String(50),
        default="DAILY",
        nullable=False,
        comment="DAILY, WEEKLY, SEASONAL, AD_HOC"
    )
    last_successful_retrieval_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    last_attempted_retrieval_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    operational_status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING_INTEGRATION",
        nullable=False,
        comment="ACTIVE, PENDING_INTEGRATION, DEGRADED, SUSPENDED"
    )
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
    observations: Mapped[List["MarketPriceObservation"]] = relationship(
        "MarketPriceObservation",
        back_populates="source",
        cascade="all, delete-orphan"
    )
    crop_calendars: Mapped[List["CropCalendar"]] = relationship(
        "CropCalendar",
        back_populates="source"
    )

    def __repr__(self) -> str:
        return f"<DataSourceRegistry(id={self.id}, code='{self.code}', status='{self.operational_status}')>"


class Commodity(Base):
    """
    Agricultural commodities and configurable crops.
    Supports Maharashtra crop catalogues with bilingual (English/Marathi) metadata.
    """
    __tablename__ = "commodities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    name_mr: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="CEREALS, PULSES, OILSEEDS, CASH_CROPS, VEGETABLES, FRUITS, SPICES, FODDER"
    )
    botanical_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    standard_unit: Mapped[str] = mapped_column(
        String(20),
        default="QUINTAL",
        nullable=False,
        comment="QUINTAL (100 kg), KG, TONNE"
    )
    crop_duration_min_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    crop_duration_max_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description_mr: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    observations: Mapped[List["MarketPriceObservation"]] = relationship(
        "MarketPriceObservation",
        back_populates="commodity",
        cascade="all, delete-orphan"
    )
    crop_calendars: Mapped[List["CropCalendar"]] = relationship(
        "CropCalendar",
        back_populates="commodity",
        cascade="all, delete-orphan"
    )
    price_forecasts: Mapped[List["PriceForecast"]] = relationship(
        "PriceForecast",
        back_populates="commodity",
        cascade="all, delete-orphan"
    )
    cost_estimates: Mapped[List["CropCostEstimate"]] = relationship(
        "CropCostEstimate",
        back_populates="commodity"
    )
    market_mappings: Mapped[List["CommodityMarketMapping"]] = relationship(
        "CommodityMarketMapping",
        back_populates="commodity",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "crop_duration_min_days IS NULL OR crop_duration_max_days IS NULL OR crop_duration_min_days <= crop_duration_max_days",
            name="chk_commodity_duration_valid"
        ),
    )

    def __repr__(self) -> str:
        return f"<Commodity(id={self.id}, code='{self.code}', name='{self.name}', category='{self.category}')>"


class MarketApmc(Base):
    """
    Agricultural Produce Market Committees (APMCs) and principal yards across Maharashtra.
    Links relationally to existing State, District, and Taluka entities.
    """
    __tablename__ = "markets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    market_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    name_mr: Mapped[str] = mapped_column(String(150), nullable=False)
    state_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("states.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    district_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("districts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    taluka_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("talukas.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    agmarknet_market_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    market_type: Mapped[str] = mapped_column(
        String(50),
        default="PRINCIPAL_MARKET",
        nullable=False,
        comment="PRINCIPAL_MARKET, SUB_YARD, PRIVATE_MARKET, DIRECT_MARKETING"
    )
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
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

    # Relationships to existing geographic entities
    state = relationship("State", backref="markets")
    district = relationship("District", backref="markets")
    taluka = relationship("Taluka", backref="markets")

    observations: Mapped[List["MarketPriceObservation"]] = relationship(
        "MarketPriceObservation",
        back_populates="market",
        cascade="all, delete-orphan"
    )
    price_forecasts: Mapped[List["PriceForecast"]] = relationship(
        "PriceForecast",
        back_populates="market",
        cascade="all, delete-orphan"
    )
    commodity_mappings: Mapped[List["CommodityMarketMapping"]] = relationship(
        "CommodityMarketMapping",
        back_populates="market",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<MarketApmc(id={self.id}, code='{self.market_code}', name='{self.name}')>"


class CommodityMarketMapping(Base):
    """
    Source-to-canonical mapping resolving commodity names, varieties, and grades
    used by individual mandis / AGMARKNET bulletins to canonical SoilPilot commodities.
    """
    __tablename__ = "commodity_market_mappings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    commodity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("commodities.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    market_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("markets.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    source_commodity_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    source_variety_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    source_grade: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    commodity: Mapped["Commodity"] = relationship("Commodity", back_populates="market_mappings")
    market: Mapped["MarketApmc"] = relationship("MarketApmc", back_populates="commodity_mappings")

    __table_args__ = (
        UniqueConstraint(
            "market_id",
            "source_commodity_name",
            "source_variety_name",
            name="uq_commodity_market_source_mapping"
        ),
    )

    def __repr__(self) -> str:
        return f"<CommodityMarketMapping(id={self.id}, source='{self.source_commodity_name}', comm_id={self.commodity_id})>"


class MarketPriceObservation(Base):
    """
    Individual observed agricultural market price record.
    Preserves strict separation between observation_date and retrieval_timestamp,
    enforces monetary precision (Numeric 10,2), unit normalization, and price integrity.
    """
    __tablename__ = "market_price_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    commodity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("commodities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    market_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("markets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    source_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("data_sources.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    source_record_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Unique identifier or SHA-256 hash provided by source bulletin"
    )

    # Strict temporal separation
    observation_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="The date when trading occurred at the APMC yard"
    )
    retrieval_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        comment="The timestamp when SoilPilot retrieved and ingested this observation"
    )

    # Monetary values in Indian Rupees (₹) with exact 2-decimal precision
    min_price: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Minimum observed price (₹ / unit)"
    )
    max_price: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Maximum observed price (₹ / unit)"
    )
    modal_price: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Modal (most frequent) observed price (₹ / unit)"
    )
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    price_unit: Mapped[str] = mapped_column(
        String(30),
        default="RS_PER_QUINTAL",
        nullable=False,
        comment="RS_PER_QUINTAL, RS_PER_KG, RS_PER_TONNE"
    )

    # Market arrival volume
    arrival_quantity: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2),
        nullable=True,
        comment="Reported physical volume traded"
    )
    arrival_unit: Mapped[Optional[str]] = mapped_column(
        String(30),
        default="TONNE",
        nullable=True,
        comment="TONNE, QUINTAL, BAGS_50KG"
    )

    # Auditing and payload preservation
    raw_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
        comment="Original unprocessed source payload record for auditability"
    )
    validation_status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        nullable=False,
        index=True,
        comment="VERIFIED, PENDING, FLAGGED_OUTLIER, SUSPECT_INVERTED, SUPERSEDED"
    )
    validation_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    commodity: Mapped["Commodity"] = relationship("Commodity", back_populates="observations")
    market: Mapped["MarketApmc"] = relationship("MarketApmc", back_populates="observations")
    source: Mapped["DataSourceRegistry"] = relationship("DataSourceRegistry", back_populates="observations")

    __table_args__ = (
        # Price logical checks
        CheckConstraint("min_price IS NULL OR min_price >= 0", name="chk_price_min_nonnegative"),
        CheckConstraint("max_price IS NULL OR max_price >= 0", name="chk_price_max_nonnegative"),
        CheckConstraint("modal_price IS NULL OR modal_price >= 0", name="chk_price_modal_nonnegative"),
        CheckConstraint("arrival_quantity IS NULL OR arrival_quantity >= 0", name="chk_arrival_nonnegative"),
        CheckConstraint(
            "min_price IS NULL OR max_price IS NULL OR min_price <= max_price",
            name="chk_price_min_lte_max"
        ),
        CheckConstraint(
            "min_price IS NULL OR modal_price IS NULL OR min_price <= modal_price",
            name="chk_price_min_lte_modal"
        ),
        CheckConstraint(
            "modal_price IS NULL OR max_price IS NULL OR modal_price <= max_price",
            name="chk_price_modal_lte_max"
        ),
        # Compound indexing for analytical timeseries performance
        Index("ix_mpo_commodity_market_date", "commodity_id", "market_id", "observation_date"),
        Index("ix_mpo_market_date", "market_id", "observation_date"),
        Index("ix_mpo_source_record", "source_id", "source_record_id"),
        Index("ix_mpo_validation_date", "validation_status", "observation_date"),
    )

    def __repr__(self) -> str:
        return f"<MarketPriceObservation(id={self.id}, comm_id={self.commodity_id}, market_id={self.market_id}, date={self.observation_date}, modal={self.modal_price})>"


class CropCalendar(Base):
    """
    Regional crop calendars and planting windows for Maharashtra agro-climatic zones.
    Preserves seasonal context (Kharif, Rabi, Zaid) and academic source provenance.
    """
    __tablename__ = "crop_calendars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    commodity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("commodities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    state_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("states.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    district_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("districts.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    taluka_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("talukas.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    season: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
        comment="KHARIF, RABI, ZAID_SUMMER, ANNUAL, PERENNIAL"
    )

    # Planting Window (Month 1-12, Day 1-31)
    planting_window_start_month: Mapped[int] = mapped_column(Integer, nullable=False)
    planting_window_start_day: Mapped[int] = mapped_column(Integer, nullable=False)
    planting_window_end_month: Mapped[int] = mapped_column(Integer, nullable=False)
    planting_window_end_day: Mapped[int] = mapped_column(Integer, nullable=False)

    # Duration range
    duration_min_days: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_max_days: Mapped[int] = mapped_column(Integer, nullable=False)

    # Harvest Window
    harvest_window_start_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    harvest_window_start_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    harvest_window_end_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    harvest_window_end_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Provenance
    source_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("data_sources.id", ondelete="SET NULL"),
        nullable=True
    )
    source_reference: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="E.g., MPKV Rahuri Krishi Darshani 2025-26 Package of Practices"
    )
    source_publication_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Resource considerations
    water_requirement_category: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
        comment="LOW (dryland/rainfed), MEDIUM (semi-irrigated), HIGH (irrigated), VERY_HIGH (water-intensive/sugarcane)"
    )
    labor_intensity: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
        comment="LOW, MODERATE, INTENSIVE"
    )
    verification_status: Mapped[str] = mapped_column(
        String(30),
        default="UNVERIFIED",
        nullable=False,
        comment="OFFICIAL_AGRONOMY_APPROVED, RESEARCH_TRIAL, UNVERIFIED"
    )
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
    commodity: Mapped["Commodity"] = relationship("Commodity", back_populates="crop_calendars")
    state = relationship("State", backref="crop_calendars")
    district = relationship("District", backref="crop_calendars")
    taluka = relationship("Taluka", backref="crop_calendars")
    source: Mapped[Optional["DataSourceRegistry"]] = relationship("DataSourceRegistry", back_populates="crop_calendars")

    __table_args__ = (
        CheckConstraint(
            "duration_min_days > 0 AND duration_min_days <= duration_max_days",
            name="chk_calendar_duration_valid"
        ),
        CheckConstraint(
            "planting_window_start_month BETWEEN 1 AND 12 AND planting_window_end_month BETWEEN 1 AND 12",
            name="chk_calendar_months_valid"
        ),
        CheckConstraint(
            "planting_window_start_day BETWEEN 1 AND 31 AND planting_window_end_day BETWEEN 1 AND 31",
            name="chk_calendar_days_valid"
        ),
        Index("ix_crop_calendars_lookup", "commodity_id", "season", "district_id"),
    )

    def __repr__(self) -> str:
        return f"<CropCalendar(id={self.id}, comm_id={self.commodity_id}, season='{self.season}', duration={self.duration_min_days}-{self.duration_max_days}d)>"


class PriceForecast(Base):
    """
    Price forecast records for expected harvest windows.
    Strictly distinguished from observed market prices; preserves training cutoff,
    model version, and statistical confidence intervals for backtesting.
    """
    __tablename__ = "price_forecasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    commodity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("commodities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    market_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("markets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    forecast_generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Timestamp when model run produced this projection"
    )
    target_period_start: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Start date of expected harvest or selling period"
    )
    target_period_end: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="End date of expected harvest or selling period"
    )
    forecast_horizon_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Lead time in days between generation and target period"
    )

    # Predicted price and uncertainty intervals (₹ / unit)
    predicted_modal_price: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Predicted modal harvest price"
    )
    lower_uncertainty_bound: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Lower bound of statistical confidence interval (e.g. 80% CI)"
    )
    upper_uncertainty_bound: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Upper bound of statistical confidence interval (e.g. 80% CI)"
    )
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    price_unit: Mapped[str] = mapped_column(String(30), default="RS_PER_QUINTAL", nullable=False)

    # Provenance and Model Tracking
    model_identifier: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="E.g., PROPHET_APMC_SEASONAL, ARIMA_V1, LIGHTGBM_TIME_SERIES"
    )
    model_version: Mapped[str] = mapped_column(String(30), nullable=False)
    training_data_cutoff_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Cutoff date of historical training observations (ensures reproducibility)"
    )
    confidence_metric_name: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="MAPE, RMSE, R2, DIRECTIONAL_ACCURACY"
    )
    confidence_metric_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        default="DRAFT",
        nullable=False,
        comment="PUBLISHED, DRAFT, BACKTEST, UNAVAILABLE_INSUFFICIENT_DATA, DEPRECATED"
    )
    status_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    commodity: Mapped["Commodity"] = relationship("Commodity", back_populates="price_forecasts")
    market: Mapped["MarketApmc"] = relationship("MarketApmc", back_populates="price_forecasts")

    __table_args__ = (
        CheckConstraint(
            "target_period_start <= target_period_end",
            name="chk_forecast_target_period_valid"
        ),
        CheckConstraint(
            "lower_uncertainty_bound IS NULL OR predicted_modal_price IS NULL OR lower_uncertainty_bound <= predicted_modal_price",
            name="chk_forecast_lower_bound_valid"
        ),
        CheckConstraint(
            "predicted_modal_price IS NULL OR upper_uncertainty_bound IS NULL OR predicted_modal_price <= upper_uncertainty_bound",
            name="chk_forecast_upper_bound_valid"
        ),
        Index("ix_price_forecasts_lookup", "commodity_id", "market_id", "target_period_start"),
        Index("ix_price_forecasts_model", "model_identifier", "model_version"),
    )

    def __repr__(self) -> str:
        return f"<PriceForecast(id={self.id}, comm_id={self.commodity_id}, target={self.target_period_start}, pred={self.predicted_modal_price})>"


class CropCostEstimate(Base):
    """
    Cultivation cost, gross revenue, and net return estimates.
    Provides schema for farm profitability calculations while keeping calculations
    decoupled from database storage. Links to existing Field/Farmer when field-specific.
    """
    __tablename__ = "crop_cost_estimates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    commodity_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("commodities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    district_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("districts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    taluka_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("talukas.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    field_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("fields.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Optional foreign key to specific cadastral field for field-specific suitability"
    )
    farmer_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("farmers.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    season: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
        comment="KHARIF, RABI, ZAID"
    )
    area: Mapped[float] = mapped_column(
        Numeric(10, 2),
        default=1.0,
        nullable=False,
        comment="Area basis for this estimate"
    )
    area_unit: Mapped[str] = mapped_column(
        String(20),
        default="HECTARE",
        nullable=False,
        comment="HECTARE, ACRE"
    )

    # Cost breakdown and totals (₹)
    cost_breakdown: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
        comment="Detailed breakdown: seeds, land_prep, fertilizers, irrigation, labor, pest_control, harvesting"
    )
    estimated_cost_per_unit_area: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2),
        nullable=True,
        comment="Total operational cultivation cost per hectare/acre (₹)"
    )

    # Expected yield
    estimated_yield_min: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    estimated_yield_max: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    estimated_yield_expected: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    yield_unit: Mapped[str] = mapped_column(
        String(30),
        default="QUINTAL_PER_HECTARE",
        nullable=False,
        comment="QUINTAL_PER_HECTARE, TONNE_PER_HECTARE, KG_PER_ACRE"
    )

    # Financial estimates
    forecast_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("price_forecasts.id", ondelete="SET NULL"),
        nullable=True
    )
    assumed_price_per_yield_unit: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2),
        nullable=True,
        comment="Assumed farmgate price per quintal/tonne (₹)"
    )
    estimated_gross_revenue: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2),
        nullable=True,
        comment="Expected yield * Assumed price (₹)"
    )
    estimated_net_return: Mapped[Optional[float]] = mapped_column(
        Numeric(12, 2),
        nullable=True,
        comment="Gross Revenue - Total Cost (₹)"
    )

    # Risk & Agronomic fit
    risk_level: Mapped[str] = mapped_column(
        String(30),
        default="MEDIUM",
        nullable=False,
        comment="LOW, MEDIUM, HIGH"
    )
    soil_suitability_index: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
        comment="Soil suitability score 0.0 to 1.0 derived from SoilPilot DSM / Soil Health Card"
    )
    assumptions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_reference: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="E.g., CACP Comprehensive Scheme for Study of Cost of Cultivation / MPKV Rahuri"
    )
    calculation_version: Mapped[str] = mapped_column(
        String(50),
        default="V1.0_PROVISIONAL",
        nullable=False
    )
    estimate_status: Mapped[str] = mapped_column(
        String(30),
        default="PENDING_CALCULATION",
        nullable=False,
        comment="PENDING_CALCULATION, ESTIMATED, INSUFFICIENT_DATA"
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
    commodity: Mapped["Commodity"] = relationship("Commodity", back_populates="cost_estimates")
    district = relationship("District", backref="crop_cost_estimates")
    taluka = relationship("Taluka", backref="crop_cost_estimates")
    field = relationship("Field", backref="crop_cost_estimates")
    farmer = relationship("Farmer", backref="crop_cost_estimates")
    forecast = relationship("PriceForecast")

    __table_args__ = (
        CheckConstraint(
            "estimated_yield_min IS NULL OR estimated_yield_max IS NULL OR estimated_yield_min <= estimated_yield_max",
            name="chk_cost_yield_valid"
        ),
        Index("ix_crop_cost_estimates_lookup", "commodity_id", "district_id", "season"),
        Index("ix_crop_cost_estimates_field", "field_id", "commodity_id"),
    )

    def __repr__(self) -> str:
        return f"<CropCostEstimate(id={self.id}, comm_id={self.commodity_id}, season='{self.season}', net={self.estimated_net_return})>"
