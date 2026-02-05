import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2, Check, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";

interface ToolbarProps {
    tenderId: string;
    title: string;
}

export function Toolbar({ tenderId, title }: ToolbarProps) {
    const router = useRouter();
    const syncState = useDesignCanvasStore((state) => state.syncState);

    return (
        <div className="h-14 border-b bg-white flex items-center justify-between px-4 z-10 relative">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    title="Back to Designs"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="font-semibold text-lg leading-tight">{title}</h1>
                    <p className="text-xs text-muted-foreground">Design Canvas</p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-4 text-sm text-muted-foreground">
                    {syncState === 'syncing' && (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Saving...</span>
                        </>
                    )}
                    {syncState === 'synced' && (
                        <>
                            <Check className="h-4 w-4 text-green-500" />
                            <span>Saved</span>
                        </>
                    )}
                    {syncState === 'failed' && (
                        <>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-red-500">Failed to save</span>
                        </>
                    )}
                </div>

                <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Copy
                </Button>
            </div>
        </div>
    );
}
