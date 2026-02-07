I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The existing test file contains comprehensive unit tests for proposal generation components (CSV export, PDF generation, storage backends, audit logging). The codebase follows a clear integration testing pattern using in-memory SQLite databases with `StaticPool`, FastAPI `TestClient`, and dependency overrides for authentication. The proposal generation system uses Celery tasks for async PDF generation, supports configurable storage backends (local/S3), and integrates with multiple models (`SiteDesign`, `EnergyEstimate`, `FinancialAnalysis`, `BOQItem`) through tenant-isolated relationships.

## Approach

The integration tests will follow the established pattern from `test_financial_api.py` and `test_energy_estimation_integration.py`, using in-memory SQLite with real database operations, FastAPI TestClient for API testing, and direct Celery task execution (via `.run()`) for synchronous testing. Tests will be organized into logical classes covering the full end-to-end flow, tenant isolation, error scenarios, and edge cases. Real WeasyPrint PDF generation will be used (not mocked) to validate actual PDF output, with temporary file cleanup. The tests will verify the complete workflow from API request through Celery task execution to file storage and retrieval.

## Implementation Steps

### 1. Add Integration Test Fixtures and Setup

In file:backend/tests/test_proposal.py, add integration test infrastructure after the existing unit tests:

- Create `integration_db_session` fixture using in-memory SQLite with `StaticPool` (similar to `test_financial_api.py` pattern)
- Create `test_client` fixture that overrides `get_db` and `get_current_user` dependencies
- Define global test tenant/user IDs for consistent tenant isolation testing
- Create `current_user_context` dict to switch between users during tests
- Implement `override_get_db()` and `override_get_current_user()` functions
- Add `setup_integration_db` autouse fixture to create/drop schema for each test

### 2. Create Comprehensive Test Data Fixture

Add `proposal_test_data` fixture that creates a complete data hierarchy:

- Create `Tenant` (TEST_TENANT_A_ID) and `User` (TEST_USER_A_ID)
- Create second tenant/user for cross-tenant isolation tests (TEST_TENANT_B_ID, TEST_USER_B_ID)
- Create `Tender` with latitude/longitude for energy estimation
- Create `EquipmentModule` and `EquipmentInverter` with realistic specifications
- Create `SiteDesign` with site_boundary GeoJSON, equipment references, tilt/azimuth settings
- Create multiple `BOQItem` entries with different categories (modules, inverters, BOS, labor)
- Create `EnergyEstimate` with completed status, annual_energy_kwh, and monthly_energy_kwh array
- Create `FinancialAnalysis` with calculated metrics
- Return dict with all entity IDs for test access

### 3. Test Full Async PDF Generation Flow

Create `TestProposalGenerationIntegration` class with tests:

**Test: `test_full_pdf_generation_flow_with_celery_task`**
- Use `proposal_test_data` fixture to get design_id
- Call POST `/api/site-designs/{design_id}/proposal` endpoint with section options
- Assert response status 202 ACCEPTED and extract task_id
- Create mock `self` object for Celery task with `request.retries` and `max_retries`
- Import and call `generate_proposal_task.run(mock_self, str(design_id), options)` synchronously
- Assert task result contains `{"status": "success", "result_url": ..., "storage_id": ...}`
- Verify PDF file exists in storage using storage backend's `exists()` method
- Verify file size > 0 bytes
- Clean up generated PDF file

**Test: `test_pdf_generation_with_all_sections_enabled`**
- Generate proposal with all sections enabled: `{"include_cover": True, "include_site_map": True, "include_specs": True, "include_energy": True, "include_financials": True, "include_equipment": True}`
- Verify PDF is generated successfully
- Optionally: Read PDF content and verify it contains expected text markers for each section

**Test: `test_pdf_generation_with_selective_sections`**
- Generate proposal with only cover and financials: `{"include_cover": True, "include_financials": True}`
- Verify PDF is generated with reduced content
- Compare file size is smaller than full proposal

### 4. Test API Endpoints with Real Database

Create `TestProposalAPIEndpoints` class:

