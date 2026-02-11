# Auto-Save Testing Strategy

This directory contains comprehensive tests for the Design Canvas auto-save functionality.

## Core Components Tested

1. **Hooks (`useSiteDesigns.ts`)**:
    * Exponential backoff retry logic (1s, 2s, 4s).
    * Retry exhaustion after 3 attempts.
    * Optimistic update rollbacks on failure.
    * Manual retry data caching.

2. **State Management (`useDesignCanvasStore.ts`)**:
    * Sync state transitions (`synced` -> `pending` -> `syncing` -> `failed`).
    * Retry count tracking.
    * Last sync timestamp management.

3. **UI Components**:
    * **Toolbar**: Status indicators (Loader, Check, Alert icons), relative time formatting ("just now", "2 minutes ago"), and manual retry button.
    * **PlacementSettings / EquipmentSelector**: 30-second debounced saves and rapid change coalescing.
    * **Page Component**: `beforeunload` window listener and the "Unsaved Changes" navigation confirm dialog.

## Testing Patterns

### 1. Debounce Testing

Use `vi.useFakeTimers()` to verify the 30-second delay.

```typescript
vi.useFakeTimers();
const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

// Trigger change
await user.type(input, 'value');

// Advance and verify
act(() => { vi.advanceTimersByTime(29000); });
expect(apiSpy).not.toHaveBeenCalled();

act(() => { vi.advanceTimersByTime(1000); });
expect(apiSpy).toHaveBeenCalled();
```

### 2. Exponential Backoff Testing

Verify that retries happen at 1s, 2s, and 4s steps.

```typescript
await waitFor(() => expect(store.retryCount).toBe(1)); // Initial fail
act(() => { vi.advanceTimersByTime(1100); });
await waitFor(() => expect(store.retryCount).toBe(2)); // First retry fail
```

### 3. Error Handling & Retry Testing Patterns

#### Precise Backoff Verification with Fake Timers

Use fake timers to verify exact retry timing (1s, 2s, 4s) without flakiness:

```typescript
vi.useFakeTimers({ now: 0 });

// Mock MSW handler with attempt counter
let attemptCount = 0;
server.use(
    http.patch(endpoint, () => {
        attemptCount++;
        return new HttpResponse(null, { status: 500 });
    })
);

// Trigger mutation
fireEvent.click(screen.getByText("Save Design"));

// Verify initial attempt
await vi.waitFor(() => {
    expect(useDesignCanvasStore.getState().syncState).toBe('syncing');
});
expect(attemptCount).toBe(1);

// First retry after 1000ms
await vi.advanceTimersByTimeAsync(1050);
await vi.waitFor(() => {
    expect(useDesignCanvasStore.getState().retryCount).toBe(1);
});
expect(attemptCount).toBe(2);

// Second retry after 2000ms
await vi.advanceTimersByTimeAsync(2050);
expect(attemptCount).toBe(3);

// Third retry after 4000ms
await vi.advanceTimersByTimeAsync(4050);
expect(attemptCount).toBe(4);

// Verify final failed state
await vi.waitFor(() => {
    expect(useDesignCanvasStore.getState().syncState).toBe('failed');
});

vi.useRealTimers();
```

#### Beforeunload Handler Testing with Spies

Test browser-level unsaved changes warning:

```typescript
const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

// Set unsaved state
useDesignCanvasStore.setState({ syncState: 'pending' });

// Render component with beforeunload handler
const BeforeunloadComponent = () => {
    const syncState = useDesignCanvasStore(state => state.syncState);
    
    React.useEffect(() => {
        const handler = (event: BeforeUnloadEvent) => {
            const current = useDesignCanvasStore.getState().syncState;
            if (current === 'pending' || current === 'failed') {
                event.preventDefault();
                event.returnValue = 'You have unsaved changes...';
                return 'You have unsaved changes...';
            }
        };
        
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [syncState]);
    
    return <div>Component</div>;
};

render(<BeforeunloadComponent />);

// Verify listener was added
expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

// Dispatch event and verify warning
const event = new Event('beforeunload') as BeforeUnloadEvent;
const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

window.dispatchEvent(event);

expect(preventDefaultSpy).toHaveBeenCalled();
expect(event.returnValue).toBe('You have unsaved changes...');

// Cleanup
addEventListenerSpy.mockRestore();
```

#### Full Sync State Machine Testing

Test complete state transitions including `pending`:

