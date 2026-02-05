# Database Schema & Equipment Library Setup

## Objective

Create database schema for all new entities and seed equipment library with common PV modules and inverters.

## Scope

**In Scope:**
- Alembic migration for new tables: `site_designs`, `design_versions`, `equipment_modules`, `equipment_inverters`, `energy_estimates`, `financial_analyses`
- SQLAlchemy models in `file:backend/app/models/models.py`
- Seed script for global equipment library (is_global=True)
- Database indexes for performance (tenant_id, is_global, equipment lookups)

**Out of Scope:**
- Service layer implementation (separate ticket)
- API endpoints (separate ticket)
- Frontend integration

## Acceptance Criteria

- [ ] All 6 new tables created via Alembic migration
- [ ] Models match Tech Plan schema exactly (including equipment_module_id, equipment_inverter_id, tilt_deg, parameter_hash, status columns)
- [ ] Equipment library seeded with at least 10 common modules and 5 common inverters (is_global=True)
- [ ] Relationships defined: Tender→SiteDesign, SiteDesign→Equipment, SiteDesign→EnergyEstimate, etc.
- [ ] Migration runs successfully on clean database
- [ ] Backward compatible (no changes to existing tables)

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: Data Model section
- `file:backend/app/models/models.py` - Existing models
- `file:backend/alembic/versions/` - Migration location

## Dependencies

None (foundation ticket)