I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The existing `test_financial_api.py` contains only a basic test for the GET endpoint. The financial analysis system integrates with BOQ service for cost calculation and energy estimation service for energy data. The API endpoint at `/api/site-designs/{design_id}/financial-analysis` automatically triggers calculation if analysis doesn't exist. The `FinancialAnalysisResponse` schema is defined inline in the API file. Unit tests already cover formula accuracy, edge cases, and service-level logic comprehensively.

## Approach

Create comprehensive integration tests that validate the complete end-to-end flow through the API layer, focusing on real database interactions, multi-service integration, tenant isolation, and automatic recalculation scenarios. Tests will use in-memory SQLite with proper fixtures following the established pattern from `test_site_design_api.py` and `test_energy_estimation_integration.py`. Each test will verify both API response format and database persistence.

## Implementation Instructions

### 1. Expand Test Fixtures and Setup

In `file:backend/tests/test_financial_api.py`, enhance the existing fixtures:

- Keep the existing in-memory SQLite setup with `TestingSessionLocal` and dependency overrides
- Add a comprehensive `setup_test_data` fixture that creates:
  - Tenant and User (already exists)
  - Tender with valid latitude/longitude
  - Equipment (EquipmentModule and EquipmentInverter) with valid specifications
  - SiteDesign linked to tender and equipment
  - Helper function to create BOQ items with various cost scenarios
  - Helper function to create completed EnergyEstimate records

### 2. Test End-to-End Flow

Add `test_end_to_end_flow_create_design_to_financial_analysis`:

- Create a tender using the test database
- Create equipment (module and inverter) records
- Create a site design via the API or directly in DB
- Add multiple BOQ items with different categories and margins
- Create a completed energy estimate with realistic annual_energy_kwh
- Call GET `/api/site-designs/{design_id}/financial-analysis`
- Verify response status is 200
- Verify response matches `FinancialAnalysisResponse` schema structure
- Verify calculations: `annual_savings_usd = annual_energy_kwh * 0.12`
- Verify calculations: `simple_payback_years = system_cost_usd / annual_savings_usd`
- Verify calculations: `roi_pct = ((annual_savings_usd * 25) - system_cost_usd) / system_cost_usd * 100`
- Query database to confirm `FinancialAnalysis` record was persisted
- Verify `calculated_at` timestamp is set

### 3. Test Automatic Calculation When Analysis Doesn't Exist

Add `test_automatic_calculation_when_missing`:

- Create site design with BOQ items and energy estimate
- Ensure no `FinancialAnalysis` record exists in database
- Call GET `/api/site-designs/{design_id}/financial-analysis`
- Verify response status is 200
- Verify financial analysis was automatically created
- Query database to confirm record exists
- Verify all fields are populated correctly

### 4. Test Recalculation When BOQ Changes

Add `test_recalculation_after_boq_update`:

- Create initial setup with BOQ items and financial analysis
- Record initial `system_cost_usd` and `calculated_at` timestamp
- Update BOQ item via BOQ service (increase unit_cost or quantity)
- Verify BOQ service triggers recalculation (check `_trigger_recalculation` was called)
- Call GET `/api/site-designs/{design_id}/financial-analysis`
- Verify `system_cost_usd` reflects new BOQ total
- Verify `calculated_at` timestamp is updated
- Verify payback and ROI recalculated correctly

Add `test_recalculation_after_boq_item_creation`:

- Create initial setup with financial analysis
- Add new BOQ item via BOQ service
- Verify financial analysis is recalculated with updated cost

Add `test_recalculation_after_boq_item_deletion`:

- Create setup with multiple BOQ items and financial analysis
- Delete a BOQ item via BOQ service
- Verify financial analysis reflects reduced system cost

### 5. Test Recalculation When Energy Estimate Changes

Add `test_recalculation_after_energy_estimate_update`:

- Create initial setup with energy estimate and financial analysis
- Record initial `annual_savings_usd`
- Update energy estimate with different `annual_energy_kwh` (simulate recalculation)
- Manually trigger financial recalculation via energy service callback
- Verify `annual_savings_usd` reflects new energy value
- Verify payback and ROI recalculated correctly

### 6. Test API Response Format Validation

Add `test_response_format_matches_schema`:

- Create complete setup with all dependencies
- Call GET `/api/site-designs/{design_id}/financial-analysis`
- Verify response contains all required fields:
  - `id` (UUID)
  - `site_design_id` (UUID)
  - `system_cost_usd` (float)
  - `electricity_rate_usd_per_kwh` (float)
  - `annual_rate_escalation_pct` (float)
  - `annual_savings_usd` (float)
  - `simple_payback_years` (float)
  - `roi_pct` (float)
