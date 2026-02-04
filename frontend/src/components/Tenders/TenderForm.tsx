"use client";

import React, { useEffect } from "react";
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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TenderStatus } from "@/types";

const formSchema = z.object({
    name: z.string().min(3, "Project name must be at least 3 characters"),
    client_name: z.string().min(2, "Client name is required"),
    target_capacity_kw: z.preprocess(
        (val) => (val === "" || val === null ? undefined : val),
        z.coerce.number().gt(0, "Capacity must be greater than 0").optional()
    ).optional(),
    status: z.enum(["draft", "in_review", "submitted", "won", "lost"] as const),
    latitude: z.coerce.number().optional().nullable(),
    longitude: z.coerce.number().optional().nullable(),
});

type TenderFormValues = z.infer<typeof formSchema>;

interface TenderFormProps {
    initialData?: Partial<TenderFormValues> & { id?: string };
    onSubmit: (data: any) => Promise<void>;
    isLoading: boolean;
    onCancel: () => void;
    title: string;
}

export function TenderForm({
    initialData,
    onSubmit,
    isLoading,
    onCancel,
    title,
}: TenderFormProps) {
    const form = useForm<TenderFormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: "",
            client_name: "",
            target_capacity_kw: undefined,
            status: "draft",
            latitude: null,
            longitude: null,
            ...initialData,
        },
    });

    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name || "",
                client_name: initialData.client_name || "",
                target_capacity_kw: initialData.target_capacity_kw ?? undefined,
                status: initialData.status as TenderStatus || "draft",
                latitude: initialData.latitude ?? null,
                longitude: initialData.longitude ?? null,
            });
        }
    }, [initialData, form]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                <p className="text-muted-foreground">
                    Enter the details for the tender below.
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }: { field: any }) => (
                            <FormItem>
                                <FormLabel>Project Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Solar Farm Alpha" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="client_name"
                        render={({ field }: { field: any }) => (
                            <FormItem>
                                <FormLabel>Client Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Green Energy Corp" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="target_capacity_kw"
                        render={({ field }: { field: any }) => (
                            <FormItem>
                                <FormLabel>Target Capacity (kW)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} value={field.value ?? ""} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }: { field: any }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    disabled={!initialData?.id}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="in_review">In Review</SelectItem>
                                        <SelectItem value="submitted">Submitted</SelectItem>
                                        <SelectItem value="won">Won</SelectItem>
                                        <SelectItem value="lost">Lost</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="latitude"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Latitude</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="any" {...field} value={field.value ?? ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="longitude"
                            render={({ field }: { field: any }) => (
                                <FormItem>
                                    <FormLabel>Longitude</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="any" {...field} value={field.value ?? ""} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
