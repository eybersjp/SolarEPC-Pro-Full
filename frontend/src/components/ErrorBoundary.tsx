"use client";

import React from "react";
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-background/50 backdrop-blur-sm border border-destructive/20 rounded-xl">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
                {(error as any).message || "An unexpected error occurred. Please try again or contact support if the issue persists."}
            </p>
            <div className="flex gap-4">
                <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2"
                >
                    <RefreshCcw className="w-4 h-4" />
                    Reload Page
                </Button>
                <Button onClick={resetErrorBoundary}>
                    Try Again
                </Button>
            </div>
        </div>
    );
};

export const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
    return (
        <ReactErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
                // Reset the state of your app so the error doesn't happen again
            }}
            onError={(error) => {
                console.error("ErrorBoundary caught an error:", error);
                toast.error("Application Error", {
                    description: "An unexpected error occurred. We've been notified.",
                });
            }}
        >
            {children}
        </ReactErrorBoundary>
    );
};