- Verify field types match schema
- Verify values are properly rounded (2 decimal places where applicable)

### 7. Test Error Handling for Missing Site Design

Add `test_error_missing_site_design`:

- Use a non-existent UUID for site_design_id
- Call GET `/api/site-designs/{invalid_id}/financial-analysis`
- Verify response status is 404
- Verify error message contains "Site Design not found"

### 8. Test Tenant Isolation and Access Control

Add `test_tenant_isolation`:

- Create two tenants with separate users
- Create site design for tenant A
- Override `get_current_user` to return tenant B user
- Call GET `/api/site-designs/{tenant_a_design_id}/financial-analysis`
- Verify response status is 404 (design not found due to tenant filter)
- Verify no cross-tenant data leakage

Add `test_access_control_different_users_same_tenant`:

- Create two users in same tenant
- Create site design by user A
- Override `get_current_user` to return user B (same tenant)
- Call GET `/api/site-designs/{design_id}/financial-analysis`
- Verify response status is 200 (same tenant can access)

### 9. Test Database Persistence Verification

Add `test_calculations_persisted_correctly`:

- Create complete setup
- Call GET `/api/site-designs/{design_id}/financial-analysis`
- Query database directly for `FinancialAnalysis` record
- Verify all calculated fields match API response
- Verify `calculated_at` timestamp is recent
- Verify foreign key relationship to `SiteDesign` is correct

### 10. Test Edge Cases in Integration Context

Add `test_missing_energy_estimate_graceful_degradation`:

- Create site design with BOQ items but no energy estimate
- Call GET `/api/site-designs/{design_id}/financial-analysis`
- Verify response status is 200
- Verify `annual_savings_usd` is 0.0
- Verify `simple_payback_years` is 0.0
- Verify system still calculates cost from BOQ

Add `test_failed_energy_estimate_status`:

- Create site design with energy estimate status = "failed"
- Call GET `/api/site-designs/{design_id}/financial-analysis`
- Verify financial analysis uses 0 for energy calculations
- Verify cost calculations still work from BOQ

Add `test_empty_boq_zero_cost`:

- Create site design with no BOQ items
- Create completed energy estimate
- Call GET `/api/site-designs/{design_id}/financial-analysis`
- Verify `system_cost_usd` is 0.0
- Verify `roi_pct` is 0.0 (graceful handling of division by zero)

### 11. Test Concurrent Calculation Scenarios

Add `test_idempotent_calculation`:

- Create site design with dependencies
- Call GET endpoint twice in succession
- Verify both calls return same `FinancialAnalysis` record (same ID)
- Verify `calculated_at` timestamp is same (no unnecessary recalculation)

### 12. Test Complex BOQ Scenarios

Add `test_complex_boq_with_margins`:

- Create BOQ items with various margin percentages (0%, 10%, 25%)
- Create multiple categories (modules, inverters, bos, labor)
- Verify `system_cost_usd` correctly sums all line totals with margins
- Verify calculations use grand_total from BOQ summary

### Test Organization

Structure tests using pytest classes for better organization:

```python
class TestFinancialAnalysisAPIEndToEnd:
    """End-to-end flow tests"""
    
class TestFinancialAnalysisAutoCalculation:
    """Automatic calculation tests"""
    
class TestFinancialAnalysisRecalculation:
    """Recalculation trigger tests"""
    
class TestFinancialAnalysisAPIValidation:
    """API response format and schema tests"""
    
class TestFinancialAnalysisErrorHandling:
    """Error scenarios and edge cases"""
    
class TestFinancialAnalysisTenantIsolation:
    """Multi-tenancy and access control tests"""
```

### Assertions Pattern

For each test, follow this assertion pattern:

1. **API Response Validation**: Status code, response structure
2. **Calculation Accuracy**: Verify formulas match expected values
3. **Database Persistence**: Query DB to confirm data saved correctly
4. **Relationships**: Verify foreign keys and relationships intact
5. **Timestamps**: Verify `calculated_at` is set appropriately

### Test Data Helpers

Add helper functions in the test file:

- `create_boq_items(db, tender_id, items_config)` - Create multiple BOQ items from config
- `create_energy_estimate(db, design_id, annual_kwh, status)` - Create energy estimate
- `get_financial_analysis_from_db(db, design_id)` - Query financial analysis directly
- `calculate_expected_values(cost, energy)` - Calculate expected financial metrics for assertions