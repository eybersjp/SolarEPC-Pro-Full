I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Add intelligent recalculation logic to `DesignVersionService.restore_from_version()`:

- Compare restored snapshot parameters with current state to detect changes in equipment, placement settings, or geometry
- Trigger energy estimation recalculation via `EnergyEstimationService` from `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\energy_estimation.py` if relevant parameters changed
- Trigger financial analysis recalculation via `FinancialAnalysisService` from `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\services\financial_analysis.py` if system cost or energy estimates changed
- Invalidate cached energy estimates using `invalidate_cache_if_needed()` when parameters change
- Update API endpoint in `c:\Users\SSTECH\developments\apps\solarepc-pro\backend\app\api\site_designs.py` to return recalculation status