I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase has a well-structured energy estimation service with hash-based caching, retry logic via Celery tasks, and comprehensive unit tests. The `EnergyEstimate` model supports retry tracking with `retry_count`, `last_retry_at`, `status`, and `error_message` fields. The PVWatts API integration uses `httpx` for HTTP requests with a configurable API key from `settings.PVWATTS_API_KEY`. The existing unit tests mock external dependencies but don't test actual API integration scenarios.

## Approach

Create a new integration test file `test_energy_estimation_integration.py` that performs real PVWatts API calls to validate end-to-end functionality. The tests will use the actual API key from configuration, test different site types and their array_type mappings, verify response parsing and database persistence, and handle edge cases like rate limiting and timeouts. Tests will be marked with `pytest.mark.integration` to allow selective execution and will include comprehensive docstrings documenting setup requirements.

## Implementation Steps

### 1. Create Integration Test File Structure

Create file:backend/tests/test_energy_estimation_integration.py with the following structure:

- Import necessary modules: `pytest`, `httpx`, `uuid`, `time`, `datetime`
- Import application modules: `SessionLocal`, `EnergyEstimate`, `SiteDesign`, `Tender`, `EnergyEstimationService`, `settings`
- Add module-level docstring explaining integration test requirements (API key, network access)
- Add `pytest.mark.integration` decorator to mark all tests as integration tests

### 2. Setup Test Fixtures

Create fixtures for integration testing:

**Database Session Fixture**
- Create `integration_db_session` fixture that yields a real database session
- Use `SessionLocal()` from file:backend/app/core/database.py
- Ensure proper cleanup with `db.close()` in finally block

**Test Data Fixtures**
- Create `test_tender` fixture that creates a real `Tender` record with valid coordinates (e.g., lat=34.0, lon=-118.0 for Los Angeles)
- Create `test_site_design` fixture for each site type (rooftop, ground_mount, carport)
- Set realistic values: `system_size_kwp=10.0`, `tilt_deg=20.0`, `azimuth_deg=180.0`
- Use `db.add()` and `db.commit()` to persist test data
- Implement cleanup in fixture teardown to delete test records

**API Key Validation Fixture**
- Create `validate_api_key` fixture that checks if `settings.PVWATTS_API_KEY` is set and not "DEMO_KEY"
- Skip tests with `pytest.skip()` if API key is not configured
- Add informative skip message about setting `PVWATTS_API_KEY` environment variable

### 3. Test Actual PVWatts API Calls

**Test Basic API Call Success**
- Test name: `test_pvwatts_api_call_success`
- Create `EnergyEstimationService` instance with real database session
- Call `estimate_energy_async()` with test site design ID
- Wait for task completion using polling loop (max 30 seconds, check every 2 seconds)
- Query `EnergyEstimate` record and verify:
  - `status == "completed"`
  - `annual_energy_kwh > 0`
  - `monthly_energy_kwh` is a list/dict with 12 entries
  - `capacity_factor > 0`
  - `error_message is None`

**Test API Response Parsing**
- Test name: `test_api_response_parsing`
- Make direct API call using `httpx.get()` with PVWatts endpoint
- Verify response structure matches expected format:
  - `outputs.ac_annual` exists and is numeric
  - `outputs.ac_monthly` is array of 12 values
  - `outputs.capacity_factor` exists and is between 0 and 1
- Ensure parsing logic in file:backend/app/services/tasks.py handles all fields correctly

### 4. Test Site Type and Array Type Mapping

**Parametrized Test for Site Types**
- Test name: `test_site_type_array_type_mapping`
- Use `@pytest.mark.parametrize` with parameters:
  - `("rooftop", 1)` - fixed roof mount
  - `("ground_mount", 0)` - fixed open rack
  - `("carport", 0)` - approximated as fixed open rack
- For each site type:
  - Create site design with specific `site_type`
  - Trigger energy estimation
  - Verify API call includes correct `array_type` parameter
  - Use `httpx` mock or inspect task parameters to validate mapping

**Test Array Type Impact on Results**
- Test name: `test_array_type_affects_energy_output`
- Create two identical site designs except for site_type (rooftop vs ground_mount)
- Compare energy estimates and verify they differ due to array_type
- Document expected behavior in test docstring

### 5. Test Real Coordinates and Geographic Variations

**Test Multiple Geographic Locations**
- Test name: `test_geographic_location_variations`
- Use `@pytest.mark.parametrize` with different coordinates:
  - Los Angeles: `(34.0, -118.0)`
  - Phoenix: `(33.4, -112.0)`
  - Seattle: `(47.6, -122.3)`
- Verify API accepts all coordinates and returns valid results
- Ensure `monthly_energy_kwh` patterns differ based on location (e.g., Seattle has lower winter production)

**Test Coordinate Edge Cases**
- Test name: `test_coordinate_edge_cases`
- Test with `lat=None, lon=None` - verify graceful handling
- Test with extreme valid coordinates (Alaska, Hawaii)
- Verify error handling for invalid coordinates (out of range)

### 6. Test Monthly Energy Data Structure

