"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { firebaseUser, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !firebaseUser) {
            // Store the path they were trying to access
            const searchParams = new URLSearchParams();
            searchParams.set("from", pathname);
            router.push(`/login?${searchParams.toString()}`);
        }
    }, [firebaseUser, loading, router, pathname]);

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"></div>
                    <p className="text-sm font-medium animate-pulse text-muted-foreground">Verifying access...</p>
                </div>
            </div>
        );
    }

    if (!firebaseUser) {
        return null;
    }

    return <>{children}</>;
}
