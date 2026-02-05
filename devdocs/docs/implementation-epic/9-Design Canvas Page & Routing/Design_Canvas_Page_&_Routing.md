# Design Canvas Page & Routing

## Objective

Create design canvas page with routing, layout structure, and state management setup.

## Scope

**In Scope:**
- Next.js page: `/tenders/[tenderId]/design/[designId]`
- Page layout: toolbar, map area, floating palette, right panel, bottom sheet
- Zustand store setup: `useDesignCanvasStore` with sync state tracking
- React Query hooks: `useDesignQuery`, `useUpdateDesignMutation`
- Loading states and error boundaries
- Navigation: back to designs, unsaved changes warning

**Out of Scope:**
- Map implementation (separate ticket)
- Drawing tools (separate ticket)
- Equipment/settings panels (separate ticket)
- Results display (separate ticket)

## Acceptance Criteria

- [ ] Page route created: `/tenders/[tenderId]/design/[designId]`
- [ ] Page layout structure matches wireframe in Core Flows
- [ ] Zustand store tracks: drawing mode, tool selection, sync state (pending/syncing/synced/failed)
- [ ] React Query hooks fetch design data and handle mutations
- [ ] Optimistic updates with sync state tracking
- [ ] beforeunload handler warns about unsaved changes
- [ ] Navigation back to designs list works
- [ ] Loading states for initial page load
- [ ] Error boundary catches and displays errors
- [ ] Responsive layout (desktop only for Phase 1)

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: Frontend Components, Zustand State Management
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Wireframes, Flow 1 (Access Design Canvas)

## Dependencies

- Ticket: SiteDesign Service & CRUD API (provides API endpoints)