I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The existing `test_proposal.py` has minimal test coverage with only basic CSV generation and placeholder tests. The `ProposalService` has been enhanced with configurable sections, storage backend abstraction, audit logging, and graceful degradation. The service uses external dependencies (WeasyPrint, matplotlib) and integrates with storage backends (local/S3). Testing patterns from `test_financial_analysis.py` and `test_energy_estimation.py` show comprehensive approaches including parametrized tests, edge cases, mocking strategies, and graceful degradation verification.

## Approach

Create comprehensive unit tests organized into logical test classes covering all aspects of the proposal service. Mock all external dependencies (WeasyPrint, matplotlib, storage backends, database) to ensure fast, isolated tests. Use parametrized tests for section combinations and data scenarios. Verify audit logging, graceful degradation, error handling, and storage backend selection. Follow the established testing patterns from other test files in the codebase, ensuring proper mocking of database queries and external services.

## Implementation Steps

### 1. Test File Structure and Fixtures

Expand `file:backend/tests/test_proposal.py` with comprehensive fixtures and test organization:

**Add fixtures:**
- `mock_db` - Mock database session
- `mock_storage_local` - Mock LocalFileStorage instance
- `mock_storage_s3` - Mock S3Storage instance
- `mock_audit_service` - Mock AuditService instance
- `sample_site_design` - Sample SiteDesign model instance
- `sample_tender` - Sample Tender model instance
- `sample_energy_estimate` - Sample EnergyEstimate with completed status
- `sample_financial_analysis` - Sample FinancialAnalysis instance
- `sample_bom_items` - List of sample BOQItem instances
- `proposal_service` - ProposalService instance with mocked dependencies

**Organize into test classes:**
- `TestTemplateRendering` - Template rendering with section combinations
- `TestCSVExport` - CSV BOM export scenarios
- `TestMonthlyChart` - Chart generation with different data formats
- `TestGracefulDegradation` - Missing data handling
- `TestStorageBackend` - Storage backend selection and usage
- `TestAuditLogging` - Audit logging verification
- `TestErrorScenarios` - Error handling and edge cases

### 2. Template Rendering Tests (`TestTemplateRendering`)

Create parametrized tests for all section combinations:

**Test all section toggles:**
- Use `@pytest.mark.parametrize` with section combinations (all enabled, all disabled, individual sections)
- Mock `ProposalService.generate_pdf()` to test template rendering without PDF generation
- Patch `weasyprint.HTML` and `weasyprint.CSS` to capture rendered HTML
- Verify conditional blocks appear/disappear based on options
- Test with complete data (all models present)
- Assert HTML contains expected sections when enabled
- Assert HTML excludes sections when disabled

**Test data binding:**
- Verify tender data (name, client_name, latitude, longitude) renders correctly
- Verify design data (system_size_kwp, total_modules, azimuth_deg, tilt_deg, site_type) renders correctly
- Verify energy data (annual_energy_kwh, capacity_factor) renders correctly
- Verify financial data (system_cost_usd, annual_savings_usd, simple_payback_years, roi_pct) renders correctly
- Verify BOM items render in table format

**Parametrized test example:**
```python
@pytest.mark.parametrize("options,expected_sections", [
    ({"include_cover": True, "include_site_map": False, ...}, ["cover-page"]),
    ({"include_cover": False, "include_energy": True, ...}, ["Energy Production"]),
    # ... more combinations
])
```

### 3. CSV BOM Export Tests (`TestCSVExport`)

Test CSV generation with various data scenarios:

**Test normal CSV generation:**
- Mock database to return design and BOQ items
- Call `generate_bom_csv(site_design_id)`
- Verify CSV header: "Category,Description,Unit Cost ($),Quantity,Margin (%),Line Total ($)"
- Verify each BOQ item row with correct formatting (2 decimal places for costs)
- Verify CSV string is properly formatted

