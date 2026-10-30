"""Phase 3: Gat-Wise Farmers Schema

Revision ID: 002_gat_farmers
Revises: 001_phase2_geography
Create Date: 2026-10-12 12:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_gat_farmers'
down_revision: Union[str, None] = '001_phase2_geography'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gat_farmers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('village_id', sa.Integer(), nullable=False),
        sa.Column('village_name', sa.String(length=150), nullable=False),
        sa.Column('gat_no', sa.String(length=50), nullable=False),
        sa.Column('farmer_name', sa.String(length=255), nullable=False),
        sa.Column('source_file', sa.String(length=255), server_default='Malegaon_Khurd_Gat_and_Farmer_Names.xlsx', nullable=False),
        sa.Column('source_row', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['village_id'], ['villages.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('village_id', 'gat_no', 'farmer_name', name='uq_gat_farmer_record')
    )
    op.create_index('ix_gat_farmers_id', 'gat_farmers', ['id'], unique=False)
    op.create_index('ix_gat_farmers_village_id', 'gat_farmers', ['village_id'], unique=False)
    op.create_index('ix_gat_farmers_village_name', 'gat_farmers', ['village_name'], unique=False)
    op.create_index('ix_gat_farmers_gat_no', 'gat_farmers', ['gat_no'], unique=False)
    op.create_index('ix_gat_farmers_farmer_name', 'gat_farmers', ['farmer_name'], unique=False)
    op.create_index('ix_gat_farmers_village_gat', 'gat_farmers', ['village_id', 'gat_no'], unique=False)
    op.create_index('ix_gat_farmers_village_name_gat', 'gat_farmers', ['village_name', 'gat_no'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_gat_farmers_village_name_gat', table_name='gat_farmers')
    op.drop_index('ix_gat_farmers_village_gat', table_name='gat_farmers')
    op.drop_index('ix_gat_farmers_farmer_name', table_name='gat_farmers')
    op.drop_index('ix_gat_farmers_gat_no', table_name='gat_farmers')
    op.drop_index('ix_gat_farmers_village_name', table_name='gat_farmers')
    op.drop_index('ix_gat_farmers_village_id', table_name='gat_farmers')
    op.drop_index('ix_gat_farmers_id', table_name='gat_farmers')
    op.drop_table('gat_farmers')
