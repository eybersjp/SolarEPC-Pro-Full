import { Button } from "@/components/ui/button";
import { MousePointer2, Home, Mountain, Car, Ban, Pencil } from "lucide-react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";

export function FloatingPalette() {
    const { mode, selectedTool, setMode, setSelectedTool, setSelectedGeometry } = useDesignCanvasStore();

    const tools = [
        { id: 'select', icon: MousePointer2, label: 'Select' },
        { id: 'edit', icon: Pencil, label: 'Edit Geometry' },
        { id: 'roof', icon: Home, label: 'Roof' },
        { id: 'ground', icon: Mountain, label: 'Ground' },
        { id: 'carport', icon: Car, label: 'Carport' },
        { id: 'exclusion', icon: Ban, label: 'Exclusion' },
    ];

    return (
        <div className="absolute top-4 left-4 flex flex-col gap-2 bg-white p-2 rounded-lg shadow-lg border z-20">
            {tools.map((tool) => (
                <Button
                    key={tool.id}
                    variant={
                        (tool.id === 'select' && mode === 'select') ||
                            (tool.id === 'edit' && mode === 'edit') ||
                            (selectedTool === tool.id && mode === 'draw')
                            ? "default" : "ghost"
                    }
                    size="icon"
                    onClick={() => {
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
                >
                    <tool.icon className="h-5 w-5" />
                </Button>
            ))}
        </div>
    );
}
