import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";

interface ValidationWarningsProps {
    warnings: string[];
    valid?: boolean;
}

export function ValidationWarnings({ warnings, valid }: ValidationWarningsProps) {
    if (!warnings || warnings.length === 0) {
        if (valid === false) {
            return (
                <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Invalid Design</AlertTitle>
                    <AlertDescription>
                        This design has critical issues and may not be feasible.
                    </AlertDescription>
                </Alert>
            );
        }
        return null;
    }

    return (
        <div className="space-y-4 mb-6">
            <Alert variant="warning" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-300">Design Warnings</AlertTitle>
                <AlertDescription>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        {warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                        ))}
                    </ul>
                </AlertDescription>
            </Alert>

            {!valid && valid !== undefined && (
                <div className="flex items-center p-3 text-sm rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                    <Info className="h-4 w-4 mr-2" />
                    <span>This configuration is currently marked as invalid.</span>
                </div>
            )}
        </div>
    );
}
