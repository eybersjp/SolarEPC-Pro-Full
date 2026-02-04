"use client";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 text-center md:p-12",
                className
            )}
        >
            {icon && (
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted">
                    {icon}
                </div>
            )}
            <h3 className="mb-1 text-lg font-semibold">{title}</h3>
            {description && (
                <p className="mb-4 max-w-sm text-sm text-muted">{description}</p>
            )}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}
