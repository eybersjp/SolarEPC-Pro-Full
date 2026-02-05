# Energy Estimation Service (PVWatts Integration)

## Objective

Integrate PVWatts API for energy estimation with caching, retry logic, and graceful degradation.

## Scope

**In Scope:**
- `EnergyEstimationService` with PVWatts API client
- Async Celery task for API calls
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)
- Hash-based cache invalidation (SHA256 of energy parameters)
- Graceful degradation: allow proposals without energy data if API fails
- API endpoint: `GET /api/site-designs/{id}/energy-estimate`
- Task status polling: `GET /api/tasks/{task_id}/status`

**Out of Scope:**
- Custom energy simulation (using PVWatts only)
- Shading loss estimation (Phase 2)
- Hourly simulation (PVWatts provides monthly data)

## Acceptance Criteria

- [ ] EnergyEstimationService.estimate_energy_async() triggers Celery task
- [ ] Celery task calls PVWatts API with system parameters (capacity, lat/long, azimuth, tilt, losses)
- [ ] Retry logic: 3 attempts with exponential backoff
- [ ] On success: Store results in energy_estimates with status="completed"
- [ ] On failure: Store error with status="failed", allow proposal generation to proceed
- [ ] Hash-based cache invalidation: compute hash from energy parameters, invalidate only when hash changes
- [ ] Cached results returned immediately on subsequent loads
- [ ] Frontend can poll task status and display results when ready
- [ ] Manual retry available if estimation fails
- [ ] Unit tests for service, Celery task, and retry logic
- [ ] Integration tests with PVWatts API (use test API key)

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: EnergyEstimationService, PVWatts Integration, Cache Invalidation
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 4 (View Detailed Results)

## Dependencies

- Ticket: SiteDesign Service & CRUD API
- Ticket: Auto-Placement Algorithm & Hybrid Execution (provides total_modules for capacity calculation)