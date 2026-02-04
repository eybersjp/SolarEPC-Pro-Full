"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { usePreconditions } from '@/lib/hooks/usePreconditions';
import { useTenders } from '@/lib/hooks/useTenders';
import { PreconditionsChecklist } from '@/components/Preconditions/PreconditionsChecklist';
import { Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PreconditionsPage() {
    const params = useParams();
    const id = params.id as string;

    const { data: tender, isLoading: loadingTender } = useTenders().useGet(id);
    const { data: precondition, isLoading: loadingPreconditions, error } = usePreconditions(id);

    if (loadingTender || loadingPreconditions) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
                <p className="text-sm text-muted-foreground animate-pulse">Loading project assessments...</p>
            </div>
        );
    }

    if (error || !precondition) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="p-4 rounded-full bg-danger/10 text-danger mb-4">
                    <ShieldCheck className="h-12 w-12" />
                </div>
                <h2 className="text-xl font-bold">Failed to load preconditions</h2>
                <p className="text-muted-foreground">This project might not exist or the data could not be retrieved.</p>
                <Button asChild variant="outline" className="mt-4">
                    <Link href={`/tenders/${id}`}>Back to Tender</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col space-y-4">
                <Link
                    href={`/tenders/${id}`}
                    className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Tender Details
                </Link>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black tracking-tight text-white">Project Assessment</h1>
                        <p className="text-lg text-muted-foreground">
                            Evaluation for <span className="text-primary font-semibold">{tender?.name}</span>
                        </p>
                    </div>
                </div>
            </div>

            <PreconditionsChecklist tenderId={id} precondition={precondition} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-card/30 border border-border/50 space-y-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold">Risk Management</h3>
                    <p className="text-xs text-muted-foreground">
                        Ensure all legal and technical risks are addressed before committing resources.
                    </p>
                </div>
                <div className="p-6 rounded-2xl bg-card/30 border border-border/50 space-y-2">
                    <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center text-success mb-2">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold">Go Criteria</h3>
                    <p className="text-xs text-muted-foreground">
                        A project is usually viable when grid, land, permits, and funds are all within reach.
                    </p>
                </div>
                <div className="p-6 rounded-2xl bg-card/30 border border-border/50 space-y-2">
                    <div className="h-10 w-10 rounded-lg bg-danger/10 flex items-center justify-center text-danger mb-2">
                        <XCircle className="h-6 w-6" />
                    </div>
                    <h3 className="font-bold">Stop Signals</h3>
                    <p className="text-xs text-muted-foreground">
                        Be prepared to halt projects that cannot meet these critical milestones.
                    </p>
                </div>
            </div>
        </div>
    );
}
