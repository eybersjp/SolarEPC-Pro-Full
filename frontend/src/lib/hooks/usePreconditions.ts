"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { preconditionsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import type { PreconditionUpdate } from "@/types";

/**
 * Hook to get preconditions for a tender
 */
export function usePreconditions(tenderId: string | undefined) {
    const query = useQuery({
        queryKey: queryKeys.preconditions.detail(tenderId ?? ""),
        queryFn: () => preconditionsApi.get(tenderId!),
        enabled: !!tenderId,
    });

    return {
        data: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for updating preconditions
 */
export function useUpdatePreconditions(tenderId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: PreconditionUpdate) =>
            preconditionsApi.update(tenderId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.preconditions.detail(tenderId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.tenders.detail(tenderId),
            });
            toast.success("Preconditions updated successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update preconditions");
        },
    });
}
