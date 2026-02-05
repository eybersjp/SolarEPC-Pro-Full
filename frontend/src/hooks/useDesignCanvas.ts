import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pvDesignsApi } from "@/lib/api";
import { PVDesignUpdate } from "@/types";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { pvDesignKeys } from "./usePVDesigns";

export function useDesignQuery(designId: string) {
    return useQuery({
        queryKey: pvDesignKeys.detail(designId),
        queryFn: () => pvDesignsApi.get(designId),
        enabled: !!designId,
    });
}

export function useUpdateDesignMutation(designId: string) {
    const queryClient = useQueryClient();
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);

    return useMutation({
        mutationFn: (data: PVDesignUpdate) => {
            setSyncState('syncing');
            return pvDesignsApi.update(designId, data);
        },
        onSuccess: (data) => {
            setSyncState('synced');
            queryClient.setQueryData(pvDesignKeys.detail(designId), data);
        },
        onError: () => {
            setSyncState('failed');
        },
    });
}
