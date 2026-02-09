I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The `DesignsList` component is a presentational component that displays site designs in a responsive grid layout. It handles three states: loading (skeleton cards), empty (no designs with CTA), and populated (design cards with navigation). The component uses Next.js Link for navigation, date-fns for formatting, and Lucide icons for visual elements. The codebase follows a consistent testing pattern using Vitest, React Testing Library, and MSW for API mocking, with well-established fixtures and test utilities.

## Approach

Create comprehensive unit tests covering all component states and user interactions. Tests will verify loading skeletons, empty state messaging and navigation, design card rendering with correct data formatting, and navigation link functionality. The tests will follow existing patterns from `EquipmentSelector.test.tsx` and `PlacementSettings.test.tsx`, using `renderWithProviders`, MSW handlers, and fixture data. Focus on accessibility, user interactions, and visual regression prevention through snapshot-style assertions.

## Implementation Steps

### 1. Create Test File Structure

Create `file:frontend/src/components/SiteDesigns/__tests__/DesignsList.test.tsx` with the following test suite structure:

- Import necessary testing utilities from `@/test/utils`
- Import component under test: `DesignsList`
- Import fixtures: `mockSiteDesign`, `createMockSiteDesign` from `@/test/fixtures/siteDesign`
- Import MSW utilities: `server`, `http`, `HttpResponse` from `@/test/mocks/server`
- Set up describe block: `describe('DesignsList', () => {...})`

### 2. Test Loading State

**Test: "should render skeleton cards while loading"**

- Render component with `isLoading={true}` and `designs={undefined}`
- Assert exactly 3 skeleton cards are rendered using `screen.getAllByTestId` or class selectors
- Verify skeleton elements have correct structure (header skeletons, content skeletons, button skeleton)
- Ensure no actual design data is displayed during loading

### 3. Test Empty State

**Test: "should render empty state when no designs exist"**

- Render component with `isLoading={false}` and `designs={[]}`
- Assert "No designs found" heading is visible using `screen.getByText(/No designs found/i)`
- Verify descriptive message about creating first design is present
- Check Layers icon is rendered (accessibility: decorative element)
- Verify "Create New Design" button exists and has correct href

**Test: "should navigate to create new design from empty state"**

- Render empty state
- Find "Create New Design" button using `screen.getByRole('link', { name: /Create New Design/i })`
- Assert button links to `/tenders/${tenderId}/design/new` using `expect(button).toHaveAttribute('href', ...)`

### 4. Test Design Cards Rendering

**Test: "should render design cards with correct data"**

- Create mock designs array with 2-3 designs using `createMockSiteDesign`
- Render component with `designs={mockDesigns}` and `isLoading={false}`
- For each design:
  - Assert design name is displayed: `screen.getByText(design.name)`
  - Verify created date is formatted correctly using date-fns format
  - Check total modules count is shown: `screen.getByText(design.total_modules)`
  - Verify system size displays with `.toFixed(1)` precision and "kWp" unit
  - Ensure Grid3X3, Calendar, Layers, and Zap icons are present

**Test: "should format dates correctly using date-fns"**

- Create design with specific `created_at` timestamp
- Render component
- Assert formatted date matches `format(new Date(design.created_at), "MMM d, yyyy")`
- Example: "Jan 15, 2024"

**Test: "should display system size with one decimal precision"**

- Create design with `system_size_kwp: 44.567`
- Render component
- Assert displayed value is "44.6 kWp" (not "44.567 kWp")

### 5. Test Navigation Links

**Test: "should navigate to design canvas when clicking Open Canvas button"**

- Render component with mock designs
- Find first "Open Canvas" button using `screen.getAllByRole('link', { name: /Open Canvas/i })[0]`
- Assert href attribute is `/tenders/${tenderId}/design/${design.id}`
- Verify ArrowRight icon is present in button

**Test: "should render correct number of design cards"**

