import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { boqApi } from "@/lib/api";
import { BOQItemCreate, BOQItemUpdate, BOQSummary, BOQItem } from "@/types";

export const boqKeys = {
    all: ["boq"] as const,
    lists: () => [...boqKeys.all, "list"] as const,
    list: (tenderId: string) => [...boqKeys.lists(), tenderId] as const,
};

// Helper to recalculate totals after optimistic updates
function recalculateTotals(items: BOQItem[]): Omit<BOQSummary, "items"> {
    let subtotal = 0;
    let grandTotal = 0;

    items.forEach((item) => {
        const lineCost = item.quantity * item.unit_cost;
        const linePrice = lineCost * (1 + item.margin_pct / 100);
        subtotal += lineCost;
        grandTotal += linePrice;
    });

    return {
        subtotal,
        total_margin: grandTotal - subtotal,
        grand_total: grandTotal,
    };
}

export function useBOQ(tenderId: string) {
    const queryClient = useQueryClient();

    const boqQuery = useQuery({
        queryKey: boqKeys.list(tenderId),
        queryFn: () => boqApi.list(tenderId),
        enabled: !!tenderId,
    });

    const createItemMutation = useMutation({
        mutationFn: (data: BOQItemCreate) => boqApi.create(tenderId, data),
        onMutate: async (newItem) => {
            await queryClient.cancelQueries({ queryKey: boqKeys.list(tenderId) });
            const previousData = queryClient.getQueryData<BOQSummary>(boqKeys.list(tenderId));

            if (previousData) {
                // Optimistically add the new item with a temp ID
                const optimisticItem: BOQItem = {
                    id: `temp-${Date.now()}`,
                    category: newItem.category,
                    description: newItem.description,
                    unit_cost: newItem.unit_cost,
                    quantity: newItem.quantity,
                    margin_pct: newItem.margin_pct ?? 0,
                    line_total: newItem.quantity * newItem.unit_cost * (1 + (newItem.margin_pct ?? 0) / 100),
                };
                const newItems = [...previousData.items, optimisticItem];
                const newTotals = recalculateTotals(newItems);
                queryClient.setQueryData<BOQSummary>(boqKeys.list(tenderId), {
                    items: newItems,
                    ...newTotals,
                });
            }

            return { previousData };
        },
        onError: (err, newItem, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(boqKeys.list(tenderId), context.previousData);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: boqKeys.list(tenderId) });
        },
    });

    const updateItemMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: BOQItemUpdate }) =>
            boqApi.update(id, data),
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: boqKeys.list(tenderId) });
            const previousData = queryClient.getQueryData<BOQSummary>(boqKeys.list(tenderId));

            if (previousData) {
                const newItems = previousData.items.map((item) => {
                    if (item.id === id) {
                        const updated = { ...item, ...data };
                        updated.line_total = updated.quantity * updated.unit_cost * (1 + updated.margin_pct / 100);
                        return updated;
                    }
                    return item;
                });
                const newTotals = recalculateTotals(newItems);
                queryClient.setQueryData<BOQSummary>(boqKeys.list(tenderId), {
                    items: newItems,
                    ...newTotals,
                });
            }

            return { previousData };
        },
        onError: (err, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(boqKeys.list(tenderId), context.previousData);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: boqKeys.list(tenderId) });
        },
    });

    const deleteItemMutation = useMutation({
        mutationFn: (id: string) => boqApi.delete(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: boqKeys.list(tenderId) });
            const previousData = queryClient.getQueryData<BOQSummary>(boqKeys.list(tenderId));

            if (previousData) {
                const newItems = previousData.items.filter((item) => item.id !== id);
                const newTotals = recalculateTotals(newItems);
                queryClient.setQueryData<BOQSummary>(boqKeys.list(tenderId), {
                    items: newItems,
                    ...newTotals,
                });
            }

            return { previousData };
        },
        onError: (err, id, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(boqKeys.list(tenderId), context.previousData);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: boqKeys.list(tenderId) });
        },
    });

    const exportBOQ = async (format: "json" | "csv") => {
        try {
            const blob = await boqApi.export(tenderId, format);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `boq-${tenderId}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Export failed:", error);
            throw error;
        }
    };

    return {
        boqData: boqQuery.data,
        isLoading: boqQuery.isLoading,
        error: boqQuery.error,
        createItem: createItemMutation.mutate,
        createItemAsync: createItemMutation.mutateAsync,
        isCreating: createItemMutation.isPending,
        updateItem: updateItemMutation.mutate,
        updateItemAsync: updateItemMutation.mutateAsync,
        isUpdating: updateItemMutation.isPending,
        deleteItem: deleteItemMutation.mutate,
        deleteItemAsync: deleteItemMutation.mutateAsync,
        isDeleting: deleteItemMutation.isPending,
        exportBOQ,
    };
}
