"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/common/TableSkeleton";

import { PVDesignList } from "@/components/PVDesign/PVDesignList";
import { PVDesignForm } from "@/components/PVDesign/PVDesignForm";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { tendersApi } from "@/lib/api";
import { usePVDesigns } from "@/hooks/usePVDesigns";
import { AppShell } from "@/components/common/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { toast } from "sonner";

export default function PVDesignsPage() {
    const params = useParams();
    const router = useRouter();
    const tenderId = params.id as string;
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [designToDelete, setDesignToDelete] = useState<string | null>(null);

    // Fetch tender details for context
    const { data: tender, isLoading: isTenderLoading } = useQuery({
        queryKey: ["tender", tenderId],
        queryFn: () => tendersApi.get(tenderId),
        enabled: !!tenderId,
    });

    const { designs, isLoading: isDesignsLoading, error, deleteDesignAsync } = usePVDesigns(tenderId);
    const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        setCurrentDeletingId(id);
        try {
            await deleteDesignAsync(id);
            toast.success("Design deleted", {
                description: "The PV design has been successfully deleted.",
            });
        } catch (error) {
            console.error("Failed to delete design:", error);
            toast.error("Error", {
                description: "Failed to delete the design. Please try again.",
            });
        } finally {
            setCurrentDeletingId(null);
        }
    };

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

                {error && (
                    <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
                        Failed to load designs: {(error as Error).message}
                    </div>
                )}

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">PV Designs</h1>
                        <p className="text-muted-foreground">
                            {isTenderLoading ? <Skeleton className="h-4 w-[200px]" /> : `Manage designs for ${tender?.name}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Design
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
                                <DialogHeader>
                                    <DialogTitle>Create New PV Design</DialogTitle>
                                    <DialogDescription>
                                        Configure modules and inverters to generate a system design.
                                    </DialogDescription>
                                </DialogHeader>
                                <PVDesignForm
                                    tenderId={tenderId}
                                    onSuccess={() => setIsCreateOpen(false)} // This might conflict with the "Done" button change if I'm not careful. The done button calls onSuccess. 
                                // Wait, the previous comment said: "Create flow closes the dialog immediately... Only close after the user can view the result"
                                // I changed PVDesignForm to call onSuccess when "Done" is clicked.
                                // So passing setIsCreateOpen(false) here is correct, as it will be called when "Done" is clicked.
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <Tabs defaultValue="list" className="w-full">
                    <TabsList>
                        <TabsTrigger value="list">All Designs</TabsTrigger>
                        <TabsTrigger value="analysis" disabled>Comparative Analysis (Coming Soon)</TabsTrigger>
                    </TabsList>
                    <TabsContent value="list" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>System Configurations</CardTitle>
                                <CardDescription>
                                    List of all PV designs associated with this tender.
                                </CardDescription>
                            </CardHeader>
                            <div className="p-6 pt-0">
                                {isDesignsLoading ? (
                                    <TableSkeleton columnCount={5} rowCount={5} />
                                ) : (
                                    <PVDesignList
                                        designs={designs || []}
                                        onDelete={(id) => {
                                            setDesignToDelete(id);
                                            setDeleteDialogOpen(true);
                                        }}
                                        isDeleting={currentDeletingId}
                                        onCreateFirst={() => setIsCreateOpen(true)}
                                    />
                                )}
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete PV Design"
                description="Are you sure you want to delete this design? This action cannot be undone."
                variant="danger"
                confirmLabel="Delete"
                onConfirm={() => {
                    if (designToDelete) {
                        handleDelete(designToDelete);
                        setDeleteDialogOpen(false);
                    }
                }}
                isLoading={currentDeletingId === designToDelete}
            />
        </AppShell>
    );
}
