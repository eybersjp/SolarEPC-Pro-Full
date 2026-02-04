import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";

import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
    title: "SolarEPC Pro",
    description: "Commercial & utility-scale solar EPC operating system",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body>
                <QueryProvider>
                    <AuthProvider>
                        <ErrorBoundary>
                            {children}
                        </ErrorBoundary>
                        <Toaster />
                    </AuthProvider>
                </QueryProvider>
            </body>
        </html>
    );
}

