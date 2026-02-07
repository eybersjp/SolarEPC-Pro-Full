import React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { SiteDesignResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Grid3X3, Calendar, Layers, Zap, ArrowRight } from "lucide-react";

interface DesignsListProps {
    designs: SiteDesignResponse[] | undefined;
    isLoading: boolean;
    tenderId: string;
}

export function DesignsList({ designs, isLoading, tenderId }: DesignsListProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="overflow-hidden">
                        <CardHeader className="p-4 space-y-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">
                            <div className="grid grid-cols-2 gap-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <Skeleton className="h-9 w-full" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (!designs || designs.length === 0) {
        return (
            <Card className="border-dashed border-2 bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                        <Layers className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">No designs found</h3>
                    <p className="text-muted-foreground max-w-xs mx-auto mt-1">
                        Create your first site design to start laying out PV modules and calculating capacity.
                    </p>
                    <Button variant="outline" className="mt-6" asChild>
                        <Link href={`/tenders/${tenderId}/design/new`}>
                            Create New Design
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {designs.map((design) => (
                <Card key={design.id} className="group hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                    <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-base font-semibold truncate group-hover:text-primary transition-colors">
                                {design.name}
                            </CardTitle>
                            <Grid3X3 className="h-4 w-4 text-muted-foreground opacity-50" />
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <Calendar className="mr-1 h-3 w-3" />
                            {format(new Date(design.created_at), "MMM d, yyyy")}
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted/50 p-2 rounded-md">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center">
                                    <Layers className="mr-1 h-3 w-3" />
                                    Modules
                                </div>
                                <div className="text-sm font-bold mt-0.5">{design.total_modules}</div>
                            </div>
                            <div className="bg-muted/50 p-2 rounded-md">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center">
                                    <Zap className="mr-1 h-3 w-3 text-orange-500" />
                                    System Size
                                </div>
                                <div className="text-sm font-bold mt-0.5">{design.system_size_kwp.toFixed(1)} kWp</div>
                            </div>
                        </div>

                        <Button variant="secondary" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" asChild>
                            <Link href={`/tenders/${tenderId}/design/${design.id}`}>
                                Open Canvas
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
