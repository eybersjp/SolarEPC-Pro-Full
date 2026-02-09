I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase follows a well-structured pattern with TypeScript types in `file:frontend/src/types/index.ts`, API client methods in `file:frontend/src/lib/api.ts`, and React Query keys in `file:frontend/src/lib/queryKeys.ts`. The backend already has complete version management endpoints implemented at `/site-designs/{design_id}/versions` with schemas defined in `file:backend/app/schemas/design_version.py`. The existing patterns use namespaced API objects (e.g., `siteDesignsApi`, `equipmentApi`) and a factory pattern for query keys with nested hierarchies.

## Approach

The implementation will add TypeScript type definitions mirroring the backend Pydantic schemas, create API client methods following the existing `fetchApi` pattern, and add query keys using the factory pattern. All types will be added to the existing types file, API methods will be added to the `siteDesignsApi` namespace (since versions are scoped to site designs), and query keys will be added as a new `designVersions` factory following the established hierarchical structure.

## Implementation Steps

### 1. Add TypeScript Type Definitions

Update `file:frontend/src/types/index.ts` to add version-related types based on the backend schemas in `file:backend/app/schemas/design_version.py`:

**Add the following type definitions:**

- `DesignVersionCreate` - Request payload for creating a version with `version_name` (string, required) and `notes` (string, optional)
- `DesignVersionResponse` - Response type with `id` (string), `site_design_id` (string), `version_name` (string), `notes` (string | null), `created_at` (string), `total_modules` (number | null), `system_size_kwp` (number | null)
- `DesignVersionDetail` - Extends `DesignVersionResponse` with additional `snapshot_data` field (Record<string, any>) containing the full design state
- `DesignVersionRestoreResponse` - Response from restore operation with `site_design` (SiteDesignResponse) and `recalculation_status` (Record<string, any>)

**Location:** Add these types after the existing `SiteDesignResponse` type definition (around line 327) to keep related types together.

### 2. Add Version API Client Methods

Update `file:frontend/src/lib/api.ts` to add version management methods to the `siteDesignsApi` namespace:

**Add the following methods to the `siteDesignsApi` object (after the existing `getFinancialAnalysis` method around line 306):**

- `createVersion: (designId: string, data: DesignVersionCreate)` - POST to `/site-designs/{designId}/versions` returning `DesignVersionResponse`
- `listVersions: (designId: string)` - GET from `/site-designs/{designId}/versions` returning `DesignVersionResponse[]`
- `getVersionDetail: (designId: string, versionId: string)` - GET from `/site-designs/{designId}/versions/{versionId}` returning `DesignVersionDetail`
- `restoreVersion: (designId: string, versionId: string)` - POST to `/site-designs/{designId}/restore/{versionId}` returning `DesignVersionRestoreResponse`

**Import requirements:** Add the new types to the import statement at the top of the file (lines 3-37).

**Pattern to follow:** Use the existing `fetchApi` helper with appropriate HTTP methods, following the same structure as `recalculate`, `getEnergyEstimate`, etc.

### 3. Add Version Query Keys

Update `file:frontend/src/lib/queryKeys.ts` to add query key factory for version management:

**Add a new `designVersions` factory after the `proposals` factory (around line 101):**

```typescript
designVersions: {
    all: ["design-versions"] as const,
    lists: () => [...queryKeys.designVersions.all, "list"] as const,
    list: (designId: string) => 
        [...queryKeys.designVersions.lists(), designId] as const,
    details: () => [...queryKeys.designVersions.all, "detail"] as const,
    detail: (designId: string, versionId: string) => 
        [...queryKeys.designVersions.details(), designId, versionId] as const,
}
```

**Pattern rationale:** This follows the established factory pattern with hierarchical keys (`all` → `lists`/`details` → specific queries) enabling efficient cache invalidation and query management.

### 4. Verification Points

After implementation, verify:

- All type definitions match the backend Pydantic schemas exactly
- API methods use correct HTTP verbs and endpoint paths matching `file:backend/app/api/site_designs.py`
- Query keys follow the factory pattern and enable proper cache invalidation
- Import statements are updated in both `api.ts` and type consumers
- TypeScript compilation succeeds with no type errors