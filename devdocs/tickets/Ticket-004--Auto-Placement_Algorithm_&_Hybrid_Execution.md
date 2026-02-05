# Auto-Placement Algorithm & Hybrid Execution

## Objective

Implement grid fill auto-placement algorithm with hybrid sync/async execution based on estimated module count.

## Scope

**In Scope:**
- `PlacementAlgorithmService` with grid fill algorithm
- Hybrid execution logic: sync for <1,000 modules, async for ≥1,000
- Module count estimation from boundary area
- Exclusion zone handling
- Orientation and azimuth application
- GeoJSON output (module positions as Features)
- Celery task for async execution
- API action endpoint: `POST /api/site-designs/{id}/recalculate`

**Out of Scope:**
- Shading analysis (Phase 2)
- Terrain optimization (Phase 2)
- Layout optimization suggestions (Phase 3)

## Acceptance Criteria

- [ ] PlacementAlgorithmService.calculate_placement() implements basic grid fill
- [ ] Algorithm respects: edge setbacks, row spacing, exclusion zones
- [ ] Supports portrait/landscape orientation and azimuth rotation
- [ ] Hybrid execution: estimate module count from boundary area, choose sync or async
- [ ] Sync execution completes in <2 seconds for sites with <1,000 modules
- [ ] Async execution via Celery task for larger sites
- [ ] API endpoint returns: immediate results (sync) or task_id (async)
- [ ] Module positions stored as GeoJSON Features in site_designs.module_placements
- [ ] Total module count and system size (kWp) calculated and stored
- [ ] Unit tests for algorithm (various boundary shapes, exclusions)
- [ ] Integration tests for sync and async paths

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: PlacementAlgorithmService, Hybrid Sync/Async
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 2 (Auto-Placement), Flow 3 (Recalculate)

## Dependencies

- Ticket: SiteDesign Service & CRUD API