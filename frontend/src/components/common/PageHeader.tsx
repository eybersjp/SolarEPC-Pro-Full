"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}

export function PageHeader({
    title,
    description,
    actions,
    className,
}: PageHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
                className
            )}
        >
            <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                    {title}
                </h1>
                {description && (
                    <p className="text-sm text-muted md:text-base">{description}</p>
                )}
            </div>
            {actions && (
                <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
            )}
        </div>
    );
}
