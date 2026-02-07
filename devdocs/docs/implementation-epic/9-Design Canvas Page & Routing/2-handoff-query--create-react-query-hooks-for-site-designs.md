I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Implement React Query hooks for site design data fetching and mutations:

- Create frontend/src/hooks/useSiteDesigns.ts with hooks: `useSiteDesignsQuery`, `useSiteDesignQuery`, `useCreateSiteDesignMutation`, `useUpdateSiteDesignMutation`, `useDeleteSiteDesignMutation`
- Integrate with Zustand store in `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\stores\useDesignCanvasStore.ts` for sync state tracking (pending/syncing/synced/failed)
- Implement optimistic updates for mutations
- Add retry logic for failed mutations (3 attempts)