"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "bg-primary/20 text-primary",
                secondary: "bg-muted/20 text-muted",
                success: "bg-success/20 text-success",
                destructive: "bg-danger/20 text-danger",
                warning: "bg-warning/20 text-warning",
                outline: "border border-border text-foreground",
                // Custom tender status variants
                draft: "bg-muted/20 text-muted",
                "in-review": "bg-warning/20 text-warning",
                submitted: "bg-primary/20 text-primary",
                won: "bg-success/20 text-success",
                lost: "bg-danger/20 text-danger",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
