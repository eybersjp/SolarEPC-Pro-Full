import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { siteDesignsApi, pvDesignsApi } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import {
    SiteDesignCreate,
    SiteDesignUpdate,
    SiteDesignResponse,
    EnergyEstimateResponse,
    FinancialAnalysisResponse,
    DesignVersionCreate,
    DesignVersionResponse,
    DesignVersionDetail,
    DesignVersionRestoreResponse
} from "@/types";
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
        refetchInterval: (query: any) => {
            const status = query.state.data?.placement_task_status;
            if (status === 'pending' || status === 'running') {
                return 2000;
            }
            return false;
        }
    });
}

export function useCreateSiteDesignMutation(tenderId: string) {
    const queryClient = useQueryClient();
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);
    const setRetryCount = useDesignCanvasStore((state) => state.setRetryCount);

    return useMutation({
        mutationFn: (data: SiteDesignCreate) => {
            setSyncState('syncing');
            setRetryCount(0);
            return siteDesignsApi.create(tenderId, data);
        },
        retry: process.env.NODE_ENV === 'test' ? 0 : 3,
        retryDelay: (attemptIndex) => {
            const delays = [1000, 2000, 4000];
            setRetryCount(attemptIndex + 1);
            return delays[attemptIndex] || 4000;
        },
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
    const setRetryCount = useDesignCanvasStore((state) => state.setRetryCount);
    const setLastMutationData = useDesignCanvasStore((state) => state.setLastMutationData);

    return useMutation({
        mutationFn: (data: SiteDesignUpdate) => {
            setSyncState('syncing');
            setLastMutationData(data);
            return siteDesignsApi.update(designId, data);
        },
        retry: 3,
        retryDelay: (attemptIndex) => {
            const delays = [1000, 2000, 4000];
            setRetryCount(attemptIndex + 1);
            toast.error("Failed to save changes. Retrying...");
            return delays[attemptIndex] || 4000;
        },
        onMutate: async (newData) => {
            setRetryCount(0);
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.siteDesigns.detail(designId) });

            // Snapshot the previous value
            const previousDesign = queryClient.getQueryData<SiteDesignResponse>(queryKeys.siteDesigns.detail(designId));

            // Optimistically update
            if (previousDesign) {
                queryClient.setQueryData<SiteDesignResponse>(queryKeys.siteDesigns.detail(designId), {
                    ...previousDesign,
                    ...newData,
                    placement_settings: newData.placement_settings
                        ? { ...previousDesign.placement_settings, ...newData.placement_settings }
                        : previousDesign.placement_settings
                } as SiteDesignResponse);
            }

            return { previousDesign };
        },
        onSuccess: (data) => {
            setSyncState('synced');
            setLastMutationData(null);
            queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), data);
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.lists() });
            toast.success("Version saved successfully");
        },
        onError: (err: any, newData, context) => {
            const retryCount = useDesignCanvasStore.getState().retryCount;
            setSyncState('failed');

            if (retryCount >= 3) {
                toast.error("Failed to save changes after 3 attempts. Click retry to try again.");
            }

            if (context?.previousDesign) {
                queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), context.previousDesign);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.detail(designId) });
        },
    });
}

export function useDeleteSiteDesignMutation(tenderId: string) {
    const queryClient = useQueryClient();
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);
    const setRetryCount = useDesignCanvasStore((state) => state.setRetryCount);

    return useMutation({
        mutationFn: (designId: string) => {
            setSyncState('syncing');
            setRetryCount(0);
            return siteDesignsApi.delete(designId);
        },
        retry: process.env.NODE_ENV === 'test' ? 0 : 3,
        retryDelay: (attemptIndex) => {
            const delays = [1000, 2000, 4000];
            setRetryCount(attemptIndex + 1);
            return delays[attemptIndex] || 4000;
        },
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

export function useRecalculatePlacementMutation(designId: string) {
    const queryClient = useQueryClient();
    const setPlacementLoading = useDesignCanvasStore((state) => state.setPlacementLoading);
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);

    return useMutation({
        mutationFn: async () => {
            setPlacementLoading(true);
            setSyncState('syncing');
            return siteDesignsApi.recalculate(designId);
        },
        retry: 0,
        onSuccess: (data) => {
            setSyncState('synced');
            queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), data);
        },
        onError: (error: Error) => {
            setSyncState('failed');
            toast.error(error.message || "Failed to recalculate layout");
        },
        onSettled: () => {
            setPlacementLoading(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.detail(designId) });
        },
    });
}

export function useEnergyEstimateQuery(designId: string, options: any = {}) {
    return useQuery<EnergyEstimateResponse>({
        queryKey: queryKeys.energyEstimation.detail(designId),
        queryFn: () => siteDesignsApi.getEnergyEstimate(designId),
        enabled: !!designId && options.enabled !== false,
        refetchInterval: (query: any) => {
            const data = query.state.data;
            if (data?.status === 'calculating') {
                return 2000;
            }
            return false;
        },
        ...options
    });
}