**Test: `test_generate_proposal_endpoint_authentication`**
- Call POST `/api/site-designs/{design_id}/proposal` without authentication override
- Temporarily remove `get_current_user` override to test auth requirement
- Assert 401 or 403 response

**Test: `test_generate_proposal_endpoint_with_options`**
- Call POST endpoint with request body containing section options
- Verify task_id is returned
- Verify task status is "PENDING"

**Test: `test_generate_proposal_endpoint_invalid_design_id`**
- Call POST endpoint with non-existent UUID
- Execute task and verify it returns error status
- Assert error message contains "Design not found"

**Test: `test_csv_export_endpoint_success`**
- Call GET `/api/site-designs/{design_id}/export-csv`
- Assert response status 200
- Assert Content-Type is text/plain or text/csv
- Assert Content-Disposition header contains "attachment; filename=bom_design_"
- Parse CSV content and verify headers and data rows match BOQItem entries
- Verify all BOQ items are present in CSV

**Test: `test_csv_export_endpoint_empty_boq`**
- Delete all BOQItem entries for the tender
- Call CSV export endpoint
- Verify response contains only headers, no data rows

### 5. Test Task Status Polling Endpoint

Create `TestTaskStatusPolling` class:

**Test: `test_task_status_polling_pending`**
- Mock a Celery task with PENDING status using `patch("celery.result.AsyncResult")`
- Call GET `/api/tasks/{task_id}`
- Assert response contains `{"task_id": ..., "status": "PENDING"}`

**Test: `test_task_status_polling_success`**
- Execute proposal generation task synchronously
- Mock AsyncResult to return SUCCESS status with result dict
- Call GET `/api/tasks/{task_id}`
- Assert response contains `{"task_id": ..., "status": "SUCCESS", "result_url": ...}`

**Test: `test_task_status_polling_failure`**
- Mock AsyncResult to return FAILURE status with exception
- Call GET `/api/tasks/{task_id}`
- Assert response contains `{"task_id": ..., "status": "FAILURE", "error": ...}`

### 6. Test Integration with Models

Create `TestProposalModelIntegration` class:

**Test: `test_proposal_with_complete_data_hierarchy`**
- Verify proposal generation correctly loads SiteDesign with joinedload for Tender
- Verify it accesses EnergyEstimate data for monthly charts
- Verify it accesses FinancialAnalysis data for financial section
- Verify it loads all BOQItem entries for equipment list
- Assert all data is correctly rendered in PDF (check audit log entries)

**Test: `test_proposal_with_missing_energy_estimate`**
- Delete EnergyEstimate for the design
- Generate proposal with graceful degradation
- Verify PDF is generated with "N/A" or placeholder for energy section
- Verify no exceptions are raised

**Test: `test_proposal_with_missing_financial_analysis`**
- Delete FinancialAnalysis for the design
- Generate proposal
- Verify PDF is generated with "N/A" for financial metrics

**Test: `test_proposal_with_failed_energy_estimate`**
- Set EnergyEstimate status to "failed"
- Generate proposal
- Verify graceful handling and appropriate messaging in PDF

**Test: `test_proposal_with_empty_monthly_energy_data`**
- Set EnergyEstimate.monthly_energy_kwh to empty list or None
- Generate proposal
- Verify chart generation is skipped (returns None)
- Verify PDF is still generated successfully

### 7. Test File Storage and Retrieval

Create `TestProposalStorageIntegration` class:

**Test: `test_local_storage_backend_integration`**
- Set `PROPOSAL_STORAGE_BACKEND=local` in settings
- Generate proposal
- Verify file is saved to local directory (PROPOSAL_LOCAL_DIR)
- Verify `get_url()` returns correct local file path or URL
- Verify file can be read and contains PDF header (%PDF)
- Clean up file

**Test: `test_s3_storage_backend_integration`** (with mocked boto3)
- Set `PROPOSAL_STORAGE_BACKEND=s3` in settings
- Mock boto3 client upload_file and generate_presigned_url
- Generate proposal
- Verify S3 upload_file was called with correct parameters
- Verify presigned URL is returned

**Test: `test_storage_backend_selection`**
- Test that `get_storage_backend()` returns correct backend based on settings
- Verify LocalFileStorage is returned when PROPOSAL_STORAGE_BACKEND=local
- Verify S3Storage is returned when PROPOSAL_STORAGE_BACKEND=s3

