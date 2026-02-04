"use client";

import React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { PVDesign } from "@/types";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Box, Plus } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface PVDesignListProps {
    designs: PVDesign[];
    onDelete: (id: string) => void;
    onView?: (design: PVDesign) => void;
    isDeleting?: string | null;
    onCreateFirst?: () => void;
}

export function PVDesignList({ designs, onDelete, onView, isDeleting, onCreateFirst }: PVDesignListProps) {
    if (designs.length === 0) {
        return (
            <EmptyState
                icon={<Box className="h-8 w-8" />}
                title="No PV designs created"
                description="Start by creating your first system configuration to see sizing results and validation."
                action={
                    onCreateFirst && (
                        <Button onClick={onCreateFirst}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create First Design
                        </Button>
                    )
                }
                className="my-4"
            />
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>System Specs</TableHead>
                        <TableHead>Capacity</TableHead>
                        <TableHead>DC:AC</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {designs.map((design) => (
                        <TableRow key={design.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onView?.(design)}>
                            <TableCell onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            {design.valid !== false ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                            ) : (
                                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                            )}
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {design.valid !== false
                                                ? "Optimal configuration"
                                                : `${design.warnings?.length || 0} validation warnings`}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </TableCell>
                            <TableCell>
                                <div className="font-medium text-sm">{design.module_model} / {design.inverter_model}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {design.total_modules} modules ({design.module_watt}W)
                                </div>
                            </TableCell>
                            <TableCell>
                                <span className="font-semibold">{design.total_capacity_kwp} kWp</span>
                            </TableCell>
                            <TableCell>
                                <Badge variant={design.dc_ac_ratio > 1.5 || design.dc_ac_ratio < 1.0 ? "outline" : "secondary"}>
                                    {design.dc_ac_ratio}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(design.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <div className="flex justify-end space-x-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => onDelete(design.id)}
                                        disabled={isDeleting === design.id}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView?.(design)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
