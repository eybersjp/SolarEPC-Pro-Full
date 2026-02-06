I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create integration tests for the financial analysis API endpoint in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\tests\test_financial_api.py`:

- Test end-to-end flow: create design → add BOQ items → calculate energy → get financial analysis
- Test automatic calculation when analysis doesn't exist
- Test recalculation when BOQ or energy estimate changes
- Test API response format matches `FinancialAnalysisResponse` schema
- Test error handling for missing site design
- Test tenant isolation and access control
- Verify calculations are persisted correctly in database