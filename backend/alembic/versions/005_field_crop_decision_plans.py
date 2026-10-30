"""SoilPilot Phase 9: Crop Ranking & Decision Engine Data Model

Revision ID: 005_field_crop_decision_plans
Revises: 004_field_crop_suitability
Create Date: 2026-10-22 17:15:00.000000

Adds table:
- field_crop_decision_plans: Persisted multi-criteria crop decision plans,
  preserving candidate evaluations, decision tiers, financial scenarios,
  constraints, and rule engine versions.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_field_crop_decision_plans'
down_revision: Union[str, None] = '004_field_crop_suitability'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'field_crop_decision_plans',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=True),
        sa.Column('farmer_id', sa.Integer(), nullable=True),
        sa.Column('gat_no', sa.String(length=50), nullable=False),
        sa.Column('planning_date', sa.Date(), nullable=False),
        sa.Column('planning_horizon', sa.String(length=30), nullable=False),
        sa.Column('season', sa.String(length=30), nullable=False),
        sa.Column('area_evaluated', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('area_unit', sa.String(length=20), nullable=False),
        sa.Column('evaluated_crops', sa.JSON(), nullable=False),
        sa.Column('decision_tier_summary', sa.JSON(), nullable=False),
        sa.Column('planning_context', sa.JSON(), nullable=False),
        sa.Column('engine_version', sa.String(length=50), nullable=False),
        sa.Column('disclaimer', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['farmer_id'], ['farmers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_field_crop_decision_plans_id', 'field_crop_decision_plans', ['id'], unique=False)
    op.create_index('ix_field_crop_decision_plans_field_id', 'field_crop_decision_plans', ['field_id'], unique=False)
    op.create_index('ix_field_crop_decision_plans_farmer_id', 'field_crop_decision_plans', ['farmer_id'], unique=False)
    op.create_index('ix_field_crop_decision_plans_gat_no', 'field_crop_decision_plans', ['gat_no'], unique=False)
    op.create_index('ix_field_crop_decision_plans_date', 'field_crop_decision_plans', ['planning_date'], unique=False)
    op.create_index('ix_field_crop_decision_plans_season', 'field_crop_decision_plans', ['season'], unique=False)
    op.create_index('ix_field_crop_decision_plans_lookup', 'field_crop_decision_plans', ['gat_no', 'planning_date', 'season'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_field_crop_decision_plans_lookup', table_name='field_crop_decision_plans')
    op.drop_index('ix_field_crop_decision_plans_season', table_name='field_crop_decision_plans')
    op.drop_index('ix_field_crop_decision_plans_date', table_name='field_crop_decision_plans')
    op.drop_index('ix_field_crop_decision_plans_gat_no', table_name='field_crop_decision_plans')
    op.drop_index('ix_field_crop_decision_plans_farmer_id', table_name='field_crop_decision_plans')
    op.drop_index('ix_field_crop_decision_plans_field_id', table_name='field_crop_decision_plans')
    op.drop_index('ix_field_crop_decision_plans_id', table_name='field_crop_decision_plans')
    op.drop_table('field_crop_decision_plans')
