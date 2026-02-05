"use client";

import { useEffect } from "react";
import { CanvasLayout } from "@/components/DesignCanvas/CanvasLayout";
import { useDesignQuery } from "@/hooks/useDesignCanvas";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface DesignPageProps {
    params: {
        id: string; // This corresponds to the [id] folder (tenderId)
        designId: string;
    };
}

export default function DesignPage({ params }: DesignPageProps) {
    const { id: tenderId, designId } = params;
    const router = useRouter();

    const { data: design, isLoading, error } = useDesignQuery(designId);
    const syncState = useDesignCanvasStore((state) => state.syncState);

    // Warn about unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (syncState !== 'synced') {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [syncState]);

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-lg font-medium">Loading Design...</span>
            </div>
        );
    }

    if (error || !design) {
        return (
            <div className="h-screen w-screen flex items-center justify-center flex-col">
                <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Design</h1>
                <p className="text-muted-foreground mb-4">
                    {error?.message || "Design not found"}
                </p>
                <button
                    onClick={() => router.back()}
                    className="text-primary hover:underline"
                >
                    Return to Tender
                </button>
            </div>
        );
    }

    return (
        <CanvasLayout title={`Design: ${design.module_model}`} tenderId={tenderId}>
            <div className="bg-white/50 w-full h-full flex items-center justify-center border-2 border-dashed border-slate-300 rounded-lg m-4">
                <div className="text-center text-muted-foreground">
                    <p className="text-lg font-medium mb-1">Map Area Wrapper</p>
                    <p className="text-sm">Map implementation is out of scope for this ticket.</p>
                </div>
            </div>
        </CanvasLayout>
    );
}
