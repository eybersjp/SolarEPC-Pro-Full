"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/common/AppShell";
import { helioPrepApi, tendersApi } from "@/lib/api";
import { InputDataset, ValidationResult, NormalizedDataset } from "@/types";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function HelioPrepPage() {
    const params = useParams();
    const tenderId = params.id as string;
    const [siteData, setSiteData] = useState({
        address: "",
        latitude: 0,
        longitude: 0,
        utility_name: "",
        tariff_name: "",
    });
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [normalizedData, setNormalizedData] = useState<NormalizedDataset | null>(null);

    const { data: tender, isLoading: isTenderLoading } = useQuery({
        queryKey: ["tender", tenderId],
        queryFn: () => tendersApi.get(tenderId),
        enabled: !!tenderId,
    });

    const validateMutation = useMutation({
        mutationFn: (data: InputDataset) => helioPrepApi.validate(tenderId, data),
        onSuccess: (data) => {
            setValidationResult(data);
            if (data.is_valid) {
                toast.success("Validation successful", {
                    description: "Data is clean and ready for normalization.",
                });
            } else {
                toast.warning("Validation issues found", {
                    description: "Please address the errors flagged below.",
                });
            }
        },
    });

    const normalizeMutation = useMutation({
        mutationFn: (data: InputDataset) => helioPrepApi.normalize(tenderId, data),
        onSuccess: (data) => {
            setNormalizedData(data);
            toast.success("Normalization complete");
        },
    });

    const handleRunValidation = () => {
        const payload: InputDataset = {
            site_data: siteData,
            utility_bills: [], // Placeholder for now
            load_profile: [], // Placeholder for now
        };
        validateMutation.mutate(payload);
    };

    const handleRunNormalization = () => {
        const payload: InputDataset = {
            site_data: siteData,
            utility_bills: [],
            load_profile: [],
        };
        normalizeMutation.mutate(payload);
    };

    return (
        <AppShell>
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
                    <Link href={`/tenders/${tenderId}`} className="hover:text-primary flex items-center">
                        <ArrowLeft className="mr-1 h-3 w-3" />
                        Back to Tender
                    </Link>
                    <span>/</span>
                    <span className="text-foreground font-medium">HelioPrep</span>
                </div>

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">HelioPrep</h1>
                        <p className="text-muted-foreground">
                            {isTenderLoading ? <Skeleton className="h-4 w-[200px]" /> : `Prepare & Validate data for ${tender?.name}`}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Site & Utility Configuration</CardTitle>
                            <CardDescription>Enter project location and utility details for simulation.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="address">Site Address</Label>
                                <Input
                                    id="address"
                                    placeholder="123 Solar Way..."
                                    value={siteData.address}
                                    onChange={(e) => setSiteData({ ...siteData, address: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="utility">Utility Provider</Label>
                                    <Input
                                        id="utility"
                                        placeholder="PG&E, Eskom, etc."
                                        value={siteData.utility_name}
                                        onChange={(e) => setSiteData({ ...siteData, utility_name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="tariff">Utility Tariff</Label>
                                    <Input
                                        id="tariff"
                                        placeholder="E-TOU-C, Business Rate..."
                                        value={siteData.tariff_name}
                                        onChange={(e) => setSiteData({ ...siteData, tariff_name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleRunValidation}
                                    disabled={validateMutation.isPending}
                                >
                                    {validateMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                    Run Validation
                                </Button>
                                <Button
                                    onClick={handleRunNormalization}
                                    disabled={normalizeMutation.isPending || !validationResult?.is_valid}
                                >
                                    {normalizeMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                    Normalize & Export
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        {validationResult && (
                            <Card className={validationResult.is_valid ? "border-green-500/50 bg-green-50/10" : "border-amber-500/50 bg-amber-50/10"}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        {validationResult.is_valid ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                                        ) : (
                                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                                        )}
                                        Validation Results
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {validationResult.flags.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No issues found. Data looks clean.</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {validationResult.flags.map((flag, idx) => (
                                                <li key={idx} className="flex gap-2 text-sm">
                                                    <span className={`font-semibold ${flag.severity === 'error' ? 'text-destructive' : 'text-amber-600'}`}>
                                                        {flag.severity === 'error' ? '[ERROR]' : '[WARN]'}
                                                    </span>
                                                    <span>{flag.message}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {normalizedData && (
                            <Card className="border-primary/50 bg-primary/5">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Save className="h-5 w-5" />
                                        Normalized Dataset Ready
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Annual Consumption:</span>
                                        <span className="font-medium">{normalizedData.annual_consumption_kwh.toLocaleString()} kWh</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Peak Demand:</span>
                                        <span className="font-medium">{normalizedData.peak_demand_kw.toLocaleString()} kW</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Standardized Tariff:</span>
                                        <span className="font-medium">{normalizedData.standardized_tariff_name}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
