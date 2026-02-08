I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase follows a well-structured testing pattern using Vitest, React Testing Library, and MSW for API mocking. Existing tests demonstrate comprehensive coverage of hooks, components, and stores with patterns for optimistic updates, error handling, and user interactions. The equipment and placement settings components are already implemented with React Query hooks, Zustand store integration, and debounced auto-save functionality.

## Approach

Create comprehensive unit tests for the newly implemented equipment and placement features following the established testing patterns. Tests will cover component rendering, user interactions, API integration, error handling, and state management. Use MSW to mock equipment API endpoints, create test fixtures for equipment data, and verify the equipment selection gating logic for drawing tools. Tests will ensure proper debouncing, optimistic updates, and integration with the design canvas store.

## Implementation Steps

### 1. Create Equipment Test Fixtures

Create `file:frontend/src/test/fixtures/equipment.ts` with mock equipment data:
- Export `mockEquipmentModule` with complete `EquipmentModule` properties (id, manufacturer, model, wattage, efficiency, dimensions, electrical specs)
- Export `mockEquipmentInverter` with complete `EquipmentInverter` properties (id, manufacturer, model, capacity_kw, voltage ranges, MPPT channels)
- Export `createMockModule(overrides)` factory function for custom module data
- Export `createMockInverter(overrides)` factory function for custom inverter data
- Include multiple mock modules and inverters in arrays for list testing

### 2. Add Equipment API Handlers to MSW

Update `file:frontend/src/test/mocks/handlers.ts`:
- Add `http.get('*/api/equipment/modules')` handler returning array of mock modules
- Add `http.get('*/api/equipment/inverters')` handler returning array of mock inverters
- Support query parameters for search and manufacturer filters
- Return filtered results based on query params
- Add delay option for testing loading states

### 3. Create useEquipment Hook Tests

Create `file:frontend/src/hooks/__tests__/useEquipment.test.tsx`:
- Test `useEquipmentModulesQuery()` successfully fetches modules list
- Test `useEquipmentInvertersQuery()` successfully fetches inverters list
- Test loading states while fetching equipment data
- Test error handling when API calls fail (use MSW override with 500 status)
- Test query with filters (search, manufacturer) and verify correct API calls
- Test query key generation with different filter combinations
- Use `renderHook` with QueryClientProvider wrapper
- Verify data structure matches `EquipmentModule` and `EquipmentInverter` types

### 4. Create EquipmentSelector Component Tests

Create `file:frontend/src/components/DesignCanvas/__tests__/EquipmentSelector.test.tsx`:
- **Rendering Tests:**
  - Test component renders with loading skeletons initially
  - Test component renders module and inverter select dropdowns after loading
  - Test displays error alert when equipment fetch fails
  - Test shows equipment specs after selection (wattage, efficiency, dimensions for modules; capacity, MPPT, voltage for inverters)
  - Test shows info message when no equipment selected

- **Selection Tests:**
  - Test module selection triggers `useUpdateSiteDesignMutation` with `equipment_module_id`
  - Test inverter selection triggers mutation with `equipment_inverter_id`
  - Test selections update `useDesignCanvasStore` via `setEquipmentSelection`
  - Test loading spinner shows during mutation
  - Test dropdowns are disabled during mutation

- **Integration Tests:**
  - Test component initializes with equipment from design data
  - Test equipment specs display correct values from selected equipment
  - Test search/filter functionality in dropdowns (if implemented)
  - Mock `useSiteDesignQuery` to return design with pre-selected equipment
  - Mock `useEquipmentModulesQuery` and `useEquipmentInvertersQuery` with test data
  - Use `userEvent` to interact with select components
  - Verify toast notifications on save success/failure

### 5. Create PlacementSettings Component Tests

Create `file:frontend/src/components/DesignCanvas/__tests__/PlacementSettings.test.tsx`:
- **Rendering Tests:**
  - Test component renders all setting controls (azimuth slider + input, row spacing slider, tilt slider, orientation switch)
  - Test displays current values from design data
  - Test shows loading state when design is not loaded

- **Slider Interaction Tests:**
  - Test azimuth slider updates local state and displays value (0-360°)
  - Test azimuth input field updates value and syncs with slider
  - Test row spacing slider updates value (0.5-10m)
  - Test tilt slider updates value (0-90°)
  - Test orientation switch toggles between portrait/landscape
  - Use `userEvent` to interact with sliders and inputs
  - Verify `setPlacementSettings` is called with correct values

