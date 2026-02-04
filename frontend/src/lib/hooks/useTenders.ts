"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tendersApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import type { TenderCreate, TenderUpdate } from "@/types";

interface TenderFilters {
    status?: string;
    limit?: number;
    offset?: number;
}

/**
 * Hook to list tenders with optional filters
 */
export function useTenders(filters?: TenderFilters) {
    const query = useQuery({
        queryKey: queryKeys.tenders.list(filters),
        queryFn: () => tendersApi.list(filters),
    });

    return {
        tenders: query.data ?? [],
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook to get a single tender by ID
 */
export function useTender(id: string | undefined) {
    const query = useQuery({
        queryKey: queryKeys.tenders.detail(id ?? ""),
        queryFn: () => tendersApi.get(id!),
        enabled: !!id,
    });

    return {
        tender: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for creating a new tender
 */
export function useCreateTender() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: TenderCreate) => tendersApi.create(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tenders.all });
            toast.success("Tender created successfully");
            return data;
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to create tender");
        },
    });
}

/**
 * Hook for updating a tender
 */
export function useUpdateTender() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: TenderUpdate }) =>
            tendersApi.update(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.tenders.detail(variables.id),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.tenders.lists() });
            toast.success("Tender updated successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to update tender");
        },
    });
}

/**
 * Hook for deleting a tender
 */
export function useDeleteTender() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => tendersApi.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tenders.all });
            toast.success("Tender deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to delete tender");
        },
    });
}
