import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Settings } from "lucide-react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";

export function RightPanel() {
    const { rightPanelOpen, toggleRightPanel } = useDesignCanvasStore();

    if (!rightPanelOpen) {
        return (
            <div className="absolute top-4 right-0 z-20">
                <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-r-none border-l-0 shadow-md"
                    onClick={toggleRightPanel}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="w-80 border-l bg-white h-full flex flex-col z-20 relative">
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2 font-medium">
                    <Settings className="h-4 w-4" />
                    Properties
                </div>
                <Button variant="ghost" size="icon" onClick={toggleRightPanel} className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 p-4 overflow-auto">
                <div className="text-sm text-muted-foreground text-center mt-10">
                    No items selected
                </div>
            </div>
        </div>
    );
}