### 8. Test Tenant Isolation and Permissions

Create `TestProposalTenantIsolation` class:

**Test: `test_cross_tenant_proposal_generation_blocked`**
- Create design for TEST_TENANT_A
- Switch current_user_context to TEST_USER_B (different tenant)
- Attempt to generate proposal for TEST_TENANT_A's design
- Verify task fails or returns error (design not found due to tenant filter)

**Test: `test_cross_tenant_csv_export_blocked`**
- Create design for TEST_TENANT_A
- Switch to TEST_USER_B
- Call CSV export endpoint
- Verify 404 response (design not accessible)

**Test: `test_same_tenant_different_user_access`**
- Create design for TEST_TENANT_A by TEST_USER_A
- Create TEST_USER_C in same tenant (TEST_TENANT_A)
- Switch to TEST_USER_C
- Generate proposal and export CSV
- Verify both operations succeed (same tenant access)

**Test: `test_audit_log_records_correct_tenant_and_user`**
- Generate proposal as TEST_USER_A
- Query AuditLog table for proposal generation action
- Verify tenant_id matches TEST_TENANT_A_ID
- Verify user_id matches TEST_USER_A_ID
- Verify entity_type is "Proposal" or "SiteDesign"
- Verify action is "generate_proposal" or similar

### 9. Test Real WeasyPrint PDF Generation

Create `TestWeasyPrintIntegration` class:

**Test: `test_real_pdf_generation_with_weasyprint`**
- Do NOT mock weasyprint.HTML or weasyprint.CSS
- Generate proposal with real WeasyPrint rendering
- Verify PDF file is created
- Read PDF file and verify it starts with "%PDF-1." header
- Verify file size is reasonable (> 10KB for a real PDF)
- Optionally: Use PyPDF2 or similar to verify PDF structure and page count

**Test: `test_pdf_contains_design_data`**
- Generate real PDF
- Extract text from PDF using PyPDF2 or pdfplumber
- Verify design name appears in PDF
- Verify system size (kwp) appears in PDF
- Verify financial metrics appear in PDF

**Test: `test_monthly_chart_embedded_in_pdf`**
- Generate proposal with energy data
- Verify chart image is generated (not None)
- Verify chart is embedded in PDF (check for image markers or base64 data in HTML)

### 10. Test Error Scenarios and Edge Cases

Create `TestProposalErrorHandling` class:

**Test: `test_proposal_generation_with_invalid_geojson`**
- Create design with malformed site_boundary
- Attempt to generate proposal
- Verify graceful error handling (no crash)

**Test: `test_proposal_generation_with_missing_equipment`**
- Delete EquipmentModule referenced by design
- Generate proposal
- Verify error is caught and logged
- Verify task returns error status

**Test: `test_csv_export_with_special_characters`**
- Create BOQItem with description containing commas, quotes, newlines
- Export CSV
- Verify CSV is properly escaped and parseable

**Test: `test_concurrent_proposal_generation`**
- Trigger multiple proposal generation tasks for different designs
- Verify all tasks complete successfully
- Verify no file naming conflicts or race conditions

**Test: `test_proposal_generation_rollback_on_storage_failure`**
- Mock storage.save() to raise exception
- Generate proposal
- Verify database rollback is called
- Verify audit log is not committed (or marked as failed)

### 11. Add Test Cleanup and Utilities

Add helper functions and cleanup:

- Create `cleanup_generated_files()` helper to remove test PDFs from local storage
- Add `verify_pdf_structure(file_path)` helper to validate PDF format
- Add `parse_csv_content(csv_string)` helper to parse and validate CSV
- Use `tmp_path` fixture for temporary file operations where applicable
- Ensure all tests clean up after themselves (delete files, reset settings)

### 12. Mark Integration Tests Appropriately

- Add `@pytest.mark.integration` decorator to all integration test classes
- Add `@pytest.mark.slow` for tests that generate real PDFs
- Update pytest configuration to allow running integration tests separately: `pytest -m integration`
- Add docstrings to each test explaining what is being tested and why