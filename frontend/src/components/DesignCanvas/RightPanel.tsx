import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Settings, Wrench } from "lucide-react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EquipmentSelector } from "./EquipmentSelector";

interface RightPanelProps {
    designId: string;
}

export function RightPanel({ designId }: RightPanelProps) {
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
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        Placement settings UI - Out of scope
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
