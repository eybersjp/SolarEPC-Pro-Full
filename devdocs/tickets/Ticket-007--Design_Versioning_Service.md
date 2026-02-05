# Design Versioning Service

## Objective

Implement design versioning with immutable snapshots for version management and comparison.

## Scope

**In Scope:**
- `DesignVersionService` with snapshot creation and restoration
- Full state snapshots stored in JSONB (site_boundary, exclusion_zones, module_placements, settings, results)
- API endpoints: list versions, create version, restore from version
- Version metadata: name, notes, created_by, created_at

**Out of Scope:**
- Visual comparison UI (Phase 2)
- Diff-based versioning (using full snapshots)
- Version limits or cleanup (unlimited versions for Phase 1)

## Acceptance Criteria

- [ ] DesignVersionService.create_version() creates immutable snapshot
- [ ] Snapshot includes: all geometric data, placement settings, calculated results
- [ ] DesignVersionService.list_versions() returns all versions for a design
- [ ] DesignVersionService.restore_from_version() loads version data into current design
- [ ] API endpoints: `GET /api/site-designs/{id}/versions`, `POST /api/site-designs/{id}/versions`, `POST /api/site-designs/{id}/restore/{version_id}`
- [ ] Audit logging for version creation
- [ ] Restored designs trigger recalculation of energy/financials if parameters changed
- [ ] Unit tests for versioning logic

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: DesignVersionService
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 6 (Save & Version Management)

## Dependencies

- Ticket: SiteDesign Service & CRUD API