"use client";

import { Zap, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsBadgeProps {
    totalModules: number | null;
    systemSizeKwp: number | null;
    loading?: boolean;
}

/**
 * StatsBadge Component
 * Displays system-level metrics on the Map Canvas.
 */
export default function StatsBadge({ totalModules, systemSizeKwp, loading }: StatsBadgeProps) {
    if (loading) {
        return (
            <div className="absolute top-4 right-4 z-[400] bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl flex gap-6 min-w-[200px]">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-16 bg-white/5" />
                    <Skeleton className="h-5 w-24 bg-white/10" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-3 w-12 bg-white/5" />
                    <Skeleton className="h-5 w-20 bg-white/10" />
                </div>
            </div>
        );
    }

    return (
        <div className="absolute top-4 right-4 z-[400] bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-2xl flex gap-8 items-center pointer-events-none group">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-500/10 rounded-xl">
                    <LayoutGrid className="h-4 w-4 text-teal-400" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Modules</div>
                    <div className="text-xl font-bold text-white tabular-nums tracking-tight">
                        {totalModules?.toLocaleString() ?? 0}
                    </div>
                </div>
            </div>

            <div className="h-8 w-px bg-white/10" />

            <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl">
                    <Zap className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Capacity</div>
                    <div className="text-xl font-bold text-white tabular-nums tracking-tight">
                        {systemSizeKwp?.toFixed(2) ?? "0.00"}
                        <span className="text-xs font-medium text-slate-400 ml-1">kWp</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
