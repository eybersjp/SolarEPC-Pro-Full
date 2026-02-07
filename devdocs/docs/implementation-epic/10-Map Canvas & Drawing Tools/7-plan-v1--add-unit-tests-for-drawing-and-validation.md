I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The frontend currently has **no testing infrastructure** in place. The codebase uses Next.js 14, React 18, TypeScript, React Query (TanStack Query), Zustand for state management, and @turf/turf for GeoJSON validation. The backend uses pytest, but the frontend needs a separate JavaScript/TypeScript testing setup. Key areas requiring test coverage include GeoJSON validation logic, Zustand store state management, React Query hooks with optimistic updates/rollback, and the polygon drawing workflow integration.

## Approach

Establish a comprehensive testing infrastructure using **Vitest** (fast, modern, Vite-based test runner), **React Testing Library** (component testing), and **MSW** (Mock Service Worker for API mocking). This stack aligns with modern React best practices and provides excellent TypeScript support. The plan focuses on unit tests for pure functions and stores, integration tests for hooks with API interactions, and workflow tests for the drawing feature. Tests will be co-located with source files in `__tests__` directories for better organization.

## Implementation Steps

### 1. Install Testing Dependencies

Add the following packages to `file:frontend/package.json`:

**Testing Framework & Utilities:**
- `vitest` - Fast unit test framework with native ESM support
- `@vitest/ui` - Optional UI for test visualization
- `jsdom` - DOM environment for testing

**React Testing:**
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom matchers for DOM assertions
- `@testing-library/user-event` - User interaction simulation

**Mocking & Utilities:**
- `msw` - Mock Service Worker for API mocking
- `@testing-library/react-hooks` - For testing custom hooks (if needed for isolated hook testing)

Add test script to package.json:
```json
"scripts": {
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage"
}
```

---

### 2. Create Vitest Configuration

Create `file:frontend/vitest.config.ts` with the following configuration:

- Extend from Next.js config for path aliases (`@/` mappings)
- Set test environment to `jsdom` for DOM testing
- Configure globals for `describe`, `it`, `expect` without imports
- Set up coverage reporting with thresholds (80% minimum recommended)
- Include setup files for test utilities
- Configure test file patterns: `**/__tests__/**/*.{test,spec}.{ts,tsx}`

---

### 3. Create Test Setup File

Create `file:frontend/src/test/setup.ts`:

- Import `@testing-library/jest-dom` for custom matchers
- Configure MSW server for API mocking
- Set up global test utilities and helpers
- Mock Leaflet and map-related modules (since they require browser APIs)
- Configure React Query test utilities with default options
- Add custom matchers for GeoJSON validation if needed

---

### 4. Create MSW API Mocks

Create `file:frontend/src/test/mocks/handlers.ts`:

Define MSW request handlers for:
- `GET /api/site-designs/:id` - Return mock site design data
- `PUT /api/site-designs/:id` - Simulate successful update
- `POST /api/site-designs` - Simulate creation
- `DELETE /api/site-designs/:id` - Simulate deletion

Create `file:frontend/src/test/mocks/server.ts`:
- Set up MSW server instance
- Export server for use in tests
- Configure request handlers

Create `file:frontend/src/test/fixtures/siteDesign.ts`:
- Define mock site design objects
- Include valid and invalid GeoJSON polygons
- Create factory functions for test data generation

---

### 5. Unit Tests for GeoJSON Validation

Create `file:frontend/src/lib/__tests__/geojsonValidation.test.ts`:

**Test Cases:**
- **Valid polygon** - 4+ points, closed, positive area, no self-intersections
- **Invalid structure** - Missing type, missing coordinates, wrong type
- **Insufficient points** - Less than 3 vertices (< 4 total with closure)
- **Unclosed polygon** - First and last points don't match
- **Zero/negative area** - Degenerate polygons
- **Self-intersecting polygon** - Figure-8 or overlapping edges (use turf.kinks)
- **Error handling** - Catch and return validation errors gracefully

Use `@turf/turf` helper functions to create test polygons programmatically.

---

### 6. Unit Tests for Zustand Store

Create `file:frontend/src/stores/__tests__/useDesignCanvasStore.test.ts`:

**Test Cases:**
- **Initial state** - Verify default values (mode: 'select', syncState: 'synced', etc.)
- **setMode** - Changes mode and resets selectedGeometry appropriately
- **setSelectedTool** - Updates selected tool
- **setSelectedGeometry** - Updates selected geometry
- **setSyncState** - Transitions between pending/syncing/synced/failed
- **setPlacementLoading** - Toggles loading state
- **toggleRightPanel** - Toggles panel open/closed state
- **Mode transitions** - Verify state cleanup when switching modes

Use Zustand's testing utilities or direct store manipulation for isolated testing.

---

### 7. Unit Tests for React Query Hooks

Create `file:frontend/src/hooks/__tests__/useSiteDesigns.test.ts`:

