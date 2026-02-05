# Equipment Library Service & API

## Objective

Implement equipment library service and API endpoints for managing PV modules and inverters with tenant isolation.

## Scope

**In Scope:**
- `EquipmentLibraryService` with CRUD operations
- Tenant isolation: filter by `(is_global=True OR tenant_id=current_tenant)`
- Search and filtering capabilities
- API endpoints: GET/POST for modules and inverters
- Pydantic schemas for validation
- Service-level security enforcement

**Out of Scope:**
- Frontend UI (separate ticket)
- Equipment specification validation (basic validation only)
- Import from external databases (future enhancement)

## Acceptance Criteria

- [ ] EquipmentLibraryService implemented following existing service pattern
- [ ] Tenant isolation enforced in all queries
- [ ] API endpoints: `GET /api/equipment/modules`, `POST /api/equipment/modules`, `GET /api/equipment/inverters`, `POST /api/equipment/inverters`
- [ ] Search by manufacturer, model, wattage
- [ ] Global equipment (is_global=True) visible to all tenants
- [ ] Tenant-specific equipment (is_global=False) visible only to owning tenant
- [ ] Audit logging for equipment creation
- [ ] Unit tests for service and API

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: EquipmentLibraryService, Tenant Isolation
- `file:backend/app/services/pv_design.py` - Service pattern reference
- `file:backend/app/core/security.py` - Auth/tenant verification

## Dependencies

- Ticket: Database Schema & Equipment Library Setup