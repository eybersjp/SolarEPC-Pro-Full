# SiteDesign Service & CRUD API

## Objective

Implement core SiteDesign service with CRUD operations, GeoJSON validation, and audit logging.

## Scope

**In Scope:**
- `SiteDesignService` following existing service pattern
- CRUD operations: create, get, update, delete
- GeoJSON validation (backend): closed polygons, ≥3 vertices, no self-intersections, valid coordinates
- Geometric calculations: site area (using Shapely or similar)
- Tenant isolation and audit logging
- API endpoints: GET/POST/PUT/DELETE for site designs
- Pydantic schemas for request/response

**Out of Scope:**
- Auto-placement algorithm (separate ticket)
- Energy estimation (separate ticket)
- Versioning (separate ticket)

## Acceptance Criteria

- [ ] SiteDesignService implemented with methods: create_design, get_design, update_geometry, update_settings, delete_design
- [ ] GeoJSON validation prevents invalid geometries from being saved
- [ ] API endpoints: `GET /api/tenders/{id}/site-designs`, `POST /api/tenders/{id}/site-designs`, `GET /api/site-designs/{id}`, `PUT /api/site-designs/{id}`, `DELETE /api/site-designs/{id}`
- [ ] Tenant isolation enforced (designs accessible only to owning tenant)
- [ ] Audit logging for all mutations
- [ ] Site area calculated and stored (site_area_sqm)
- [ ] Equipment references validated (equipment_module_id, equipment_inverter_id exist)
- [ ] Unit tests for service and API

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: SiteDesignService, GeoJSON Validation
- `file:backend/app/services/tender.py` - Service pattern reference
- `file:backend/app/services/audit.py` - Audit logging pattern

## Dependencies

- Ticket: Database Schema & Equipment Library Setup
- Ticket: Equipment Library Service & API