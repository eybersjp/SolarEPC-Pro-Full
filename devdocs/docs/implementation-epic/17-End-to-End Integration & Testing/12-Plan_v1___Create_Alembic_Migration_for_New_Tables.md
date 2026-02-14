I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The database models have been successfully implemented with all required enums (`SiteType`, `ModuleOrientation`, `EnergyEstimateStatus`) and models (`EquipmentModule`, `EquipmentInverter`, `SiteDesign`, `DesignVersion`, `EnergyEstimate`, `FinancialAnalysis`). The base migration `01b88ee7b6fa_add_equipment_library_and_site_designs.py` already creates all 6 tables with proper foreign key constraints. However, explicit performance indexes for `tenant_id`, `is_global`, `tender_id`, equipment IDs, and `parameter_hash` are missing from the existing migrations.

## Approach

Since the base tables already exist, create a new Alembic migration to add performance indexes that optimize common query patterns: filtering equipment by tenant/global status, listing designs by tender, and cache lookups for energy estimates. This follows the incremental migration pattern already established in the project (as seen with migrations `aa748ce719fc` and `323d4664204e`). The migration will include proper upgrade/downgrade functions and be tested for idempotency.

## Implementation Steps

### 1. Create New Performance Indexes Migration

Navigate to the backend directory and generate a new migration file:

```bash
cd backend
alembic revision -m "add_performance_indexes_to_equipment_and_designs"
```

This creates a new migration file in `file:backend/alembic/versions/` with the naming pattern `<revision_id>_add_performance_indexes_to_equipment_and_designs.py`.

### 2. Implement Index Creation in upgrade() Function

In the generated migration file, implement the `upgrade()` function to create the following indexes:

**Equipment Module Indexes:**
- Index on `tenant_id` for filtering tenant-specific modules
- Index on `is_global` for filtering global library modules
- Composite index on `(tenant_id, is_active)` for active equipment queries
- Composite index on `(is_global, is_active)` for global active equipment

**Equipment Inverter Indexes:**
- Index on `tenant_id` for filtering tenant-specific inverters
- Index on `is_global` for filtering global library inverters
- Composite index on `(tenant_id, is_active)` for active equipment queries
- Composite index on `(is_global, is_active)` for global active equipment

**Site Design Indexes:**
- Index on `tender_id` for listing all designs for a tender
- Index on `equipment_module_id` for finding designs using specific modules
- Index on `equipment_inverter_id` for finding designs using specific inverters
- Index on `created_by` for user activity tracking
- Composite index on `(tender_id, created_at)` for chronological design listing

**Energy Estimate Indexes:**
- Unique index on `parameter_hash` for fast cache lookups
- Index on `status` for filtering by calculation status

**Design Version Indexes:**
- Index on `site_design_id` for version history queries
- Composite index on `(site_design_id, created_at)` for chronological version listing

Use SQLAlchemy's `op.create_index()` with appropriate naming conventions (e.g., `ix_equipment_modules_tenant_id`).

### 3. Implement Index Removal in downgrade() Function

In the same migration file, implement the `downgrade()` function to drop all indexes created in the upgrade function using `op.drop_index()`. Ensure the order is reversed from the upgrade function to handle any dependencies.

### 4. Verify Migration Syntax

Review the generated migration file to ensure:
- Proper imports: `from alembic import op` and `import sqlalchemy as sa`
- Correct revision identifiers (revision, down_revision pointing to `323d4664204e`)
- No syntax errors in index creation statements
- Index names follow PostgreSQL naming conventions (max 63 characters)

### 5. Test Migration on Development Database

Execute the following test sequence:

**Initial State Check:**
```bash
alembic current
```
Verify current revision is `323d4664204e`.

**Apply Migration:**
```bash
alembic upgrade head
```
Monitor output for successful index creation. No errors should occur.

**Verify Indexes Created:**
Connect to PostgreSQL and run:
```sql
\d equipment_modules
\d equipment_inverters
\d site_designs
\d energy_estimates
\d design_versions
```
Confirm all indexes are present in the table definitions.

**Test Rollback:**
```bash
alembic downgrade -1
```
Verify indexes are dropped without errors.

**Test Re-application:**
```bash
alembic upgrade head
```
Confirm migration is idempotent and indexes are recreated successfully.

### 6. Validate Index Performance Impact

Run sample queries to verify index usage:

```sql
EXPLAIN ANALYZE SELECT * FROM equipment_modules WHERE tenant_id = '<uuid>' AND is_active = true;
EXPLAIN ANALYZE SELECT * FROM site_designs WHERE tender_id = '<uuid>' ORDER BY created_at DESC;
EXPLAIN ANALYZE SELECT * FROM energy_estimates WHERE parameter_hash = '<hash>';
```

Confirm that PostgreSQL query planner uses the newly created indexes (look for "Index Scan" in EXPLAIN output).

### 7. Update Migration History Documentation

Document the new migration in `file:backend/alembic_history.txt` (if it exists) or project documentation with:
- Migration revision ID
- Purpose: "Add performance indexes for equipment library and site designs"
- Tables affected: equipment_modules, equipment_inverters, site_designs, energy_estimates, design_versions
- Date applied

### 8. Commit Migration File

Add the new migration file to version control:
```bash
git add backend/alembic/versions/<revision_id>_add_performance_indexes_to_equipment_and_designs.py
git commit -m "Add performance indexes for equipment and site design tables"
```

## Migration File Structure Reference

```python
"""add performance indexes to equipment and designs

Revision ID: <generated_id>
Revises: 323d4664204e
Create Date: <timestamp>
"""
from alembic import op
import sqlalchemy as sa

revision = '<generated_id>'
down_revision = '323d4664204e'

def upgrade() -> None:
    # Create indexes using op.create_index()
    # Example: op.create_index('ix_equipment_modules_tenant_id', 'equipment_modules', ['tenant_id'])
    pass

def downgrade() -> None:
    # Drop indexes using op.drop_index()
    # Example: op.drop_index('ix_equipment_modules_tenant_id', 'equipment_modules')
    pass
```

## Verification Checklist

- [ ] Migration file created with correct revision chain
- [ ] All 15+ indexes defined in upgrade() function
- [ ] All indexes removed in downgrade() function
- [ ] Migration applies successfully: `alembic upgrade head`
- [ ] All indexes visible in database schema
- [ ] Migration rolls back successfully: `alembic downgrade -1`
- [ ] Migration re-applies successfully (idempotency test)
- [ ] Query plans show index usage in EXPLAIN ANALYZE
- [ ] No foreign key constraint violations
- [ ] Migration file committed to version control

This project uses a task-tracking convention. After completing all changes, create the file `~/.traycer/yolo_artifacts/e89c60be-104a-400b-9511-29f7aca8bc76.json` with content `{}`. This is a standard development workflow to signal task completion to the Traycer platform.