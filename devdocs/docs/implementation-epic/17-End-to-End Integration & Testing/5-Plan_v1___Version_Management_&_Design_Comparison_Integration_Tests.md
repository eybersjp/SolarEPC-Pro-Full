I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The version management system is already well-implemented with comprehensive tests covering core functionality. The backend has robust tests for version creation, restoration, snapshot integrity, tenant isolation, and audit logging. The frontend tests cover the complete workflow, error handling, React Query integration, and state management. However, there are opportunities to enhance integration testing by:

1. **Backend**: Adding explicit placement algorithm recalculation tests, complete workflow integration (placement → energy → financial → proposal), and version comparison scenarios with equipment changes
2. **Frontend**: Testing keyboard shortcuts, placement algorithm UI feedback during restore, and deeper integration with the complete design canvas workflow

## Approach

The implementation will extend existing test files rather than create new ones, following established patterns. For backend, we'll add test classes to `test_integration_version_management.py` focusing on placement recalculation and complete workflow integration. For frontend, we'll enhance `versionManagementIntegration.test.tsx` with additional scenarios covering keyboard shortcuts, placement UI feedback, and integration with the broader design canvas workflow. This approach maintains consistency with existing test structure while filling identified gaps.

## Implementation Steps

### Backend Integration Tests Enhancement

#### 1. Add Placement Algorithm Recalculation Tests

**File**: `file:backend/tests/test_integration_version_management.py`

Add a new test class `TestVersionRestorePlacementRecalculation` after the existing `TestVersionRestorationWorkflow` class:

- **Test placement recalculation trigger on geometry changes**: Create a version, modify `site_boundary` and `exclusion_zones`, restore version, verify `PlacementAlgorithmService.calculate_placement()` is called
- **Test placement recalculation with equipment changes**: Create version with one module type, change to different module (different dimensions), restore, verify placement recalculation triggered
- **Test placement recalculation with settings changes**: Modify `row_spacing_m`, `edge_setback_m`, `tilt_deg`, `azimuth_deg`, restore version, verify recalculation
- **Test placement task status tracking**: For large sites (>1000 modules), verify async task is created and status transitions from `pending` → `processing` → `completed`
- **Test placement recalculation skipped for metadata-only changes**: Change only `name` field, restore, verify placement service not called

Mock `PlacementAlgorithmService` similar to how `EnergyEstimationService` and `FinancialAnalysisService` are mocked in existing tests. Use `@patch("app.services.design_version.PlacementAlgorithmService")` decorator.

#### 2. Add Complete Workflow Integration Tests

**File**: `file:backend/tests/test_integration_version_management.py`

Add a new test class `TestVersionRestoreCompleteWorkflow` to test the full cascade:

- **Test complete recalculation cascade**: Create version → Modify design (geometry + equipment + settings) → Restore version → Verify sequence:
  1. Placement recalculation triggered
  2. Energy estimation triggered (after placement completes)
  3. Financial analysis triggered (after energy completes)
  4. Verify audit logs for all operations
  
- **Test workflow with async placement**: For large site, verify:
  1. Placement task created with status `pending`
  2. Energy estimation waits for placement completion
  3. Financial analysis waits for energy completion
  4. Poll placement task status endpoint
  
- **Test workflow with partial failures**: 
  1. Placement succeeds
  2. Energy estimation fails (mock PVWatts timeout)
  3. Financial analysis still completes with default energy values
  4. Verify graceful degradation

- **Test proposal regeneration after version restore**: 
  1. Create proposal for original design
  2. Restore to different version
  3. Verify existing proposal marked as outdated
  4. Generate new proposal with restored design data

Use the existing `workflow_context` fixture and extend it with proposal creation. Mock `ProposalService` to verify regeneration triggers.

#### 3. Add Version Comparison Tests

**File**: `file:backend/tests/test_integration_version_management.py`

Enhance the existing `TestVersionComparisonWorkflow` class:

- **Test comparison with equipment changes**: Create versions with different module types (e.g., 400W vs 550W), verify snapshot captures equipment specs, compare `total_modules` and `system_size_kwp` differences
  
- **Test comparison with geometry changes**: Create versions with different `site_boundary` areas, verify `site_area_sqm` differences, compare `module_placements` arrays

- **Test comparison with energy/financial data**: Create versions, calculate energy for each, verify snapshots include energy estimates, compare `annual_energy_kwh` and `simple_payback_years`

- **Test version diff calculation**: Add helper method to calculate differences between two version snapshots, verify it correctly identifies changed fields (geometry, equipment, settings, results)

#### 4. Add Performance and Edge Case Tests

**File**: `file:backend/tests/test_integration_version_management.py`

Add a new test class `TestVersionPerformanceAndEdgeCases`:

- **Test large snapshot data**: Create design with 500+ module placements, 10+ exclusion zones, verify version creation completes in <2 seconds, verify snapshot size is reasonable (<1MB)

- **Test rapid version creation**: Create 10 versions in quick succession, verify all snapshots are unique and correctly ordered

