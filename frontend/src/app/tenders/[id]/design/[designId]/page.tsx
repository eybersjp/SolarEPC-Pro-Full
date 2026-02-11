"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { CanvasLayout } from "@/components/DesignCanvas/CanvasLayout";
import MapCanvas from "@/components/DesignCanvas/MapCanvas";
import { useSiteDesignQuery } from "@/hooks/useSiteDesigns";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { LoadingSpinner, ErrorMessage } from "@/components/common";

import { createContext, useContext } from "react";

interface NavigationContextType {
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const useDesignNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error("useDesignNavigation must be used within a NavigationProvider");
    }
    return context;
};

export default function DesignCanvasPage() {
    const params = useParams();
    const router = useRouter();
    const tenderId = params.id as string;
    const designId = params.designId as string;

    const { data: design, isLoading, error } = useSiteDesignQuery(designId);
    const syncState = useDesignCanvasStore((state) => state.syncState);

    const [isNavigationWarningOpen, setIsNavigationWarningOpen] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

    const setCurrentVersionName = useDesignCanvasStore((state) => state.setCurrentVersionName);

    // Sync version context with design data
    useEffect(() => {
        if (design) {
            const currentName = useDesignCanvasStore.getState().currentVersionName;
            if (currentName !== design.version_name) {
                setCurrentVersionName(design.version_name || null);
            }
        }
    }, [designId, design?.version_name, setCurrentVersionName]);

    // Browser-native beforeunload handler
    useEffect(() => {
        const hasUnsavedChanges = syncState === 'pending' || syncState === 'failed';

        if (!hasUnsavedChanges) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = ''; // Required for Chrome
            return '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [syncState]);

    const handleNavigationAttempt = (navigationCallback: () => void) => {
        const hasUnsavedChanges = syncState === 'pending' || syncState === 'failed';

        if (hasUnsavedChanges) {
            setPendingNavigation(() => navigationCallback);
            setIsNavigationWarningOpen(true);
        } else {
            navigationCallback();
        }
    };

    const handleConfirmNavigation = () => {
        if (pendingNavigation) {
            pendingNavigation();
        }
        setIsNavigationWarningOpen(false);
        setPendingNavigation(null);
    };

    const handleCancelNavigation = () => {
        setIsNavigationWarningOpen(false);
        setPendingNavigation(null);
    };

    const navigationValue = useMemo(() => ({
        push: (url: string) => handleNavigationAttempt(() => router.push(url)),
        replace: (url: string) => handleNavigationAttempt(() => router.replace(url)),
        back: () => handleNavigationAttempt(() => router.back()),
    }), [router, syncState]); // syncState is used inside handleNavigationAttempt

    // Calculate center from boundary if not available on design object
    const getCenter = (): [number, number] => {
        if (!design?.site_boundary?.coordinates?.[0]?.length) {
            return [0, 0];
        }

        const coords = design.site_boundary.coordinates[0];
        let totalLat = 0;
        let totalLng = 0;

        coords.forEach((coord) => {
            totalLng += coord[0];
            totalLat += coord[1];
        });

        return [totalLat / coords.length, totalLng / coords.length];
    };

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <LoadingSpinner />
                    <p className="mt-4 text-sm text-muted-foreground font-medium">Loading Design Canvas...</p>
                </div>
            </div>
        );
    }

    if (error || !design) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                <ErrorMessage
                    title="Design Not Found"
                    message="The requested design could not be loaded. It may have been deleted or you may not have permission to view it."
                />
            </div>
        );
    }

    return (
        <NavigationContext.Provider value={navigationValue}>
            <div className="h-screen w-screen overflow-hidden">
                <CanvasLayout
                    title={design.name}
                    tenderId={tenderId}
                    designId={designId}
                >
                    <MapCanvas
                        center={getCenter()}
                        tenderId={tenderId}
                        designId={designId}
                    />
                </CanvasLayout>

                <ConfirmDialog
                    open={isNavigationWarningOpen}
                    onOpenChange={(open) => !open && handleCancelNavigation()}
                    title="Unsaved Changes"
                    description="You have unsaved changes that haven't been synced. Are you sure you want to leave? Your changes may be lost."
                    confirmLabel="Leave Anyway"
                    cancelLabel="Stay on Page"
                    onConfirm={handleConfirmNavigation}
                    variant="danger"
                />
            </div>
        </NavigationContext.Provider>
    );
}
