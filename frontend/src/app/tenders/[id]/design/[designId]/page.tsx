"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { CanvasLayout } from "@/components/DesignCanvas/CanvasLayout";
import { useSiteDesignQuery } from "@/hooks/useSiteDesigns";
import { useTender } from "@/lib/hooks/useTenders";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { DEFAULT_MAP_CONFIG } from "@/lib/mapConfig";

// Dynamically import MapCanvas as it uses Leaflet which is client-side only
const MapCanvas = dynamic(
    () => import("@/components/DesignCanvas/MapCanvas"),
    {
        ssr: false,
        loading: () => (
            <div className="h-full w-full flex items-center justify-center bg-slate-900/5 rounded-lg border-2 border-dashed border-slate-200">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    <span className="text-sm text-slate-400 font-medium">Loading Map Canvas...</span>
                </div>
            </div>
        )
    }
);

interface DesignPageProps {
    params: {
        id: string; // This corresponds to the [id] folder (tenderId)
        designId: string;
    };
}

export default function DesignPage({ params }: DesignPageProps) {
    const { id: tenderId, designId } = params;
    const router = useRouter();

    // Fetch design data and tender data (for coordinates)
    const { data: design, isLoading: designLoading, error: designError } = useSiteDesignQuery(designId);
    const { tender, isLoading: tenderLoading, error: tenderError } = useTender(tenderId);

    const syncState = useDesignCanvasStore((state) => state.syncState);

    // Derived map center - priority to tender coordinates, fallback to default
    const mapCenter = useMemo((): [number, number] => {
        if (tender?.latitude && tender?.longitude) {
            return [tender.latitude, tender.longitude];
        }
        return DEFAULT_MAP_CONFIG.center;
    }, [tender?.latitude, tender?.longitude]);

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

    const isLoading = designLoading || tenderLoading;
    const error = designError || tenderError;

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                        </div>
                    </div>
                    <span className="mt-6 text-lg font-semibold text-slate-700">Initializing Design Workspace</span>
                    <p className="text-slate-400 text-sm mt-1">Retrieving site data and configurations...</p>
                </div>
            </div>
        );
    }

    if (error || !design) {
        return (
            <div className="h-screen w-screen flex items-center justify-center flex-col bg-slate-50 p-6">
                <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 text-center max-w-md w-full">
                    <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Workspace Error</h1>
                    <p className="text-slate-500 mb-8 leading-relaxed">
                        {error instanceof Error ? error.message : "We couldn't load the design session data. Please try again or return to the tender overview."}
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-md active:scale-95"
                        >
                            Retry Loading
                        </button>
                        <button
                            onClick={() => router.push(`/tenders/${tenderId}`)}
                            className="text-slate-500 font-medium hover:text-slate-800 transition-colors py-2"
                        >
                            Return to Tender
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <CanvasLayout title={`Design: ${design.name}`} tenderId={tenderId} designId={designId}>
            <div className="w-full h-full p-4 relative overflow-hidden">
                <div className="w-full h-full bg-slate-200 rounded-xl overflow-hidden shadow-2xl border border-white/20">
                    <MapCanvas
                        center={mapCenter}
                        tenderId={tenderId}
                        designId={designId}
                    />
                </div>
            </div>
        </CanvasLayout>
    );
}
