"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
    return (
        <SonnerToaster
            theme="dark"
            position="top-right"
            toastOptions={{
                style: {
                    background: "var(--color-bg-card)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-border)",
                },
                classNames: {
                    success: "!bg-success/10 !border-success/20",
                    error: "!bg-danger/10 !border-danger/20",
                    warning: "!bg-warning/10 !border-warning/20",
                },
            }}
        />
    );
}
