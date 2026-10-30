"""SoilPilot Phase 8: Field Crop Suitability Integration Data Model

Revision ID: 004_field_crop_suitability
Revises: 003_market_intelligence
Create Date: 2026-10-22 17:00:00.000000

Adds table:
- field_crop_suitability_assessments: Persisted field suitability evaluations
  preserving criteria results, soil snapshots, source provenance, and rule versions.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_field_crop_suitability'
down_revision: Union[str, None] = '003_market_intelligence'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'field_crop_suitability_assessments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=True),
        sa.Column('gat_no', sa.String(length=50), nullable=False),
        sa.Column('commodity_id', sa.Integer(), nullable=False),
        sa.Column('assessment_status', sa.String(length=50), nullable=False),
        sa.Column('overall_summary', sa.Text(), nullable=False),
        sa.Column('evaluated_criteria', sa.JSON(), nullable=False),
        sa.Column('soil_values_snapshot', sa.JSON(), nullable=False),
        sa.Column('missing_factors', sa.JSON(), nullable=False),
        sa.Column('identified_constraints', sa.JSON(), nullable=False),
        sa.Column('agronomic_sources', sa.JSON(), nullable=False),
        sa.Column('rule_engine_version', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['commodity_id'], ['commodities.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_field_crop_suitability_assessments_id', 'field_crop_suitability_assessments', ['id'], unique=False)
    op.create_index('ix_field_crop_suitability_assessments_field_id', 'field_crop_suitability_assessments', ['field_id'], unique=False)
    op.create_index('ix_field_crop_suitability_assessments_gat_no', 'field_crop_suitability_assessments', ['gat_no'], unique=False)
    op.create_index('ix_field_crop_suitability_assessments_commodity_id', 'field_crop_suitability_assessments', ['commodity_id'], unique=False)
    op.create_index('ix_field_suitability_status', 'field_crop_suitability_assessments', ['assessment_status'], unique=False)
    op.create_index('ix_field_suitability_gat_comm', 'field_crop_suitability_assessments', ['gat_no', 'commodity_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_field_suitability_gat_comm', table_name='field_crop_suitability_assessments')
    op.drop_index('ix_field_suitability_status', table_name='field_crop_suitability_assessments')
    op.drop_index('ix_field_crop_suitability_assessments_commodity_id', table_name='field_crop_suitability_assessments')
    op.drop_index('ix_field_crop_suitability_assessments_gat_no', table_name='field_crop_suitability_assessments')
    op.drop_index('ix_field_crop_suitability_assessments_field_id', table_name='field_crop_suitability_assessments')
    op.drop_index('ix_field_crop_suitability_assessments_id', table_name='field_crop_suitability_assessments')
    op.drop_table('field_crop_suitability_assessments')
