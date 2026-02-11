"use client";

import { Loader2 } from "lucide-react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { Button } from "@/components/ui/button";

/**
 * PlacementLoadingOverlay Component
 * Displays a full-screen loading state when a placement task is in progress.
 */
export default function PlacementLoadingOverlay() {
    const isVisible = useDesignCanvasStore((state) => state.placementLoading);
    const status = useDesignCanvasStore((state) => state.placementStatus);
    const error = useDesignCanvasStore((state) => state.placementError);
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);

    if (!isVisible && !error) return null;

    const getStatusText = () => {
        switch (status) {
            case 'pending': return 'Queuing optimization...';
            case 'running': return 'Calculating optimal placement...';
            case 'completed': return 'Finalizing layout...';
            case 'failed': return 'Optimization failed';
            default: return 'Optimizing Layout';
        }
    };

    return (
        <div className="absolute inset-0 z-[1000] bg-slate-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center transition-all duration-300">
            <div className="bg-slate-900/90 p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-6 text-center max-w-sm mx-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                    {status === 'failed' ? (
                        <div className="h-12 w-12 bg-red-500/20 rounded-full flex items-center justify-center relative z-10 border border-red-500/50">
                            <span className="text-red-500 font-bold text-xl">!</span>
                        </div>
                    ) : (
                        <Loader2 className="h-12 w-12 text-primary animate-spin relative z-10" />
                    )}
                </div>

                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white tracking-tight" data-testid="placement-status-title">
                        {getStatusText()}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed" data-testid="placement-status-description">
                        {status === 'failed'
                            ? (error || "An unexpected error occurred during layout optimization.")
                            : "We're calculating the optimal module placement for your site boundary..."}
                    </p>
                </div>

                {status === 'failed' ? (
                    <div className="flex gap-3 w-full">
                        <Button
                            variant="default"
                            className="flex-1"
                            onClick={() => {
                                // Triggering recalculation via setSyncState pending which triggers the mutation in PlacementSettings
                                // Or we could just reset the error and let the user click the button in panel
                                useDesignCanvasStore.getState().setPlacementStatus(null, null);
                                useDesignCanvasStore.getState().setPlacementLoading(false);
                            }}
                            data-testid="placement-retry-button"
                        >
                            Dismiss
                        </Button>
                    </div>
                ) : (
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary animate-[shimmer_2s_infinite_linear] w-1/3 rounded-full" />
                    </div>
                )}
            </div>
        </div>
    );
}
