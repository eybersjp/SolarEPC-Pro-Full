I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Enhance proposal service with audit logging and error handling:

- Add audit logging to `ProposalService.generate_pdf()` and `generate_bom_csv()` using `AuditService` from `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\audit.py`
- Enhance template `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\templates\proposal.html` with better "N/A" handling for missing energy/financial data
- Update `ProposalService.generate_pdf()` to handle missing `EnergyEstimate` and `FinancialAnalysis` gracefully
- Add error handling in `generate_proposal_task` for partial data scenarios
- Update `_generate_monthly_chart()` to handle empty/null data gracefully