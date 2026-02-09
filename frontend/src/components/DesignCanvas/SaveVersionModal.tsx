"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { useCreateVersionMutation } from "@/hooks/useSiteDesigns";
import { cn } from "@/lib/utils";

interface SaveVersionModalProps {
    designId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onVersionSaved?: (versionName: string) => void;
}

export function SaveVersionModal({ designId, open, onOpenChange, onVersionSaved }: SaveVersionModalProps) {
    const [versionName, setVersionName] = useState("");
    const [notes, setNotes] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);

    const createMutation = useCreateVersionMutation(designId);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (!open) {
            setVersionName("");
            setNotes("");
            setValidationError(null);
            createMutation.reset();
        }
    }, [open, createMutation]);

    const validateVersionName = (name: string) => {
        if (!name.trim()) {
            return "Version name is required";
        }
        if (name.length > 255) {
            return "Version name must be less than 255 characters";
        }
        return null;
    };

    const handleSave = () => {
        const error = validateVersionName(versionName);
        if (error) {
            setValidationError(error);
            return;
        }

        createMutation.mutate(
            {
                version_name: versionName.trim(),
                notes: notes.trim() || undefined,
            },
            {
                onSuccess: () => {
                    onVersionSaved?.(versionName.trim());
                    onOpenChange(false);
                },
            }
        );
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setVersionName(value);
        if (validationError) {
            setValidationError(validateVersionName(value));
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !createMutation.isPending && onOpenChange(val)}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Save className="w-5 h-5 text-primary" />
                        Save as Version
                    </DialogTitle>
                    <DialogDescription>
                        Create a snapshot of the current design state to restore it later if needed.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label htmlFor="version-name" className={cn(validationError && "text-destructive")}>
                                Version Name
                            </Label>
                            <span className="text-[10px] text-muted-foreground">
                                {versionName.length}/255
                            </span>
                        </div>
                        <Input
                            id="version-name"
                            placeholder="e.g., Initial Layout, Option A"
                            value={versionName}
                            onChange={handleNameChange}
                            disabled={createMutation.isPending}
                            className={cn(validationError && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!validationError}
                            aria-describedby={validationError ? "version-name-error" : undefined}
                            autoFocus
                        />
                        {validationError && (
                            <div
                                id="version-name-error"
                                className="flex items-center gap-1.5 text-destructive text-xs font-medium animate-in fade-in slide-in-from-top-1"
                            >
                                <AlertCircle className="w-3.5 h-3.5" />
                                {validationError}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="version-notes">Notes (Optional)</Label>
                        <Textarea
                            id="version-notes"
                            placeholder="Add notes about specific changes or constraints..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={createMutation.isPending}
                            className="min-h-[100px] resize-none"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={createMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={createMutation.isPending}
                        className="min-w-[100px]"
                    >
                        {createMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            "Save Version"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
