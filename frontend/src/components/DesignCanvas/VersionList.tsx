"use client";

import React, { useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    History,
    RotateCcw,
    Calendar,
    FileText,
    Layers,
    Zap,
    Loader2,
    AlertCircle,
    User,
    History as HistoryIcon // Workaround if needed, but History is already there
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useVersionsQuery, useRestoreVersionMutation } from "@/hooks/useSiteDesigns";
import { DesignVersionResponse } from "@/types";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * VersionList component displays a dropdown menu of saved design versions
 * and allows users to restore previous versions.
 * 
 * @param designId - The site design ID
 * @param open - Controls dropdown visibility
 * @param onOpenChange - Callback when dropdown open state changes
 * @param onVersionRestored - Optional callback after successful version restore
 */
interface VersionListProps {
    designId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onVersionRestored?: (versionName: string) => void;
}

export function VersionList({
    designId,
    open,
    onOpenChange,
    onVersionRestored,
}: VersionListProps) {
    const [versionToRestore, setVersionToRestore] = useState<DesignVersionResponse | null>(null);
    const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const { data: versions, isLoading, isError, error, refetch } = useVersionsQuery(designId);
    const restoreMutation = useRestoreVersionMutation(designId);
    const isModifiedSinceVersion = useDesignCanvasStore((state) => state.isModifiedSinceVersion);

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                onOpenChange(!open);
            }
            if (e.key === 'Escape' && open) {
                onOpenChange(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onOpenChange]);

    const handleRestoreClick = (e: React.MouseEvent, version: DesignVersionResponse) => {
        e.preventDefault();
        e.stopPropagation();
        setVersionToRestore(version);
        setIsRestoreDialogOpen(true);
    };

    const handleConfirmRestore = () => {
        if (!versionToRestore) return;

        restoreMutation.mutate(versionToRestore.id, {
            onSuccess: () => {
                onVersionRestored?.(versionToRestore.version_name);
                setIsRestoreDialogOpen(false);
                onOpenChange(false);
                toast.success("Restored to version: " + versionToRestore.version_name);
            },
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.abs(now.getTime() - date.getTime()) / 36e5;

        if (diffInHours < 24) {
            return formatDistanceToNow(date, { addSuffix: true });
        }
        return format(date, "MMM d, yyyy 'at' h:mm a");
    };

    const filteredVersions = versions?.filter(v =>
        v.version_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.created_by_name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            <DropdownMenu open={open} onOpenChange={onOpenChange}>
                <DropdownMenuTrigger asChild>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "h-9 w-9",
                                        restoreMutation.isPending && "animate-pulse"
                                    )}
                                    disabled={restoreMutation.isPending}
                                    aria-label="Version history"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <History className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>View and restore previous versions (Ctrl+H)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    className="w-80 max-h-[450px] overflow-y-auto"
                    align="end"
                    aria-busy={isLoading}
                >
                    <DropdownMenuLabel className="flex items-center justify-between">
                        <span>Version History</span>
                        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <div className="p-2">
                        <div className="relative">
                            <FileText className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-8 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Search versions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Search versions"
                            />
                        </div>
                    </div>
                    <DropdownMenuSeparator />

                    {isLoading ? (
                        <div className="p-2 space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                    <Skeleton className="h-8 w-full" />
                                </div>
                            ))}
                        </div>
                    ) : isError ? (
                        <div className="p-4 text-center">
                            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
                            <p className="text-sm text-destructive font-medium">Failed to load versions</p>
                            <p className="text-xs text-muted-foreground mb-3">{(error as Error)?.message}</p>
                            <Button variant="outline" size="sm" onClick={() => refetch()}>
                                Retry
                            </Button>
                        </div>
                    ) : !versions || versions.length === 0 ? (
                        <div className="p-8 text-center">
                            <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm font-medium">No versions saved yet</p>
                            <p className="text-xs text-muted-foreground">
                                Save a version to create snapshots of your design
                            </p>
                        </div>
                    ) : filteredVersions?.length === 0 ? (
                        <div className="p-8 text-center">
                            <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm font-medium">No versions found</p>
                            <p className="text-xs text-muted-foreground">
                                Try adjusting your search query
                            </p>
                        </div>
                    ) : (
                        <div className="py-1">
                            {filteredVersions?.map((version, index) => (
                                <div
                                    key={version.id}
                                    role="listitem"
                                    className={cn(
                                        "px-3 py-3 hover:bg-accent/50 transition-colors group relative",
                                        index !== filteredVersions.length - 1 && "border-b"
                                    )}
                                >
                                    <div className="flex justify-between items-start gap-2 mb-1">
                                        <span className="font-semibold text-sm truncate max-w-[180px]" title={version.version_name}>
                                            {version.version_name}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => handleRestoreClick(e, version)}
                                            disabled={restoreMutation.isPending}
                                            aria-label={`Restore to version ${version.version_name}`}
                                        >
                                            <RotateCcw className="h-3 w-3 mr-1" />
                                            Restore
                                        </Button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground mb-2">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            <span>{formatDate(version.created_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            <span>{version.created_by_name || "Unknown"}</span>
                                        </div>
                                    </div>

                                    {version.notes && (
                                        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground mb-2 bg-slate-50 p-1.5 rounded border border-slate-100 italic">
                                            <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                                            <p className="line-clamp-2">{version.notes}</p>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {version.total_modules !== null && (
                                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 font-normal bg-white">
                                                <Layers className="h-2.5 w-2.5" />
                                                {version.total_modules} modules
                                            </Badge>
                                        )}
                                        {version.system_size_kwp !== null && (
                                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 font-normal bg-white">
                                                <Zap className="h-2.5 w-2.5 text-yellow-500" />
                                                {version.system_size_kwp.toFixed(1)} kWp
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmDialog
                open={isRestoreDialogOpen}
                onOpenChange={setIsRestoreDialogOpen}
                title="Restore Version?"
                description={cn(
                    `This will restore the design to '${versionToRestore?.version_name}'.`,
                    isModifiedSinceVersion && "⚠️ Warning: You have unsaved changes that will be lost!",
                    "The system will automatically recalculate placement and energy estimates."
                )}
                confirmLabel="Restore Version"
                onConfirm={handleConfirmRestore}
                isLoading={restoreMutation.isPending}
                variant="default"
            />
        </>
    );
}
