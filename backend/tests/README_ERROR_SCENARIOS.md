# Backend Error Scenario Tests

This directory contains integration tests specifically designed to validate the system's resilience against various failure modes.

## Test File: `test_integration_error_scenarios.py`

This file covers the following error domains:

### 1. PVWatts API Failures (`TestPVWattsAPIFailures`)

- **Timeout**: Simulates network timeouts when contacting NREL APIs.
- **Rate Limit (429)**: Verifies handling of "Too Many Requests" responses.
- **Service Unavailable (503)**: Verifies handling of server-side errors.
- **Malformed JSON**: Checks behavior when API returns invalid JSON.
- **Partial Data**: Verifies graceful degradation when response is missing specific fields.
- **Connection Error**: Tests resilience against network connectivity issues.

### 2. Geometry Validation (`TestInvalidGeometryHandling`)

- **Self-Intersection**: validates that bowtie/self-crossing polygons are rejected.
- **Open Polygons**: Ensures polygons are strictly closed loops.
- **Invalid Structure**: Checks against malformed GeoJSON (e.g., Point instead of Polygon, MultiPolygon).
- **Coordinate Bounds**: Verifies coordinates are within valid WGS84 ranges.
- **Holes in Polygons**: Verifies that placement algorithm respects inner rings.
- **Degenerate Polygons**: Handles zero-area or collinear geometries.

### 3. Placement Algorithm Edge Cases (`TestPlacementAlgorithmEdgeCases`)

- **Setback Constraints**: Tests scenarios where setbacks leave no usable area.
- **Empty Boundaries**: Handles zero-area or effectively empty geometries.
- **Exclusion Zones**: Verifies that exclusion zones correctly prevent module placement.

### 4. Placement Timeout and Async Scenarios (`TestPlacementTimeoutScenarios`)

- **Execution Timeout**: Verifies handling of `TimeLimitExceeded` in async tasks.
- **Task Cancellation**: Ensures system state is consistent when tasks are revoked.
- **Large Site Performance**: Simulates high module counts and verifies async completion.
- **Transient Failures**: Verifies retry mechanism for placement calculations.

### 5. Proposal Generation Errors (`TestProposalGenerationErrors`)

- **Missing Data**: Ensures PDF generation proceeds gracefully even if energy or financial data is missing.
- **Rendering Failures**: Tests error handling during PDF rendering (WeasyPrint) or chart generation (Matplotlib).
- **Missing Assets**: Verifies behavior when CSS files or specific fonts are missing.
- **Storage Failures**: Ensures appropriate exceptions are raised if S3/storage backend is down.
- **Template Errors**: Handles Jinja2 rendering exceptions.

### 6. Retry Logic and Exponential Backoff (`TestRetryLogicAndBackoff`)

- **Backoff Timing**: Verifies that retry intervals follow an exponential pattern.
- **Retry Count**: Ensures `estimate.retry_count` is correctly incremented and tracked.
- **Successful Retry**: Verifies system completes successfully after transient API failures.
- **Validation Guards**: Ensures non-transient errors (like missing records) do NOT trigger retries.

### 7. Concurrent Design Updates (`TestConcurrentDesignUpdates`)

- **Optimistic Locking**: Documents and verifies the "last-write-wins" behavior.
- **Concurrent Tasks**: Verifies that simultaneous placement/proposal tasks don't deadlock.
- **Idempotency**: Ensures duplicate requests (e.g., energy estimation) are handled gracefully (via parameter hashing).

## Running the Tests

To run these specific tests:

```bash
pytest backend/tests/test_integration_error_scenarios.py -v
```

To run all integration tests:

```bash
pytest -m integration
```

### Filtering by Marker

- Run concurrency tests: `pytest -m concurrency`
- Run retry logic tests: `pytest -m retry`
- Run timeout-sensitive tests: `pytest -m slow`
