"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boqApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "@/lib/toast";
import type { BOQItemCreate, BOQItemUpdate, BOQSummary } from "@/types";

/**
 * Hook to get BOQ for a tender
 */
export function useBOQ(tenderId: string | undefined) {
    const query = useQuery({
        queryKey: queryKeys.boq.list(tenderId ?? ""),
        queryFn: () => boqApi.list(tenderId!),
        enabled: !!tenderId,
    });

    return {
        items: query.data?.items ?? [],
        subtotal: query.data?.subtotal ?? 0,
        totalMargin: query.data?.total_margin ?? 0,
        grandTotal: query.data?.grand_total ?? 0,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}

/**
 * Hook for adding a BOQ item
 */
export function useCreateBOQItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tenderId, data }: { tenderId: string; data: BOQItemCreate }) =>
            boqApi.create(tenderId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.boq.list(variables.tenderId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.tenders.detail(variables.tenderId),
            });
            toast.success("BOQ item added successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to add BOQ item");
        },
    });
}

/**
 * Hook for updating a BOQ item
 */
export function useUpdateBOQItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tenderId, itemId, data }: { tenderId: string; itemId: string; data: BOQItemUpdate }) =>
            boqApi.update(itemId, data),
        onMutate: async ({ tenderId, itemId, data }) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: queryKeys.boq.list(tenderId) });

            // Snapshot the previous value
            const previousBOQ = queryClient.getQueryData<BOQSummary>(queryKeys.boq.list(tenderId));

            // Optimistically update to the new value
            if (previousBOQ) {
                queryClient.setQueryData<BOQSummary>(queryKeys.boq.list(tenderId), {
                    ...previousBOQ,
                    items: previousBOQ.items.map((item: any) =>
                        item.id === itemId ? { ...item, ...data } : item
                    )
                });
            }

            return { previousBOQ };
        },
        onError: (error: Error, { tenderId }, context) => {
            if (context?.previousBOQ) {
                queryClient.setQueryData(queryKeys.boq.list(tenderId), context.previousBOQ);
            }
            toast.error(error.message || "Failed to update BOQ item");
        },
        onSuccess: (_, { tenderId }) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.boq.list(tenderId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.tenders.detail(tenderId),
            });
            toast.success("BOQ item updated successfully");
        },
    });
}

/**
 * Hook for deleting a BOQ item
 */
export function useDeleteBOQItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ tenderId, itemId }: { tenderId: string; itemId: string }) =>
            boqApi.delete(itemId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.boq.list(variables.tenderId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.tenders.detail(variables.tenderId),
            });
            toast.success("BOQ item deleted successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to delete BOQ item");
        },
    });
}

/**
 * Hook for exporting BOQ
 */
export function useExportBOQ() {
    return useMutation({
        mutationFn: ({ tenderId, format }: { tenderId: string; format: 'json' | 'csv' }) =>
            boqApi.export(tenderId, format),
        onSuccess: (blob: Blob, variables) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `boq-${variables.tenderId}.${variables.format === 'csv' ? 'csv' : 'json'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("BOQ exported successfully");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to export BOQ");
        },
    });
}
