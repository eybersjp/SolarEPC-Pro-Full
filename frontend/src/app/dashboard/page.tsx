"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Trophy,
    FileText,
    Activity,
    Zap,
    Plus
} from "lucide-react";
import { dashboardApi } from "@/lib/api";
import { RecentTenders } from "@/components/Dashboard/RecentTenders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import Link from "next/link";

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    description?: string;
    trend?: string;
}

function StatCard({ title, value, icon: Icon, description, trend }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {description}
                        {trend && <span className="text-primary ml-1">{trend}</span>}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

import { DashboardSkeleton } from "@/components/common/DashboardSkeleton";
import { AppShell } from "@/components/common/AppShell";

export default function DashboardPage() {
    const { data: dashboardData, isLoading, error } = useQuery({
        queryKey: ["dashboard"],
        queryFn: () => dashboardApi.get(),
    });

    if (error) {
        return (
            <AppShell>
                <ErrorMessage
                    message="Failed to load dashboard data. Please try again later."
                />
            </AppShell>
        );
    }

    if (isLoading) {
        return (
            <AppShell>
                <DashboardSkeleton />
            </AppShell>
        );
    }

    const stats = dashboardData?.stats;
    const recent_tenders = dashboardData?.recent_tenders;

    return (
        <AppShell>
            <div className="flex flex-col gap-8">
                {/* Header Section */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                        <p className="text-muted-foreground">
                            Welcome back! Here&apos;s an overview of your solar projects.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/tenders/new">
                            <Plus className="mr-2 h-4 w-4" />
                            New Tender
                        </Link>
                    </Button>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Total Tenders"
                        value={stats!.total_tenders}
                        icon={FileText}
                        description="Lifetime total"
                    />
                    <StatCard
                        title="Active Tenders"
                        value={stats!.active_tenders}
                        icon={Activity}
                        description="Currently in progress"
                        trend="+2 this week"
                    />
                    <StatCard
                        title="Tenders Won"
                        value={stats!.won_tenders}
                        icon={Trophy}
                        description="Conversion rate: "
                        trend={`${stats!.total_tenders ? Math.round((stats!.won_tenders / stats!.total_tenders) * 100) : 0}%`}
                    />
                    <StatCard
                        title="Total Capacity"
                        value={`${(stats!.total_capacity_kw / 1000).toFixed(1)} MW`}
                        icon={Zap}
                        description="Aggregated project size"
                    />
                </div>

                {/* Recent Tenders Section */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold tracking-tight">Recent Tenders</h2>
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/tenders">View all</Link>
                        </Button>
                    </div>
                    <RecentTenders tenders={recent_tenders!} />
                </div>
            </div>
        </AppShell>
    );
}
