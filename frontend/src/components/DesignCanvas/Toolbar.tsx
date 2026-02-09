import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Loader2, Check, AlertCircle, FileText, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { ProposalWizard } from "./ProposalWizard";
import { useState, useEffect } from "react";
import { formatRelativeTime, cn } from "@/lib/utils";
import { useUpdateSiteDesignMutation } from "@/hooks/useSiteDesigns";
import { toast } from "@/lib/toast";

import { useDesignNavigation } from "../../app/tenders/[id]/design/[designId]/page";

interface ToolbarProps {
    tenderId: string;
    designId: string;
    title: string;
}

export function Toolbar({ tenderId, designId, title }: ToolbarProps) {
    const { back } = useDesignNavigation();
    const { syncState, lastSyncedAt, retryCount, lastMutationData } = useDesignCanvasStore((state) => ({
        syncState: state.syncState,
        lastSyncedAt: state.lastSyncedAt,
        retryCount: state.retryCount,
        lastMutationData: state.lastMutationData,
    }));
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [relativeTime, setRelativeTime] = useState("");

    const updateMutation = useUpdateSiteDesignMutation(designId);

    // Update relative time every 30 seconds
    useEffect(() => {
        if (syncState === 'synced' && lastSyncedAt) {
            setRelativeTime(formatRelativeTime(lastSyncedAt));
            const interval = setInterval(() => {
                setRelativeTime(formatRelativeTime(lastSyncedAt));
            }, 30000);
            return () => clearInterval(interval);
        } else {
            setRelativeTime("");
        }
    }, [syncState, lastSyncedAt]);

    const handleBackClick = () => {
        back();
    };

    const handleManualRetry = () => {
        if (lastMutationData) {
            toast.info("Retrying save...");
            updateMutation.mutate(lastMutationData);
        }
    };

    return (
        <div className="h-14 border-b bg-white flex items-center justify-between px-4 z-10 relative">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackClick}
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
                <div className="flex items-center gap-2 mr-4 text-sm text-muted-foreground min-w-[150px] justify-end">
                    {syncState === 'syncing' && (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Saving...</span>
                        </>
                    )}
                    {syncState === 'synced' && (
                        <>
                            <Check className="h-4 w-4 text-green-500" />
                            <span>{relativeTime ? `Auto-saved ${relativeTime}` : 'Saved'}</span>
                        </>
                    )}
                    {syncState === 'failed' && (
                        <div className="flex items-center gap-2 text-red-500">
                            <AlertCircle className="h-4 w-4" />
                            <span>Failed to save {retryCount > 0 && `(attempt ${retryCount}/3)`}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={handleManualRetry}
                                disabled={updateMutation.isPending}
                                title="Retry manual save"
                            >
                                <RefreshCw className={cn("h-3 w-3", updateMutation.isPending && "animate-spin")} />
                            </Button>
                        </div>
                    )}
                </div>

                <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Copy
                </Button>

                <Button variant="default" size="sm" onClick={() => setIsWizardOpen(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Proposal
                </Button>
            </div>

            <ProposalWizard
                designId={designId}
                open={isWizardOpen}
                onOpenChange={setIsWizardOpen}
            />
        </div>
    );
}
