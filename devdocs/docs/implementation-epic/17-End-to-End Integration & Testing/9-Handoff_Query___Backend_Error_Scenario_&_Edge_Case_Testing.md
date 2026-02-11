I have the following user query that I want you to help me with. Implement the requested functionality following best practices.

Expand error scenario coverage in backend tests:

- Enhance `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\tests\test_integration_error_scenarios.py` with additional PVWatts failure modes (503 service unavailable, malformed JSON, partial data)
- Add placement timeout scenarios (>30s execution, task cancellation)
- Add PDF generation failures (WeasyPrint crash, template missing, chart generation failure)
- Add invalid polygon scenarios (self-intersecting, too small for setback, exclusion zones covering entire site)
- Verify retry logic with exponential backoff for energy estimation
- Test concurrent design updates and optimistic locking