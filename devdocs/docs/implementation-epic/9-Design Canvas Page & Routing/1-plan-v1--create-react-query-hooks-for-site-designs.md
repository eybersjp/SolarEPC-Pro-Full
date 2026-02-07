I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase already has the foundation in place: site design types are defined in `file:frontend/src/types/index.ts`, API methods exist in `file:frontend/src/lib/api.ts`, and query keys are configured in `file:frontend/src/lib/queryKeys.ts`. The Zustand store at `file:frontend/src/stores/useDesignCanvasStore.ts` tracks sync state with four states: `pending`, `syncing`, `synced`, and `failed`. Existing hooks like `usePVDesigns` and `useBOQ` demonstrate the pattern: React Query for data fetching, optimistic updates in mutations, toast notifications, and query invalidation.

## Approach

Create a new hooks file `file:frontend/src/hooks/useSiteDesigns.ts` following the established pattern from `usePVDesigns` and `useBOQ`. Implement five hooks: two query hooks for listing and fetching individual designs, and three mutation hooks for create, update, and delete operations. Integrate Zustand store updates in mutation callbacks to track sync state. Implement optimistic updates for the update mutation to provide instant UI feedback. Configure retry logic (3 attempts) on mutations using React Query's built-in retry mechanism. Follow the existing patterns for error handling, toast notifications, and query invalidation.

## Implementation Steps

### 1. Create the Site Designs Hooks File

Create `file:frontend/src/hooks/useSiteDesigns.ts` with the following structure and hooks:

**Import Dependencies:**
- Import `useQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query`
- Import `siteDesignsApi` from `@/lib/api`
- Import `queryKeys` from `@/lib/queryKeys`
- Import `toast` from `@/lib/toast`
- Import `useDesignCanvasStore` from `@/stores/useDesignCanvasStore`
- Import types: `SiteDesignCreate`, `SiteDesignUpdate`, `SiteDesignResponse` from `@/types`

### 2. Implement Query Hooks

**Hook: `useSiteDesignsQuery`**
- Accept `tenderId: string | undefined` parameter
- Use `useQuery` with:
  - `queryKey`: `queryKeys.siteDesigns.list(tenderId ?? "")`
  - `queryFn`: Call `siteDesignsApi.list(tenderId!)`
  - `enabled`: `!!tenderId`
- Return object with: `designs` (data array or empty array), `isLoading`, `error`, `refetch`

**Hook: `useSiteDesignQuery`**
- Accept `designId: string | undefined` parameter
- Use `useQuery` with:
  - `queryKey`: `queryKeys.siteDesigns.detail(designId ?? "")`
  - `queryFn`: Call `siteDesignsApi.get(designId!)`
  - `enabled`: `!!designId`
- Return object with: `design` (data or undefined), `isLoading`, `error`, `refetch`

### 3. Implement Create Mutation Hook

**Hook: `useCreateSiteDesignMutation`**
- Get `queryClient` using `useQueryClient()`
- Get `setSyncState` from `useDesignCanvasStore` using selector
- Use `useMutation` with:
  - `mutationFn`: Accept `{ tenderId: string; data: SiteDesignCreate }`, call `siteDesignsApi.create(tenderId, data)`
  - `retry`: Set to `3` for automatic retry on failure
  - `onMutate`: Set sync state to `'syncing'` using `setSyncState('syncing')`
  - `onSuccess`: 
    - Invalidate `queryKeys.siteDesigns.all`
    - Invalidate `queryKeys.tenders.detail(variables.tenderId)`
    - Set sync state to `'synced'`
    - Show success toast: "Design created successfully"
  - `onError`:
    - Set sync state to `'failed'`
    - Show error toast with error message or "Failed to create design"
- Return the mutation object

### 4. Implement Update Mutation Hook with Optimistic Updates

**Hook: `useUpdateSiteDesignMutation`**
- Get `queryClient` using `useQueryClient()`
- Get `setSyncState` from `useDesignCanvasStore` using selector
- Use `useMutation` with:
  - `mutationFn`: Accept `{ designId: string; data: SiteDesignUpdate }`, call `siteDesignsApi.update(designId, data)`
  - `retry`: Set to `3` for automatic retry on failure
  - `onMutate`: Implement optimistic update:
    - Set sync state to `'syncing'`
    - Cancel outgoing queries for `queryKeys.siteDesigns.detail(variables.designId)`
    - Snapshot previous design data using `queryClient.getQueryData<SiteDesignResponse>`
    - Optimistically update cache with merged data: `{ ...previousDesign, ...data, updated_at: new Date().toISOString() }`
    - Return context object with `previousDesign` for rollback
  - `onSuccess`:
    - Invalidate `queryKeys.siteDesigns.detail(variables.designId)`
    - Invalidate `queryKeys.siteDesigns.all`
    - Set sync state to `'synced'`
    - Show success toast: "Design updated successfully"
  - `onError`:
    - Rollback optimistic update using context's `previousDesign` if available
    - Set sync state to `'failed'`
    - Show error toast with error message or "Failed to update design"
- Return the mutation object

### 5. Implement Delete Mutation Hook

**Hook: `useDeleteSiteDesignMutation`**
- Get `queryClient` using `useQueryClient()`
- Get `setSyncState` from `useDesignCanvasStore` using selector
- Use `useMutation` with:
  - `mutationFn`: Accept `{ tenderId: string; designId: string }`, call `siteDesignsApi.delete(designId)`
  - `retry`: Set to `3` for automatic retry on failure
  - `onMutate`: Set sync state to `'syncing'`
  - `onSuccess`:
    - Invalidate `queryKeys.siteDesigns.all`
    - Invalidate `queryKeys.tenders.detail(variables.tenderId)`
    - Set sync state to `'synced'`
    - Show success toast: "Design deleted successfully"
  - `onError`:
    - Set sync state to `'failed'`
    - Show error toast with error message or "Failed to delete design"
- Return the mutation object

### 6. Add "use client" Directive

Add `"use client";` directive at the top of the file to ensure it runs in the client-side context (Next.js requirement).

### 7. Export All Hooks

Export all five hooks from the file:
- `useSiteDesignsQuery`
- `useSiteDesignQuery`
- `useCreateSiteDesignMutation`
- `useUpdateSiteDesignMutation`
- `useDeleteSiteDesignMutation`

## Integration Notes

**Zustand Store Integration:**
- The `setSyncState` function from `useDesignCanvasStore` is called in mutation callbacks to update the global sync state
- State transitions: `syncing` → `synced` (on success) or `syncing` → `failed` (on error)
- The sync state can be used by UI components to show sync indicators and prevent navigation when changes are pending

**Retry Logic:**
- React Query's built-in `retry` option is set to `3` on all mutations
- Failed mutations will automatically retry up to 3 times before calling `onError`
- Exponential backoff is applied by default between retries

**Optimistic Updates:**
- Only the update mutation implements optimistic updates since it's the most frequent operation during design editing
- The optimistic update immediately reflects changes in the UI while the API call is in progress
- If the mutation fails, the previous state is restored from the context

**Query Invalidation Strategy:**
- All mutations invalidate `queryKeys.siteDesigns.all` to refresh list views
- Create and delete mutations also invalidate the tender detail to update related data
- Update mutation invalidates the specific design detail for targeted refresh