export function useTriggerEnergyEstimateMutation(designId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => siteDesignsApi.triggerEnergyEstimate(designId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.energyEstimation.detail(designId) });
            toast.success("Energy estimation started");
        },
        onError: (error: Error) => {
            toast.error(error.message || "Failed to trigger energy estimation");
        },
    });
}

export function useFinancialAnalysisQuery(designId: string) {
    return useQuery({
        queryKey: queryKeys.financialAnalysis.detail(designId),
        queryFn: () => siteDesignsApi.getFinancialAnalysis(designId),
        enabled: !!designId,
    });
}

export function usePVDesignQuery(tenderId: string, pvDesignId: string | null) {
    return useQuery({
        queryKey: queryKeys.pvDesigns.detail(tenderId, pvDesignId || ''),
        queryFn: () => pvDesignsApi.get(pvDesignId!),
        enabled: !!tenderId && !!pvDesignId,
    });
}

export function useCreateVersionMutation(designId: string) {
    const queryClient = useQueryClient();
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);
    const setRetryCount = useDesignCanvasStore((state) => state.setRetryCount);

    return useMutation({
        mutationFn: (data: DesignVersionCreate) => {
            setSyncState('syncing');
            return siteDesignsApi.createVersion(designId, data);
        },
        retry: process.env.NODE_ENV === 'test' ? 0 : 3,
        retryDelay: (attemptIndex) => {
            const delays = [1000, 2000, 4000];
            setRetryCount(attemptIndex + 1);
            toast.error("Failed to save changes. Retrying...");
            return delays[attemptIndex] || 4000;
        },
        onMutate: async (newVersion) => {
            setRetryCount(0);
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.designVersions.list(designId) });

            // Snapshot the previous value
            const previousVersions = queryClient.getQueryData<DesignVersionResponse[]>(queryKeys.designVersions.list(designId));

            // Optimistically update to the new value
            if (previousVersions) {
                const tempVersion: DesignVersionResponse = {
                    id: `temp-${Date.now()}`,
                    site_design_id: designId,
                    version_name: newVersion.version_name,
                    notes: newVersion.notes || null,
                    created_at: new Date().toISOString(),
                    created_by_name: "You", // Optimistic placeholder
                    total_modules: null,
                    system_size_kwp: null,
                };
                queryClient.setQueryData<DesignVersionResponse[]>(queryKeys.designVersions.list(designId), [
                    tempVersion,
                    ...previousVersions,
                ]);
            }

            return { previousVersions };
        },
        onSuccess: () => {
            setSyncState('synced');
            toast.success("Version saved successfully");
        },
        onError: (error: Error, _variables, context) => {
            setSyncState('failed');
            if (context?.previousVersions) {
                queryClient.setQueryData(queryKeys.designVersions.list(designId), context.previousVersions);
            }
            toast.error(error.message || "Failed to save version");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.designVersions.list(designId) });
        },
    });
}

export function useVersionsQuery(designId: string) {
    return useQuery({
        queryKey: queryKeys.designVersions.list(designId),
        queryFn: () => siteDesignsApi.listVersions(designId),
        enabled: !!designId,
    });
}

export function useVersionDetailQuery(designId: string, versionId: string) {
    return useQuery({
        queryKey: queryKeys.designVersions.detail(designId, versionId),
        queryFn: () => siteDesignsApi.getVersionDetail(designId, versionId),
        enabled: !!designId && !!versionId,
    });
}

export function useRestoreVersionMutation(designId: string) {
    const queryClient = useQueryClient();
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);
    const setRetryCount = useDesignCanvasStore((state) => state.setRetryCount);
    const setPlacementLoading = useDesignCanvasStore((state) => state.setPlacementLoading);

    return useMutation({
        mutationFn: (versionId: string) => {
            setSyncState('syncing');
            setPlacementLoading(true);
            setRetryCount(0);
            return siteDesignsApi.restoreVersion(designId, versionId);
        },
        retry: process.env.NODE_ENV === 'test' ? 0 : 3,
        retryDelay: (attemptIndex) => {
            const delays = [1000, 2000, 4000];
            setRetryCount(attemptIndex + 1);
            toast.error("Failed to restore version. Retrying...");
            return delays[attemptIndex] || 4000;
        },
        onSuccess: (data) => {
            setSyncState('synced');
            queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), data.site_design);
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.energyEstimation.detail(designId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.financialAnalysis.detail(designId) });
        },
        onError: (error: Error) => {
            setSyncState('failed');
            toast.error(error.message || "Failed to restore version");
        },
        onSettled: () => {
            setPlacementLoading(false);
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.detail(designId) });
        },
    });
}
