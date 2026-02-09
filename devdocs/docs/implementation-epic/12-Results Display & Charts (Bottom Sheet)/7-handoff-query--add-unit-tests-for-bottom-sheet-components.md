I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create comprehensive unit tests for the bottom sheet:

- Create frontend/src/components/DesignCanvas/**tests**/ResultsBottomSheet.test.tsx
- Test collapsed/expanded state transitions
- Test polling logic with mock data (calculating → completed → failed states)
- Test chart rendering with monthly energy data
- Test error states and retry functionality
- Test graceful degradation when data is unavailable
- Mock React Query hooks using MSW handlers in `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\test\mocks\handlers.ts`