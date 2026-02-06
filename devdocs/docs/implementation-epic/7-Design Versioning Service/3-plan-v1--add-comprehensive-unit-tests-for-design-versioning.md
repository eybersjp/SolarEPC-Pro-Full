I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The current `test_design_version.py` has minimal coverage with only basic tests for version creation, listing, and restoration. The `DesignVersionService` has been refactored to use instance-based pattern with `AuditService` integration and automatic recalculation triggers on restore. The service includes tenant isolation helpers and comprehensive audit logging. Testing patterns from file:backend/tests/test_site_design_service.py and file:backend/tests/test_site_design_api.py show clear separation between service-level and API-level tests using in-memory SQLite fixtures.

## Approach

Expand test coverage following the established testing patterns by creating comprehensive service-level and API-level tests. Tests will be organized into logical groups: snapshot data validation, tenant isolation, audit logging verification, recalculation triggers, error handling, and edge cases. Mock Celery tasks to avoid async complexity while verifying recalculation logic. Use fixtures for reusable test data setup and verify audit log entries directly in the database to ensure proper logging.

## Implementation Instructions

### 1. Update Test Infrastructure

**In file:backend/tests/test_design_version.py:**

- Add imports for `AuditLog`, `EnergyEstimate`, `FinancialAnalysis` models
- Add import for `unittest.mock` to mock Celery tasks
- Create reusable fixtures following patterns from file:backend/tests/test_site_design_service.py:
  - `test_db_service` fixture for service-level tests (separate from API tests)
  - `test_data_fixture` that creates tenant, user, equipment, tender, and site_design with complete data
  - `mock_celery_tasks` fixture to patch `tasks.calculate_energy_task.delay`

### 2. Add Version Creation Tests with Complete Snapshot Data

**Test Group: Snapshot Data Validation**

Create tests verifying all snapshot fields are captured:

- `test_create_version_captures_all_geometry_fields` - Verify `site_boundary`, `exclusion_zones`, `module_placements` are in snapshot
- `test_create_version_captures_all_placement_settings` - Verify `edge_setback_m`, `row_spacing_m`, `module_orientation`, `azimuth_deg`, `tilt_deg` are in snapshot
- `test_create_version_captures_calculated_results` - Verify `total_modules`, `system_size_kwp`, `site_area_sqm` are in snapshot
- `test_create_version_captures_equipment_ids` - Verify `equipment_module_id`, `equipment_inverter_id` are stored as strings in snapshot
- `test_create_version_with_empty_exclusion_zones` - Edge case: empty list for exclusion_zones
- `test_create_version_with_null_module_placements` - Edge case: null/empty module_placements

**Implementation Pattern:**
```
Use DesignVersionService instance
Create site_design with specific values for all fields
Call create_version()
Query DesignVersion from DB
Assert snapshot_data contains all expected keys and values
```

### 3. Add Tenant Isolation Tests

**Test Group: Tenant Isolation**

Create tests verifying cross-tenant access is blocked:

- `test_create_version_tenant_isolation` - User from tenant A cannot create version for tenant B's design
- `test_list_versions_tenant_isolation` - User from tenant A cannot list versions for tenant B's design
- `test_restore_version_tenant_isolation` - User from tenant A cannot restore tenant B's version
- `test_get_version_or_404_tenant_isolation` - Helper method blocks cross-tenant access

**Implementation Pattern:**
```
Create two tenants with separate users and site_designs
Instantiate DesignVersionService with tenant_a credentials
Attempt to access tenant_b's design/version
Assert HTTPException with status_code 404 is raised
```

### 4. Add Audit Logging Tests

**Test Group: Audit Logging Verification**

Create tests verifying audit logs are created:

- `test_create_version_creates_audit_log` - Verify `AuditLog` entry with action="create", entity_type="DesignVersion"
- `test_create_version_audit_log_contains_snapshot_keys` - Verify `new_value` contains version_name, notes, snapshot_keys
- `test_list_versions_creates_audit_log` - Verify `AuditLog` entry with action="list"
- `test_restore_version_creates_audit_log` - Verify `AuditLog` entry with action="update", entity_type="SiteDesign"
- `test_restore_version_audit_log_contains_old_new_values` - Verify `old_value` and `new_value` contain complete state
- `test_audit_log_includes_restored_version_metadata` - Verify `new_value` contains `restored_from_version_id` and `restored_from_version_name`

**Implementation Pattern:**
```
Perform operation (create/list/restore)
Query AuditLog table filtering by tenant_id, entity_type, action
Assert log entry exists with correct fields
Verify old_value and new_value structure
```

