I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create comprehensive unit tests for the new components:

- Create frontend/src/components/DesignCanvas/**tests**/EquipmentSelector.test.tsx testing equipment selection, search, spec display, and save behavior
- Create frontend/src/components/DesignCanvas/**tests**/PlacementSettings.test.tsx testing slider interactions, debounced save, recalculate button
- Add tests for equipment hooks in frontend/src/hooks/**tests**/useEquipment.test.tsx
- Test equipment selection gating logic in existing FloatingPalette tests
- Use MSW to mock equipment API endpoints in `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\test\mocks\handlers.ts`