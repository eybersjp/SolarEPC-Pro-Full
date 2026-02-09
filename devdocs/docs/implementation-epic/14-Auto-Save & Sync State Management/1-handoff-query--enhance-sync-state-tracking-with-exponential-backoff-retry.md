I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Implement exponential backoff retry logic for failed syncs:

- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\hooks\useSiteDesigns.ts` to add custom retry logic with exponential backoff (1s, 2s, 4s)
- Enhance `useDesignCanvasStore` in `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\stores\useDesignCanvasStore.ts` to track retry attempts and last sync timestamp
- Add `retryCount` and `lastSyncedAt` fields to the Zustand store
- Update `useUpdateSiteDesignMutation` to implement exponential backoff using React Query's `retryDelay` option