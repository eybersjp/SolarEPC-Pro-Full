"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Hook to get dashboard statistics and recent tenders
 */
export function useDashboard() {
    const query = useQuery({
        queryKey: queryKeys.dashboard.stats(),
        queryFn: () => dashboardApi.get(),
    });

    return {
        stats: query.data?.stats,
        recentTenders: query.data?.recent_tenders ?? [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}
