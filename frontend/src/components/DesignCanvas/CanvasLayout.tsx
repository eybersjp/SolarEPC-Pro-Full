import { ReactNode } from "react";
import { Toolbar } from "./Toolbar";
import { FloatingPalette } from "./FloatingPalette";
import { RightPanel } from "./RightPanel";
import PlacementLoadingOverlay from "./PlacementLoadingOverlay";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { ResultsBottomSheet } from "./ResultsBottomSheet";

interface CanvasLayoutProps {
    children: ReactNode;
    title: string;
    tenderId: string;
    designId: string;
}

export function CanvasLayout({ children, title, tenderId, designId }: CanvasLayoutProps) {
    const rightPanelOpen = useDesignCanvasStore((state) => state.rightPanelOpen);

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50">
            <Toolbar
                title={title}
                tenderId={tenderId}
                designId={designId}
            />

            <div className="flex-1 flex overflow-hidden relative">
                {/* Main Canvas Area */}
                <div className="flex-1 relative bg-slate-100 overflow-hidden">
                    <FloatingPalette />
                    <PlacementLoadingOverlay />
                    {children}
                    <ResultsBottomSheet designId={designId} />
                </div>

                {/* Right Panel */}
                <RightPanel designId={designId} />
            </div>
        </div>
    );
}
