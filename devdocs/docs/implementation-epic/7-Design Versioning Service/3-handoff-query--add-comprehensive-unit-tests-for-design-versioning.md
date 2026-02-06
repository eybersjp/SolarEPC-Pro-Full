I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Expand test coverage in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\tests\test_design_version.py`:

- Add tests for version creation with all snapshot data fields (geometry, settings, results)
- Add tests for tenant isolation (verify users can't access other tenants' versions)
- Add tests for audit logging on create, list, and restore operations
- Add tests for recalculation triggers when restoring versions with changed parameters
- Add tests for error cases (invalid version_id, missing design, permission errors)
- Add tests for edge cases (empty exclusion zones, null placement results)
- Follow testing patterns from `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\tests\test_site_design_service.py` and `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\tests\test_site_design_api.py`