```typescript
vi.useFakeTimers({ now: 0 });

// Mock successful response
server.use(
    http.patch(endpoint, () => {
        return HttpResponse.json({ id: designId, name: "Updated" });
    })
);

const TestComponent = () => {
    const syncState = useDesignCanvasStore(state => state.syncState);
    const retryCount = useDesignCanvasStore(state => state.retryCount);
    const mutation = useUpdateSiteDesignMutation(designId);
    
    return (
        <div>
            <button onClick={() => mutation.mutate({ name: "New" })}>
                Save
            </button>
            <span data-testid="sync-state">{syncState}</span>
            <span data-testid="retry-count">{retryCount}</span>
        </div>
    );
};

render(<TestComponent />, { wrapper: Wrapper });

// Initial: synced
expect(screen.getByTestId("sync-state")).toHaveTextContent('synced');

// Trigger mutation
fireEvent.click(screen.getByText("Save"));

// Verify transition: syncing
await vi.waitFor(() => {
    expect(screen.getByTestId("sync-state")).toHaveTextContent('syncing');
});

// Advance timers
await vi.advanceTimersByTimeAsync(100);

// Verify transition: synced
await vi.waitFor(() => {
    expect(screen.getByTestId("sync-state")).toHaveTextContent('synced');
});

// Verify state updates
expect(screen.getByTestId("retry-count")).toHaveTextContent('0');
expect(useDesignCanvasStore.getState().lastSyncedAt).not.toBeNull();

vi.useRealTimers();
```

#### Query Invalidation Verification

Test that failed mutations trigger query invalidation:

```typescript
vi.useFakeTimers({ now: 0 });

const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

server.use(
    http.patch(endpoint, () => {
        return new HttpResponse(null, { status: 500 });
    })
);

render(<TestComponent />, { wrapper: Wrapper });
fireEvent.click(screen.getByText("Save"));

// Advance through all retries
await vi.advanceTimersByTimeAsync(1050);
await vi.advanceTimersByTimeAsync(2050);
await vi.advanceTimersByTimeAsync(4050);

await vi.waitFor(() => {
    expect(useDesignCanvasStore.getState().syncState).toBe('failed');
});

// Verify invalidation was called (in onSettled)
expect(invalidateSpy).toHaveBeenCalledWith({ 
    queryKey: ["site-designs", "detail", designId] 
});

invalidateSpy.mockRestore();
vi.useRealTimers();
```

#### MSW State Counters

Track exact attempt counts for assertions:

```typescript
let attemptCount = 0;

beforeEach(() => {
    attemptCount = 0;  // Reset for each test
});

server.use(
    http.patch(endpoint, () => {
        attemptCount++;
        if (attemptCount <= 2) {
            return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({ success: true });
    })
);

// Test can now assert exact attempt counts
expect(attemptCount).toBe(3);  // 2 failures + 1 success
```

### 4. Navigation Guards

Test both the browser-level `beforeunload` event and the internal React navigation handling.

* `beforeunload` is prevented if `syncState` is `pending` or `failed`.
* `ConfirmDialog` is displayed when initiating internal navigation while unsaved.

## Test Utilities

* `mockSyncState`: Quickly set the store to a specific sync state.
* `advanceDebounceTimer`: Utility to advance timers and flush promises.
* `createWrapper`: Setup a clean `QueryClientProvider` for hook testing.

## E2E Integration Tests

### Overview

The `e2eDesignWorkflow.test.tsx` file contains comprehensive end-to-end integration tests covering:

1. **Store State Management** - Sync state transitions (synced → pending → syncing → synced)
2. **Equipment Selection Gating** - Mode transitions and drawing tool availability
3. **Auto-Save Debounce Logic** - Coalescing rapid changes into single save operations
4. **Placement Loading State** - Loading state management during recalculation
5. **Right Panel Toggle** - Panel state management
6. **Sync State Error Recovery** - Retry logic with exponential backoff
7. **Mode Transitions** - Transitions between select, draw, and edit modes
8. **Concurrent State Updates** - Multiple state updates handled correctly
9. **State Persistence** - State maintained across component renders
10. **React Query Integration** - Integration with data fetching layer

### Test Utilities for E2E Tests

* `selectEquipment(user, moduleId, inverterId, screen)` - Simulate complete equipment selection
* `drawPolygon(coordinates)` - Simulate drawing polygon boundaries
* `advanceAndVerifySave(ms)` - Advance timers and verify save completion
* `waitForPollingComplete(checkCondition, maxAttempts, intervalMs)` - Wait for polling to complete
* `generateProposal(user, screen, options)` - Simulate proposal generation flow

### MSW Handler Special Test IDs

Use special IDs in tests to trigger specific behaviors:

* `design-zero` - Returns zero capacity design
* `design-stale-test` - Returns stale energy estimate
* `design-poll-finish` - Completes after 2 polling attempts
* `design-retry-test` - Simulates retry failures
* `design-no-energy` - Returns 404 for energy estimate
* `task-fail` - Simulates task failure

### Running E2E Tests

```bash
# Run E2E integration tests
npm test -- e2eDesignWorkflow

# Run with coverage
npm test -- e2eDesignWorkflow --coverage
```
