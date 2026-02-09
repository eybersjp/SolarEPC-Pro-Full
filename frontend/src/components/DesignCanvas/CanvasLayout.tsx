import { ReactNode, useState, useEffect } from "react";
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
    const [isVersionListOpen, setIsVersionListOpen] = useState(false);

    // Keyboard shortcut to toggle version list (Ctrl+H or Cmd+H)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                setIsVersionListOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50">
            <Toolbar
                title={title}
                tenderId={tenderId}
                designId={designId}
                isVersionListOpen={isVersionListOpen}
                onVersionListOpenChange={setIsVersionListOpen}
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
                <RightPanel
                    designId={designId}
                    isVersionListOpen={isVersionListOpen}
                    onVersionListOpenChange={setIsVersionListOpen}
                />
            </div>
        </div>
    );
}
