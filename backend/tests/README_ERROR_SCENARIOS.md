# Backend Error Scenario Tests

This directory contains integration tests specifically designed to validate the system's resilience against various failure modes.

## Test File: `test_integration_error_scenarios.py`

This file covers the following error domains:

### 1. PVWatts API Failures (`TestPVWattsAPIFailures`)

- **Timeout**: Simulates network timeouts when contacting NREL APIs.
- **Rate Limit (429)**: Verifies handling of "Too Many Requests" responses.
- **Invalid Response**: Checks behavior when API returns malformed or unexpected data.
- **Connection Error**: Tests resilience against network connectivity issues.

### 2. Geometry Validation (`TestInvalidGeometryHandling`)

- **Self-Intersection**: validates that bowtie/self-crossing polygons are rejected.
- **Open Polygons**: Ensures polygons are strictly closed loops.
- **Invalid Structure**: Checks against malformed GeoJSON.
- **Coordinate Bounds**: Verifies coordinates are within valid WGS84 ranges.

### 3. Placement Algorithm Edge Cases (`TestPlacementAlgorithmEdgeCases`)

- **Setback Constraints**: Tests scenarios where setbacks leave no usable area.
- **Empty Boundaries**: Handles zero-area or effectively empty geometries.
- **Exclusion Zones**: Verifies that exclusion zones correctly prevent module placement.

### 4. Proposal Generation Errors (`TestProposalGenerationErrors`)

- **Missing Data**: Ensures PDF generation proceeds gracefully even if energy or financial data is missing.
- **Rendering Failures**: Tests error handling during PDF rendering (WeasyPrint) or chart generation (Matplotlib).

### 5. Data Persistence (`TestDataPersistenceAndRollback`)

- **Transaction Rollback**: explicit tests to ensure database consistency on failure.
- **Concurrent Updates**: validating data integrity under simulated concurrent access.

## Running the Tests

To run these specific tests:

```bash
pytest backend/tests/test_integration_error_scenarios.py -v
```

To run all integration tests:

```bash
pytest -m integration
```
