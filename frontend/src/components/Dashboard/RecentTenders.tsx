"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, FileText } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TenderSummary } from "@/types";
import { Button } from "@/components/ui/button";

interface RecentTendersProps {
    tenders: TenderSummary[];
}

export function RecentTenders({ tenders }: RecentTendersProps) {
    if (!tenders || tenders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-card text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <h3 className="font-semibold text-lg">No recent tenders</h3>
                <p className="text-sm text-muted-foreground mb-4">You haven't created any tenders yet.</p>
                <Link href="/tenders/new">
                    <Button size="sm">Create your first tender</Button>
                </Link>
            </div>
        );
    }

    const getStatusVariant = (status: string) => {
        switch (status) {
            case "won":
                return "secondary"; // Assuming 'secondary' is styled as green/success in some contexts, but 'outline' or custom might be better.
            case "lost":
                return "destructive";
            case "draft":
                return "outline";
            case "in_review":
                return "secondary";
            case "submitted":
                return "default";
            default:
                return "outline";
        }
    };

    return (
        <div className="border rounded-lg bg-card overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tender Name</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Capacity (kW)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Created</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tenders.map((tender) => (
                        <TableRow key={tender.id} className="group cursor-pointer">
                            <TableCell className="font-medium">
                                <Link href={`/tenders/${tender.id}`} className="hover:underline block">
                                    {tender.name}
                                </Link>
                            </TableCell>
                            <TableCell>{tender.client_name || "-"}</TableCell>
                            <TableCell>{tender.target_capacity_kw ? `${tender.target_capacity_kw} kW` : "-"}</TableCell>
                            <TableCell>
                                <Badge variant={getStatusVariant(tender.status)} className="capitalize">
                                    {tender.status.replace("_", " ")}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                                {format(new Date(tender.created_at), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <div className="p-4 border-t bg-muted/30 text-center">
                <Link href="/tenders" className="text-sm font-medium text-primary hover:underline underline-offset-4">
                    View all tenders
                </Link>
            </div>
        </div>
    );
}
