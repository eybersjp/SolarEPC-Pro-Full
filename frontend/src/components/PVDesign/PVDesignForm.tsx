"use client";

import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PVDesignCreate } from "@/types";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
    module_model: z.string().min(2, "Module model is required"),
    module_watt: z.coerce.number().gt(0, "Wattage must be greater than 0"),
    inverter_model: z.string().min(2, "Inverter model is required"),
    inverter_kw: z.coerce.number().gt(0, "Capacity must be greater than 0"),
    strings_per_inverter: z.coerce.number().int().gt(0, "Must be at least 1"),
    modules_per_string: z.coerce.number().int().gt(0, "Must be at least 1"),
});

interface PVDesignFormProps {
    onSubmit: (data: PVDesignCreate) => void;
    isLoading?: boolean;
    onCancel?: () => void;
    title?: string;
}

export function PVDesignForm({
    onSubmit,
    isLoading,
    onCancel,
    title = "Create New PV Design",
}: PVDesignFormProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            module_model: "",
            module_watt: 550,
            inverter_model: "",
            inverter_kw: 100,
            strings_per_inverter: 10,
            modules_per_string: 20,
        },
    });

    // Watch values for real-time calculations
    const watchedValues = form.watch();

    const calculations = useMemo(() => {
        const { module_watt, inverter_kw, strings_per_inverter, modules_per_string } = watchedValues;

        if (!module_watt || !inverter_kw || !strings_per_inverter || !modules_per_string) {
            return { totalModules: 0, capacityKwp: 0, dcAcRatio: 0 };
        }

        const totalModules = strings_per_inverter * modules_per_string;
        const capacityKwp = (totalModules * module_watt) / 1000;
        const dcAcRatio = capacityKwp / inverter_kw;

        return {
            totalModules,
            capacityKwp: Number(capacityKwp.toFixed(2)),
            dcAcRatio: Number(dcAcRatio.toFixed(2)),
        };
    }, [watchedValues]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">
                    Enter the specifications for your PV system design.
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Module Specifications</h4>
                            <FormField
                                control={form.control}
                                name="module_model"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Module Model</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. LONGI Hi-MO 5" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="module_watt"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Module Wattage (Wp)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Inverter Specifications</h4>
                            <FormField
                                control={form.control}
                                name="inverter_model"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Inverter Model</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Huawei SUN2000-100KTL" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="inverter_kw"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Inverter Capacity (kW AC)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Configuration</h4>
                            <FormField
                                control={form.control}
                                name="strings_per_inverter"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Strings per Inverter</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="modules_per_string"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Modules per String</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Design Calculations (Preview)</h4>
                            <Card className="bg-muted/50 border-dashed">
                                <CardContent className="pt-6 space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Total Modules:</span>
                                        <span className="font-bold">{calculations.totalModules}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">System Capacity:</span>
                                        <span className="font-bold">{calculations.capacityKwp} kWp</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">DC:AC Ratio:</span>
                                        <span className={`font-bold ${calculations.dcAcRatio < 1.0 || calculations.dcAcRatio > 1.5
                                            ? "text-amber-600 dark:text-amber-400"
                                            : "text-green-600 dark:text-green-400"
                                            }`}>
                                            {calculations.dcAcRatio}
                                        </span>
                                    </div>
                                    {calculations.dcAcRatio > 1.5 && (
                                        <p className="text-[10px] text-amber-600 font-medium leading-tight">
                                            Warning: DC:AC ratio &gt; 1.5 might lead to excessive clipping.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        {onCancel && (
                            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                                Cancel
                            </Button>
                        )}
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Saving..." : "Create Design"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
