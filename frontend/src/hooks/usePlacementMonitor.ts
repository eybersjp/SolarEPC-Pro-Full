"use client";

import { useEffect, useRef } from "react";
import { useSiteDesignQuery } from "./useSiteDesigns";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { toast } from "@/lib/toast";

/**
 * usePlacementMonitor Hook
 * Watches the placement_task_status of a design and manages loading state/notifications.
 */
export function usePlacementMonitor(designId: string) {
    const setPlacementLoading = useDesignCanvasStore((state) => state.setPlacementLoading);
    const lastStatus = useRef<string | null>(null);

    const { data: design } = useSiteDesignQuery(designId);

    useEffect(() => {
        if (!design) return;

        const status = design.placement_task_status;
        const error = design.placement_task_error;
        const isLoading = status === 'pending' || status === 'running';

        console.error(`[usePlacementMonitor] Status update: ${status}, Last: ${lastStatus.current}, IsLoading: ${isLoading}`);
        // toast.error(`DEBUG: ${status} [${lastStatus.current}]`);

        setPlacementLoading(isLoading);
        useDesignCanvasStore.getState().setPlacementStatus(status, error);

        // Handle transitions for notifications
        if (lastStatus.current && ['running', 'pending', 'failed', 'retrying'].includes(lastStatus.current)) {
            if (status === 'completed') {
                console.error('[usePlacementMonitor] Triggering success toast');
                toast.success("Module placement optimization complete!");
            }
            if (status === 'failed') {
                console.error('[usePlacementMonitor] Triggering failure toast');
                const errorMsg = error || "Optimization failed";
                if (!errorMsg.includes("Optimization failed")) {
                    toast.error(`Placement failed: ${errorMsg}`);
                }
            }
        }

        lastStatus.current = status;
    }, [design, setPlacementLoading]);

    return { design };
}
