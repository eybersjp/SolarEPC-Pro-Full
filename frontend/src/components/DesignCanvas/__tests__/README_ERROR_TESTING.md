# Frontend Error Handling Tests

This directory contains tests for validating the frontend's error handling, retry logic, and graceful degradation.

## Test File: `errorHandling.test.tsx`

The tests use MSW (Mock Service Worker) to simulate various network conditions and server responses.

### Key Test Scenarios

#### 1. Network Failures During Save

- **500 Errors**: Verifies that server errors trigger the "failed" sync state.
- **Timeouts**: Tests handling of long-running or dropped requests.
- **Retry Logic**: Validates that the application attempts to resave with exponential backoff before giving up.

#### 2. Unsaved Changes Warnings

- **Navigation Blocking**: Ensures the user is warned if they try to leave the page with pending changes.
- **Clean Navigation**: Confirms that synced states allow navigation without warnings.

#### 3. Graceful Degradation

- **Partial Data Loading**: Verifies that components (like the Map) load even if secondary data (like energy estimates) fails.
- **UI Feedback**: Checks for appropriate error toasts and status indicators when things go wrong.

#### 4. Sync State Transitions

- **Visual Feedback**: Validates that the UI correctly reflects 'syncing', 'synced', and 'failed' states.
- **Recovery**: Tests that a failed state can be recovered from (e.g., by a successful retry).

## Mocking Strategy

The tests rely on `handlers.ts` which includes specific logic to simulate errors based on query parameters or ID patterns:

- `retry-test`: Triggers 500 errors for a specified number of attempts.
- `timeout-test`: Delays response to simulate timeout.
- `rate-limit`: return 429 status codes.

## Running the Tests

To run the error handling tests:

```bash
npm test -- errorHandling.test.tsx
```
