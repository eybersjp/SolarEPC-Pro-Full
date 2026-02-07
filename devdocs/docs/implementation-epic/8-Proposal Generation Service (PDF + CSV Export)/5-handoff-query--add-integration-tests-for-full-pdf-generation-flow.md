I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create integration tests for end-to-end proposal generation:

- Add integration tests in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\tests\test_proposal.py` for:
  - Full async PDF generation flow with Celery task
  - API endpoint `/site-designs/{id}/proposal` with real database
  - Task status polling endpoint `/tasks/{task_id}`
  - CSV export endpoint `/site-designs/{id}/export-csv`
  - Integration with `SiteDesign`, `EnergyEstimate`, `FinancialAnalysis`, and `BOQItem` models
- Test with real WeasyPrint PDF generation (not mocked)
- Verify file storage and retrieval
- Test tenant isolation and permissions