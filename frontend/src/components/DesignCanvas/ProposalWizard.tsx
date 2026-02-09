"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, FileSpreadsheet, AlertCircle, CheckCircle } from "lucide-react";
import { useGenerateProposalMutation, useTaskStatusQuery, useExportCSV } from "@/hooks/useProposal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProposalWizardProps {
    designId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ProposalSection {
    id: keyof typeof defaultSections;
    label: string;
}

const defaultSections = {
    include_cover: true,
    include_site_map: true,
    include_specs: true,
    include_energy: true,
    include_financials: true,
    include_equipment: true,
};

const sections: ProposalSection[] = [
    { id: "include_cover", label: "Cover Page" },
    { id: "include_site_map", label: "Site Map" },
    { id: "include_specs", label: "Technical Specifications" },
    { id: "include_energy", label: "Energy Production Analysis" },
    { id: "include_financials", label: "Financial Analysis" },
    { id: "include_equipment", label: "Equipment Details" },
];

export function ProposalWizard({ designId, open, onOpenChange }: ProposalWizardProps) {
    const [step, setStep] = useState(1);
    const [title, setTitle] = useState("");
    const [selectedSections, setSelectedSections] = useState(defaultSections);
    const [taskId, setTaskId] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    // Hooks
    const generateMutation = useGenerateProposalMutation(designId);

    // Polling query - enabled only when we have a task ID and we are in step 2 (Preview/Generating)
    const taskQuery = useTaskStatusQuery(taskId || "", designId, !!taskId);

    const exportMutation = useExportCSV(designId);

    // Monitor task status
    useEffect(() => {
        if (taskQuery.data?.status === "SUCCESS" && taskQuery.data.result_url) {
            setPdfUrl(taskQuery.data.result_url);
        }
    }, [taskQuery.data]);

    // Cleanup on close
    useEffect(() => {
        if (!open) {
            // Optional: reset state logic here if desired, otherwise we rely on user manually closing.
            // Requirement says "Prevent dialog close during generation", so we control onOpenChange.
            // If strictly closed (unmounted), state is lost anyway.
        }
    }, [open]);

    const handleSectionChange = (sectionId: keyof typeof defaultSections, checked: boolean) => {
        setSelectedSections((prev) => ({
            ...prev,
            [sectionId]: checked,
        }));
    };

    const handleGenerate = () => {
        generateMutation.mutate(
            { ...selectedSections, title },
            {
                onSuccess: (data) => {
                    setTaskId(data.task_id);
                    setStep(2);
                },
            }
        );
    };

    const handleRetry = () => {
        setStep(1);
        setTaskId(null);
        setPdfUrl(null);
        generateMutation.reset();
    };

    const handleReset = () => {
        setStep(1);
        setTitle("");
        setSelectedSections(defaultSections);
        setTaskId(null);
        setPdfUrl(null);
        generateMutation.reset();
    };

    const handleClose = () => {
        // Prevent closing if generation is in progress (PENDING or STARTED)
        const isGenerating = taskQuery.data?.status === "PENDING" || taskQuery.data?.status === "STARTED";
        if (isGenerating && step === 2) {
            const confirm = window.confirm("Proposal generation is in progress. Are you sure you want to close?");
            if (!confirm) return;
        }
        onOpenChange(false);
    };

    const handleDownloadPDF = () => {
        if (pdfUrl) {
            const link = document.createElement("a");
            link.href = pdfUrl;
            // Use title for filename if available, sanitize it, otherwise fallback to designId
            const safeTitle = title ? title.replace(/[^a-z0-9]/gi, '_').substring(0, 50) : `Design_${designId.substring(0, 8)}`;
            link.download = `Proposal_${safeTitle}_${new Date().toISOString().split("T")[0]}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("PDF downloaded successfully");
        }
    };

    const handleDownloadCSV = () => {
        exportMutation.mutate();
    };

    // Derived States
    const isSelectionValid = Object.values(selectedSections).some((v) => v);
    const isGenerating = taskQuery.data?.status === "PENDING" || taskQuery.data?.status === "STARTED" || generateMutation.isPending;
    const isSuccess = taskQuery.data?.status === "SUCCESS";
    const hasPdfUrl = !!pdfUrl;

    // Treat success without URL as an error state for the UI
    const isSuccessButNoUrl = isSuccess && !hasPdfUrl;

    const isError = taskQuery.data?.status === "FAILURE" || taskQuery.isError || generateMutation.isError || isSuccessButNoUrl;

    let errorMessage = taskQuery.data?.error || (taskQuery.error as Error)?.message || (generateMutation.error as Error)?.message || "Failed to generate proposal";
    if (isSuccessButNoUrl) {
        errorMessage = "Generation succeeded but the PDF URL is missing. Please try again.";
    }

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogContent className="max-w-3xl sm:max-w-4xl h-[90vh] sm:h-[800px] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Generate Proposal</DialogTitle>
                        <span className="text-sm text-muted-foreground mr-8">
                            Step {step} of 3: {step === 1 ? "Configure" : step === 2 ? "Preview" : "Download"}
                        </span>
                    </div>
                    <DialogDescription>
                        {step === 1 && "Configure the sections to include in your proposal."}
                        {step === 2 && "Generates a professional PDF proposal based on your design."}
                        {step === 3 && "Your proposal is ready for download."}
                    </DialogDescription>

                    {/* Progress Indicator */}
                    <div className="w-full bg-secondary h-1 mt-2 rounded-full overflow-hidden">
                        <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${(step / 3) * 100}%` }}
                        />
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 px-1">
                    {/* Step 1: Configure */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="proposal-title">Proposal Title</Label>
                                <Input
                                    id="proposal-title"
                                    placeholder="e.g., Solar Installation Proposal - [Client Name]"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-3">
                                <Label>Include Sections</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {sections.map((section) => (
                                        <div key={section.id} className="flex items-center space-x-2 border p-3 rounded-md hover:bg-accent/50 transition-colors">
                                            <Checkbox
                                                id={section.id}
                                                checked={selectedSections[section.id]}
                                                onCheckedChange={(checked) =>
                                                    handleSectionChange(section.id, checked as boolean)
                                                }
                                            />
                                            <Label htmlFor={section.id} className="cursor-pointer flex-1">
                                                {section.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Preview & Generation */}
                    {step === 2 && (
                        <div className="h-full flex flex-col items-center justify-center min-h-[400px]">
                            {isGenerating && (
                                <div className="text-center space-y-4">
                                    <div className="relative mx-auto w-16 h-16">
                                        <div className="absolute inset-0 rounded-full border-4 border-primary/30"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
                                        <Loader2 className="w-8 h-8 absolute inset-0 m-auto text-primary animate-pulse" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-medium">
                                            {taskQuery.data?.status === "STARTED" ? "Generating proposal..." : "Queuing your request..."}
                                        </h3>
                                        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                                            This may take 30-60 seconds depending on the content selected.
                                        </p>
                                    </div>
                                    <div className="w-64 h-1.5 bg-secondary rounded-full mx-auto overflow-hidden">
                                        <div className="h-full bg-primary/50 w-full animate-progress-indeterminate origin-left-right"></div>
                                    </div>
                                </div>
                            )}

                            {isSuccess && hasPdfUrl && (
                                <div className="w-full h-full flex flex-col space-y-4">
                                    <div className="bg-green-50 text-green-700 p-3 rounded-md flex items-center justify-center gap-2 text-sm border border-green-200">
                                        <CheckCircle className="w-4 h-4" />
                                        Proposal generated successfully!
                                    </div>
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-sm font-medium text-muted-foreground truncate max-w-[300px]" title={title}>
                                            {title || "Untitled Proposal"}
                                        </h4>
                                    </div>
                                    <iframe
                                        src={pdfUrl!}
                                        className="w-full flex-1 border rounded-md min-h-[400px] bg-slate-100"
                                        title="Proposal Preview"
                                    />
                                    <p className="text-xs text-center text-muted-foreground">
                                        Preview may vary slightly from downloaded file.
                                    </p>
                                </div>
                            )}

                            {isError && (
                                <div className="text-center space-y-4 p-8 border border-destructive/20 bg-destructive/5 rounded-lg max-w-md mx-auto">
                                    <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-medium text-destructive">Generation Failed</h3>
                                        <p className="text-muted-foreground text-sm">
                                            {errorMessage}
                                        </p>
                                    </div>
                                    <Button onClick={handleRetry} variant="outline" className="mt-4">
                                        Try Again
                                    </Button>
                                    {/* Timeout specific message could go here if we tracked time */}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Download */}
                    {step === 3 && (
                        <div className="flex flex-col items-center justify-center h-full space-y-8 p-8">
                            <div className="text-center space-y-2">
                                <div className="bg-green-100 p-3 rounded-full w-fit mx-auto mb-4">
                                    <CheckCircle className="w-12 h-12 text-green-600" />
                                </div>
                                <h2 className="text-2xl font-semibold">Your proposal is ready!</h2>
                                <p className="text-muted-foreground">
                                    Download your files below.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                                <div className="border rounded-lg p-6 flex flex-col items-center space-y-4 hover:border-primary/50 transition-colors shadow-sm">
                                    <FileText className="w-12 h-12 text-red-500" />
                                    <div className="text-center">
                                        <div className="font-medium">Proposal PDF</div>
                                        <div className="text-xs text-muted-foreground">Complete proposal document</div>
                                    </div>
                                    <Button onClick={handleDownloadPDF} className="w-full" disabled={!hasPdfUrl}>
                                        Download PDF
                                    </Button>
                                </div>

                                <div className="border rounded-lg p-6 flex flex-col items-center space-y-4 hover:border-primary/50 transition-colors shadow-sm">
                                    <FileSpreadsheet className="w-12 h-12 text-green-500" />
                                    <div className="text-center">
                                        <div className="font-medium">Bill of Materials</div>
                                        <div className="text-xs text-muted-foreground">Equipment list as CSV</div>
                                    </div>
                                    <Button
                                        onClick={handleDownloadCSV}
                                        variant="outline"
                                        className="w-full"
                                        disabled={exportMutation.isPending}
                                    >
                                        {exportMutation.isPending && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        Download CSV
                                    </Button>
                                </div>
                            </div>

                            <div className="text-sm text-muted-foreground pt-4 border-t w-full max-w-lg">
                                <div className="flex justify-between">
                                    <span>Design ID:</span>
                                    <span className="font-mono">{designId.slice(0, 8)}...</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Generated:</span>
                                    <span>{new Date().toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between gap-2 border-t pt-4 mt-auto">
                    {step === 1 && (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleGenerate} disabled={!isSelectionValid || generateMutation.isPending}>
                                {generateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Next: Preview
                            </Button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setStep(1)}
                                disabled={isGenerating}
                            >
                                Back
                            </Button>
                            <Button
                                onClick={() => setStep(3)}
                                disabled={!isSuccess || !hasPdfUrl}
                            >
                                Next: Download
                            </Button>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <Button variant="outline" onClick={handleReset}>
                                Generate Another
                            </Button>
                            <Button onClick={handleClose}>
                                Close
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
