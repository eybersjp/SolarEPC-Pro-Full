"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/common/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { usePVDesigns, useCreatePVDesign, useDeletePVDesign } from "@/lib/hooks/usePVDesigns";
import { useTender } from "@/lib/hooks/useTenders";
import { PVDesignList } from "@/components/PVDesign/PVDesignList";
import { PVDesignForm } from "@/components/PVDesign/PVDesignForm";
import { ValidationWarnings } from "@/components/PVDesign/ValidationWarnings";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Plus, ArrowLeft, Zap, Info } from "lucide-react";
import Link from "next/link";
import { PVDesign, PVDesignCreate } from "@/types";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

import { Skeleton } from "@/components/ui/skeleton";

export default function PVDesignsPage() {
    const { id: tenderId } = useParams<{ id: string }>();
    const router = useRouter();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedDesign, setSelectedDesign] = useState<PVDesign | null>(null);
    const [designToDelete, setDesignToDelete] = useState<string | null>(null);

    const { tender, isLoading: isTenderLoading } = useTender(tenderId);
    const { designs, isLoading: isDesignsLoading, error } = usePVDesigns(tenderId);
    const createDesignMutation = useCreatePVDesign(tenderId);
    const deleteDesignMutation = useDeletePVDesign(tenderId);

    const handleCreateDesign = async (data: PVDesignCreate) => {
        try {
            await createDesignMutation.mutateAsync(data);
            setIsCreateModalOpen(false);
        } catch (error) {
            // Error handled by hook toast
        }
    };

    const handleDeleteDesign = async () => {
        if (!designToDelete) return;
        try {
            await deleteDesignMutation.mutateAsync(designToDelete);
            setDesignToDelete(null);
        } catch (error) {
            // Error handled by hook toast
        }
    };

    if (error || (!isTenderLoading && !tender)) {
        return (
            <AppShell>
                <ErrorMessage
                    title="Could not load PV designs"
                    message={error ? (error as Error).message : "The requested tender or its designs could not be found."}
                    action={
                        <Button onClick={() => router.push(`/tenders/${tenderId}`)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Tender
                        </Button>
                    }
                />
            </AppShell>
        );
    }

    const isLoading = isTenderLoading || isDesignsLoading;

    return (
        <AppShell>
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                    <Link href={`/tenders/${tenderId}`} className="hover:text-primary flex items-center">
                        <ArrowLeft className="mr-1 h-3 w-3" />
                        Back to Tender
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-medium">PV Designs</span>
                </div>

                <PageHeader
                    title={isLoading ? <Skeleton className="h-9 w-[250px]" /> : "PV System Designs"}
                    description={isLoading ? <Skeleton className="h-4 w-[300px]" /> : `Manage sizing and module configurations for ${tender!.name}`}
                    action={
                        isLoading ? (
                            <Skeleton className="h-10 w-[120px]" />
                        ) : (
                            <Button onClick={() => setIsCreateModalOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                New Design
                            </Button>
                        )
                    }
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Configurations</CardTitle>
                                <CardDescription>
                                    All saved PV designs for this project. The system calculates sizing results automatically.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <PVDesignList
                                    designs={designs}
                                    onDelete={(id: string) => setDesignToDelete(id)}
                                    onView={(design: PVDesign) => setSelectedDesign(design)}
                                    isDeleting={deleteDesignMutation.isPending ? designToDelete : null}
                                    onCreateFirst={() => setIsCreateModalOpen(true)}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        {selectedDesign ? (
                            <Card className="border-primary/50 bg-primary/5 dark:bg-primary/10">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg">Design Details</CardTitle>
                                            <CardDescription>Selected configuration</CardDescription>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedDesign(null)}>Close</Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <ValidationWarnings
                                        warnings={selectedDesign.warnings || []}
                                        valid={selectedDesign.valid}
                                    />

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Module</p>
                                            <p className="font-medium underline decoration-primary/30 underline-offset-4">{selectedDesign.module_model}</p>
                                            <p className="text-xs">{selectedDesign.module_watt}Wp</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Inverter</p>
                                            <p className="font-medium underline decoration-primary/30 underline-offset-4">{selectedDesign.inverter_model}</p>
                                            <p className="text-xs">{selectedDesign.inverter_kw}kW AC</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Config</p>
                                            <p className="font-medium">{selectedDesign.strings_per_inverter} Strings</p>
                                            <p className="text-xs">{selectedDesign.modules_per_string} Mod/Str</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Created</p>
                                            <p className="font-medium text-xs">
                                                {new Date(selectedDesign.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-primary/20">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold flex items-center">
                                                <Zap className="h-4 w-4 mr-1 text-primary" />
                                                Calculated Results
                                            </span>
                                        </div>
                                        <div className="bg-background/50 rounded p-3 space-y-2 border border-primary/10">
                                            <div className="flex justify-between text-xs">
                                                <span>System Capacity:</span>
                                                <span className="font-bold">{selectedDesign.total_capacity_kwp} kWp</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span>DC:AC Ratio:</span>
                                                <span className="font-bold">{selectedDesign.dc_ac_ratio}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span>Total Modules:</span>
                                                <span className="font-bold">{selectedDesign.total_modules}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="border-dashed">
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium flex items-center">
                                        <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                                        Design Inspector
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-muted-foreground text-center py-8">
                                        Select a design from the list to view detailed calculations and validation warnings.
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium">Design Guide</CardTitle>
                            </CardHeader>
                            <CardContent className="text-xs space-y-2 text-muted-foreground">
                                <p>• DC:AC ratios between 1.1 and 1.3 are generally considered optimal.</p>
                                <p>• Watch out for high DC:AC ratios (&gt;1.5) as they may cause significant energy clipping.</p>
                                <p>• Ensure modules per string match the inverter's MPPT voltage range (typically 15-25 modules).</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Create Modal */}
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>New PV Design</DialogTitle>
                            <DialogDescription>
                                Configure a new PV system layout for {tender.name}.
                            </DialogDescription>
                        </DialogHeader>
                        <PVDesignForm
                            onSubmit={handleCreateDesign}
                            isLoading={createDesignMutation.isPending}
                            onCancel={() => setIsCreateModalOpen(false)}
                        />
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <ConfirmDialog
                    open={!!designToDelete}
                    onOpenChange={(open: boolean) => !open && setDesignToDelete(null)}
                    title="Delete PV Design"
                    description="Are you sure you want to delete this design configuration? This action cannot be undone."
                    confirmLabel="Delete Design"
                    onConfirm={handleDeleteDesign}
                    variant="danger"
                    isLoading={deleteDesignMutation.isPending}
                />
            </div>
        </AppShell>
    );
}
