# Auto-Save & Sync State Management

## Objective

Implement auto-save with sync state tracking, retry logic, and data loss prevention.

## Scope

**In Scope:**
- Sync state tracking in Zustand: pending, syncing, synced, failed
- Immediate save for critical operations (boundary/exclusion drawing)
- Debounced save for settings changes (30 seconds)
- Automatic retry for failed syncs (3 attempts with backoff)
- Unsaved changes warning (beforeunload handler)
- Auto-save indicator in toolbar ("Saving...", "Auto-saved 2 min ago")
- Failed sync notification with manual retry option

**Out of Scope:**
- Conflict resolution for multi-user editing (Phase 2)
- Offline mode (future)
- Change history/undo (future)

## Acceptance Criteria

- [ ] Zustand store tracks sync state for each change type (geometry, settings, equipment)
- [ ] Critical operations (boundary, exclusion) save immediately via React Query mutation
- [ ] Settings changes debounced to 30 seconds before saving
- [ ] Failed syncs automatically retry (3 attempts with exponential backoff: 1s, 2s, 4s)
- [ ] Auto-save indicator shows current state: "Saving...", "Auto-saved X min ago", "Failed to save"
- [ ] beforeunload handler shows warning if changes are "pending" or "failed"
- [ ] Toast notification for failed syncs: "Failed to save changes. Retrying..."
- [ ] Manual retry button if all automatic retries fail
- [ ] Sync state resets to "synced" after successful save
- [ ] Unit tests for sync state machine and retry logic

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: Optimistic Updates, Sync State Tracking, Auto-Save Strategy
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 6 (Save & Version Management)

## Dependencies

- Ticket: Design Canvas Page & Routing
- Ticket: SiteDesign Service & CRUD API (provides save endpoints)