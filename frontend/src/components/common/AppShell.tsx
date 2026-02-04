"use client";

import { cn } from "@/lib/utils";

interface AppShellProps {
    children: React.ReactNode;
    className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
    return (
        <div className={cn("flex min-h-screen flex-col", className)}>
            {/* Header placeholder - will be implemented in Phase 3 */}
            <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
                <div className="container flex h-16 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-primary">SolarEPC</span>
                        <span className="text-sm text-muted">Pro</span>
                    </div>
                    {/* User menu placeholder */}
                    <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-primary/20" />
                    </div>
                </div>
            </header>

            {/* Main content area */}
            <div className="flex flex-1">
                {/* Sidebar placeholder - will be implemented in Phase 3 */}
                <aside className="hidden w-64 border-r border-border bg-card md:block">
                    <nav className="flex flex-col gap-2 p-4">
                        <div className="h-8 w-full rounded bg-card" />
                        <div className="h-8 w-full rounded bg-card" />
                        <div className="h-8 w-full rounded bg-card" />
                    </nav>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-auto">
                    <div className="container py-6">{children}</div>
                </main>
            </div>
        </div>
    );
}
