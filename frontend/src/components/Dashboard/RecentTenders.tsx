"use client";

import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TenderSummary, TenderStatus } from "@/types";

import { EmptyState } from "@/components/common/EmptyState";
import { FileText, Plus } from "lucide-react";

interface RecentTendersProps {
    tenders: TenderSummary[];
}

const statusMap: Record<TenderStatus, { label: string; variant: any }> = {
    draft: { label: "Draft", variant: "draft" },
    in_review: { label: "In Review", variant: "in-review" },
    submitted: { label: "Submitted", variant: "submitted" },
    won: { label: "Won", variant: "won" },
    lost: { label: "Lost", variant: "lost" },
};

export function RecentTenders({ tenders }: RecentTendersProps) {
    if (!tenders || tenders.length === 0) {
        return (
            <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="No recent tenders"
                description="Your recently created or updated projects will appear here."
                action={
                    <Button asChild variant="outline" size="sm">
                        <Link href="/tenders">
                            View All Tenders
                        </Link>
                    </Button>
                }
            />
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tender Name</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Capacity (kW)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Created At</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tenders.map((tender) => (
                        <TableRow key={tender.id}>
                            <TableCell className="font-medium">
                                <Link href={`/tenders/${tender.id}`} className="hover:underline text-primary">
                                    {tender.name}
                                </Link>
                            </TableCell>
                            <TableCell>{tender.client_name || "-"}</TableCell>
                            <TableCell>{tender.target_capacity_kw ? tender.target_capacity_kw.toLocaleString() : "0"}</TableCell>
                            <TableCell>
                                <Badge variant={statusMap[tender.status].variant}>
                                    {statusMap[tender.status].label}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                {format(new Date(tender.created_at), "MMM d, yyyy")}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