**Test Monthly Data Format**
- Test name: `test_monthly_energy_data_structure`
- Trigger energy estimation and wait for completion
- Verify `monthly_energy_kwh` field:
  - Is stored as JSON/JSONB in database
  - Contains exactly 12 entries
  - All values are numeric and positive
  - Sum of monthly values approximately equals annual energy (within tolerance)

**Test Monthly Data Persistence**
- Test name: `test_monthly_data_persistence`
- Create energy estimate and verify monthly data is saved
- Query database in new session to ensure data persists correctly
- Verify JSON serialization/deserialization works properly

### 7. Test API Rate Limiting Scenarios

**Test Rate Limit Handling**
- Test name: `test_api_rate_limit_handling`
- Make multiple rapid API calls (10+ in quick succession)
- Verify system handles 429 status codes gracefully
- Check that retry logic activates and eventually succeeds
- Verify `retry_count` increments appropriately
- Document expected behavior: Celery retry with exponential backoff

**Test Rate Limit Recovery**
- Test name: `test_rate_limit_recovery`
- Simulate rate limit by making many requests
- Wait for rate limit window to reset
- Verify subsequent requests succeed
- Check that `status` transitions from "calculating" to "completed"

### 8. Test Timeout Scenarios

**Test API Timeout Handling**
- Test name: `test_api_timeout_handling`
- Mock slow API response using `httpx` timeout parameter
- Set timeout to 1 second in test (override default 30s)
- Verify timeout exception is caught and handled
- Check that `error_message` contains timeout information
- Verify retry logic activates (check `retry_count` and `last_retry_at`)

**Test Network Failure Recovery**
- Test name: `test_network_failure_recovery`
- Simulate network failure by using invalid API endpoint
- Verify error is logged and status set to "failed" after max retries
- Check `error_message` contains meaningful error description
- Verify `retry_count` reaches max value (3)

### 9. Test Data Storage in EnergyEstimate Model

**Test Complete Data Persistence**
- Test name: `test_energy_estimate_data_persistence`
- Create energy estimate with all parameters
- Verify all fields are correctly stored:
  - `parameter_hash` matches computed hash
  - `system_capacity_kw`, `latitude`, `longitude`, `azimuth`, `tilt` match input
  - `annual_energy_kwh`, `monthly_energy_kwh`, `capacity_factor` from API response
  - `status`, `retry_count`, `last_retry_at`, `calculated_at` are set correctly

**Test Hash-Based Cache Validation**
- Test name: `test_hash_based_cache_integration`
- Create energy estimate and wait for completion
- Call `estimate_energy_async()` again with same parameters
- Verify cached result is returned (no new API call)
- Change one parameter (e.g., tilt) and call again
- Verify new API call is made and hash is updated

### 10. Document Test Setup Requirements

**Add Module-Level Documentation**
```python
"""
Integration tests for PVWatts API interaction.

Setup Requirements:
1. Set PVWATTS_API_KEY environment variable with valid NREL API key
   - Get free key from: https://developer.nrel.gov/signup/
   - Set in .env file: PVWATTS_API_KEY=your_key_here
   
2. Ensure network access to https://developer.nrel.gov/api/pvwatts/v8.json

3. Database must be running and accessible (for real data persistence)

4. Run integration tests separately from unit tests:
   pytest -m integration backend/tests/test_energy_estimation_integration.py

Note: These tests make real API calls and may be subject to rate limiting.
Recommended to run with delays between tests or use API key with higher limits.
"""
```

**Add Test-Level Docstrings**
- Each test should have comprehensive docstring explaining:
  - What is being tested
  - Expected behavior
  - Any special setup or prerequisites
  - Expected API response format
  - How to interpret failures

### 11. Add Test Markers and Configuration

**Configure pytest.ini or pyproject.toml**
- Add integration marker definition
- Configure test discovery patterns
- Set default timeout for integration tests (e.g., 60 seconds)

**Add Skip Conditions**
- Use `@pytest.mark.skipif` for tests requiring specific conditions
- Skip if API key not configured
- Skip if network unavailable
- Add informative skip messages

### 12. Add Cleanup and Teardown

**Database Cleanup**
- Implement fixture teardown to delete test records
- Use `db.query(EnergyEstimate).filter(...).delete()`
- Delete associated `SiteDesign` and `Tender` records
- Ensure cleanup runs even if test fails

**API Call Throttling**
- Add delays between tests to avoid rate limiting
- Use `time.sleep(1)` between API-heavy tests
- Consider using `pytest-xdist` for parallel execution with rate limiting

## Testing Checklist

- [ ] All tests have descriptive names and docstrings
- [ ] Tests use real database session and commit data
- [ ] Tests make actual PVWatts API calls (not mocked)
- [ ] All site types (rooftop, ground_mount, carport) are tested
- [ ] Geographic variations are tested with different coordinates
- [ ] Monthly energy data structure is validated
- [ ] Rate limiting scenarios are tested
- [ ] Timeout scenarios are tested
- [ ] Data persistence in `EnergyEstimate` model is verified
- [ ] Hash-based caching is validated with real API calls
- [ ] Setup requirements are documented in module docstring
- [ ] Tests are marked with `@pytest.mark.integration`
- [ ] Cleanup and teardown are implemented
- [ ] Tests can be run independently and in any order