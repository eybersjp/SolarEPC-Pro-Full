/**
 * React Query key factory for consistent cache key management.
 * Following the factory pattern for better organization and type safety.
 */

export const queryKeys = {
    // Auth queries
    auth: {
        all: ["auth"] as const,
        me: () => [...queryKeys.auth.all, "me"] as const,
    },

    // Tender queries
    tenders: {
        all: ["tenders"] as const,
        lists: () => [...queryKeys.tenders.all, "list"] as const,
        list: (filters?: { status?: string; limit?: number; offset?: number }) =>
            [...queryKeys.tenders.lists(), filters] as const,
        details: () => [...queryKeys.tenders.all, "detail"] as const,
        detail: (id: string) => [...queryKeys.tenders.details(), id] as const,
    },

    // Dashboard queries
    dashboard: {
        all: ["dashboard"] as const,
        stats: () => [...queryKeys.dashboard.all, "stats"] as const,
    },

    // PV Design queries
    pvDesigns: {
        all: ["pv-designs"] as const,
        lists: () => [...queryKeys.pvDesigns.all, "list"] as const,
        list: (tenderId: string) =>
            [...queryKeys.pvDesigns.lists(), tenderId] as const,
        details: () => [...queryKeys.pvDesigns.all, "detail"] as const,
        detail: (tenderId: string, designId: string) =>
            [...queryKeys.pvDesigns.details(), tenderId, designId] as const,
    },

    // Preconditions queries
    preconditions: {
        all: ["preconditions"] as const,
        details: () => [...queryKeys.preconditions.all, "detail"] as const,
        detail: (tenderId: string) =>
            [...queryKeys.preconditions.details(), tenderId] as const,
    },

    // BOQ queries
    boq: {
        all: ["boq"] as const,
        lists: () => [...queryKeys.boq.all, "list"] as const,
        list: (tenderId: string) => [...queryKeys.boq.lists(), tenderId] as const,
        summaries: () => [...queryKeys.boq.all, "summary"] as const,
        summary: (tenderId: string) =>
            [...queryKeys.boq.summaries(), tenderId] as const,
    },
} as const;