- **Debounced Auto-Save Tests:**
  - Test settings changes trigger debounced save after 3 seconds
  - Test multiple rapid changes only trigger one save
  - Test `useUpdateSiteDesignMutation` is called with `placement_settings`
  - Test `setSyncState('pending')` is called on setting change
  - Use `vi.useFakeTimers()` to control debounce timing
  - Verify optimistic update behavior

- **Recalculate Button Tests:**
  - Test recalculate button triggers `useRecalculatePlacementMutation`
  - Test button shows loading spinner during recalculation
  - Test button is disabled during recalculation
  - Test success toast on successful recalculation
  - Test error toast on failed recalculation
  - Mock mutation responses with MSW

### 6. Update FloatingPalette Tests for Equipment Gating

Update or create `file:frontend/src/components/DesignCanvas/__tests__/FloatingPalette.test.tsx`:
- **Equipment Gating Tests:**
  - Test drawing tools (roof, ground, carport, exclusion) are disabled when `hasEquipmentSelected` is false
  - Test drawing tools are enabled when `hasEquipmentSelected` is true
  - Test select and edit tools are always enabled regardless of equipment selection
  - Test tooltip shows "Select equipment to enable drawing tools" on disabled tools
  - Test clicking disabled tool does not change mode or selectedTool
  - Test clicking enabled drawing tool sets mode to 'draw' and selectedTool correctly

- **Store Integration Tests:**
  - Test component reads `hasEquipmentSelected` from `useDesignCanvasStore`
  - Test equipment selection state changes enable/disable tools dynamically
  - Use `useDesignCanvasStore.setState()` to simulate equipment selection changes
  - Verify visual states (opacity, cursor) for disabled tools

### 7. Integration Test for Equipment Selection Flow

Create `file:frontend/src/components/DesignCanvas/__tests__/equipmentSelectionFlow.test.tsx`:
- Test complete flow: select module → select inverter → drawing tools enabled
- Test flow: deselect equipment → drawing tools disabled → mode resets to 'select'
- Test equipment selection persists across component remounts
- Test equipment selection triggers immediate save to backend
- Test error handling during equipment selection save
- Render `EquipmentSelector` and `FloatingPalette` together
- Verify store state changes propagate correctly between components

### 8. Add Store Tests for Equipment State

Update `file:frontend/src/stores/__tests__/useDesignCanvasStore.test.ts`:
- Test `setEquipmentSelection(moduleId, inverterId)` updates state correctly
- Test `hasEquipmentSelected` is true when both module and inverter are set
- Test `hasEquipmentSelected` is false when either is null
- Test `clearEquipmentSelection()` resets equipment state
- Test equipment deselection resets mode to 'select' if currently in 'draw' mode
- Test equipment deselection clears selectedTool if in 'draw' mode
- Test `setPlacementSettings()` merges settings correctly
- Test placement settings state updates independently

## Testing Utilities and Patterns

**Common Test Setup:**
```typescript
// Use existing renderWithProviders from test/utils.tsx
// Mock toast notifications
vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Reset store before each test
beforeEach(() => {
  useDesignCanvasStore.setState({
    hasEquipmentSelected: false,
    equipmentModuleId: null,
    equipmentInverterId: null,
    placementSettings: {},
  })
})
```

**MSW Handler Pattern:**
```typescript
// Override handlers for specific tests
server.use(
  http.get('*/api/equipment/modules', () => {
    return HttpResponse.json([mockEquipmentModule])
  })
)
```

**Debounce Testing Pattern:**
```typescript
vi.useFakeTimers()
// Trigger change
await user.click(slider)
// Fast-forward time
vi.advanceTimersByTime(3000)
// Verify mutation called
await waitFor(() => expect(updateMutation).toHaveBeenCalled())
vi.useRealTimers()
```

## Test Coverage Goals

- **EquipmentSelector**: 90%+ coverage (rendering, selection, specs display, error handling)
- **PlacementSettings**: 90%+ coverage (sliders, debounce, recalculate, error handling)
- **useEquipment hooks**: 100% coverage (simple query hooks)
- **FloatingPalette gating**: 100% coverage of equipment-related logic
- **Store equipment state**: 100% coverage of equipment-related actions