import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pvDesignsApi } from "@/lib/api";
import { PVDesignCreate } from "@/types";

export const pvDesignKeys = {
    all: ["pv-designs"] as const,
    lists: () => [...pvDesignKeys.all, "list"] as const,
    list: (tenderId: string) => [...pvDesignKeys.lists(), tenderId] as const,
    details: () => [...pvDesignKeys.all, "detail"] as const,
    detail: (id: string) => [...pvDesignKeys.details(), id] as const,
};

export function usePVDesigns(tenderId: string) {
    const queryClient = useQueryClient();

    const designsQuery = useQuery({
        queryKey: pvDesignKeys.list(tenderId),
        queryFn: () => pvDesignsApi.list(tenderId),
        enabled: !!tenderId,
    });

    const createDesignMutation = useMutation({
        mutationFn: (data: PVDesignCreate) => pvDesignsApi.create(tenderId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: pvDesignKeys.list(tenderId) });
        },
    });

    const deleteDesignMutation = useMutation({
        mutationFn: (designId: string) => pvDesignsApi.delete(designId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: pvDesignKeys.list(tenderId) });
        },
    });

    return {
        designs: designsQuery.data ?? [],
        isLoading: designsQuery.isLoading,
        error: designsQuery.error,
        createDesign: createDesignMutation.mutate,
        createDesignAsync: createDesignMutation.mutateAsync,
        isCreating: createDesignMutation.isPending,
        createError: createDesignMutation.error,
        deleteDesign: deleteDesignMutation.mutate,
        deleteDesignAsync: deleteDesignMutation.mutateAsync,
        isDeleting: deleteDesignMutation.isPending,
        deleteError: deleteDesignMutation.error,
    };
}

export function usePVDesign(designId: string) {
    return useQuery({
        queryKey: pvDesignKeys.detail(designId),
        queryFn: () => pvDesignsApi.get(designId),
        enabled: !!designId,
    });
}