### 5. Add Recalculation Trigger Tests

**Test Group: Recalculation Logic**

Create tests verifying automatic recalculations on restore:

- `test_restore_triggers_energy_recalc_when_equipment_changes` - Change `equipment_module_id`, verify energy estimation triggered
- `test_restore_triggers_energy_recalc_when_tilt_changes` - Change `tilt_deg`, verify energy estimation triggered
- `test_restore_triggers_energy_recalc_when_azimuth_changes` - Change `azimuth_deg`, verify energy estimation triggered
- `test_restore_triggers_energy_recalc_when_system_size_changes` - Change `system_size_kwp`, verify energy estimation triggered
- `test_restore_triggers_financial_recalc_when_energy_params_change` - Verify financial analysis triggered when energy params change
- `test_restore_skips_recalc_when_no_relevant_changes` - Only change `name`, verify recalc_status shows "skipped"
- `test_restore_returns_recalculation_status` - Verify return tuple contains recalc_status dict with energy_estimation and financial_analysis keys
- `test_restore_handles_recalculation_errors_gracefully` - Mock service to raise exception, verify error message in recalc_status

**Implementation Pattern:**
```
Mock EnergyEstimationService.estimate_energy_async and FinancialAnalysisService.calculate_financials
Create version with baseline state
Modify site_design to change relevant parameters
Create second version
Restore first version (which has different parameters)
Assert mocked methods were called (or not called based on test)
Verify recalc_status in return value
```

### 6. Add Error Case Tests

**Test Group: Error Handling**

Create tests for error scenarios:

- `test_create_version_invalid_site_design_id` - Non-existent UUID raises HTTPException 404
- `test_restore_version_invalid_version_id` - Non-existent version UUID raises HTTPException 404
- `test_restore_version_mismatched_site_design` - Version belongs to different site_design, raises HTTPException 404
- `test_create_version_missing_required_fields` - Pydantic validation error for missing version_name
- `test_list_versions_for_nonexistent_design` - Returns empty list or raises 404 based on implementation

**Implementation Pattern:**
```
Use pytest.raises(HTTPException) as exc
Attempt operation with invalid data
Assert exc.value.status_code == expected_code
Assert expected error message in exc.value.detail
```

### 7. Add Edge Case Tests

**Test Group: Edge Cases**

Create tests for boundary conditions:

- `test_create_version_with_minimal_snapshot_data` - Site design with only required fields
- `test_restore_version_with_missing_snapshot_fields` - Snapshot missing optional fields, verify defaults applied
- `test_restore_version_preserves_unrelated_fields` - Fields not in snapshot remain unchanged
- `test_create_multiple_versions_same_design` - Create 5+ versions, verify all listed in correct order (desc by created_at)
- `test_restore_version_updates_updated_at_timestamp` - Verify site_design.updated_at changes after restore

**Implementation Pattern:**
```
Create specific edge case scenario
Perform operation
Verify expected behavior with assertions
Check database state directly when needed
```

### 8. Organize Test File Structure

**File Organization:**

```
# Imports and Setup (existing)
# Fixtures (new and existing)
# Test Group 1: Snapshot Data Validation (6 tests)
# Test Group 2: Tenant Isolation (4 tests)
# Test Group 3: Audit Logging Verification (6 tests)
# Test Group 4: Recalculation Logic (8 tests)
# Test Group 5: Error Handling (5 tests)
# Test Group 6: Edge Cases (5 tests)
# Existing tests (refactor if needed)
```

Add docstrings to each test explaining what is being verified and why it matters.

### 9. Mock External Dependencies

**Celery Task Mocking:**

- Use `@pytest.fixture` to create `mock_celery_tasks` that patches `app.services.tasks.calculate_energy_task.delay`
- Apply fixture to all recalculation tests
- Verify task was called with correct parameters using `mock.assert_called_once_with()`

**Service Mocking for Error Tests:**

- Use `unittest.mock.patch` to mock `EnergyEstimationService.estimate_energy_async` to raise exceptions
- Use `unittest.mock.patch` to mock `FinancialAnalysisService.calculate_financials` to raise exceptions
- Verify error handling in `restore_version()` catches exceptions and includes error message in recalc_status

### 10. Verification Checklist

After implementation, verify:

- All 34+ new tests pass independently and together
- Test coverage for file:backend/app/services/design_version.py reaches >90%
- No test pollution (each test cleans up properly via fixtures)
- Tests run in <5 seconds total (in-memory DB is fast)
- Mock assertions verify expected behavior without external dependencies
- Audit log verification queries work correctly
- Tenant isolation is thoroughly tested for all service methods