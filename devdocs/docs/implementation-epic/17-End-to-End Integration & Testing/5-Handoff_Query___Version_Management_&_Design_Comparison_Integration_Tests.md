I have the following user query that I want you to help me with. Implement the requested functionality following best practices.

Create integration tests for version management and design comparison workflows:

- Add tests in backend/tests/test_integration_version_management.py:
  - Test version creation, listing, and restoration via `DesignVersionService`
  - Verify automatic recalculation triggers on version restore (placement, energy, financials)
  - Test version snapshot data integrity and immutability
  - Validate audit logging for version operations
- Add frontend tests in frontend/src/components/DesignCanvas/**tests**/versionManagementIntegration.test.tsx:
  - Test complete workflow: Save version → View version list → Restore version → Verify recalculation
  - Test version comparison UI (if multiple versions exist)
  - Verify unsaved changes handling when switching versions
  - Test version metadata display and filtering
- Extend existing <traycer-file absPath="c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas_*tests*_\versionWorkflow.test.tsx">frontend/src/components/DesignCanvas/**tests**/versionWorkflow.test.tsx</traycer-file> with integration scenarios