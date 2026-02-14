"""Add equipment library and site designs

Revision ID: 01b88ee7b6fa
Revises: 
Create Date: 2026-02-05 12:28:36.772691

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '01b88ee7b6fa'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Tenants ---
    op.create_table(
        'tenants',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # --- Users ---
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('firebase_uid', sa.String(length=128), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('role', sa.Enum('ADMIN', 'PM', 'ENGINEER', 'VIEWER', name='userrole'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('firebase_uid')
    )

    # --- Tenders ---
    op.create_table(
        'tenders',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('client_name', sa.String(length=255), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('target_capacity_kw', sa.Float(), nullable=True),
        sa.Column('status', sa.Enum('DRAFT', 'IN_REVIEW', 'SUBMITTED', 'WON', 'LOST', name='tenderstatus'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # --- Preconditions ---
    op.create_table(
        'preconditions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tender_id', sa.UUID(), nullable=False),
        sa.Column('grid_connection', sa.Boolean(), nullable=True),
        sa.Column('land_access', sa.Boolean(), nullable=True),
        sa.Column('permits_cleared', sa.Boolean(), nullable=True),
        sa.Column('financing_confirmed', sa.Boolean(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('go_decision', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['tender_id'], ['tenders.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tender_id')
    )

    # --- Equipment Modules ---
    op.create_table(
        'equipment_modules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=True),
        sa.Column('manufacturer', sa.String(length=255), nullable=False),
        sa.Column('model', sa.String(length=255), nullable=False),
        sa.Column('wattage', sa.Integer(), nullable=False),
        sa.Column('efficiency', sa.Float(), nullable=False),
        sa.Column('length_m', sa.Float(), nullable=False),
        sa.Column('width_m', sa.Float(), nullable=False),
        sa.Column('thickness_m', sa.Float(), nullable=False),
        sa.Column('voc', sa.Float(), nullable=False),
        sa.Column('isc', sa.Float(), nullable=False),
        sa.Column('vmp', sa.Float(), nullable=False),
        sa.Column('imp', sa.Float(), nullable=False),
        sa.Column('is_global', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # --- Equipment Inverters ---
    op.create_table(
        'equipment_inverters',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=True),
        sa.Column('manufacturer', sa.String(length=255), nullable=False),
        sa.Column('model', sa.String(length=255), nullable=False),
        sa.Column('capacity_kw', sa.Float(), nullable=False),
        sa.Column('max_dc_voltage', sa.Float(), nullable=False),
        sa.Column('mppt_voltage_range_min', sa.Float(), nullable=False),
        sa.Column('mppt_voltage_range_max', sa.Float(), nullable=False),
        sa.Column('max_input_current', sa.Float(), nullable=False),
        sa.Column('num_mppt_channels', sa.Integer(), nullable=False),
        sa.Column('is_global', sa.Boolean(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # --- Site Designs ---
    op.create_table(
        'site_designs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tender_id', sa.UUID(), nullable=False),
        sa.Column('pv_design_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('site_type', sa.String(length=50), nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('equipment_module_id', sa.UUID(), nullable=False),
        sa.Column('equipment_inverter_id', sa.UUID(), nullable=False),
        sa.Column('site_boundary', sa.JSON(), nullable=False),
        sa.Column('exclusion_zones', sa.JSON(), nullable=True),
        sa.Column('module_placements', sa.JSON(), nullable=True),
        sa.Column('edge_setback_m', sa.Float(), nullable=True),
        sa.Column('row_spacing_m', sa.Float(), nullable=True),
        sa.Column('module_orientation', sa.String(length=20), nullable=True),
        sa.Column('azimuth_deg', sa.Float(), nullable=True),
        sa.Column('tilt_deg', sa.Float(), nullable=False),
        sa.Column('total_modules', sa.Integer(), nullable=True),
        sa.Column('system_size_kwp', sa.Float(), nullable=True),
        sa.Column('site_area_sqm', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['equipment_inverter_id'], ['equipment_inverters.id'], ),
        sa.ForeignKeyConstraint(['equipment_module_id'], ['equipment_modules.id'], ),
        sa.ForeignKeyConstraint(['tender_id'], ['tenders.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # --- PV Designs (Original) ---
    op.create_table(
        'pv_designs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tender_id', sa.UUID(), nullable=False),
        sa.Column('module_model', sa.String(length=255), nullable=True),
        sa.Column('module_watt', sa.Integer(), nullable=True),
        sa.Column('inverter_model', sa.String(length=255), nullable=True),
        sa.Column('inverter_kw', sa.Integer(), nullable=True),
        sa.Column('strings_per_inverter', sa.Integer(), nullable=True),
        sa.Column('modules_per_string', sa.Integer(), nullable=True),
        sa.Column('dc_ac_ratio', sa.Float(), nullable=True),
        sa.Column('total_modules', sa.Integer(), nullable=True),
        sa.Column('total_capacity_kwp', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tender_id'], ['tenders.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Add FK from SiteDesign to PVDesign now that both exist
    with op.batch_alter_table('site_designs') as batch_op:
        batch_op.create_foreign_key('fk_site_designs_pv_design', 'pv_designs', ['pv_design_id'], ['id'])

    # --- BOQ Items ---
    op.create_table(
        'boq_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tender_id', sa.UUID(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('unit_cost', sa.Float(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=True),
        sa.Column('margin_pct', sa.Float(), nullable=True),
        sa.Column('line_total', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['tender_id'], ['tenders.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # --- Design Versions ---
    op.create_table(
        'design_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('site_design_id', sa.UUID(), nullable=False),
        sa.Column('version_name', sa.String(length=255), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('snapshot_data', sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['site_design_id'], ['site_designs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # --- Energy Estimates ---
    op.create_table(
        'energy_estimates',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('site_design_id', sa.UUID(), nullable=True),
        sa.Column('parameter_hash', sa.String(length=64), nullable=False),
        sa.Column('system_capacity_kw', sa.Float(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('azimuth', sa.Float(), nullable=False),
        sa.Column('tilt', sa.Float(), nullable=False),
        sa.Column('losses_pct', sa.Float(), nullable=True),
        sa.Column('annual_energy_kwh', sa.Float(), nullable=False),
        sa.Column('monthly_energy_kwh', sa.JSON(), nullable=False),
        sa.Column('capacity_factor', sa.Float(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('calculated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['site_design_id'], ['site_designs.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('site_design_id')
    )

    # --- Financial Analyses ---
    op.create_table(
        'financial_analyses',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('site_design_id', sa.UUID(), nullable=True),
        sa.Column('system_cost_usd', sa.Float(), nullable=False),
        sa.Column('electricity_rate_usd_per_kwh', sa.Float(), nullable=False),
        sa.Column('annual_rate_escalation_pct', sa.Float(), nullable=True),
        sa.Column('annual_savings_usd', sa.Float(), nullable=False),
        sa.Column('simple_payback_years', sa.Float(), nullable=False),
        sa.Column('roi_pct', sa.Float(), nullable=False),
        sa.Column('calculated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['site_design_id'], ['site_designs.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('site_design_id')
    )

    # --- Audit Logs ---
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('entity_type', sa.String(length=100), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('old_value', sa.JSON(), nullable=True),
        sa.Column('new_value', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('financial_analyses')
    op.drop_table('energy_estimates')
    op.drop_table('design_versions')
    op.drop_table('boq_items')
    # Drop FK before dropping site_designs
    op.drop_constraint('fk_site_designs_pv_design', 'site_designs', type_='foreignkey')
    op.drop_table('site_designs')
    op.drop_table('pv_designs')
    op.drop_table('equipment_inverters')
    op.drop_table('equipment_modules')
    op.drop_table('preconditions')
    op.drop_table('tenders')
    op.drop_table('users')
    op.drop_table('tenants')
    
    # Drop enums
    sa.Enum(name='userrole').drop(op.get_bind())
    sa.Enum(name='tenderstatus').drop(op.get_bind())
