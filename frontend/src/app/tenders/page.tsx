"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/common/AppShell";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useTenders, useCreateTender, useDeleteTender } from "@/lib/hooks/useTenders";
import { StatusBadge } from "@/components/Tenders/StatusBadge";
import { TenderForm } from "@/components/Tenders/TenderForm";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Tender, TenderStatus, TenderCreate } from "@/types";
import { Plus, Filter, Eye, Edit, Trash2 } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { EmptyState } from "@/components/common/EmptyState";
import { format } from "date-fns";

import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/common/TableSkeleton";

export default function TendersPage() {
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const { tenders, isLoading, error } = useTenders({
        status: statusFilter === "all" ? undefined : statusFilter,
    });

    const createTenderMutation = useCreateTender();
    const deleteTenderMutation = useDeleteTender();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [tenderToDelete, setTenderToDelete] = useState<string | null>(null);

    const handleCreateTender = async (data: TenderCreate) => {
        try {
            await createTenderMutation.mutateAsync(data);
            setIsCreateModalOpen(false);
        } catch (error) {
            // Error handled by mutation hook
        }
    };

    return (
        <AppShell>
            <div className="space-y-6">
                <PageHeader
                    title="Tenders"
                    description="Manage and track your solar project tenders."
                    actions={
                        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                            <DialogTrigger asChild>
                                <Button className="btn-primary">
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Tender
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-width-[600px]">
                                <TenderForm
                                    title="Create New Tender"
                                    onSubmit={handleCreateTender}
                                    isLoading={createTenderMutation.isPending}
                                    onCancel={() => setIsCreateModalOpen(false)}
                                />
                            </DialogContent>
                        </Dialog>
                    }
                />

                <div className="flex items-center space-x-4 mb-6">
                    <div className="flex items-center space-x-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Filter by Status:</span>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="won">Won</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {isLoading ? (
                    <TableSkeleton columnCount={6} />
                ) : error ? (
                    <ErrorMessage
                        title="Failed to load tenders"
                        message={(error as Error).message}
                    />
                ) : tenders.length === 0 ? (
                    <EmptyState
                        title="No tenders found"
                        description={
                            statusFilter === "all"
                                ? "You haven't created any tenders yet. Click 'New Tender' to get started."
                                : `No tenders found with status '${statusFilter}'.`
                        }
                        icon={<Eye className="h-12 w-12" />}
                        action={
                            statusFilter === "all" ? (
                                <Button onClick={() => setIsCreateModalOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Your First Tender
                                </Button>
                            ) : (
                                <Button variant="outline" onClick={() => setStatusFilter("all")}>
                                    Clear Filters
                                </Button>
                            )
                        }
                    />
                ) : (
                    <div className="card overflow-hidden">
                        <div className="overflow-x-auto -mx-4 sm:mx-0">
                            <div className="inline-block min-w-full align-middle">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Project Name</TableHead>
                                            <TableHead>Client</TableHead>
                                            <TableHead>Capacity (kW)</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="hidden md:table-cell">Created</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tenders.map((tender: Tender) => (
                                            <TableRow key={tender.id}>
                                                <TableCell className="font-medium max-w-[200px] truncate">
                                                    <Link
                                                        href={`/tenders/${tender.id}`}
                                                        className="hover:underline text-primary"
                                                    >
                                                        {tender.name}
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="text-sm md:text-base">{tender.client_name || "N/A"}</TableCell>
                                                <TableCell className="text-sm md:text-base">{tender.target_capacity_kw || "N/A"} kW</TableCell>
                                                <TableCell>
                                                    <StatusBadge status={tender.status} />
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    {format(new Date(tender.created_at), "MMM d, yyyy")}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col sm:flex-row justify-end gap-1">
                                                        <Button variant="ghost" size="icon" asChild title="View Details">
                                                            <Link href={`/tenders/${tender.id}`}>
                                                                <Eye className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                        <Button variant="ghost" size="icon" asChild title="Edit Basic Info">
                                                            <Link href={`/tenders/${tender.id}?edit=true`}>
                                                                <Edit className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            title="Delete Tender"
                                                            onClick={() => {
                                                                setTenderToDelete(tender.id);
                                                                setDeleteDialogOpen(true);
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                    title="Delete Tender"
                    description="Are you sure you want to delete this tender? This will also delete all associated PV designs, BOQ items, and preconditions. This action cannot be undone."
                    variant="danger"
                    confirmLabel="Delete"
                    onConfirm={async () => {
                        if (tenderToDelete) {
                            await deleteTenderMutation.mutateAsync(tenderToDelete);
                            setDeleteDialogOpen(false);
                            setTenderToDelete(null);
                        }
                    }}
                    isLoading={deleteTenderMutation.isPending}
                />
            </div>
        </AppShell>
    );
}
