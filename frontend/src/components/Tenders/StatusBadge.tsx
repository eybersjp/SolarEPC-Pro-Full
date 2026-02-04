"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { TenderStatus } from "@/types";

interface StatusBadgeProps {
    status: TenderStatus;
    className?: string;
}

const statusLabels: Record<TenderStatus, string> = {
    draft: "Draft",
    in_review: "In Review",
    submitted: "Submitted",
    won: "Won",
    lost: "Lost",
};

const statusClasses: Record<TenderStatus, string> = {
    draft: "badge-draft",
    in_review: "badge-in-review",
    submitted: "badge-submitted",
    won: "badge-won",
    lost: "badge-lost",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
    return (
        <span className={cn("badge", statusClasses[status], className)}>
            {statusLabels[status]}
        </span>
    );
}
