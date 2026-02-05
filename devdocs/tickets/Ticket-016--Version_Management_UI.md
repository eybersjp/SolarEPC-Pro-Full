# Version Management UI

## Objective

Implement UI for creating, listing, and restoring design versions.

## Scope

**In Scope:**
- "Save as Version" button in toolbar
- Version creation modal (name input, notes textarea)
- Version indicator in toolbar (shows current version name)
- Version list view (accessible from design list or canvas)
- Restore from version functionality
- Toast notifications for version operations

**Out of Scope:**
- Visual diff between versions (Phase 2)
- Version comparison side-by-side (Phase 2)
- Version deletion (versions are immutable)

## Acceptance Criteria

- [ ] "Save as Version" button in toolbar opens modal
- [ ] Modal has: version name input, optional notes textarea, "Save Version" button
- [ ] Clicking "Save Version" calls `POST /api/site-designs/{id}/versions`
- [ ] Toast notification: "Version saved: [name]"
- [ ] Toolbar shows current version name (if design was loaded from version)
- [ ] Version list accessible (e.g., dropdown or separate view)
- [ ] Version list shows: version name, created date, created by, notes preview
- [ ] Clicking version triggers restore: `POST /api/site-designs/{id}/restore/{version_id}`
- [ ] Restore confirmation modal: "Restore this version? Unsaved changes will be lost."
- [ ] After restore, canvas reloads with version data
- [ ] Unit tests for version UI components

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: DesignVersionService
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 6 (Save & Version Management), Flow 7 (Switch Between Designs)

## Dependencies

- Ticket: Design Canvas Page & Routing
- Ticket: Design Versioning Service (provides API endpoints)