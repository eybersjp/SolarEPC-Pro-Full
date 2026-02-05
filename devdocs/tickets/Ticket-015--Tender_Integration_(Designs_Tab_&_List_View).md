# Tender Integration (Designs Tab & List View)

## Objective

Integrate design canvas into tender detail page with Designs tab and design list view.

## Scope

**In Scope:**
- Add "Designs" tab to tender detail page (alongside Overview, Preconditions, BOQ)
- Design list view showing all designs for a tender
- Design cards with: static placeholder thumbnail, name, stats, last modified
- "Create New Design" button
- Empty state for tenders with no designs
- Navigation to design canvas page

**Out of Scope:**
- Real thumbnail generation (Phase 2)
- Design comparison UI (Phase 2)
- Bulk operations (delete multiple, duplicate - future)

## Acceptance Criteria

- [ ] Tender detail page has "Designs" tab (matches wireframe)
- [ ] Clicking "Designs" tab shows design list view
- [ ] Design list fetches via `GET /api/tenders/{id}/site-designs`
- [ ] Each design card displays: static placeholder icon, name, total modules, system size (kWp), last modified date
- [ ] "Create New Design" button creates new design and navigates to canvas
- [ ] Clicking design card navigates to `/tenders/{tenderId}/design/{designId}`
- [ ] Empty state shows "No designs yet" with "Create Your First Design" CTA
- [ ] Design list updates when returning from canvas (React Query cache invalidation)
- [ ] Responsive grid layout (matches wireframe)
- [ ] Unit tests for component

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 1 (Access Design Canvas), Wireframe
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: Tender Integration

## Dependencies

- Ticket: SiteDesign Service & CRUD API (provides design list endpoint)
- Ticket: Design Canvas Page & Routing (navigation target)