**Test edge cases:**
- Empty BOM items list (should return header only)
- BOQ items with None/null values (should render as "N/A" or "0")
- BOQ items with zero quantities
- BOQ items with negative margins
- Very large quantities and costs (formatting verification)

**Test audit logging:**
- Verify `AuditService.log()` called with correct parameters
- Verify entity_type="BOM", action="export_csv"
- Verify new_value contains item_count and timestamp

**Parametrized test for data scenarios:**
```python
@pytest.mark.parametrize("bom_items,expected_rows", [
    ([], 1),  # Header only
    ([sample_item1, sample_item2], 3),  # Header + 2 items
])
```

### 4. Monthly Chart Generation Tests (`TestMonthlyChart`)

Test `_generate_monthly_chart()` with different data formats:

**Test with list input:**
- Mock matplotlib.pyplot to avoid actual chart generation
- Test with 12-element list of floats
- Test with list shorter than 12 (should pad with zeros)
- Test with list longer than 12 (should truncate to 12)
- Verify base64 encoded PNG returned

**Test with dict input:**
- Test with dict containing 12 key-value pairs
- Test with dict containing fewer than 12 pairs (should pad)
- Verify values extracted correctly

**Test edge cases:**
- None input (should return None)
- Empty list (should return None)
- All-zero values (should return None per graceful degradation)
- Invalid data type (should return None and log warning)
- Exception during chart generation (should return None and log error)

**Mock matplotlib:**
- Patch `matplotlib.pyplot.figure`, `matplotlib.pyplot.bar`, `matplotlib.pyplot.savefig`, `matplotlib.pyplot.close`
- Verify chart configuration (figsize, colors, labels)
- Verify savefig called with correct format and parameters

### 5. Graceful Degradation Tests (`TestGracefulDegradation`)

Test handling of missing energy and financial data:

**Test missing EnergyEstimate:**
- Mock database to return None for energy estimate query
- Call `generate_pdf()` with `include_energy=True`
- Verify template renders with warning message
- Verify no chart generated (chart_image is None)
- Verify PDF generation completes successfully

**Test incomplete EnergyEstimate:**
- Mock energy estimate with status="calculating" or "failed"
- Verify template shows appropriate warning
- Verify graceful handling without exceptions

**Test missing FinancialAnalysis:**
- Mock database to return None for financial analysis query
- Call `generate_pdf()` with `include_financials=True`
- Verify template renders with warning message
- Verify PDF generation completes successfully

**Test missing BOM items:**
- Mock database to return empty list for BOQ items
- Verify template shows warning message
- Verify PDF generation completes successfully

**Test missing SiteDesign (error case):**
- Mock database to return None for site design
- Verify `ValueError` raised with appropriate message

**Test missing Tender (error case):**
- Mock database to return None for tender
- Verify `ValueError` raised with appropriate message

### 6. Storage Backend Tests (`TestStorageBackend`)

Test storage backend selection and usage:

**Test LocalFileStorage usage:**
- Mock `get_storage_backend()` to return LocalFileStorage instance
- Mock `LocalFileStorage.save()` to return filename
- Mock `LocalFileStorage.get_url()` to return local path
- Call `generate_pdf()`
- Verify `storage.save()` called with correct parameters (temp file path, filename)
- Verify filename format: `proposal_{design_id}_{timestamp}.pdf`
- Verify temporary file cleanup (os.remove called)

**Test S3Storage usage:**
- Mock `get_storage_backend()` to return S3Storage instance
- Mock `S3Storage.save()` to return S3 key
- Mock `S3Storage.get_url()` to return presigned URL
- Call `generate_pdf()`
- Verify `storage.save()` called correctly
- Verify S3 key format

**Test storage error handling:**
- Mock `storage.save()` to raise exception
- Verify exception propagates
- Verify temporary file cleanup still occurs (in finally block)

### 7. Audit Logging Tests (`TestAuditLogging`)

Verify audit logging for all operations:

