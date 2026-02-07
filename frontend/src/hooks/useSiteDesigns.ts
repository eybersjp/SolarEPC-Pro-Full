import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { siteDesignsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { SiteDesignCreate, SiteDesignUpdate, SiteDesignResponse } from "@/types";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { toast } from "@/lib/toast";

export function useSiteDesignsQuery(tenderId: string) {
    return useQuery({
        queryKey: queryKeys.siteDesigns.list(tenderId),
        queryFn: () => siteDesignsApi.list(tenderId),
        enabled: !!tenderId,
    });
}

export function useSiteDesignQuery(designId: string) {
    return useQuery({
        queryKey: queryKeys.siteDesigns.detail(designId),
        queryFn: () => siteDesignsApi.get(designId),
        enabled: !!designId,
    });
}

export function useCreateSiteDesignMutation(tenderId: string) {
    const queryClient = useQueryClient();
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);

    return useMutation({
        mutationFn: (data: SiteDesignCreate) => {
            setSyncState('syncing');
            return siteDesignsApi.create(tenderId, data);
        },
        retry: 3,
        onSuccess: () => {
            setSyncState('synced');
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.tenders.detail(tenderId) });
            toast.success("Design created successfully");
        },
        onError: (error: Error) => {
            setSyncState('failed');
            toast.error(error.message || "Failed to create design");
        },
    });
}

export function useUpdateSiteDesignMutation(designId: string) {
    const queryClient = useQueryClient();
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);

    return useMutation({
        mutationFn: (data: SiteDesignUpdate) => {
            setSyncState('syncing');
            return siteDesignsApi.update(designId, data);
        },
        retry: 3,
        onMutate: async (newData) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: queryKeys.siteDesigns.detail(designId) });

            // Snapshot the previous value
            const previousDesign = queryClient.getQueryData<SiteDesignResponse>(queryKeys.siteDesigns.detail(designId));

            // Optimistically update to the new value
            if (previousDesign) {
                queryClient.setQueryData<SiteDesignResponse>(queryKeys.siteDesigns.detail(designId), {
                    ...previousDesign,
                    ...newData,
                    // If placement_settings is being updated, we need to merge it carefully
                    placement_settings: newData.placement_settings
                        ? { ...previousDesign.placement_settings, ...newData.placement_settings }
                        : previousDesign.placement_settings
                } as SiteDesignResponse);
            }

            return { previousDesign };
        },
        onSuccess: (data) => {
            setSyncState('synced');
            queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), data);
            // Also invalidate lists to ensure everything stays in sync
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.lists() });
            toast.success("Design saved");
        },
        onError: (err: any, newData, context) => {
            setSyncState('failed');
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousDesign) {
                queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), context.previousDesign);
            }
            toast.error(err?.message || "Failed to save design");
        },
        onSettled: () => {
            // Always refetch after error or success to ensure we have the server state
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.detail(designId) });
        },
    });
}

export function useDeleteSiteDesignMutation(tenderId: string) {
    const queryClient = useQueryClient();
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);

    return useMutation({
        mutationFn: (designId: string) => {
            setSyncState('syncing');
            return siteDesignsApi.delete(designId);
        },
        retry: 3,
        onSuccess: () => {
            setSyncState('synced');
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.tenders.detail(tenderId) });
            toast.success("Design deleted");
        },
        onError: (error: Error) => {
            setSyncState('failed');
            toast.error(error.message || "Failed to delete design");
        },
    });
}
