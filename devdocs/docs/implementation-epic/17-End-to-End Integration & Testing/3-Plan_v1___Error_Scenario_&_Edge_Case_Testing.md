I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase has established robust testing infrastructure with real database sessions for backend integration tests and MSW-based mocking for frontend tests. Existing patterns include retry logic with exponential backoff (1s, 2s, 4s), sync state management ('pending' → 'syncing' → 'synced'/'failed'), and graceful degradation for missing data. The backend services handle errors through Celery retry mechanisms and status tracking, while frontend hooks use React Query's retry configuration with optimistic updates and rollback capabilities.

## Approach

Create comprehensive error scenario tests covering both backend and frontend layers. Backend tests will extend the existing `test_energy_estimation_integration.py` pattern with real SQLite database sessions to test PVWatts failures, invalid geometries, placement edge cases, and PDF generation errors. Frontend tests will leverage MSW handlers to simulate network failures, verify retry logic with exponential backoff, test sync state transitions, and validate graceful degradation. All tests will verify data persistence, error recovery, and user feedback mechanisms.

## Implementation Steps

### Backend Error Scenario Tests

**1. Create `file:backend/tests/test_integration_error_scenarios.py`**

Set up test infrastructure following the pattern from `file:backend/tests/test_energy_estimation_integration.py`:

- Add `db_session` fixture using real SQLite database with `create_engine` and `sessionmaker`
- Create `error_test_context` fixture that sets up: Tenant → User → Tender → Equipment (Module, Inverter) → SiteDesign
- Use `@pytest.mark.integration` decorator for all test classes
- Import required services: `EnergyEstimationService`, `PlacementAlgorithmService`, `ProposalService`, `SiteDesignService`
- Import models: `SiteDesign`, `EnergyEstimate`, `FinancialAnalysis`, `Tender`, `EquipmentModule`, `EquipmentInverter`

**2. PVWatts API Failure Tests**

Implement test class `TestPVWattsAPIFailures`:

- **Test timeout scenario**: Mock `httpx.get` to raise `httpx.TimeoutException`, verify `EnergyEstimate.status` transitions to "failed", check `error_message` contains "Timeout", validate retry count increments (0 → 1 → 2 → 3)
- **Test rate limit (429)**: Mock response with `status_code=429`, verify retry mechanism triggers 3 times with exponential backoff, check final status is "failed" with "Too Many Requests" in error message
- **Test invalid response**: Mock response with malformed JSON or missing `outputs` field, verify service handles gracefully and sets appropriate error message
- **Test network error**: Mock `httpx.get` to raise `httpx.ConnectError`, verify retry logic and final failure state
- Use pattern from `file:backend/tests/test_energy_estimation_integration.py` lines 180-238 for mocking and task execution

**3. Invalid Polygon Geometry Tests**

Implement test class `TestInvalidGeometryHandling`:

- **Test self-intersecting polygon**: Create GeoJSON with coordinates that cross themselves (e.g., bowtie shape), call `SiteDesignService.update()` with invalid boundary, verify validation error from `file:backend/app/utils/geojson_validator.py` is raised, check error message contains "Invalid geometry"
- **Test too few points**: Create polygon with only 2 points (minimum is 4 including closure), verify validation returns `(False, "Polygon must have at least 3 vertices")`
- **Test unclosed polygon**: Create polygon where first and last coordinates don't match, verify error message "Polygon must be closed"
- **Test invalid GeoJSON structure**: Send dict with wrong `type` field or missing `coordinates`, verify validation catches structural errors
- **Test out-of-range coordinates**: Use coordinates outside WGS84 bounds (lat > 90 or lon > 180), verify validation error
- Use `validate_geojson_polygon()` from `file:backend/app/utils/geojson_validator.py` for validation checks

**4. Placement Algorithm Edge Cases**

Implement test class `TestPlacementAlgorithmEdgeCases`:

- **Test no modules fit**: Set `edge_setback_m` to 50 meters on a small 10x10m boundary, call `PlacementAlgorithmService.calculate_placement()`, verify result has `total_modules=0` and `stats.error` contains "Setback too large"
- **Test setback too large**: Use setback larger than half the boundary dimensions, verify empty placement area and appropriate error in stats
- **Test empty boundary**: Pass empty polygon or polygon with zero area, verify graceful handling without crash
- **Test exclusion zones covering entire site**: Create exclusion zones that completely overlap the boundary, verify zero modules placed
- **Test extreme module dimensions**: Use unrealistically large module dimensions (e.g., 100m x 100m), verify algorithm handles without error
- Reference `file:backend/app/services/placement_algorithm.py` lines 48-58 for setback handling logic

