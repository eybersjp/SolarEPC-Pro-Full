"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Download, FileJson, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/common/TableSkeleton";

import { useBOQ } from "@/hooks/useBOQ";
import { useTender } from "@/lib/hooks/useTenders";
import { BOQTable } from "@/components/BOQ/BOQTable";
import { BOQSummary } from "@/components/BOQ/BOQSummary";
import { BOQItemForm } from "@/components/BOQ/BOQItemForm";
import { AppShell } from "@/components/common/AppShell";
import { BOQItemCreate, BOQItemUpdate } from "@/types";

export default function BOQPage() {
    const params = useParams();
    const tenderId = params.id as string;
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [currentDeletingId, setCurrentDeletingId] = useState<string | null>(null);

    const { tender, isLoading: isTenderLoading } = useTender(tenderId);
    const {
        boqData,
        isLoading: isBOQLoading,
        error,
        createItemAsync,
        isCreating,
        updateItemAsync,
        deleteItemAsync,
        exportBOQ,
    } = useBOQ(tenderId);

    const handleCreateItem = async (data: BOQItemCreate) => {
        try {
            await createItemAsync(data);
            toast.success("Item added", { description: "BOQ item has been added successfully." });
            setIsCreateOpen(false);
        } catch (error) {
            console.error("Failed to create item:", error);
            toast.error("Failed to add item", { description: "Please try again." });
        }
    };

    const handleEditItem = async (id: string, data: BOQItemUpdate) => {
        try {
            await updateItemAsync({ id, data });
            toast.success("Item updated", { description: "BOQ item has been updated." });
        } catch (error) {
            console.error("Failed to update item:", error);
            toast.error("Failed to update item", { description: "Please try again." });
        }
    };

    const handleDeleteItem = async (id: string) => {
        setCurrentDeletingId(id);
        try {
            await deleteItemAsync(id);
            toast.success("Item deleted", { description: "BOQ item has been removed." });
        } catch (error) {
            console.error("Failed to delete item:", error);
            toast.error("Failed to delete item", { description: "Please try again." });
        } finally {
            setCurrentDeletingId(null);
        }
    };

    const handleExport = async (format: "json" | "csv") => {
        try {
            await exportBOQ(format);
            toast.success("Export complete", { description: `BOQ exported as ${format.toUpperCase()}.` });
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Export failed", { description: "Please try again." });
        }
    };

    const isLoading = isTenderLoading || isBOQLoading;

    return (
        <AppShell>
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                    <Link href={`/tenders/${tenderId}`} className="hover:text-primary flex items-center">
                        <ArrowLeft className="mr-1 h-3 w-3" />
                        Back to Tender
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-medium">Bill of Quantities</span>
                </div>

                {error && (
                    <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
                        Failed to load BOQ: {(error as Error).message}
                    </div>
                )}

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Bill of Quantities</h1>
                        <p className="text-muted-foreground">
                            {isLoading ? <Skeleton className="h-4 w-[200px]" /> : `Manage pricing for ${tender?.name}`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Export
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExport("csv")}>
                                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                                    Export as CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("json")}>
                                    <FileJson className="mr-2 h-4 w-4" />
                                    Export as JSON
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Item
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px] max-w-[95vw]">
                                <DialogHeader>
                                    <DialogTitle>Add BOQ Item</DialogTitle>
                                    <DialogDescription>
                                        Add a new line item to the Bill of Quantities.
                                    </DialogDescription>
                                </DialogHeader>
                                <BOQItemForm
                                    onSubmit={handleCreateItem as any}
                                    isLoading={isCreating}
                                    onCancel={() => setIsCreateOpen(false)}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Summary Section */}
                {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-24 w-full" />
                        ))}
                    </div>
                ) : boqData ? (
                    <BOQSummary
                        totalCost={boqData.subtotal}
                        totalMargin={boqData.total_margin}
                        grandTotal={boqData.grand_total}
                    />
                ) : null}

                {/* Items Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Line Items</CardTitle>
                        <CardDescription>
                            All cost items grouped by category.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <TableSkeleton columnCount={7} rowCount={8} />
                        ) : (
                            <BOQTable
                                items={boqData?.items || []}
                                onEdit={handleEditItem}
                                onDelete={handleDeleteItem}
                                isDeleting={currentDeletingId}
                                onCreateFirst={() => setIsCreateOpen(true)}
                            />
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppShell>
    );
}
