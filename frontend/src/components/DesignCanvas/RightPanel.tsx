import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Settings, Wrench, History as HistoryIcon } from "lucide-react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EquipmentSelector } from "./EquipmentSelector";
import { PlacementSettings } from "./PlacementSettings";
import { VersionList } from "./VersionList";

interface RightPanelProps {
    designId: string;
    isVersionListOpen: boolean;
    onVersionListOpenChange: (open: boolean) => void;
}

export function RightPanel({ designId, isVersionListOpen, onVersionListOpenChange }: RightPanelProps) {
    const rightPanelOpen = useDesignCanvasStore((state) => state.rightPanelOpen);
    const toggleRightPanel = useDesignCanvasStore((state) => state.toggleRightPanel);
    const setCurrentVersionName = useDesignCanvasStore((state) => state.setCurrentVersionName);

    const handleVersionRestored = (versionName: string) => {
        setCurrentVersionName(versionName);
    };

    if (!rightPanelOpen) {
        return (
            <div className="absolute top-4 right-0 z-20">
                <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-r-none border-l-0 shadow-md"
                    onClick={toggleRightPanel}
                    aria-label="Open Properties Panel"
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
                <Button variant="ghost" size="icon" onClick={toggleRightPanel} className="h-8 w-8" aria-label="Close Properties Panel">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 p-4 overflow-auto flex flex-col gap-4">
                <Card>
                    <CardHeader className="p-4 flex flex-row items-center gap-2 space-y-0">
                        <Wrench className="h-4 w-4" />
                        <CardTitle className="text-sm font-medium">Equipment</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <EquipmentSelector designId={designId} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 flex flex-row items-center gap-2 space-y-0">
                        <Settings className="h-4 w-4" />
                        <CardTitle className="text-sm font-medium">Placement Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <PlacementSettings designId={designId} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 flex flex-row items-center gap-2 space-y-0">
                        <HistoryIcon className="h-4 w-4" />
                        <CardTitle className="text-sm font-medium">Version History</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-xs text-muted-foreground mb-3">
                            View and restore previous design snapshots.
                        </p>
                        <VersionList
                            designId={designId}
                            open={isVersionListOpen}
                            onOpenChange={onVersionListOpenChange}
                            onVersionRestored={handleVersionRestored}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
