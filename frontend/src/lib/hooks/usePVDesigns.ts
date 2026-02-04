"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pvDesignsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import type { PVDesignCreate } from "@/types";

/**
 * Hook to list all PV designs for a tender
 */
export function usePVDesigns(tenderId: string | undefined) {
    const query = useQuery({
        queryKey: queryKeys.pvDesigns.list(tenderId ?? ""),
        queryFn: () => pvDesignsApi.list(tenderId!),
        enabled: !!tenderId,
    });

    return {
        designs: query.data ?? [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook to get a single PV design by ID
 */
export function usePVDesign(tenderId: string | undefined, designId: string | undefined) {
    const query = useQuery({
        queryKey: queryKeys.pvDesigns.detail(tenderId ?? "", designId ?? ""),
        queryFn: () => pvDesignsApi.get(designId!),
        enabled: !!tenderId && !!designId,
    });

    return {
        design: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for creating a new PV design
 */
export function useCreatePVDesign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tenderId, data }: { tenderId: string; data: PVDesignCreate }) =>
            pvDesignsApi.create(tenderId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.pvDesigns.all });
            queryClient.invalidateQueries({
                queryKey: queryKeys.tenders.detail(variables.tenderId),
            });
            toast.success("PV design created successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to create PV design");
        },
    });
}

/**
 * Hook for deleting a PV design
 */
export function useDeletePVDesign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tenderId, designId }: { tenderId: string; designId: string }) =>
            pvDesignsApi.delete(designId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.pvDesigns.all });
            queryClient.invalidateQueries({
                queryKey: queryKeys.tenders.detail(variables.tenderId),
            });
            toast.success("PV design deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to delete PV design");
        },
    });
}
