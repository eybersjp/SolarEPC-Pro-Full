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

### 3. Navigation Guards

Test both the browser-level `beforeunload` event and the internal React navigation handling.

* `beforeunload` is prevented if `syncState` is `pending` or `failed`.
* `ConfirmDialog` is displayed when initiating internal navigation while unsaved.

## Test Utilities

* `mockSyncState`: Quickly set the store to a specific sync state.
* `advanceDebounceTimer`: Utility to advance timers and flush promises.
* `createWrapper`: Setup a clean `QueryClientProvider` for hook testing.
