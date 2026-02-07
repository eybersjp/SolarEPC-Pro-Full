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
        const isLoading = status === 'pending' || status === 'running';

        setPlacementLoading(isLoading);

        // Handle transitions for notifications
        if (lastStatus.current === 'running' || lastStatus.current === 'pending') {
            if (status === 'completed') {
                toast.success("Module placement optimization complete!");
            } else if (status === 'failed') {
                toast.error(design.placement_task_error || "Background optimization failed");
            }
        }

        lastStatus.current = status;
    }, [design, setPlacementLoading]);

    return { design };
}
