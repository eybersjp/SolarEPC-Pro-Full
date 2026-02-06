I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The existing test file `test_financial_analysis.py` contains basic tests for calculation accuracy and zero energy edge cases. The `FinancialAnalysisService` uses default assumptions (electricity_rate=0.12, escalation_rate=2.0, lifespan_years=25) and integrates with BOQ and Energy services. The service handles edge cases by returning 0.0 for payback when savings is zero and 0.0 for ROI when cost is zero. The BOQ service has a `_trigger_recalculation` method that calls financial analysis after create/update/delete operations. Energy estimates can have statuses: "calculating", "completed", or "failed".

## Approach

The implementation plan will expand the existing test suite to comprehensively cover all formulas, edge cases, BOQ integration scenarios, default assumptions, graceful degradation, and recalculation triggers. Tests will follow the established patterns using pytest fixtures, MagicMock for service dependencies, and parametrize for multiple scenarios. Each test will be isolated and focused on a specific aspect of the financial analysis service, ensuring complete coverage of the acceptance criteria formulas and error handling paths.

## Implementation Steps

### 1. Add Test Fixtures for Common Scenarios

Expand file:backend/tests/test_financial_analysis.py with additional fixtures:

- Add `mock_site_design` fixture that returns a properly configured SiteDesign mock with tender_id
- Add `mock_energy_estimate_completed` fixture with status="completed" and annual_energy_kwh=100000.0
- Add `mock_energy_estimate_failed` fixture with status="failed" and error_message
- Add `mock_energy_estimate_calculating` fixture with status="calculating"
- Add `mock_boq_summary` fixture returning standard BOQ summary dict with grand_total=50000.0

### 2. Test Calculation Accuracy for All Formulas

Add comprehensive formula verification tests:

- **test_annual_savings_calculation**: Verify Annual Savings = Energy × Rate formula with multiple energy/rate combinations using parametrize
- **test_simple_payback_calculation**: Verify Payback = Cost / Savings formula with various cost/savings scenarios
- **test_roi_calculation**: Verify ROI = ((Savings × 25) - Cost) / Cost × 100 formula with different profitability scenarios
- **test_rounding_precision**: Verify all financial values are rounded to 2 decimal places as per service implementation

### 3. Test Edge Cases

Add edge case handling tests:

- **test_zero_energy_zero_cost**: Both energy and cost are zero, verify savings=0, payback=0, ROI=0
- **test_zero_cost_positive_energy**: Cost is zero but energy is positive, verify ROI calculation handles division by zero (returns 0.0)
- **test_negative_roi_scenario**: System cost exceeds lifetime savings, verify negative ROI is calculated correctly
- **test_very_large_numbers**: Test with extremely large cost/energy values to ensure no overflow issues
- **test_very_small_numbers**: Test with very small positive values to ensure precision handling

### 4. Test Missing BOQ Data Scenarios

Add BOQ integration tests:

- **test_missing_boq_items**: BOQ service returns empty summary with grand_total=0, verify system_cost_usd=0
- **test_boq_service_exception**: BOQ service raises exception, verify graceful handling with system_cost=0.0
- **test_boq_with_various_totals**: Parametrize test with different BOQ totals (1000, 50000, 100000, 500000) to verify cost integration
- **test_boq_summary_structure**: Verify service correctly extracts "grand_total" key from BOQ summary dict

### 5. Test Energy Estimate Status Scenarios

Add energy estimation integration tests:

- **test_energy_estimate_missing**: get_estimate returns None, verify annual_energy=0.0 and calculations proceed
- **test_energy_estimate_failed_status**: Energy estimate exists but status="failed", verify annual_energy=0.0
- **test_energy_estimate_calculating_status**: Energy estimate status="calculating", verify annual_energy=0.0 (not completed)
- **test_energy_estimate_completed_status**: Energy estimate status="completed", verify annual_energy is used from estimate
- **test_energy_estimate_zero_kwh**: Completed estimate with annual_energy_kwh=0, verify savings=0 and payback=0

### 6. Test Default Assumptions

Add tests verifying default parameters:

- **test_default_electricity_rate**: Verify electricity_rate_usd_per_kwh is set to 0.12 in stored analysis
- **test_default_escalation_rate**: Verify annual_rate_escalation_pct is set to 2.0 in stored analysis
- **test_default_lifespan_assumption**: Verify ROI calculation uses 25 years (implicit in formula verification)
- **test_stored_parameters**: Verify all default parameters are persisted to FinancialAnalysis record

### 7. Test Graceful Degradation

Add degradation scenario tests:

- **test_site_design_not_found**: Service raises ValueError when site_design_id doesn't exist
- **test_partial_data_calculation**: Only BOQ available (no energy), verify calculation proceeds with energy=0
- **test_partial_data_calculation_reverse**: Only energy available (BOQ fails), verify calculation proceeds with cost=0
- **test_update_existing_analysis**: Existing analysis record is updated rather than creating duplicate

### 8. Test Recalculation Trigger Scenarios

Add recalculation trigger tests:

- **test_create_new_analysis**: No existing analysis, verify new FinancialAnalysis record is created and added to db
- **test_update_existing_analysis_record**: Existing analysis exists, verify it's updated with new values and calculated_at timestamp
- **test_database_commit_called**: Verify db.commit() is called after calculations
- **test_database_refresh_called**: Verify db.refresh() is called to get updated record
- **test_calculated_at_timestamp**: Verify calculated_at field is set to current UTC time

### 9. Test Service Dependencies and Mocking

Add dependency injection tests:

- **test_boq_service_initialization**: Verify BOQService is initialized with correct tenant_id and user_id
- **test_energy_service_initialization**: Verify EnergyEstimationService is initialized with db session
- **test_service_factory_function**: Test get_financial_service factory returns properly configured service instance

### 10. Test Complex Integration Scenarios

Add end-to-end calculation tests:

- **test_full_calculation_flow**: Complete scenario with valid BOQ, completed energy estimate, verify all fields calculated correctly
- **test_multiple_designs_same_tender**: Verify calculations are independent per site_design_id
- **test_recalculation_with_changed_boq**: BOQ total changes, verify recalculation updates financial analysis
- **test_recalculation_with_changed_energy**: Energy estimate changes, verify recalculation updates financial analysis

### Test Organization Structure

```python
# Group tests by category using class-based organization
class TestCalculationFormulas:
    # Tests 2.1-2.4: Formula accuracy tests
    
class TestEdgeCases:
    # Tests 3.1-3.5: Edge case handling
    
class TestBOQIntegration:
    # Tests 4.1-4.4: BOQ service integration
    
class TestEnergyEstimateIntegration:
    # Tests 5.1-5.5: Energy service integration
    
class TestDefaultAssumptions:
    # Tests 6.1-6.4: Default parameter verification
    
class TestGracefulDegradation:
    # Tests 7.1-7.4: Error handling and degradation
    
class TestRecalculationTriggers:
    # Tests 8.1-8.5: Database operations and triggers
    
class TestServiceDependencies:
    # Tests 9.1-9.3: Service initialization
    
class TestComplexScenarios:
    # Tests 10.1-10.4: Integration scenarios
```

### Key Testing Patterns to Follow

1. **Mock Database Queries**: Use `side_effect` on `mock_db.query` to return different models (SiteDesign, FinancialAnalysis)
2. **Mock Service Dependencies**: Manually set `service.boq_service` and `service.energy_service` as MagicMock instances
3. **Verify Database Operations**: Assert `db.add()`, `db.commit()`, `db.refresh()` are called appropriately
4. **Use Parametrize**: For testing multiple scenarios with same logic (different values)
5. **Assertion Precision**: Use `pytest.approx()` for floating-point comparisons where appropriate
6. **Fixture Reuse**: Leverage existing `mock_db` and `service` fixtures, extend with new fixtures as needed

### Expected Test Coverage

- **Formula Accuracy**: 100% coverage of all three financial formulas
- **Edge Cases**: All zero/null/missing data scenarios
- **Integration**: Both BOQ and Energy service integration paths
- **Error Handling**: All exception paths and graceful degradation
- **Database Operations**: All CRUD operations on FinancialAnalysis model
- **Recalculation**: Trigger scenarios from BOQ/Energy changes