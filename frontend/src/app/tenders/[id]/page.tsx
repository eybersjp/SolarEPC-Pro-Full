"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/common/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useTender, useUpdateTender, useDeleteTender } from "@/lib/hooks/useTenders";
import { StatusBadge } from "@/components/Tenders/StatusBadge";
import { TenderForm } from "@/components/Tenders/TenderForm";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Edit, Trash2, ArrowLeft, Calendar, User, MapPin, Zap } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { TenderUpdate } from "@/types";

import { Skeleton } from "@/components/ui/skeleton";

export default function TenderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const editMode = searchParams.get("edit") === "true";

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const { tender, isLoading, error } = useTender(id);
    const updateTenderMutation = useUpdateTender();
    const deleteTenderMutation = useDeleteTender();

    useEffect(() => {
        if (editMode && tender) {
            setIsEditModalOpen(true);
        }
    }, [editMode, tender]);

    const handleUpdateTender = async (data: TenderUpdate) => {
        try {
            await updateTenderMutation.mutateAsync({ id, data });
            setIsEditModalOpen(false);
            // Remove edit param from URL if present
            if (editMode) {
                router.replace(`/tenders/${id}`);
            }
        } catch (error) {
            // Handled by hook
        }
    };

    const handleDeleteTender = async () => {
        try {
            await deleteTenderMutation.mutateAsync(id);
            router.push("/tenders");
        } catch (error) {
            // Handled by hook
        }
    };

    if (error || (!isLoading && !tender)) {
        return (
            <AppShell>
                <ErrorMessage
                    title="Tender not found"
                    message={error ? (error as Error).message : "The requested tender could not be found."}
                    action={
                        <Button onClick={() => router.push("/tenders")}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Tenders
                        </Button>
                    }
                />
            </AppShell>
        );
    }

    return (
        <AppShell>
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                    <Link href="/tenders" className="hover:text-primary flex items-center">
                        <ArrowLeft className="mr-1 h-3 w-3" />
                        Back to Tenders
                    </Link>
                    <span>/</span>
                    {isLoading ? <Skeleton className="h-4 w-[120px]" /> : <span className="text-foreground font-medium">{tender!.name}</span>}
                </div>

                <PageHeader
                    title={isLoading ? <Skeleton className="h-9 w-[250px]" /> : tender!.name}
                    description={isLoading ? <Skeleton className="h-4 w-[200px]" /> : `Tender ID: ${tender!.id}`}
                    action={
                        isLoading ? (
                            <div className="flex space-x-2">
                                <Skeleton className="h-10 w-[120px]" />
                                <Skeleton className="h-10 w-[100px]" />
                            </div>
                        ) : (
                            <div className="flex space-x-2">
                                <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Info
                                </Button>
                                <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </div>
                        )
                    }
                >
                    <div className="mt-2">
                        {isLoading ? <Skeleton className="h-6 w-20 rounded-full" /> : <StatusBadge status={tender!.status} className="text-sm px-3 py-1" />}
                    </div>
                </PageHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Project Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoading ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="space-y-2">
                                            <Skeleton className="h-4 w-[100px]" />
                                            <Skeleton className="h-6 w-[150px]" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <User className="mr-2 h-4 w-4" />
                                            Client Name
                                        </div>
                                        <p className="text-lg font-medium">{tender!.client_name || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <Zap className="mr-2 h-4 w-4" />
                                            Target Capacity
                                        </div>
                                        <p className="text-lg font-medium">{tender!.target_capacity_kw || 0} kW</p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <MapPin className="mr-2 h-4 w-4" />
                                            Location
                                        </div>
                                        <p className="text-lg font-medium">
                                            {tender!.latitude && tender!.longitude
                                                ? `${tender!.latitude.toFixed(4)}, ${tender!.longitude.toFixed(4)}`
                                                : "Not specified"}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <Calendar className="mr-2 h-4 w-4" />
                                            Created On
                                        </div>
                                        <p className="text-lg font-medium">
                                            {format(new Date(tender!.created_at), "MMMM d, yyyy")}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-6 border-t border-border">
                                <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-muted-foreground">Project Modules</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {isLoading ? (
                                        [1, 2, 3, 4, 5].map((i) => (
                                            <Skeleton key={i} className="h-16 w-full rounded-md" />
                                        ))
                                    ) : (
                                        <>
                                            <Link href={`/tenders/${id}/helio-prep`} className="block">
                                                <Button variant="secondary" className="w-full justify-start h-16 text-left px-4 border-l-4 border-l-blue-500">
                                                    <div>
                                                        <div className="font-bold text-blue-600">HelioPrep</div>
                                                        <div className="text-xs opacity-70 font-normal">Data Validation</div>
                                                    </div>
                                                </Button>
                                            </Link>
                                            <Link href={`/tenders/${id}/helioscope`} className="block">
                                                <Button variant="secondary" className="w-full justify-start h-16 text-left px-4 border-l-4 border-l-orange-500">
                                                    <div>
                                                        <div className="font-bold text-orange-600">Auto-Helioscope</div>
                                                        <div className="text-xs opacity-70 font-normal">Scenarios</div>
                                                    </div>
                                                </Button>
                                            </Link>
                                            <Link href={`/tenders/${id}/preconditions`} className="block">
                                                <Button variant="secondary" className="w-full justify-start h-16 text-left px-4">
                                                    <div>
                                                        <div className="font-bold">Preconditions</div>
                                                        <div className="text-xs opacity-70 font-normal">Checklist</div>
                                                    </div>
                                                </Button>
                                            </Link>
                                            <Link href={`/tenders/${id}/pv-designs`} className="block">
                                                <Button variant="secondary" className="w-full justify-start h-16 text-left px-4">
                                                    <div>
                                                        <div className="font-bold">PV Design</div>
                                                        <div className="text-xs opacity-70 font-normal">Sizing</div>
                                                    </div>
                                                </Button>
                                            </Link>
                                            <Link href={`/tenders/${id}/boq`} className="block">
                                                <Button variant="secondary" className="w-full justify-start h-16 text-left px-4">
                                                    <div>
                                                        <div className="font-bold">BOQ & Pricing</div>
                                                        <div className="text-xs opacity-70 font-normal">Pricing</div>
                                                    </div>
                                                </Button>
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {isLoading ? (
                                    [1, 2].map((i) => (
                                        <div key={i} className="flex items-start space-x-3">
                                            <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
                                            <div className="space-y-1">
                                                <Skeleton className="h-4 w-[100px]" />
                                                <Skeleton className="h-3 w-[120px]" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <>
                                        <div className="flex items-start space-x-3 text-sm">
                                            <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                                            <div>
                                                <p className="font-medium text-foreground">Tender created</p>
                                                <p className="text-muted-foreground text-xs">{format(new Date(tender!.created_at), "MMM d, yyyy HH:mm")}</p>
                                            </div>
                                        </div>
                                        {tender!.updated_at !== tender!.created_at && (
                                            <div className="flex items-start space-x-3 text-sm">
                                                <div className="h-2 w-2 rounded-full bg-secondary mt-1.5" />
                                                <div>
                                                    <p className="font-medium text-foreground">Tender updated</p>
                                                    <p className="text-muted-foreground text-xs">{format(new Date(tender!.updated_at), "MMM d, yyyy HH:mm")}</p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Edit Modal */}
                {!isLoading && tender && (
                    <Dialog open={isEditModalOpen} onOpenChange={(open: boolean) => {
                        setIsEditModalOpen(open);
                        if (!open && editMode) router.replace(`/tenders/${id}`);
                    }}>
                        <DialogContent className="sm:max-width-[600px]">
                            <TenderForm
                                title="Edit Tender Details"
                                initialData={tender}
                                onSubmit={handleUpdateTender}
                                isLoading={updateTenderMutation.isPending}
                                onCancel={() => {
                                    setIsEditModalOpen(false);
                                    if (editMode) router.replace(`/tenders/${id}`);
                                }}
                            />
                        </DialogContent>
                    </Dialog>
                )}

                {/* Delete Confirmation */}
                {!isLoading && tender && (
                    <ConfirmDialog
                        open={isDeleteDialogOpen}
                        onOpenChange={setIsDeleteDialogOpen}
                        title="Delete Tender"
                        description={`Are you sure you want to delete "${tender.name}"? This action cannot be undone.`}
                        confirmLabel="Delete Tender"
                        onConfirm={handleDeleteTender}
                        variant="danger"
                        isLoading={deleteTenderMutation.isPending}
                    />
                )}
            </div>
        </AppShell>
    );
}
