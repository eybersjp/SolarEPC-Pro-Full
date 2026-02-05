"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    action?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

export function PageHeader({
    title,
    description,
    actions,
    action,
    children,
    className,
}: PageHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-4",
                className
            )}
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                        {title}
                    </h1>
                    {description && (
                        <div className="text-sm text-muted md:text-base">{description}</div>
                    )}
                </div>
                {(actions || action) && (
                    <div className="flex flex-shrink-0 items-center gap-2">
                        {actions}
                        {action}
                    </div>
                )}
            </div>
            {children}
        </div>
    );
}
