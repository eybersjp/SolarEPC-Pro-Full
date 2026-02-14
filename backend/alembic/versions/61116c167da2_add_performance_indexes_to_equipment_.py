"""add_performance_indexes_to_equipment_and_designs

Revision ID: 61116c167da2
Revises: 323d4664204e
Create Date: 2026-02-14 17:12:13.955389

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '61116c167da2'
down_revision: Union[str, None] = '323d4664204e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Equipment Module Indexes
    op.create_index('ix_equipment_modules_tenant_id', 'equipment_modules', ['tenant_id'], unique=False)
    op.create_index('ix_equipment_modules_is_global', 'equipment_modules', ['is_global'], unique=False)
    op.create_index('ix_equipment_modules_tenant_active', 'equipment_modules', ['tenant_id', 'is_active'], unique=False)
    op.create_index('ix_equipment_modules_global_active', 'equipment_modules', ['is_global', 'is_active'], unique=False)

    # Equipment Inverter Indexes
    op.create_index('ix_equipment_inverters_tenant_id', 'equipment_inverters', ['tenant_id'], unique=False)
    op.create_index('ix_equipment_inverters_is_global', 'equipment_inverters', ['is_global'], unique=False)
    op.create_index('ix_equipment_inverters_tenant_active', 'equipment_inverters', ['tenant_id', 'is_active'], unique=False)
    op.create_index('ix_equipment_inverters_global_active', 'equipment_inverters', ['is_global', 'is_active'], unique=False)

    # Site Design Indexes
    op.create_index('ix_site_designs_tender_id', 'site_designs', ['tender_id'], unique=False)
    op.create_index('ix_site_designs_module_id', 'site_designs', ['equipment_module_id'], unique=False)
    op.create_index('ix_site_designs_inverter_id', 'site_designs', ['equipment_inverter_id'], unique=False)
    op.create_index('ix_site_designs_created_by', 'site_designs', ['created_by'], unique=False)
    op.create_index('ix_site_designs_tender_created', 'site_designs', ['tender_id', 'created_at'], unique=False)

    # Energy Estimate Indexes
    op.create_index('ix_energy_estimates_parameter_hash', 'energy_estimates', ['parameter_hash'], unique=True)
    op.create_index('ix_energy_estimates_status', 'energy_estimates', ['status'], unique=False)

    # Design Version Indexes
    op.create_index('ix_design_versions_design_id', 'design_versions', ['site_design_id'], unique=False)
    op.create_index('ix_design_versions_design_created', 'design_versions', ['site_design_id', 'created_at'], unique=False)


def downgrade() -> None:
    # Drop Design Version Indexes
    op.drop_index('ix_design_versions_design_created', table_name='design_versions')
    op.drop_index('ix_design_versions_design_id', table_name='design_versions')

    # Drop Energy Estimate Indexes
    op.drop_index('ix_energy_estimates_status', table_name='energy_estimates')
    op.drop_index('ix_energy_estimates_parameter_hash', table_name='energy_estimates')

    # Drop Site Design Indexes
    op.drop_index('ix_site_designs_tender_created', table_name='site_designs')
    op.drop_index('ix_site_designs_created_by', table_name='site_designs')
    op.drop_index('ix_site_designs_inverter_id', table_name='site_designs')
    op.drop_index('ix_site_designs_module_id', table_name='site_designs')
    op.drop_index('ix_site_designs_tender_id', table_name='site_designs')

    # Drop Equipment Inverter Indexes
    op.drop_index('ix_equipment_inverters_global_active', table_name='equipment_inverters')
    op.drop_index('ix_equipment_inverters_tenant_active', table_name='equipment_inverters')
    op.drop_index('ix_equipment_inverters_is_global', table_name='equipment_inverters')
    op.drop_index('ix_equipment_inverters_tenant_id', table_name='equipment_inverters')

    # Drop Equipment Module Indexes
    op.drop_index('ix_equipment_modules_global_active', table_name='equipment_modules')
    op.drop_index('ix_equipment_modules_tenant_active', table_name='equipment_modules')
    op.drop_index('ix_equipment_modules_is_global', table_name='equipment_modules')
    op.drop_index('ix_equipment_modules_tenant_id', table_name='equipment_modules')
