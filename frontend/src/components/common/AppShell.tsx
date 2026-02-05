"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    FileText,
    Zap,
    ClipboardList,
    Menu,
    LogOut,
    User,
    Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

interface AppShellProps {
    children: React.ReactNode;
    className?: string;
}

const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Tenders", href: "/tenders", icon: FileText },
    { label: "PV Designs", href: "/tenders/pv-designs", icon: Zap, secondary: true }, // Placeholder for broader view
    { label: "BOQ Management", href: "/tenders/boq", icon: ClipboardList, secondary: true }, // Placeholder
];

export function AppShell({ children, className }: AppShellProps) {
    const pathname = usePathname();

    const NavContent = () => (
        <nav className="flex flex-col gap-2 p-4">
            {navItems.filter(item => !item.secondary).map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                    </Link>
                );
            })}
            <div className="my-4 border-t border-border/50" />
            <div className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Settings
            </div>
            <Link
                href="/settings"
                className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                    pathname === "/settings" && "bg-muted text-foreground"
                )}
            >
                <Settings className="h-4 w-4" />
                Preferences
            </Link>
        </nav>
    );

    return (
        <ProtectedRoute>
            <div className={cn("flex min-h-screen flex-col bg-background text-foreground", className)}>
                <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
                    <div className="container flex h-16 items-center justify-between px-4 md:px-6">
                        <div className="flex items-center gap-2">
                            <div className="md:hidden">
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="ghost" size="icon" className="md:hidden">
                                            <Menu className="h-5 w-5" />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="left" className="w-64 p-0">
                                        <SheetHeader className="p-6 border-b">
                                            <SheetTitle className="flex items-center gap-2">
                                                <span className="text-xl font-bold text-primary">SolarEPC</span>
                                                <span className="text-sm font-medium">Pro</span>
                                            </SheetTitle>
                                        </SheetHeader>
                                        <NavContent />
                                    </SheetContent>
                                </Sheet>
                            </div>
                            <Link href="/dashboard" className="flex items-center gap-2">
                                <span className="text-xl font-bold text-primary">SolarEPC</span>
                                <span className="text-sm font-medium">Pro</span>
                            </Link>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border border-border">
                                <User className="h-5 w-5" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Logout">
                                <LogOut className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1">
                    <aside className="hidden w-64 border-r border-border bg-card md:block">
                        <NavContent />
                    </aside>

                    <main className="flex-1 overflow-auto bg-muted/10">
                        <div className="container py-6 px-4 md:px-8 max-w-7xl mx-auto">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}
