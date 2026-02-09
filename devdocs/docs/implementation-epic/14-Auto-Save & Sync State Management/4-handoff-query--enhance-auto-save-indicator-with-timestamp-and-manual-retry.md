I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Improve the auto-save indicator UI in the toolbar:

- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\Toolbar.tsx` to show "Auto-saved X min ago" using the `lastSyncedAt` timestamp from Zustand store
- Add manual retry button that appears when sync state is 'failed' after all automatic retries are exhausted
- Add toast notification for failed syncs: "Failed to save changes. Retrying..."
- Use `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\lib\toast.ts` for notifications
- Add relative time formatting utility (e.g., "2 min ago", "just now")