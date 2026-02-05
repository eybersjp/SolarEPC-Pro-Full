"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { BOQItem, BOQItemCreate, BOQItemUpdate } from "@/types";

const boqItemSchema = z.object({
    category: z.string().min(1, "Category is required"),
    description: z.string().min(1, "Description is required"),
    quantity: z.coerce.number().int().positive("Quantity must be a positive integer"),
    unit_cost: z.coerce.number().min(0, "Unit cost must be non-negative"),
    margin_pct: z.coerce.number().min(0, "Margin must be non-negative").max(100, "Margin cannot exceed 100%"),
});

interface BOQItemFormProps {
    initialData?: BOQItem;
    onSubmit: (data: BOQItemCreate | BOQItemUpdate) => Promise<void>;
    isLoading?: boolean;
    onCancel?: () => void;
}

const CATEGORIES = [
    "Modules",
    "Inverters",
    "Mounting Structure",
    "Cabling (DC)",
    "Cabling (AC)",
    "Electrical BOS",
    "Civil Works",
    "Installation & Labor",
    "Logistics",
    "Permitting & Engineering",
    "Other",
];

export function BOQItemForm({ initialData, onSubmit, isLoading, onCancel }: BOQItemFormProps) {
    const form = useForm<z.infer<typeof boqItemSchema>>({
        resolver: zodResolver(boqItemSchema) as any,
        defaultValues: {
            category: "",
            description: "",
            quantity: 1,
            unit_cost: 0,
            margin_pct: 0,
        },
    });

    useEffect(() => {
        if (initialData) {
            form.reset({
                category: initialData.category,
                description: initialData.description,
                quantity: initialData.quantity,
                unit_cost: initialData.unit_cost,
                margin_pct: initialData.margin_pct,
            });
        }
    }, [initialData, form]);

    const handleSubmit = async (values: z.infer<typeof boqItemSchema>) => {
        await onSubmit(values);
        if (!initialData) {
            form.reset(); // Reset only on create
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Category <span className="text-destructive">*</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                                <Textarea placeholder="Item description" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Quantity <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="unit_cost"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Unit Cost ($) <span className="text-destructive">*</span></FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="margin_pct"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Margin (%)</FormLabel>
                            <FormControl>
                                <Input type="number" step="0.1" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end space-x-2 pt-2">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                            Cancel
                        </Button>
                    )}
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? "Update Item" : "Add Item"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