- Create array of 5 mock designs
- Render component
- Assert exactly 5 cards are rendered
- Verify each card has unique key (implicit through React rendering)

### 6. Test Responsive Grid Layout

**Test: "should apply responsive grid classes"**

- Render component with designs
- Find grid container element
- Assert container has classes: `grid`, `grid-cols-1`, `md:grid-cols-2`, `lg:grid-cols-3`, `gap-4`
- This ensures responsive behavior (1 column mobile, 2 tablet, 3 desktop)

### 7. Test Edge Cases

**Test: "should handle designs with zero modules gracefully"**

- Create design with `total_modules: 0` and `system_size_kwp: 0`
- Render component
- Assert "0" is displayed for modules
- Assert "0.0 kWp" is displayed for system size

**Test: "should handle very long design names"**

- Create design with name: "Very Long Design Name That Should Be Truncated Because It Exceeds Maximum Width"
- Render component
- Assert name is displayed
- Verify truncate class is applied to prevent overflow

**Test: "should render single design correctly"**

- Render with array containing only one design
- Assert card is rendered
- Verify grid layout is maintained

### 8. Test Accessibility

**Test: "should have accessible card structure"**

- Render component with designs
- Verify each card has proper heading structure (CardTitle)
- Check icons have appropriate aria-labels or are marked decorative
- Ensure links are keyboard navigable (implicit through Link component)

### 9. Test Hover States (Optional Visual Regression)

**Test: "should apply hover classes to cards"**

- Render component
- Find card element
- Assert classes include `hover:shadow-md` and `transition-shadow`
- Verify button has `group-hover:bg-primary` class

### Example Test Implementation Pattern

```typescript
describe('DesignsList', () => {
  const tenderId = 'tender-123';

  it('should render loading state with skeleton cards', () => {
    renderWithProviders(
      <DesignsList designs={undefined} isLoading={true} tenderId={tenderId} />
    );

    const skeletons = screen.getAllByTestId('skeleton'); // or use class selector
    expect(skeletons).toHaveLength(3);
  });

  it('should render empty state with create button', () => {
    renderWithProviders(
      <DesignsList designs={[]} isLoading={false} tenderId={tenderId} />
    );

    expect(screen.getByText(/No designs found/i)).toBeInTheDocument();
    const createButton = screen.getByRole('link', { name: /Create New Design/i });
    expect(createButton).toHaveAttribute('href', `/tenders/${tenderId}/design/new`);
  });

  it('should render design cards with formatted data', () => {
    const designs = [
      createMockSiteDesign({ 
        id: 'design-1', 
        name: 'Option A',
        total_modules: 100,
        system_size_kwp: 55.5,
        created_at: '2024-01-15T10:00:00Z'
      })
    ];

    renderWithProviders(
      <DesignsList designs={designs} isLoading={false} tenderId={tenderId} />
    );

    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('55.5 kWp')).toBeInTheDocument();
    expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
  });

  it('should navigate to design canvas on Open Canvas click', () => {
    const designs = [createMockSiteDesign({ id: 'design-1' })];
    
    renderWithProviders(
      <DesignsList designs={designs} isLoading={false} tenderId={tenderId} />
    );

    const openButton = screen.getByRole('link', { name: /Open Canvas/i });
    expect(openButton).toHaveAttribute('href', `/tenders/${tenderId}/design/design-1`);
  });
});
```

### Test Coverage Goals

- **Statements**: 100% (all conditional branches)
- **Branches**: 100% (loading, empty, populated states)
- **Functions**: 100% (component render function)
- **Lines**: 100%

### Dependencies Required

All dependencies already installed:
- `vitest` - test runner
- `@testing-library/react` - component testing
- `@testing-library/user-event` - user interaction simulation
- `date-fns` - date formatting (already used in component)
- `msw` - API mocking (if needed for integration tests)

### File Location

`file:frontend/src/components/SiteDesigns/__tests__/DesignsList.test.tsx`