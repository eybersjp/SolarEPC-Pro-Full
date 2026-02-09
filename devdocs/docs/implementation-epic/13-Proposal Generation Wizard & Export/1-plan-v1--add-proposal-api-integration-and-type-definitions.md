I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase follows a consistent pattern for API integration with React Query. The `api.ts` file organizes API methods into domain-specific objects (e.g., `siteDesignsApi`, `equipmentApi`), while `types/index.ts` defines TypeScript interfaces for all request/response payloads. The `queryKeys.ts` uses a factory pattern for cache key management. The backend proposal API has three endpoints: proposal generation (async task), task status polling, and CSV export. The existing energy estimation feature demonstrates the polling pattern using `refetchInterval` with 2-second intervals.

## Approach

The implementation will add three new API methods to `api.ts` following the existing `siteDesignsApi` pattern, define four new TypeScript types in `types/index.ts` matching the backend schema, and extend `queryKeys.ts` with proposal-specific keys. The approach mirrors the energy estimation polling pattern for task status monitoring and the BOQ export pattern for CSV downloads. This ensures consistency with existing codebase conventions and leverages proven patterns for async operations and file handling.

## Implementation Steps

### 1. Add TypeScript Type Definitions

**File:** `file:frontend/src/types/index.ts`

Add the following type definitions at the end of the file (after the existing `FinancialAnalysisResponse` interface):

- `ProposalGenerateRequest` interface with 6 boolean fields:
  - `include_cover` (default: true)
  - `include_site_map` (default: true)
  - `include_specs` (default: true)
  - `include_energy` (default: true)
  - `include_financials` (default: true)
  - `include_equipment` (default: true)

- `ProposalTaskResponse` interface with:
  - `task_id: string`
  - `status: string`

- `ProposalStatusResponse` interface with:
  - `task_id: string`
  - `status: string` (values: PENDING, STARTED, SUCCESS, FAILURE)
  - `result_url?: string` (optional)
  - `error?: string` (optional)

All fields should match the backend schema exactly as defined in `file:backend/app/schemas/proposal.py`.

### 2. Add Proposal API Methods

**File:** `file:frontend/src/lib/api.ts`

Add import for new types at the top of the file (line 34, after `FinancialAnalysisResponse`):
- Import `ProposalGenerateRequest`, `ProposalTaskResponse`, `ProposalStatusResponse`

Create a new `proposalsApi` object after the `equipmentApi` definition (after line 322):

**Method 1: `generateProposal`**
- Endpoint: `POST /site-designs/{designId}/proposal`
- Parameters: `designId: string`, `options?: ProposalGenerateRequest`
- Returns: `Promise<ProposalTaskResponse>`
- Use `fetchApi` with method POST and body containing options
- Follow the pattern from `siteDesignsApi.recalculate`

**Method 2: `getTaskStatus`**
- Endpoint: `GET /tasks/{taskId}`
- Parameters: `taskId: string`
- Returns: `Promise<ProposalStatusResponse>`
- Use `fetchApi` with method GET
- Follow the pattern from `siteDesignsApi.get`

**Method 3: `exportCSV`**
- Endpoint: `GET /site-designs/{designId}/export-csv`
- Parameters: `designId: string`
- Returns: `Promise<Blob>`
- Use manual fetch with auth token (similar to `boqApi.export` pattern in lines 210-234)
- Get Firebase auth token using `getAuth()` and `getIdToken()`
- Set Authorization header
- Return `response.blob()`
- Throw `ApiError` on failure with proper error message extraction

### 3. Add Query Keys for Proposals

**File:** `file:frontend/src/lib/queryKeys.ts`

Add a new `proposals` section after the `financialAnalysis` query keys (after line 94):

```typescript
proposals: {
    all: ["proposals"] as const,
    tasks: () => [...queryKeys.proposals.all, "task"] as const,
    task: (taskId: string) => [...queryKeys.proposals.tasks(), taskId] as const,
}
```

This follows the same hierarchical pattern as other query keys in the file.

### 4. Export New API Object

**File:** `file:frontend/src/lib/api.ts`

Ensure the `proposalsApi` object is exported (it will be automatically exported since it's defined at module level, but verify it's accessible for import in other files).

## Validation Checklist

- [ ] All type definitions match backend schema exactly
- [ ] API methods follow existing patterns (`siteDesignsApi`, `equipmentApi`)
- [ ] Error handling includes proper ApiError throwing
- [ ] CSV export uses blob download pattern from `boqApi.export`
- [ ] Query keys follow hierarchical factory pattern
- [ ] Auth token handling matches existing patterns
- [ ] TypeScript types are properly imported in `api.ts`
- [ ] All methods have proper return type annotations

## Integration Points

The new API methods and types will be consumed by:
- Custom React Query hooks in `file:frontend/src/hooks/useProposal.ts` (subsequent phase)
- Proposal wizard component for triggering generation and polling status
- CSV export functionality for downloading BOM data

The implementation maintains consistency with existing patterns for async task handling (similar to placement algorithm) and file downloads (similar to BOQ export).