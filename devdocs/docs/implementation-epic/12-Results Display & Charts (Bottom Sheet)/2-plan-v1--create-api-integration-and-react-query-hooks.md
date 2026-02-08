I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase already has well-established patterns for API integration and React Query hooks. The `file:frontend/src/lib/api.ts` uses a consistent `fetchApi` wrapper, and `file:frontend/src/hooks/useSiteDesigns.ts` demonstrates the mutation pattern with optimistic updates and sync state management. The backend energy estimation service uses async Celery tasks with status tracking ("calculating", "completed", "failed"), while financial analysis auto-calculates on demand. The types file already defines `EnergyEstimateResponse` and `FinancialAnalysisResponse`, though there's a minor discrepancy: frontend types use "pending" but backend uses "calculating" for the status.

## Approach

Extend the existing API client and React Query infrastructure to support energy estimation and financial analysis. Add two new API methods to `file:frontend/src/lib/api.ts` for triggering and fetching energy estimates, plus one for financial analysis. Create custom React Query hooks in `file:frontend/src/hooks/useSiteDesigns.ts` with intelligent polling logic that activates only when status is "calculating". Update query keys in `file:frontend/src/lib/queryKeys.ts` following the established factory pattern. Fix the type mismatch by updating the status enum to include "calculating" and "not_calculated" to match backend responses.

## Implementation Steps

### 1. Update Type Definitions

**File:** `file:frontend/src/types/index.ts`

Update the `EnergyEstimateStatus` type to match backend status values:

```typescript
export type EnergyEstimateStatus = 'calculating' | 'completed' | 'failed' | 'not_calculated';
```

Add `design_id` field to `EnergyEstimateResponse` (currently shows `id` and `design_id` in backend response):

```typescript
export interface EnergyEstimateResponse {
    id: string;
    site_design_id: string;  // Match backend field name
    status: EnergyEstimateStatus;
    annual_energy_kwh: number;
    monthly_energy_kwh: number[];  // Backend returns array of 12 numbers
    capacity_factor: number;
    error_message?: string;
    calculated_at: string | null;
}
```

Update `FinancialAnalysisResponse` to match backend field names:

```typescript
export interface FinancialAnalysisResponse {
    id: string;
    site_design_id: string;  // Match backend field name
    system_cost_usd: number;
    electricity_rate_usd_per_kwh: number;
    annual_rate_escalation_pct: number;
    annual_savings_usd: number;
    simple_payback_years: number;
    roi_pct: number;
}
```

---

### 2. Add API Client Methods

**File:** `file:frontend/src/lib/api.ts`

Add energy estimation and financial analysis API methods after the existing `siteDesignsApi` object (around line 290):

```typescript
// Energy Estimation API
export const energyEstimationApi = {
    trigger: (designId: string) =>
        fetchApi<{ status: string; estimate_id: string; current_status: string }>(
            `/site-designs/${designId}/energy-estimate`,
            { method: "POST" }
        ),

    get: (designId: string) =>
        fetchApi<EnergyEstimateResponse>(
            `/site-designs/${designId}/energy-estimate`
        ),
};

// Financial Analysis API
export const financialAnalysisApi = {
    get: (designId: string) =>
        fetchApi<FinancialAnalysisResponse>(
            `/site-designs/${designId}/financial-analysis`
        ),
};
```

Update the imports at the top of the file to include the new response types:

```typescript
import type {
    // ... existing imports
    EnergyEstimateResponse,
    FinancialAnalysisResponse,
} from "@/types";
```

---

### 3. Add Query Keys

**File:** `file:frontend/src/lib/queryKeys.ts`

Add energy estimation and financial analysis query keys after the `siteDesigns` section (around line 67):

```typescript
// Energy Estimation queries
energyEstimation: {
    all: ["energy-estimation"] as const,
    details: () => [...queryKeys.energyEstimation.all, "detail"] as const,
    detail: (designId: string) =>
        [...queryKeys.energyEstimation.details(), designId] as const,
},

// Financial Analysis queries
financialAnalysis: {
    all: ["financial-analysis"] as const,
    details: () => [...queryKeys.financialAnalysis.all, "detail"] as const,
    detail: (designId: string) =>
        [...queryKeys.financialAnalysis.details(), designId] as const,
},
```

---

### 4. Create React Query Hooks

**File:** `file:frontend/src/hooks/useSiteDesigns.ts`

Add the following hooks at the end of the file (after line 149):

**Energy Estimation Query Hook with Polling:**

```typescript
export function useEnergyEstimateQuery(designId: string) {
    return useQuery({
        queryKey: queryKeys.energyEstimation.detail(designId),
        queryFn: () => energyEstimationApi.get(designId),
        enabled: !!designId,
        refetchInterval: (data) => {
            // Poll every 2 seconds when status is "calculating"
            if (data?.status === 'calculating') {
                return 2000;
            }
            return false;
        },
        refetchIntervalInBackground: true,
    });
}
```

**Trigger Energy Estimation Mutation:**

```typescript
export function useTriggerEnergyEstimateMutation(designId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => energyEstimationApi.trigger(designId),
        onSuccess: () => {
            // Invalidate to trigger immediate refetch and start polling
            queryClient.invalidateQueries({ 
                queryKey: queryKeys.energyEstimation.detail(designId) 
            });
            toast.success("Energy estimation started");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to start energy estimation");
        },
    });
}
```

**Financial Analysis Query Hook:**

```typescript
export function useFinancialAnalysisQuery(designId: string) {
    return useQuery({
        queryKey: queryKeys.financialAnalysis.detail(designId),
        queryFn: () => financialAnalysisApi.get(designId),
        enabled: !!designId,
        retry: 1,
    });
}
```

Add imports at the top of the file:

```typescript
import { energyEstimationApi, financialAnalysisApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
```

---

### 5. Export New Hooks

**File:** `file:frontend/src/hooks/useSiteDesigns.ts`

Ensure the new hooks are exported (they already are if defined with `export function`).

---

## Integration Notes

**Polling Behavior:**
- The `useEnergyEstimateQuery` hook uses React Query's `refetchInterval` with a dynamic function
- When `status === 'calculating'`, it polls every 2000ms (2 seconds)
- When status changes to "completed" or "failed", polling stops automatically
- `refetchIntervalInBackground: true` ensures polling continues even when tab is not focused

**Error Handling:**
- Energy estimation errors are captured in the `error_message` field of the response
- Financial analysis auto-calculates if missing, so 404 errors are handled by the backend
- Both hooks integrate with the existing toast notification system

**Cache Invalidation:**
- Triggering energy estimation invalidates the query to start fresh polling
- Financial analysis should be invalidated when design parameters change (handled by subsequent phases)

**Type Safety:**
- All responses are strongly typed using the updated TypeScript interfaces
- Status values match backend exactly: "calculating", "completed", "failed", "not_calculated"