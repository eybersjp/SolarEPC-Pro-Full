import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalsApi, ApiError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { ProposalGenerateRequest, ProposalTaskResponse, ProposalStatusResponse } from "@/types";
import { toast } from "sonner";

/**
 * Hook to trigger proposal generation for a specific design.
 * @param designId - The ID of the site design.
 */
export function useGenerateProposalMutation(designId: string) {
    return useMutation({
        mutationFn: (options?: ProposalGenerateRequest) =>
            proposalsApi.generateProposal(designId, options),
        retry: process.env.NODE_ENV === 'test' ? 0 : 3,
        onSuccess: (data: ProposalTaskResponse) => {
            toast.success("Proposal generation started");
            return data;
        },
        onError: (error: ApiError | Error) => {
            const message = error instanceof ApiError
                ? error.message
                : "Failed to generate proposal";
            toast.error(message);
        },
    });
}

/**
 * Hook to poll the status of a proposal generation task.
 * Polls every 2 seconds while status is PENDING or STARTED.
 * @param taskId - The ID of the task to poll.
 * @param designId - Optional ID of the site design to invalidate when task completes.
 * @param enabled - Whether the query should be enabled.
 */
export function useTaskStatusQuery(taskId: string, designId?: string, enabled: boolean = true) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: queryKeys.proposals.task(taskId),
        queryFn: () => proposalsApi.getTaskStatus(taskId),
        enabled: !!taskId && enabled !== false,
        refetchInterval: (query) => {
            const data = query.state.data;
            if (data?.status === 'PENDING' || data?.status === 'STARTED') {
                return 2000; // Poll every 2 seconds
            }
            return false; // Stop polling when SUCCESS or FAILURE
        },
        retry: false, // Do not retry failed tasks, rely on polling
        staleTime: 0, // Ensure fresh data during polling
    });

    // Invalidate site design details when task completes successfully
    useEffect(() => {
        if (query.data?.status === 'SUCCESS' && designId) {
            queryClient.invalidateQueries({ queryKey: queryKeys.siteDesigns.detail(designId) });
        }
    }, [query.data?.status, designId, queryClient]);

    return query;
}

/**
 * Hook to export proposal/BOM as CSV.
 * @param designId - The ID of the site design.
 */
export function useExportCSV(designId: string) {
    return useMutation({
        mutationFn: () => proposalsApi.exportCSV(designId),
        retry: process.env.NODE_ENV === 'test' ? 0 : 1, // fewer retries for file downloads
        onSuccess: (data: Blob) => {
            const url = window.URL.createObjectURL(data);
            const link = document.createElement('a');
            link.href = url;
            link.download = `bom_design_${designId}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success("CSV exported successfully");
        },
        onError: (error: ApiError | Error) => {
            const message = error instanceof ApiError
                ? error.message
                : "Failed to export CSV";
            toast.error(message);
        },
    });
}
