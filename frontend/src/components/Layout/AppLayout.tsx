"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    FileText,
    Zap,
    ClipboardList,
    LogOut,
    User as UserIcon,
    Menu,
    X,
    Bell
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface NavItemProps {
    href: string;
    icon: React.ElementType;
    label: string;
    active: boolean;
    onClick?: () => void;
}

function NavItem({ href, icon: Icon, label, active, onClick }: NavItemProps) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200",
                active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
        >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
        </Link>
    );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    const navItems = [
        { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
        { href: "/tenders", icon: FileText, label: "Tenders" },
        { href: "/pv-designs", icon: Zap, label: "PV Designs" },
        { href: "/boq", icon: ClipboardList, label: "BOQ" },
    ];

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <ProtectedRoute>
            <div className="flex min-h-screen bg-background text-foreground">
                {/* Mobile Sidebar Overlay */}
                {isSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                        onClick={closeSidebar}
                    />
                )}

                {/* Sidebar */}
                <aside className={cn(
                    "fixed inset-y-0 left-0 z-50 w-64 border-r bg-card/50 backdrop-blur-xl transition-transform lg:translate-x-0 lg:static lg:inset-0",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}>
                    <div className="flex h-16 items-center px-6 border-b">
                        <Link href="/dashboard" className="flex items-center gap-2 group" onClick={closeSidebar}>
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transform group-hover:rotate-12 transition-transform shadow-lg shadow-primary/20">
                                <Zap className="h-5 w-5 fill-primary-foreground" />
                            </div>
                            <span className="text-xl font-bold tracking-tight">SolarEPC <span className="text-primary">Pro</span></span>
                        </Link>
                        <button className="ml-auto lg:hidden text-muted-foreground hover:text-foreground" onClick={closeSidebar}>
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <nav className="flex flex-col gap-1.5 p-4 flex-1">
                        {navItems.map((item) => (
                            <NavItem
                                key={item.href}
                                {...item}
                                active={pathname === item.href || pathname?.startsWith(`${item.href}/`)}
                                onClick={closeSidebar}
                            />
                        ))}
                    </nav>

                    <div className="p-4 border-t mt-auto bg-muted/30">
                        <div className="flex items-center gap-3 px-3 py-2 mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                                <UserIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-semibold truncate">{user?.name || "User"}</span>
                                <span className="text-[10px] text-muted-foreground truncate uppercase tracking-wider font-bold">{user?.role || "Team Member"}</span>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            onClick={() => logout()}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </aside>

                {/* Main Content Container */}
                <div className="flex flex-col flex-1 min-w-0">
                    {/* Desktop Header (Only on large screens) */}
                    <header className="hidden lg:flex h-16 items-center justify-between px-8 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-30">
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-medium text-muted-foreground">
                                {navItems.find(item => pathname === item.href || pathname?.startsWith(`${item.href}/`))?.label || "Workspace"}
                            </h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                                <Bell className="h-5 w-5" />
                                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary border-2 border-card"></span>
                            </Button>
                        </div>
                    </header>

                    {/* Mobile Header */}
                    <header className="flex h-16 items-center justify-between px-4 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-30 lg:hidden">
                        <button onClick={toggleSidebar} className="p-2 -ml-2 text-muted-foreground hover:text-foreground">
                            <Menu className="h-6 w-6" />
                        </button>
                        <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            <span className="font-bold">SolarEPC Pro</span>
                        </div>
                        <div className="w-6" /> {/* Spacer */}
                    </header>

                    {/* Content */}
                    <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}
