"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Play, BarChart4, Battery, Sun, Info } from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/common/AppShell";
import { helioscopeApi, tendersApi } from "@/lib/api";
import { ScenarioConfig, SimulationResult } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function HelioscopePage() {
    const params = useParams();
    const tenderId = params.id as string;
    const [scenarios, setScenarios] = useState<ScenarioConfig[]>([]);

    const { data: tender, isLoading: isTenderLoading } = useQuery({
        queryKey: ["tender", tenderId],
        queryFn: () => tendersApi.get(tenderId),
        enabled: !!tenderId,
    });

    const { data: results, isLoading: isResultsLoading, refetch: refetchResults } = useQuery({
        queryKey: ["helioscope-results", tenderId],
        queryFn: () => helioscopeApi.getResults(tenderId),
        enabled: !!tenderId,
    });

    const generateMutation = useMutation({
        mutationFn: () => helioscopeApi.getScenarios(tenderId),
        onSuccess: (data) => {
            setScenarios(data);
            toast.success("Scenarios generated", {
                description: "Automatic simulation queue started.",
            });
            refetchResults();
        },
    });

    return (
        <AppShell>
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                    <Link href={`/tenders/${tenderId}`} className="hover:text-primary flex items-center">
                        <ArrowLeft className="mr-1 h-3 w-3" />
                        Back to Tender
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-medium">Auto-Helioscope</span>
                </div>

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Auto-Helioscope Runner</h1>
                        <p className="text-muted-foreground">
                            {isTenderLoading ? <Skeleton className="h-4 w-[200px]" /> : `Scenario modeling for ${tender?.name}`}
                        </p>
                    </div>
                    <Button
                        onClick={() => generateMutation.mutate()}
                        disabled={generateMutation.isPending}
                    >
                        {generateMutation.isPending ? "Generating..." : "Run Multi-Scenario"}
                        <Play className="ml-2 h-4 w-4" />
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart4 className="h-5 w-5" />
                                Scenario Comparison
                            </CardTitle>
                            <CardDescription>
                                Benchmarking performance across different system configurations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isResultsLoading ? (
                                <div className="space-y-2">
                                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                                </div>
                            ) : results && results.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Scenario Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Annual Prod (kWh)</TableHead>
                                            <TableHead>Perf Ratio</TableHead>
                                            <TableHead>Yield (kWh/kWp)</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.map((result, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-medium">{result.scenario_name}</TableCell>
                                                <TableCell>
                                                    {result.scenario_name.includes("BESS") ? (
                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                                                            <Battery className="mr-1 h-3 w-3" /> PV+BESS
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                                                            <Sun className="mr-1 h-3 w-3" /> PV Only
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>{result.annual_production_kwh.toLocaleString()}</TableCell>
                                                <TableCell>{(result.performance_ratio * 100).toFixed(1)}%</TableCell>
                                                <TableCell>{result.specific_yield.toFixed(0)}</TableCell>
                                                <TableCell>
                                                    <Badge className="bg-green-500">Complete</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                    <Info className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
                                    <p className="mt-2 text-sm text-muted-foreground">No scenarios run yet. Click "Run Multi-Scenario" to start.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppShell>
    );
}
