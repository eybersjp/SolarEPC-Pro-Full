"use client";

import { Loader2 } from "lucide-react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";

/**
 * PlacementLoadingOverlay Component
 * Displays a full-screen loading state when a placement task is in progress.
 */
export default function PlacementLoadingOverlay() {
    const isVisible = useDesignCanvasStore((state) => state.placementLoading);

    if (!isVisible) return null;

    return (
        <div className="absolute inset-0 z-[1000] bg-slate-950/60 backdrop-blur-[2px] flex flex-col items-center justify-center transition-all duration-300">
            <div className="bg-slate-900/90 p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-6 text-center max-w-sm mx-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                    <Loader2 className="h-12 w-12 text-primary animate-spin relative z-10" />
                </div>

                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-white tracking-tight">Optimizing Layout</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        We're calculating the optimal module placement for your site boundary...
                    </p>
                </div>

                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-[shimmer_2s_infinite_linear] w-1/3 rounded-full" />
                </div>
            </div>
        </div>
    );
}
