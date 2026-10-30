"""Phase 2: Geographic Hierarchy and Fields Schema

Revision ID: 001_phase2_geography
Revises: 
Create Date: 2026-09-22 11:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
import geoalchemy2

# revision identifiers, used by Alembic.
revision: str = '001_phase2_geography'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure PostGIS spatial extension is enabled
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 1. States table
    op.create_table(
        'states',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=10), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_states_code', 'states', ['code'], unique=True)
    op.create_index('ix_states_id', 'states', ['id'], unique=False)
    op.create_index('ix_states_name', 'states', ['name'], unique=False)

    # 2. Districts table
    op.create_table(
        'districts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('state_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=10), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['state_id'], ['states.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_districts_id', 'districts', ['id'], unique=False)
    op.create_index('ix_districts_name', 'districts', ['name'], unique=False)
    op.create_index('ix_districts_state_id', 'districts', ['state_id'], unique=False)

    # 3. Talukas table
    op.create_table(
        'talukas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('district_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=10), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['district_id'], ['districts.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_talukas_district_id', 'talukas', ['district_id'], unique=False)
    op.create_index('ix_talukas_id', 'talukas', ['id'], unique=False)
    op.create_index('ix_talukas_name', 'talukas', ['name'], unique=False)

    # 4. Villages table
    op.create_table(
        'villages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('taluka_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=10), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['taluka_id'], ['talukas.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_villages_id', 'villages', ['id'], unique=False)
    op.create_index('ix_villages_name', 'villages', ['name'], unique=False)
    op.create_index('ix_villages_taluka_id', 'villages', ['taluka_id'], unique=False)

    # 5. Farmers table
    op.create_table(
        'farmers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('farmer_code', sa.String(length=50), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('mobile_number', sa.String(length=20), nullable=True),
        sa.Column('preferred_language', sa.String(length=10), server_default='mr', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_farmers_farmer_code', 'farmers', ['farmer_code'], unique=True)
    op.create_index('ix_farmers_full_name', 'farmers', ['full_name'], unique=False)
    op.create_index('ix_farmers_id', 'farmers', ['id'], unique=False)

    # 6. Fields table with PostGIS geometry
    op.create_table(
        'fields',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('farmer_id', sa.Integer(), nullable=True),
        sa.Column('village_id', sa.Integer(), nullable=False),
        sa.Column('gat_no', sa.String(length=50), nullable=False),
        sa.Column('area', sa.Float(), nullable=True),
        sa.Column('area_unit', sa.String(length=20), server_default='hectare', nullable=False),
        sa.Column('geometry', geoalchemy2.types.Geometry(geometry_type='MULTIPOLYGON', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=True),
        sa.Column('is_demo', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['farmer_id'], ['farmers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['village_id'], ['villages.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('village_id', 'gat_no', name='uq_field_village_gat')
    )
    op.create_index('ix_fields_farmer_id', 'fields', ['farmer_id'], unique=False)
    op.create_index('ix_fields_gat_no', 'fields', ['gat_no'], unique=False)
    op.create_index('ix_fields_id', 'fields', ['id'], unique=False)
    op.create_index('ix_fields_village_gat', 'fields', ['village_id', 'gat_no'], unique=False)
    op.create_index('ix_fields_village_id', 'fields', ['village_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_fields_village_id', table_name='fields')
    op.drop_index('ix_fields_village_gat', table_name='fields')
    op.drop_index('ix_fields_id', table_name='fields')
    op.drop_index('ix_fields_gat_no', table_name='fields')
    op.drop_index('ix_fields_farmer_id', table_name='fields')
    op.drop_table('fields')

    op.drop_index('ix_farmers_id', table_name='farmers')
    op.drop_index('ix_farmers_full_name', table_name='farmers')
    op.drop_index('ix_farmers_farmer_code', table_name='farmers')
    op.drop_table('farmers')

    op.drop_index('ix_villages_taluka_id', table_name='villages')
    op.drop_index('ix_villages_name', table_name='villages')
    op.drop_index('ix_villages_id', table_name='villages')
    op.drop_table('villages')

    op.drop_index('ix_talukas_name', table_name='talukas')
    op.drop_index('ix_talukas_id', table_name='talukas')
    op.drop_index('ix_talukas_district_id', table_name='talukas')
    op.drop_table('talukas')

    op.drop_index('ix_districts_state_id', table_name='districts')
    op.drop_index('ix_districts_name', table_name='districts')
    op.drop_index('ix_districts_id', table_name='districts')
    op.drop_table('districts')

    op.drop_index('ix_states_name', table_name='states')
    op.drop_index('ix_states_id', table_name='states')
    op.drop_index('ix_states_code', table_name='states')
    op.drop_table('states')
