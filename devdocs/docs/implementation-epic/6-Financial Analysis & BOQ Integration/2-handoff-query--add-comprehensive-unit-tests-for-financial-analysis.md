I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create comprehensive unit tests for financial analysis service in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\tests\test_financial_analysis.py`:

- Test calculation accuracy for all formulas (annual savings, payback, ROI)
- Test edge cases: zero energy, zero cost, missing BOQ data, failed energy estimate
- Test BOQ integration with various cost scenarios
- Test default assumptions are correctly applied
- Test graceful degradation when energy estimate is missing or failed
- Verify calculations match acceptance criteria formulas
- Add tests for recalculation trigger scenarios