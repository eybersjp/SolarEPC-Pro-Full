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
import { useTenders, useCreateTender } from "@/lib/hooks/useTenders";
import { StatusBadge } from "@/components/Tenders/StatusBadge";
import { TenderForm } from "@/components/Tenders/TenderForm";
import { Tender, TenderStatus, TenderCreate } from "@/types";
import { Plus, Filter, Eye, Edit, Trash2 } from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { EmptyState } from "@/components/common/EmptyState";
import { format } from "date-fns";

import { Skeleton } from "@/components/ui/skeleton";

export default function TendersPage() {
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const { tenders, isLoading, error } = useTenders({
        status: statusFilter === "all" ? undefined : statusFilter,
    });

    const createTenderMutation = useCreateTender();

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
                    action={
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
                    <div className="card overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Skeleton className="h-4 w-[120px]" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-[100px]" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-[80px]" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-[80px]" /></TableHead>
                                    <TableHead><Skeleton className="h-4 w-[100px]" /></TableHead>
                                    <TableHead className="text-right"><Skeleton className="h-4 w-[100px] ml-auto" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array(5).fill(0).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project Name</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Capacity (kW)</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenders.map((tender: Tender) => (
                                    <TableRow key={tender.id}>
                                        <TableCell className="font-medium">
                                            <Link
                                                href={`/tenders/${tender.id}`}
                                                className="hover:underline text-primary"
                                            >
                                                {tender.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{tender.client_name || "N/A"}</TableCell>
                                        <TableCell>{tender.target_capacity_kw || "N/A"} kW</TableCell>
                                        <TableCell>
                                            <StatusBadge status={tender.status} />
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(tender.created_at), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
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
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