- **Test version restore with missing equipment**: Create version, delete equipment from library, attempt restore, verify appropriate error handling

- **Test version restore with invalid snapshot data**: Manually corrupt snapshot JSON in database, attempt restore, verify validation catches corruption

### Frontend Integration Tests Enhancement

#### 5. Add Keyboard Shortcut Tests

**File**: `file:frontend/src/components/DesignCanvas/__tests__/versionManagementIntegration.test.tsx`

Add a new describe block `Keyboard Shortcuts`:

- **Test Ctrl+H opens version list**: Simulate `keydown` event with `ctrlKey: true, key: 'h'`, verify `VersionList` dropdown opens

- **Test Escape closes version list**: Open version list, simulate `Escape` key, verify dropdown closes

- **Test keyboard navigation in version list**: Open list, use `ArrowDown`/`ArrowUp` to navigate versions, verify focus moves correctly

- **Test Enter key to restore selected version**: Navigate to version with keyboard, press `Enter`, verify restore confirmation dialog opens

Use `userEvent.keyboard()` from `@testing-library/user-event` for keyboard simulation.

#### 6. Add Placement Algorithm UI Integration Tests

**File**: `file:frontend/src/components/DesignCanvas/__tests__/versionManagementIntegration.test.tsx`

Add a new describe block `Placement Algorithm Integration`:

- **Test placement loading indicator during restore**: Restore version, verify `PlacementLoadingOverlay` component appears, verify loading message "Recalculating module placement..."

- **Test placement progress polling**: Mock placement task status endpoint returning `pending` → `processing` → `completed`, verify UI polls every 2 seconds, verify progress updates displayed

- **Test placement completion notification**: When placement completes, verify toast notification "Module placement recalculated", verify map canvas updates with new module positions

- **Test placement failure handling**: Mock placement task failure, verify error message displayed, verify retry button appears, test retry functionality

Use MSW handlers in `file:frontend/src/test/mocks/handlers.ts` to mock placement task status endpoint. Verify `useDesignCanvasStore` state updates (`placementLoading`, `placementTaskId`).

#### 7. Add Complete Design Canvas Workflow Integration

**File**: `file:frontend/src/components/DesignCanvas/__tests__/versionManagementIntegration.test.tsx`

Add a new describe block `Complete Design Canvas Integration`:

- **Test version save from design canvas**: Render full `CanvasLayout` component, make design changes (modify equipment, draw boundary), click "Save Version" button in toolbar, verify `SaveVersionModal` opens with current design state

- **Test version restore updates all canvas components**: 
  1. Restore version with different equipment
  2. Verify `EquipmentSelector` updates to show restored equipment
  3. Verify `PlacementSettings` updates to show restored settings
  4. Verify `MapCanvas` redraws with restored boundary
  5. Verify `ResultsBottomSheet` updates with restored energy/financial data

- **Test version comparison in results panel**: Open `ResultsBottomSheet`, switch to "Versions" tab (if exists), verify multiple versions displayed side-by-side with metrics comparison

- **Test version restore clears unsaved changes**: Make changes to design, verify `isModifiedSinceVersion` flag set, restore version, verify flag cleared, verify beforeunload handler no longer warns

Render the complete `CanvasLayout` component with all child components. Use fixtures from `file:frontend/src/test/fixtures/siteDesign.ts` and `file:frontend/src/test/fixtures/designVersion.ts`.

#### 8. Add Version Metadata and Filtering Enhancement Tests

**File**: `file:frontend/src/components/DesignCanvas/__tests__/versionManagementIntegration.test.tsx`

Enhance the existing `Version Filtering and Search` describe block:

- **Test filter by date range**: Add date range picker UI test, filter versions created in last 7 days, verify filtered results

- **Test filter by creator**: Filter versions by user who created them, verify results

- **Test sort by different criteria**: Test sorting by date (newest/oldest), by name (A-Z/Z-A), by system size (largest/smallest)

- **Test version metadata tooltips**: Hover over version badges (modules, kWp), verify tooltips show detailed information (e.g., "80 modules × 400W = 32.0 kWp")

#### 9. Add Error Recovery and Resilience Tests

**File**: `file:frontend/src/components/DesignCanvas/__tests__/versionManagementIntegration.test.tsx`

Add a new describe block `Error Recovery and Resilience`:

- **Test network failure during version save**: Mock network error, verify error toast, verify modal stays open for retry, verify form data preserved

- **Test concurrent version operations**: Attempt to save version while another save is in progress, verify second operation queued or blocked with appropriate message

- **Test version restore during active placement calculation**: Start placement calculation, attempt version restore, verify warning dialog "Placement calculation in progress. Restoring will cancel it."

- **Test stale version data handling**: Mock version list with stale data, restore version, verify fresh data fetched before restore, verify no race conditions

### Documentation and Test Utilities

#### 10. Add Test Utilities and Helpers

**File**: `file:backend/tests/test_integration_version_management.py`

Add helper functions at module level:

```python
def create_version_with_energy_and_financial(
    db: Session, 
    service: DesignVersionService, 
    design_id: UUID,
    version_name: str,
    annual_energy_kwh: float = 50000.0,
    system_cost_usd: float = 80000.0
) -> DesignVersion:
    """Helper to create version with complete energy and financial data."""
    # Implementation creates energy estimate and financial analysis before version
```

```python
def assert_recalculation_triggered(
    mock_placement: MagicMock,
    mock_energy: MagicMock,
    mock_financial: MagicMock,
    expected_calls: dict
):
    """Helper to verify recalculation services were called correctly."""
    # Implementation checks mock call counts and arguments
```

**File**: `file:frontend/src/test/utils.tsx`

Add helper functions:

```typescript
export function simulateVersionWorkflow(
  queryClient: QueryClient,
  designId: string,
  versionName: string
): Promise<void> {
  // Helper to simulate complete version save → restore workflow
}

export function mockPlacementTaskStatus(
  taskId: string,
  statusSequence: Array<'pending' | 'processing' | 'completed' | 'failed'>
): void {
  // Helper to mock placement task status transitions
}
```

#### 11. Update Test Documentation

**File**: `file:backend/tests/test_integration_version_management.py`

Add comprehensive docstring at the top of the file:

```python
"""
Integration tests for Design Version Management.

This module tests the complete version management workflow including:
- Version creation with snapshot data capture
- Version listing and filtering with tenant isolation
- Version restoration with automatic recalculation triggers
- Placement algorithm recalculation on geometry/equipment changes
- Energy estimation recalculation on system parameters changes
- Financial analysis recalculation on cost/energy changes
- Complete workflow integration (placement → energy → financial → proposal)
- Version comparison scenarios
- Audit logging for all version operations
- Performance and edge case handling

Test Structure:
- TestVersionCreationWorkflow: Version creation and snapshot capture
- TestVersionRestorationWorkflow: Basic restoration with recalculations
- TestVersionRestorePlacementRecalculation: Placement-specific recalculation tests
- TestVersionRestoreCompleteWorkflow: Full cascade workflow tests
- TestVersionSnapshotIntegrity: Snapshot immutability and data integrity
- TestVersionComparisonWorkflow: Version comparison scenarios
- TestVersionTenantIsolation: Multi-tenant security tests
- TestVersionErrorHandling: Error scenarios and edge cases
- TestVersionPerformanceAndEdgeCases: Performance and stress tests
"""
```

**File**: `file:frontend/src/components/DesignCanvas/__tests__/versionManagementIntegration.test.tsx`

Add comprehensive comment block at the top:

```typescript
/**
 * Integration tests for Version Management UI workflow.
 * 
 * Tests cover:
 * - Complete workflow: Save → List → Restore → Verify recalculation
 * - Version comparison UI with multiple versions
 * - Unsaved changes handling and warnings
 * - Version filtering, search, and sorting
 * - Keyboard shortcuts (Ctrl+H, Escape, Enter)
 * - Placement algorithm integration and UI feedback
 * - Complete design canvas integration
 * - Error handling, retry logic, and resilience
 * - React Query cache management and invalidation
 * - Store state management during version operations
 * 
 * Related components:
 * - SaveVersionModal: Version creation UI
 * - VersionList: Version listing and restore UI
 * - CanvasLayout: Main design canvas container
 * - PlacementLoadingOverlay: Placement progress indicator
 * - ResultsBottomSheet: Results display with version comparison
 */
```

### Test Execution and Validation

#### 12. Run and Validate Tests

**Backend**:
```bash
# Run version management integration tests
pytest backend/tests/test_integration_version_management.py -v -m integration

# Run with coverage
pytest backend/tests/test_integration_version_management.py --cov=app.services.design_version --cov-report=html

# Verify all test classes pass
pytest backend/tests/test_integration_version_management.py::TestVersionRestorePlacementRecalculation -v
pytest backend/tests/test_integration_version_management.py::TestVersionRestoreCompleteWorkflow -v
```

**Frontend**:
```bash
# Run version management integration tests
npm test -- versionManagementIntegration.test.tsx

# Run with coverage
npm test -- versionManagementIntegration.test.tsx --coverage

# Run specific test suites
npm test -- versionManagementIntegration.test.tsx -t "Keyboard Shortcuts"
npm test -- versionManagementIntegration.test.tsx -t "Placement Algorithm Integration"
```

**Validation Checklist**:
- ✅ All backend tests pass with >90% coverage for `DesignVersionService`
- ✅ All frontend tests pass with >85% coverage for version management components
- ✅ No flaky tests (run 10 times, all pass)
- ✅ Test execution time <30 seconds for backend, <60 seconds for frontend
- ✅ All mocks properly cleaned up (no test pollution)
- ✅ Audit logs verified in all version operations
- ✅ Tenant isolation enforced in all tests
- ✅ Error scenarios properly handled with appropriate messages

This project uses a task-tracking convention. After completing all changes, create the file `~/.traycer/yolo_artifacts/5cb140f0-92a1-4b22-9f8f-19ddbdb2f600.json` with content `{}`. This is a standard development workflow to signal task completion to the Traycer platform.