**Test PDF generation audit logging:**
- Mock `AuditService.log()` to track calls
- Call `generate_pdf()` with tenant_id and user_id
- Verify `audit_service.log()` called with:
  - tenant_id (from tender or passed in)
  - user_id (from design.created_by or passed in)
  - entity_type="Proposal"
  - entity_id=site_design_id
  - action="generate_pdf"
  - new_value contains options, storage_id, timestamp
- Verify `db.commit()` called after audit log

**Test CSV export audit logging:**
- Call `generate_bom_csv()` with tenant_id and user_id
- Verify `audit_service.log()` called with:
  - entity_type="BOM"
  - action="export_csv"
  - new_value contains item_count, timestamp

**Test audit logging failure handling:**
- Mock `audit_service.log()` to raise exception
- Verify exception caught and logged as warning
- Verify `db.rollback()` called
- Verify main operation (PDF generation) still completes successfully

**Test without tenant_id/user_id:**
- Create ProposalService without tenant_id/user_id
- Verify audit logging skipped gracefully
- Verify operations complete successfully

### 8. Error Scenarios and Edge Cases (`TestErrorScenarios`)

Test error handling and edge cases:

**Test WeasyPrint failure:**
- Mock `weasyprint.HTML.write_pdf()` to raise exception
- Verify exception propagates
- Verify temporary file cleanup occurs

**Test template rendering failure:**
- Mock Jinja2 template to raise exception
- Verify exception propagates

**Test database query failures:**
- Mock database queries to raise exceptions
- Verify appropriate error handling

**Test invalid UUID:**
- Pass invalid UUID string to `generate_pdf()`
- Verify appropriate error handling

**Test concurrent access:**
- Verify service is thread-safe (no shared mutable state)

**Test large datasets:**
- Test with large number of BOM items (100+)
- Verify CSV generation handles large datasets
- Verify template rendering handles large datasets

**Test special characters:**
- Test with special characters in tender name, client name, descriptions
- Verify proper escaping in HTML template
- Verify proper escaping in CSV export

### 9. Mock Configuration

**Mock WeasyPrint:**
```python
@patch('app.services.proposal.HTML')
@patch('app.services.proposal.CSS')
def test_pdf_generation(mock_css, mock_html, ...):
    mock_html_instance = MagicMock()
    mock_html.return_value = mock_html_instance
    # Test implementation
```

**Mock matplotlib:**
```python
@patch('app.services.proposal.plt')
def test_chart_generation(mock_plt, ...):
    mock_plt.figure.return_value = MagicMock()
    # Test implementation
```

**Mock storage backend:**
```python
@patch('app.services.proposal.get_storage_backend')
def test_storage(mock_get_storage, ...):
    mock_storage = MagicMock(spec=StorageBackend)
    mock_get_storage.return_value = mock_storage
    # Test implementation
```

**Mock database queries:**
```python
def mock_query_side_effect(model):
    mock_query = MagicMock()
    if model == SiteDesign:
        mock_query.filter.return_value.first.return_value = sample_design
    elif model == Tender:
        mock_query.filter.return_value.first.return_value = sample_tender
    # ... more models
    return mock_query

mock_db.query.side_effect = mock_query_side_effect
```

### 10. Test Execution and Coverage

**Ensure comprehensive coverage:**
- All public methods tested (`generate_pdf`, `generate_bom_csv`)
- All private methods tested (`_generate_monthly_chart`)
- All code paths covered (if/else branches, try/except blocks)
- All section combinations tested
- All data scenarios tested (present, missing, invalid)

**Run tests:**
```bash
pytest backend/tests/test_proposal.py -v
pytest backend/tests/test_proposal.py --cov=app.services.proposal
```

**Verify no integration test overlap:**
- All tests should be unit tests (mocked dependencies)
- No actual PDF generation (WeasyPrint mocked)
- No actual chart generation (matplotlib mocked)
- No actual storage operations (storage backend mocked)
- No actual database operations (database mocked)
- No actual API calls