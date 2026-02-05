import { Button } from "@/components/ui/button";
import { MousePointer2, BoxSelect, Square, Grid } from "lucide-react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";

export function FloatingPalette() {
    const { mode, selectedTool, setMode, setSelectedTool } = useDesignCanvasStore();

    const tools = [
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'area', icon: Square, label: 'Draw Area' },
        { id: 'module', icon: Grid, label: 'Modules' },
    ];

    return (
        <div className="absolute top-4 left-4 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-lg border z-20">
            {tools.map((tool) => (
                <Button
                    key={tool.id}
                    variant={selectedTool === tool.id || (tool.id === 'select' && mode === 'select' && !selectedTool) ? "default" : "ghost"}
                    size="icon"
                    onClick={() => {
                        if (tool.id === 'select') {
                            setMode('select');
                            setSelectedTool(null);
                        } else {
                            setMode('draw');
                            setSelectedTool(tool.id);
                        }
                    }}
                    title={tool.label}
                >
                    <tool.icon className="h-5 w-5" />
                </Button>
            ))}
        </div>
    );
}
