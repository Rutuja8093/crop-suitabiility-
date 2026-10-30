"""SoilPilot Phase 3: Market Intelligence & Crop Planner Data Models

Revision ID: 003_market_intelligence
Revises: 002_gat_farmers
Create Date: 2026-10-22 14:30:00.000000

Adds tables:
- data_sources: Registry of verified market data sources (Agmarknet, MPKV, MSAMB)
- commodities: Configurable agricultural crop and commodity catalog
- markets: Maharashtra APMC markets and trading yards
- commodity_market_mappings: Disambiguation between mandi commodity varieties and canonical crops
- market_price_observations: Observed market prices with date/retrieval separation and integrity checks
- crop_calendars: Regional agro-climatic planting windows, durations, and water/labor metrics
- price_forecasts: Forecast models with uncertainty bands strictly separated from observations
- crop_cost_estimates: Cultivation cost, gross revenue, net margin models linked to fields
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_market_intelligence'
down_revision: Union[str, None] = '002_gat_farmers'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. data_sources
    op.create_table(
        'data_sources',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('source_type', sa.String(length=50), nullable=False),
        sa.Column('official_url', sa.String(length=255), nullable=True),
        sa.Column('access_method', sa.String(length=50), server_default='REST_API', nullable=False),
        sa.Column('licensing_notes', sa.Text(), nullable=True),
        sa.Column('update_frequency', sa.String(length=50), server_default='DAILY', nullable=False),
        sa.Column('last_successful_retrieval_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_attempted_retrieval_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('operational_status', sa.String(length=30), server_default='PENDING_INTEGRATION', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_data_sources_id', 'data_sources', ['id'], unique=False)
    op.create_index('ix_data_sources_code', 'data_sources', ['code'], unique=True)

    # 2. commodities
    op.create_table(
        'commodities',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('name_mr', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('botanical_name', sa.String(length=100), nullable=True),
        sa.Column('standard_unit', sa.String(length=20), server_default='QUINTAL', nullable=False),
        sa.Column('crop_duration_min_days', sa.Integer(), nullable=True),
        sa.Column('crop_duration_max_days', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('description_mr', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            'crop_duration_min_days IS NULL OR crop_duration_max_days IS NULL OR crop_duration_min_days <= crop_duration_max_days',
            name='chk_commodity_duration_valid'
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_commodities_id', 'commodities', ['id'], unique=False)
    op.create_index('ix_commodities_code', 'commodities', ['code'], unique=True)
    op.create_index('ix_commodities_name', 'commodities', ['name'], unique=False)
    op.create_index('ix_commodities_name_mr', 'commodities', ['name_mr'], unique=False)
    op.create_index('ix_commodities_category', 'commodities', ['category'], unique=False)

    # 3. markets
    op.create_table(
        'markets',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('market_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('name_mr', sa.String(length=150), nullable=False),
        sa.Column('state_id', sa.Integer(), nullable=False),
        sa.Column('district_id', sa.Integer(), nullable=False),
        sa.Column('taluka_id', sa.Integer(), nullable=True),
        sa.Column('agmarknet_market_id', sa.String(length=50), nullable=True),
        sa.Column('market_type', sa.String(length=50), server_default='PRINCIPAL_MARKET', nullable=False),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['state_id'], ['states.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['taluka_id'], ['talukas.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('market_code')
    )
    op.create_index('ix_markets_id', 'markets', ['id'], unique=False)
    op.create_index('ix_markets_market_code', 'markets', ['market_code'], unique=True)
    op.create_index('ix_markets_name', 'markets', ['name'], unique=False)
    op.create_index('ix_markets_state_id', 'markets', ['state_id'], unique=False)
    op.create_index('ix_markets_district_id', 'markets', ['district_id'], unique=False)
    op.create_index('ix_markets_taluka_id', 'markets', ['taluka_id'], unique=False)
    op.create_index('ix_markets_agmarknet_market_id', 'markets', ['agmarknet_market_id'], unique=False)

    # 4. commodity_market_mappings
    op.create_table(
        'commodity_market_mappings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('commodity_id', sa.Integer(), nullable=False),
        sa.Column('market_id', sa.Integer(), nullable=False),
        sa.Column('source_commodity_name', sa.String(length=100), nullable=False),
        sa.Column('source_variety_name', sa.String(length=100), nullable=True),
        sa.Column('source_grade', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['commodity_id'], ['commodities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['market_id'], ['markets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('market_id', 'source_commodity_name', 'source_variety_name', name='uq_commodity_market_source_mapping')
    )
    op.create_index('ix_commodity_market_mappings_id', 'commodity_market_mappings', ['id'], unique=False)
    op.create_index('ix_commodity_market_mappings_comm_id', 'commodity_market_mappings', ['commodity_id'], unique=False)
    op.create_index('ix_commodity_market_mappings_market_id', 'commodity_market_mappings', ['market_id'], unique=False)

    # 5. market_price_observations
    op.create_table(
        'market_price_observations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('commodity_id', sa.Integer(), nullable=False),
        sa.Column('market_id', sa.Integer(), nullable=False),
        sa.Column('source_id', sa.Integer(), nullable=False),
        sa.Column('source_record_id', sa.String(length=100), nullable=True),
        sa.Column('observation_date', sa.Date(), nullable=False),
        sa.Column('retrieval_timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('min_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('max_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('modal_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('currency', sa.String(length=10), server_default='INR', nullable=False),
        sa.Column('price_unit', sa.String(length=30), server_default='RS_PER_QUINTAL', nullable=False),
        sa.Column('arrival_quantity', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('arrival_unit', sa.String(length=30), server_default='TONNE', nullable=True),
        sa.Column('raw_payload', sa.JSON(), nullable=True),
        sa.Column('validation_status', sa.String(length=30), server_default='PENDING', nullable=False),
        sa.Column('validation_notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('min_price IS NULL OR min_price >= 0', name='chk_price_min_nonnegative'),
        sa.CheckConstraint('max_price IS NULL OR max_price >= 0', name='chk_price_max_nonnegative'),
        sa.CheckConstraint('modal_price IS NULL OR modal_price >= 0', name='chk_price_modal_nonnegative'),
        sa.CheckConstraint('arrival_quantity IS NULL OR arrival_quantity >= 0', name='chk_arrival_nonnegative'),
        sa.CheckConstraint('min_price IS NULL OR max_price IS NULL OR min_price <= max_price', name='chk_price_min_lte_max'),
        sa.CheckConstraint('min_price IS NULL OR modal_price IS NULL OR min_price <= modal_price', name='chk_price_min_lte_modal'),
        sa.CheckConstraint('modal_price IS NULL OR max_price IS NULL OR modal_price <= max_price', name='chk_price_modal_lte_max'),
        sa.ForeignKeyConstraint(['commodity_id'], ['commodities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['market_id'], ['markets.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['source_id'], ['data_sources.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_mpo_id', 'market_price_observations', ['id'], unique=False)
    op.create_index('ix_mpo_commodity_market_date', 'market_price_observations', ['commodity_id', 'market_id', 'observation_date'], unique=False)
    op.create_index('ix_mpo_market_date', 'market_price_observations', ['market_id', 'observation_date'], unique=False)
    op.create_index('ix_mpo_source_record', 'market_price_observations', ['source_id', 'source_record_id'], unique=False)
    op.create_index('ix_mpo_validation_date', 'market_price_observations', ['validation_status', 'observation_date'], unique=False)

    # 6. crop_calendars
    op.create_table(
        'crop_calendars',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('commodity_id', sa.Integer(), nullable=False),
        sa.Column('state_id', sa.Integer(), nullable=False),
        sa.Column('district_id', sa.Integer(), nullable=True),
        sa.Column('taluka_id', sa.Integer(), nullable=True),
        sa.Column('season', sa.String(length=30), nullable=False),
        sa.Column('planting_window_start_month', sa.Integer(), nullable=False),
        sa.Column('planting_window_start_day', sa.Integer(), nullable=False),
        sa.Column('planting_window_end_month', sa.Integer(), nullable=False),
        sa.Column('planting_window_end_day', sa.Integer(), nullable=False),
        sa.Column('duration_min_days', sa.Integer(), nullable=False),
        sa.Column('duration_max_days', sa.Integer(), nullable=False),
        sa.Column('harvest_window_start_month', sa.Integer(), nullable=True),
        sa.Column('harvest_window_start_day', sa.Integer(), nullable=True),
        sa.Column('harvest_window_end_month', sa.Integer(), nullable=True),
        sa.Column('harvest_window_end_day', sa.Integer(), nullable=True),
        sa.Column('source_id', sa.Integer(), nullable=True),
        sa.Column('source_reference', sa.String(length=255), nullable=True),
        sa.Column('source_publication_year', sa.Integer(), nullable=True),
        sa.Column('water_requirement_category', sa.String(length=30), nullable=True),
        sa.Column('labor_intensity', sa.String(length=30), nullable=True),
        sa.Column('verification_status', sa.String(length=30), server_default='UNVERIFIED', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('duration_min_days > 0 AND duration_min_days <= duration_max_days', name='chk_calendar_duration_valid'),
        sa.CheckConstraint('planting_window_start_month BETWEEN 1 AND 12 AND planting_window_end_month BETWEEN 1 AND 12', name='chk_calendar_months_valid'),
        sa.CheckConstraint('planting_window_start_day BETWEEN 1 AND 31 AND planting_window_end_day BETWEEN 1 AND 31', name='chk_calendar_days_valid'),
        sa.ForeignKeyConstraint(['commodity_id'], ['commodities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['state_id'], ['states.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['taluka_id'], ['talukas.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['source_id'], ['data_sources.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crop_calendars_id', 'crop_calendars', ['id'], unique=False)
    op.create_index('ix_crop_calendars_lookup', 'crop_calendars', ['commodity_id', 'season', 'district_id'], unique=False)

    # 7. price_forecasts
    op.create_table(
        'price_forecasts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('commodity_id', sa.Integer(), nullable=False),
        sa.Column('market_id', sa.Integer(), nullable=False),
        sa.Column('forecast_generated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('target_period_start', sa.Date(), nullable=False),
        sa.Column('target_period_end', sa.Date(), nullable=False),
        sa.Column('forecast_horizon_days', sa.Integer(), nullable=False),
        sa.Column('predicted_modal_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('lower_uncertainty_bound', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('upper_uncertainty_bound', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('currency', sa.String(length=10), server_default='INR', nullable=False),
        sa.Column('price_unit', sa.String(length=30), server_default='RS_PER_QUINTAL', nullable=False),
        sa.Column('model_identifier', sa.String(length=100), nullable=False),
        sa.Column('model_version', sa.String(length=30), nullable=False),
        sa.Column('training_data_cutoff_date', sa.Date(), nullable=False),
        sa.Column('confidence_metric_name', sa.String(length=50), nullable=True),
        sa.Column('confidence_metric_value', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='DRAFT', nullable=False),
        sa.Column('status_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('target_period_start <= target_period_end', name='chk_forecast_target_period_valid'),
        sa.CheckConstraint('lower_uncertainty_bound IS NULL OR predicted_modal_price IS NULL OR lower_uncertainty_bound <= predicted_modal_price', name='chk_forecast_lower_bound_valid'),
        sa.CheckConstraint('predicted_modal_price IS NULL OR upper_uncertainty_bound IS NULL OR predicted_modal_price <= upper_uncertainty_bound', name='chk_forecast_upper_bound_valid'),
        sa.ForeignKeyConstraint(['commodity_id'], ['commodities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['market_id'], ['markets.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_price_forecasts_id', 'price_forecasts', ['id'], unique=False)
    op.create_index('ix_price_forecasts_lookup', 'price_forecasts', ['commodity_id', 'market_id', 'target_period_start'], unique=False)
    op.create_index('ix_price_forecasts_model', 'price_forecasts', ['model_identifier', 'model_version'], unique=False)

    # 8. crop_cost_estimates
    op.create_table(
        'crop_cost_estimates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('commodity_id', sa.Integer(), nullable=False),
        sa.Column('district_id', sa.Integer(), nullable=False),
        sa.Column('taluka_id', sa.Integer(), nullable=True),
        sa.Column('field_id', sa.Integer(), nullable=True),
        sa.Column('farmer_id', sa.Integer(), nullable=True),
        sa.Column('season', sa.String(length=30), nullable=False),
        sa.Column('area', sa.Numeric(precision=10, scale=2), server_default='1.0', nullable=False),
        sa.Column('area_unit', sa.String(length=20), server_default='HECTARE', nullable=False),
        sa.Column('cost_breakdown', sa.JSON(), nullable=True),
        sa.Column('estimated_cost_per_unit_area', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('estimated_yield_min', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('estimated_yield_max', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('estimated_yield_expected', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('yield_unit', sa.String(length=30), server_default='QUINTAL_PER_HECTARE', nullable=False),
        sa.Column('forecast_id', sa.Integer(), nullable=True),
        sa.Column('assumed_price_per_yield_unit', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('estimated_gross_revenue', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('estimated_net_return', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('risk_level', sa.String(length=30), server_default='MEDIUM', nullable=False),
        sa.Column('soil_suitability_index', sa.Float(), nullable=True),
        sa.Column('assumptions', sa.Text(), nullable=True),
        sa.Column('source_reference', sa.String(length=255), nullable=True),
        sa.Column('calculation_version', sa.String(length=50), server_default='V1.0_PROVISIONAL', nullable=False),
        sa.Column('estimate_status', sa.String(length=30), server_default='PENDING_CALCULATION', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('estimated_yield_min IS NULL OR estimated_yield_max IS NULL OR estimated_yield_min <= estimated_yield_max', name='chk_cost_yield_valid'),
        sa.ForeignKeyConstraint(['commodity_id'], ['commodities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['taluka_id'], ['talukas.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['farmer_id'], ['farmers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['forecast_id'], ['price_forecasts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_crop_cost_estimates_id', 'crop_cost_estimates', ['id'], unique=False)
    op.create_index('ix_crop_cost_estimates_lookup', 'crop_cost_estimates', ['commodity_id', 'district_id', 'season'], unique=False)
    op.create_index('ix_crop_cost_estimates_field', 'crop_cost_estimates', ['field_id', 'commodity_id'], unique=False)


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table('crop_cost_estimates')
    op.drop_table('price_forecasts')
    op.drop_table('crop_calendars')
    op.drop_table('market_price_observations')
    op.drop_table('commodity_market_mappings')
    op.drop_table('markets')
    op.drop_table('commodities')
    op.drop_table('data_sources')
