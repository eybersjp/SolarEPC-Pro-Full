I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Implement automatic recalculation of financial metrics when dependencies change:

- Add trigger in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\energy_estimation.py` after energy estimate completion to call `FinancialAnalysisService.calculate_financials()`
- Verify existing trigger in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\boq.py` (lines 22-35, 104, 167-168, 187) is properly calling financial recalculation
- Fix unreachable code issues in BOQ service (lines 104-106, 167-170)
- Ensure recalculation happens after BOQ item create/update/delete operations
- Add error handling to prevent BOQ/energy operations from failing if financial calculation fails