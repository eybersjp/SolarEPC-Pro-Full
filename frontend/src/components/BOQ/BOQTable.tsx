"use client";

import React, { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, Loader2 } from "lucide-react";
import { BOQItem } from "@/types";
import { EmptyState } from "@/components/common/EmptyState";
import { Package, Plus } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { BOQItemForm } from "./BOQItemForm";
import { BOQItemUpdate } from "@/types";

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(amount);
}

interface BOQTableProps {
    items: BOQItem[];
    onEdit: (id: string, data: BOQItemUpdate) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    isEditing?: boolean;
    isDeleting?: string | null;
    onCreateFirst?: () => void;
}

export function BOQTable({ items, onEdit, onDelete, isDeleting, onCreateFirst }: BOQTableProps) {
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<BOQItem | null>(null);
    const [isEditLoading, setIsEditLoading] = useState(false);

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const handleDeleteConfirm = async () => {
        if (deleteId) {
            await onDelete(deleteId);
            setDeleteId(null);
        }
    };

    const handleEditSubmit = async (data: BOQItemUpdate) => {
        if (editingItem) {
            setIsEditLoading(true);
            try {
                await onEdit(editingItem.id, data);
                setEditingItem(null);
            } finally {
                setIsEditLoading(false);
            }
        }
    };

    // Group items by category
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, BOQItem[]>);

    if (items.length === 0) {
        return (
            <EmptyState
                icon={<Package className="h-8 w-8" />}
                title="No BOQ items"
                description="Start by adding the first line item to your Bill of Quantities."
                action={
                    onCreateFirst && (
                        <Button onClick={onCreateFirst}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add First Item
                        </Button>
                    )
                }
                className="my-4"
            />
        );
    }

    return (
        <>
            <div className="rounded-md border overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right hidden lg:table-cell">Unit Cost</TableHead>
                            <TableHead className="text-right hidden md:table-cell">Total Cost</TableHead>
                            <TableHead className="text-right hidden lg:table-cell">Margin</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(groupedItems).map(([category, categoryItems]) => (
                            <React.Fragment key={category}>
                                <TableRow className="bg-muted/50">
                                    <TableCell colSpan={7} className="font-semibold text-sm py-2">
                                        {category}
                                    </TableCell>
                                </TableRow>
                                {categoryItems.map((item) => {
                                    const totalCost = item.quantity * item.unit_cost;
                                    const price = totalCost * (1 + item.margin_pct / 100);
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell className="max-w-[300px]">
                                                <span className="truncate block">{item.description}</span>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                                            <TableCell className="text-right tabular-nums hidden lg:table-cell">{formatCurrency(item.unit_cost)}</TableCell>
                                            <TableCell className="text-right tabular-nums hidden md:table-cell">{formatCurrency(totalCost)}</TableCell>
                                            <TableCell className="text-right tabular-nums hidden lg:table-cell">{item.margin_pct.toFixed(1)}%</TableCell>
                                            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(price)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end space-x-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => setEditingItem(item)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDeleteClick(item.id)}
                                                        disabled={isDeleting === item.id}
                                                    >
                                                        {isDeleting === item.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete BOQ Item?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This item will be permanently removed from the Bill of Quantities.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit dialog */}
            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit BOQ Item</DialogTitle>
                        <DialogDescription>
                            Update the details of this line item.
                        </DialogDescription>
                    </DialogHeader>
                    {editingItem && (
                        <BOQItemForm
                            initialData={editingItem}
                            onSubmit={handleEditSubmit}
                            isLoading={isEditLoading}
                            onCancel={() => setEditingItem(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
