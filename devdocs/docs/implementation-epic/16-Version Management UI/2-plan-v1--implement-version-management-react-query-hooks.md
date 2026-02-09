I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Key Observations

The version management infrastructure is already in place with API methods (`siteDesignsApi.createVersion`, `listVersions`, `getVersionDetail`, `restoreVersion`), TypeScript types (`DesignVersionCreate`, `DesignVersionResponse`, `DesignVersionDetail`, `DesignVersionRestoreResponse`), and query keys (`queryKeys.designVersions.*`). The existing hooks in `useSiteDesigns.ts` follow consistent patterns with optimistic updates, exponential backoff retry logic, toast notifications, and sync state management via `useDesignCanvasStore`.

## Approach

Following the established patterns from `useUpdateSiteDesignMutation` and other existing hooks, you'll create four new React Query hooks for version management operations. Each hook will integrate with the design canvas store for sync state tracking, implement proper error handling with toast notifications, and manage cache invalidation. The `useRestoreVersionMutation` will trigger automatic recalculation after restoration, similar to the existing `useRecalculatePlacementMutation` pattern.

## Implementation Steps

### 1. Add `useCreateVersionMutation` Hook

Add this hook to `file:frontend/src/hooks/useSiteDesigns.ts` after the existing mutations:

- Accept `designId` as parameter
- Use `siteDesignsApi.createVersion` for the mutation function
- Set sync state to `'syncing'` on mutation start using `setSyncState` from `useDesignCanvasStore`
- Reset retry count to 0 using `setRetryCount`
- Implement retry logic with 3 attempts and exponential backoff delays `[1000, 2000, 4000]` (same pattern as `useUpdateSiteDesignMutation`)
- On success:
  - Set sync state to `'synced'`
  - Invalidate `queryKeys.designVersions.list(designId)` to refresh version list
  - Show success toast: `"Version saved successfully"`
- On error:
  - Set sync state to `'failed'`
  - Show error toast with error message or fallback: `"Failed to save version"`
- Return type: `UseMutationResult<DesignVersionResponse, Error, DesignVersionCreate>`

### 2. Add `useVersionsQuery` Hook

Add this query hook to `file:frontend/src/hooks/useSiteDesigns.ts`:

- Accept `designId` as parameter
- Use `queryKeys.designVersions.list(designId)` as query key
- Use `siteDesignsApi.listVersions(designId)` as query function
- Enable query only when `designId` is truthy: `enabled: !!designId`
- Return type: `UseQueryResult<DesignVersionResponse[], Error>`
- No special refetch intervals needed (static data)

### 3. Add `useVersionDetailQuery` Hook

Add this query hook to `file:frontend/src/hooks/useSiteDesigns.ts`:

- Accept `designId` and `versionId` as parameters
- Use `queryKeys.designVersions.detail(designId, versionId)` as query key
- Use `siteDesignsApi.getVersionDetail(designId, versionId)` as query function
- Enable query only when both IDs are truthy: `enabled: !!designId && !!versionId`
- Return type: `UseQueryResult<DesignVersionDetail, Error>`
- This hook will be used to display version details before restoration

### 4. Add `useRestoreVersionMutation` Hook

Add this mutation hook to `file:frontend/src/hooks/useSiteDesigns.ts`:

- Accept `designId` as parameter
- Use `siteDesignsApi.restoreVersion` for the mutation function
- Accept `versionId` as mutation parameter
- Set sync state to `'syncing'` and placement loading to `true` using `setPlacementLoading` from store
- Reset retry count to 0
- Implement retry logic with 3 attempts and exponential backoff `[1000, 2000, 4000]`
- On success:
  - Set sync state to `'synced'`
  - Update the site design cache with restored data: `queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), data.site_design)`
  - Invalidate `queryKeys.siteDesigns.lists()` to refresh design lists
  - Invalidate `queryKeys.energyEstimation.detail(designId)` to trigger energy recalculation
  - Invalidate `queryKeys.financialAnalysis.detail(designId)` to trigger financial recalculation
  - Show success toast: `"Version restored successfully. Recalculating..."`
- On error:
  - Set sync state to `'failed'`
  - Show error toast with message or fallback: `"Failed to restore version"`
- On settled:
  - Set placement loading to `false`
  - Invalidate `queryKeys.siteDesigns.detail(designId)` to ensure fresh data
- Return type: `UseMutationResult<DesignVersionRestoreResponse, Error, string>`

### 5. Export All New Hooks

Add exports at the end of `file:frontend/src/hooks/useSiteDesigns.ts`:

```typescript
export {
  useCreateVersionMutation,
  useVersionsQuery,
  useVersionDetailQuery,
  useRestoreVersionMutation
}
```

### 6. Update Hook Imports

Ensure the following imports are present at the top of `file:frontend/src/hooks/useSiteDesigns.ts`:

- Import version types: `DesignVersionCreate`, `DesignVersionResponse`, `DesignVersionDetail`, `DesignVersionRestoreResponse` from `@/types`
- All other imports should already be present from existing hooks

## Integration Notes

**Cache Invalidation Strategy:**
- Creating a version invalidates the version list for that design
- Restoring a version invalidates: design lists, design detail, energy estimation, and financial analysis (to trigger recalculations)
- Version detail queries are cached independently and don't need invalidation

**Sync State Management:**
- All mutations follow the same pattern: `'syncing'` → `'synced'` or `'failed'`
- Restore operation also sets `placementLoading` to show visual feedback during recalculation
- Retry count is tracked in the store and reset on success

**Error Handling:**
- All mutations use exponential backoff retry (3 attempts)
- Toast notifications provide user feedback for all operations
- Failed mutations preserve sync state as `'failed'` for manual retry capability

**Testing Considerations:**
- Follow the existing test patterns in `file:frontend/src/hooks/__tests__/useSiteDesigns.test.tsx`
- Mock version fixtures should be created in `file:frontend/src/test/fixtures/siteDesign.ts`
- Test optimistic updates, retry logic, error handling, and cache invalidation
- Use MSW handlers for API mocking