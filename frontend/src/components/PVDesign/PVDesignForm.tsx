"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationWarnings } from "./ValidationWarnings";

import { usePVDesigns } from "@/hooks/usePVDesigns";
import { PVDesignWithValidation } from "@/types";

const pvDesignSchema = z.object({
    module_model: z.string().min(2, "Module model is required"),
    module_watt: z.coerce.number().int("Must be an integer (W)").positive("Must be positive"),
    inverter_model: z.string().min(2, "Inverter model is required"),
    inverter_kw: z.coerce.number().int("Must be an integer (kW)").positive("Must be positive"),
    strings_per_inverter: z.coerce.number().int().positive("Must be a positive integer"),
    modules_per_string: z.coerce.number().int().positive("Must be a positive integer"),
});

interface PVDesignFormProps {
    tenderId: string;
    onSuccess?: () => void;
}

export function PVDesignForm({ tenderId, onSuccess }: PVDesignFormProps) {
    const [result, setResult] = useState<PVDesignWithValidation | null>(null);
    const { createDesignAsync, isCreating } = usePVDesigns(tenderId);

    const form = useForm<z.infer<typeof pvDesignSchema>>({
        resolver: zodResolver(pvDesignSchema),
        defaultValues: {
            module_model: "",
            module_watt: 0,
            inverter_model: "",
            inverter_kw: 0,
            strings_per_inverter: 1,
            modules_per_string: 1,
        },
    });

    async function onSubmit(values: z.infer<typeof pvDesignSchema>) {
        try {
            const design = await createDesignAsync(values);
            setResult(design);
            form.reset();
            // Do not call onSuccess immediately so user can see results
        } catch (error) {
            console.error("Failed to create PV design:", error);
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Create PV Design</CardTitle>
                    <CardDescription>
                        Enter module and inverter specifications to calculate system design.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="module_model"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Module Model</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Trina Vertex S" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="module_watt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Module Wattage (Wp)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="inverter_model"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Inverter Model</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Huawei SUN2000" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="inverter_kw"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Inverter Capacity (kW)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="strings_per_inverter"
                                    render={({ field }) => (
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
                                    render={({ field }) => (
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
                            <Button type="submit" disabled={isCreating}>
                                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Calculate & Create
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {result && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5" />
                            Calculation Results
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm font-medium text-muted-foreground">DC:AC Ratio</p>
                                <p className="text-2xl font-bold">{result.dc_ac_ratio.toFixed(2)}</p>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm font-medium text-muted-foreground">Total Capacity</p>
                                <p className="text-2xl font-bold">{result.total_capacity_kwp.toFixed(2)} kWp</p>
                            </div>
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm font-medium text-muted-foreground">Total Modules</p>
                                <p className="text-2xl font-bold">{result.total_modules}</p>
                            </div>
                        </div>

                        <ValidationWarnings warnings={result.warnings} valid={result.valid} />

                        {onSuccess && (
                            <Button onClick={onSuccess} className="w-full mt-4">
                                Done
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
