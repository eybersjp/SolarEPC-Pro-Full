import { Button } from "@/components/ui/button";
import { MousePointer2, Home, Mountain, Car, Ban, Pencil } from "lucide-react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function FloatingPalette() {
    const mode = useDesignCanvasStore((state) => state.mode);
    const selectedTool = useDesignCanvasStore((state) => state.selectedTool);
    const setMode = useDesignCanvasStore((state) => state.setMode);
    const setSelectedTool = useDesignCanvasStore((state) => state.setSelectedTool);
    const setSelectedGeometry = useDesignCanvasStore((state) => state.setSelectedGeometry);
    const hasEquipmentSelected = useDesignCanvasStore((state) => state.hasEquipmentSelected);

    const tools = [
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'edit', icon: Pencil, label: 'Edit Geometry' },
        { id: 'roof', icon: Home, label: 'Roof' },
        { id: 'ground', icon: Mountain, label: 'Ground' },
        { id: 'carport', icon: Car, label: 'Carport' },
        { id: 'exclusion', icon: Ban, label: 'Exclusion' },
    ];

    return (
        <TooltipProvider>
            <div className="absolute top-4 left-4 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-lg border z-20">
                {tools.map((tool) => {
                    const isDrawingTool = ['roof', 'ground', 'carport', 'exclusion'].includes(tool.id);
                    const isDisabled = isDrawingTool && !hasEquipmentSelected;

                    return (
                        <Tooltip key={tool.id} delayDuration={300}>
                            <TooltipTrigger asChild>
                                <span>
                                    <Button
                                        variant={
                                            (tool.id === 'select' && mode === 'select') ||
                                                (tool.id === 'edit' && mode === 'edit') ||
                                                (selectedTool === tool.id && mode === 'draw')
                                                ? "default" : "ghost"
                                        }
                                        size="icon"
                                        disabled={isDisabled}
                                        onClick={() => {
                                            if (isDisabled) return;

                                            if (tool.id === 'select') {
                                                setMode('select');
                                                setSelectedTool(null);
                                            } else if (tool.id === 'edit') {
                                                setMode('edit');
                                                setSelectedTool(null);
                                            } else {
                                                setMode('draw');
                                                setSelectedTool(tool.id);
                                                setSelectedGeometry(null);
                                            }
                                        }}
                                        title={tool.label}
                                        className={isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                                    >
                                        <tool.icon className="h-5 w-5" />
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            {isDisabled && (
                                <TooltipContent side="right">
                                    <p>Select equipment to enable drawing tools</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    );
                })}
            </div>
        </TooltipProvider>
    );
}
