I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create integration tests for PVWatts API interaction:

- Add new test file backend/tests/test_energy_estimation_integration.py
- Test actual PVWatts API calls using test API key from `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\core\config.py`
- Verify API response parsing and data storage in `EnergyEstimate` model
- Test different site types (rooftop, ground_mount, carport) and array_type mapping
- Test with real coordinates and verify monthly energy data structure
- Add tests for API rate limiting and timeout scenarios
- Document test setup requirements (API key, network access) in test docstrings