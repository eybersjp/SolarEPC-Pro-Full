I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Expand unit test coverage for the energy estimation service:

- Enhance `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\tests\test_energy_estimation.py` with comprehensive test cases
- Test hash computation and cache invalidation scenarios
- Test retry logic with mock failures (1st attempt fails, 2nd succeeds, all 3 fail)
- Test graceful degradation when PVWatts API is unavailable
- Test manual retry functionality
- Mock Celery task execution and verify parameter passing
- Test edge cases: zero capacity, invalid coordinates, missing tender data