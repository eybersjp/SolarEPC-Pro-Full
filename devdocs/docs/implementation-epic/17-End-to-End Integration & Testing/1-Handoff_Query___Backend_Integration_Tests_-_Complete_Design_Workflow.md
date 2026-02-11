I have the following user query that I want you to help me with. Implement the requested functionality following best practices.

Create comprehensive backend integration tests for the complete design workflow:

- Test flow: Create tender → Create site design → Update equipment → Draw boundary → Auto-place modules → Calculate energy → Generate financials → Create proposal
- Add integration test in backend/tests/test_integration_design_workflow.py covering all services: `SiteDesignService`, `PlacementAlgorithmService`, `EnergyEstimationService`, `FinancialAnalysisService`, `ProposalService`
- Test API endpoints in sequence: POST `/tenders/{id}/site-designs`, PUT `/site-designs/{id}`, POST `/site-designs/{id}/energy-estimate`, GET `/site-designs/{id}/energy-estimate`, POST `/site-designs/{id}/proposal`
- Verify data persistence, tenant isolation, and audit logging across the workflow
- Use real database session (SQLite) similar to `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\tests\test_energy_estimation_integration.py` pattern