**Test Cases for `useUpdateSiteDesignMutation`:**
- **Successful update** - Verify optimistic update, API call, cache update, toast success
- **Failed update with rollback** - Verify optimistic update, API failure, rollback to previous data, toast error
- **Retry logic** - Verify 3 retry attempts on failure
- **Sync state transitions** - Verify setSyncState calls (syncing → synced/failed)
- **Cache invalidation** - Verify query invalidation on success and settled

**Test Cases for `useCreateSiteDesignMutation`:**
- **Successful creation** - Verify API call, cache invalidation, toast success
- **Failed creation** - Verify error handling, toast error

**Test Cases for `useDeleteSiteDesignMutation`:**
- **Successful deletion** - Verify API call, cache invalidation, toast success
- **Failed deletion** - Verify error handling, toast error

Use `@testing-library/react` with `QueryClientProvider` wrapper and MSW for API mocking. Mock Zustand store methods to verify state updates.

---

### 8. Integration Tests for Drawing Workflow

Create `file:frontend/src/components/DesignCanvas/__tests__/drawingWorkflow.test.tsx`:

**Test Scenarios:**
- **Complete drawing flow** - Click to add vertices → Enter/double-click to complete → Validate → Save
- **Validation failure** - Draw invalid polygon (< 3 points) → Show error toast → Don't save
- **Self-intersection detection** - Draw self-intersecting polygon → Show error toast → Don't save
- **Cancel drawing** - Add vertices → Press Escape → Clear state → Return to select mode
- **Tool switching** - Start drawing → Switch tool → Clear vertices → Start new drawing
- **Optimistic update success** - Complete drawing → Verify optimistic cache update → API success → Verify final state
- **Optimistic update rollback** - Complete drawing → API failure → Verify rollback → Show error toast

Mock `useMapEvents` from react-leaflet to simulate map interactions. Use `@testing-library/user-event` for keyboard events. Verify integration between `PolygonDrawingLayer`, `useDesignCanvasStore`, `useSiteDesigns`, and `validatePolygon`.

---

### 9. Test Utilities and Helpers

Create `file:frontend/src/test/utils.tsx`:

**Utility Functions:**
- `renderWithProviders` - Wrapper component with QueryClientProvider, AuthContext, etc.
- `createTestQueryClient` - Factory for test query client with default options
- `waitForLoadingToFinish` - Helper to wait for async operations
- `mockLeafletMap` - Mock Leaflet map instance for component tests

Create `file:frontend/src/test/factories/geojson.ts`:
- `createValidPolygon` - Generate valid test polygons
- `createInvalidPolygon` - Generate invalid test polygons with specific issues
- `createSelfIntersectingPolygon` - Generate self-intersecting polygons

---

### 10. Add Test Scripts and CI Integration

Update `file:frontend/package.json` scripts:
- `test` - Run tests in watch mode
- `test:ci` - Run tests once with coverage
- `test:coverage` - Generate coverage report

Create `file:frontend/.github/workflows/test.yml` (if using GitHub Actions):
- Run tests on PR and push to main
- Enforce coverage thresholds (80% recommended)
- Upload coverage reports

Add coverage configuration to `vitest.config.ts`:
- Include: `src/**/*.{ts,tsx}`
- Exclude: `src/**/*.d.ts`, `src/test/**`, `src/**/__tests__/**`
- Thresholds: lines 80%, functions 80%, branches 75%, statements 80%

---

## Testing Best Practices

1. **Co-locate tests** - Place `__tests__` directories next to source files
2. **Descriptive test names** - Use "should..." or "when...then..." patterns
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Mock external dependencies** - Use MSW for API, mock Leaflet/map libraries
5. **Test user behavior** - Focus on what users see/do, not implementation details
6. **Avoid testing implementation** - Don't test internal state unless necessary
7. **Use data-testid sparingly** - Prefer accessible queries (getByRole, getByLabelText)
8. **Clean up after tests** - Reset mocks, clear cache between tests

---

## Test Coverage Goals

| Area | Target Coverage |
|------|----------------|
| Validation Logic (`geojsonValidation.ts`) | 100% |
| Zustand Store (`useDesignCanvasStore.ts`) | 95% |
| React Query Hooks (`useSiteDesigns.ts`) | 90% |
| Drawing Components | 80% |
| Overall Frontend | 80% |

---

## Example Test Structure

```
frontend/src/
├── lib/
│   ├── __tests__/
│   │   └── geojsonValidation.test.ts
│   └── geojsonValidation.ts
├── stores/
│   ├── __tests__/
│   │   └── useDesignCanvasStore.test.ts
│   └── useDesignCanvasStore.ts
├── hooks/
│   ├── __tests__/
│   │   └── useSiteDesigns.test.ts
│   └── useSiteDesigns.ts
├── components/
│   └── DesignCanvas/
│       ├── __tests__/
│       │   └── drawingWorkflow.test.tsx
│       └── PolygonDrawingLayer.tsx
└── test/
    ├── setup.ts
    ├── utils.tsx
    ├── mocks/
    │   ├── handlers.ts
    │   └── server.ts
    └── fixtures/
        └── siteDesign.ts
```