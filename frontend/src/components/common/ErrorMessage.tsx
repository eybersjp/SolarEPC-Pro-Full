"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/lib/api";

interface ErrorMessageProps {
    error: Error | ApiError | null;
    retry?: () => void;
    className?: string;
}

export function ErrorMessage({ error, retry, className }: ErrorMessageProps) {
    if (!error) return null;

    const message = error.message || "Something went wrong";

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-lg border border-danger/20 bg-danger/10 p-6 text-center",
                className
            )}
        >
            <AlertCircle className="mb-2 h-10 w-10 text-danger" />
            <p className="mb-4 text-sm text-danger">{message}</p>
            {retry && (
                <Button variant="outline" size="sm" onClick={retry}>
                    Try Again
                </Button>
            )}
        </div>
    );
}