**5. PDF Generation Failure Tests**

Implement test class `TestProposalGenerationErrors`:

- **Test missing energy data**: Create design without `EnergyEstimate`, call `ProposalService.generate_pdf()`, verify PDF generates with placeholder text (graceful degradation), check audit log records generation
- **Test missing financial data**: Create design without `FinancialAnalysis`, verify proposal still generates with available data
- **Test missing BOM items**: Create design with empty BOQ, verify CSV export returns empty rows with headers only
- **Test WeasyPrint failure**: Mock `weasyprint.HTML.write_pdf()` to raise exception, verify error is logged and appropriate error message returned
- **Test template rendering error**: Mock Jinja2 template to raise `TemplateNotFound`, verify service handles gracefully
- **Test chart generation failure**: Mock `matplotlib.pyplot.savefig()` to raise exception, verify proposal generates without chart (chart_b64 is None)
- Reference `file:backend/app/services/proposal.py` lines 37-141 for PDF generation flow and error handling

**6. Data Persistence and Rollback Tests**

Implement test class `TestDataPersistenceAndRollback`:

- **Test transaction rollback on error**: Start update operation, trigger exception mid-transaction, verify database rolls back to previous state
- **Test concurrent updates**: Create two sessions updating same design simultaneously, verify optimistic locking or last-write-wins behavior
- **Test orphaned records cleanup**: Delete design, verify related `EnergyEstimate` and `FinancialAnalysis` records are handled (cascade or manual cleanup)

### Frontend Error Scenario Tests

**7. Create `file:frontend/src/components/DesignCanvas/__tests__/errorHandling.test.tsx`**

Set up test infrastructure:

- Import testing utilities from `file:frontend/src/test/utils.tsx` and `file:frontend/src/test/setup.tsx`
- Import MSW handlers from `file:frontend/src/test/mocks/handlers.ts`
- Import store: `useDesignCanvasStore` from `file:frontend/src/stores/useDesignCanvasStore.ts`
- Import hooks: `useSiteDesigns`, `useEquipment`, `useProposal` from respective files
- Create `QueryClient` with `retry: false` for controlled testing
- Reset store state in `beforeEach` hook

**8. Network Failure During Save Operations**

Implement test suite `describe('Network Failures During Save')`:

- **Test PUT request failure**: Use MSW to return 500 error for `PUT /api/site-designs/:id`, trigger `useUpdateSiteDesignMutation`, verify syncState transitions: 'syncing' → 'failed', check retryCount increments, verify optimistic update rolls back
- **Test network timeout**: Mock request to hang indefinitely, verify timeout handling and error state
- **Test intermittent failures**: Configure MSW to fail first 2 attempts then succeed on 3rd, verify retry logic works and final state is 'synced'
- Reference `file:frontend/src/hooks/useSiteDesigns.ts` lines 64-127 for mutation logic

**9. Retry Logic with Exponential Backoff**

Implement test suite `describe('Exponential Backoff Retry Logic')`:

- **Test retry delays**: Mock API to fail 3 times, use `vi.useFakeTimers()`, verify delays are exactly 1000ms, 2000ms, 4000ms between attempts, check `retryCount` state updates (0 → 1 → 2 → 3)
- **Test max retries reached**: Verify after 3 failed attempts, mutation stops retrying and shows final error message "Failed to save changes after 3 attempts"
- **Test successful retry**: Configure to fail twice then succeed, verify syncState becomes 'synced' after successful retry
- **Test retry count reset**: After successful save, verify `retryCount` resets to 0
- Use pattern from `file:frontend/src/hooks/useSiteDesigns.ts` lines 76-82 for retry configuration

**10. Graceful Degradation Tests**

Implement test suite `describe('Graceful Degradation')`:

