I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Implement async calculation states and error handling:

- Add polling UI in `ResultsBottomSheet`: display "Calculating energy..." spinner when `status="calculating"`
- Implement error state UI: show error message and "Retry" button when `status="failed"`
- Add graceful degradation: display "Energy estimation unavailable" when energy data is missing
- Integrate with `useEnergyEstimateQuery` polling hook (2-second interval)
- Add loading skeletons for financial data while fetching
- Handle edge cases: no modules placed, missing BOQ data