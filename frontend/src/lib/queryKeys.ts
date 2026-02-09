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

    // Site Design queries
    siteDesigns: {
        all: ["site-designs"] as const,
        lists: () => [...queryKeys.siteDesigns.all, "list"] as const,
        list: (tenderId: string) =>
            [...queryKeys.siteDesigns.lists(), tenderId] as const,
        details: () => [...queryKeys.siteDesigns.all, "detail"] as const,
        detail: (designId: string) =>
            [...queryKeys.siteDesigns.details(), designId] as const,
    },

    // Equipment queries
    equipment: {
        all: ["equipment"] as const,
        modules: () => [...queryKeys.equipment.all, "modules"] as const,
        modulesList: (filters?: { search?: string; manufacturer?: string }) =>
            [...queryKeys.equipment.modules(), filters] as const,
        inverters: () => [...queryKeys.equipment.all, "inverters"] as const,
        invertersList: (filters?: { search?: string; manufacturer?: string }) =>
            [...queryKeys.equipment.inverters(), filters] as const,
    },

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

    // Proposal queries
    proposals: {
        all: ["proposals"] as const,
        tasks: () => [...queryKeys.proposals.all, "task"] as const,
        task: (taskId: string) => [...queryKeys.proposals.tasks(), taskId] as const,
    },

    // Design Version queries
    designVersions: {
        all: ["design-versions"] as const,
        lists: () => [...queryKeys.designVersions.all, "list"] as const,
        list: (designId: string) =>
            [...queryKeys.designVersions.lists(), designId] as const,
        details: () => [...queryKeys.designVersions.all, "detail"] as const,
        detail: (designId: string, versionId: string) =>
            [...queryKeys.designVersions.details(), designId, versionId] as const,
    },
} as const;