- **Test proposal without energy data**: Mock `GET /api/site-designs/:id/energy-estimate` to return 404, trigger proposal generation, verify it proceeds without energy data, check UI shows appropriate message
- **Test proposal without financials**: Mock financial analysis endpoint to fail, verify proposal still generates with available data
- **Test partial energy data**: Return energy estimate with incomplete `monthly_energy_kwh` (only 6 months), verify chart generation handles gracefully
- **Test zero capacity design**: Use `mockSiteDesignZeroCapacity` fixture, verify energy estimation is skipped with appropriate warning
- Reference `file:frontend/src/test/fixtures/siteDesign.ts` for mock data structures

**11. Unsaved Changes Warning Tests**

Implement test suite `describe('Unsaved Changes Warnings')`:

- **Test beforeunload handler**: Set syncState to 'pending', trigger `window.beforeunload` event, verify event.returnValue is set to prevent navigation
- **Test navigation blocking**: With unsaved changes, attempt to navigate away, verify confirmation dialog appears
- **Test clean navigation**: With syncState 'synced', verify navigation proceeds without warning
- **Test manual retry after failure**: Set syncState to 'failed', click retry button, verify mutation retries with fresh attempt

**12. Sync State Transition Tests**

Implement test suite `describe('Sync State Transitions')`:

- **Test complete transition flow**: Trigger update mutation, verify state transitions: 'synced' → 'pending' → 'syncing' → 'synced', check `lastSyncedAt` timestamp updates
- **Test failure transition**: Mock API failure, verify: 'synced' → 'pending' → 'syncing' → 'failed', check error toast appears
- **Test retry from failed state**: From 'failed' state, trigger retry, verify: 'failed' → 'syncing' → 'synced' (on success)
- **Test concurrent mutations**: Trigger multiple updates rapidly, verify state machine handles correctly without race conditions
- Reference `file:frontend/src/stores/useDesignCanvasStore.ts` lines 67-74 for state transition logic

**13. Error Recovery Tests**

Implement test suite `describe('Error Recovery Mechanisms')`:

- **Test optimistic update rollback**: Trigger mutation with optimistic update, mock failure, verify UI reverts to previous data from context
- **Test query invalidation after error**: After failed mutation, verify queries are invalidated to refetch fresh data
- **Test error boundary integration**: Wrap component in ErrorBoundary, trigger unhandled error, verify fallback UI renders
- **Test toast notifications**: Verify appropriate toast messages for different error types (network, validation, server error)

**14. MSW Handler Enhancements**

Update `file:frontend/src/test/mocks/handlers.ts`:

- Add handler for simulating network timeouts: `http.put('*/api/site-designs/:id', () => { throw new Error('Network timeout') })`
- Add handler for rate limiting: Return 429 status with retry-after header
- Add handler for validation errors: Return 422 with detailed error messages
- Add state tracking for retry attempts: Use `testState.putCallCount` pattern from lines 73-81
- Add handler for partial failures: Succeed after N attempts based on query parameter

### Integration and Validation

**15. Cross-Layer Error Propagation Tests**

Create tests verifying error propagation from backend to frontend:

- **Test API error response format**: Verify backend returns consistent error structure (status, message, details)
- **Test frontend error parsing**: Verify hooks correctly parse and display backend error messages
- **Test error logging**: Verify errors are logged to audit service on backend and console on frontend

**16. Documentation and Test Coverage**

- Add docstrings to all test functions explaining scenario and expected behavior
- Add comments for complex mock setups and state transitions
- Create `file:backend/tests/README_ERROR_SCENARIOS.md` documenting error test patterns
- Create `file:frontend/src/components/DesignCanvas/__tests__/README_ERROR_TESTING.md` with frontend error testing guide
- Verify test coverage for error paths reaches >80% using pytest-cov and vitest coverage

### Test Execution and Validation

**17. Run and Validate Tests**

- Execute backend tests: `pytest backend/tests/test_integration_error_scenarios.py -v -m integration`
- Execute frontend tests: `npm test -- errorHandling.test.tsx`
- Verify all sync state transitions work correctly
- Confirm retry logic executes with correct delays (1s, 2s, 4s)
- Validate graceful degradation scenarios complete without crashes
- Check error messages are user-friendly and actionable

This project uses a task-tracking convention. After completing all changes, create the file `~/.traycer/yolo_artifacts/5ea8a46e-0a24-4b00-a479-9dd170874a08.json` with content `{}`. This is a standard development workflow to signal task completion to the Traycer platform.