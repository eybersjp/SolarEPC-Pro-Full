"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUpdatePreconditions } from '@/lib/hooks/usePreconditions';
import type { Precondition } from '@/types';
import { CheckCircle2, XCircle, Info, Loader2 } from 'lucide-react';

interface PreconditionsChecklistProps {
    tenderId: string;
    precondition: Precondition;
}

export function PreconditionsChecklist({ tenderId, precondition }: PreconditionsChecklistProps) {
    const updateMutation = useUpdatePreconditions(tenderId);
    const [formData, setFormData] = React.useState(precondition);

    React.useEffect(() => {
        setFormData(precondition);
    }, [precondition]);

    const handleCheckboxChange = (field: keyof Precondition, checked: boolean) => {
        const newData = { ...formData, [field]: checked };
        setFormData(newData);
    };

    const handleSave = () => {
        updateMutation.mutate({
            grid_connection: formData.grid_connection,
            land_access: formData.land_access,
            permits_cleared: formData.permits_cleared,
            financing_confirmed: formData.financing_confirmed,
            go_decision: formData.go_decision,
            notes: formData.notes || undefined,
        });
    };

    const isGo = formData.go_decision;

    return (
        <Card className="w-full border-none shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
                <div>
                    <CardTitle className="text-xl font-bold">Go/No-Go Preconditions</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        Critical items required to proceed with this tender.
                    </p>
                </div>
                <Badge
                    variant={isGo ? "success" : "destructive"}
                    className="text-xs px-4 py-1.5 font-bold tracking-wider"
                >
                    {isGo ? "GO DECISION" : "NO-GO STATUS"}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start space-x-4 rounded-xl border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/50">
                        <Checkbox
                            id="grid_connection"
                            checked={formData.grid_connection}
                            onCheckedChange={(checked) => handleCheckboxChange('grid_connection', !!checked)}
                            className="mt-1"
                        />
                        <div className="space-y-1">
                            <Label htmlFor="grid_connection" className="text-sm font-semibold cursor-pointer">Grid Connection Confirmed</Label>
                            <p className="text-xs text-muted-foreground">Utility has confirmed capacity and connection point.</p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4 rounded-xl border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/50">
                        <Checkbox
                            id="land_access"
                            checked={formData.land_access}
                            onCheckedChange={(checked) => handleCheckboxChange('land_access', !!checked)}
                            className="mt-1"
                        />
                        <div className="space-y-1">
                            <Label htmlFor="land_access" className="text-sm font-semibold cursor-pointer">Land Access Secured</Label>
                            <p className="text-xs text-muted-foreground">LOI or Lease agreement signed with land owner.</p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4 rounded-xl border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/50">
                        <Checkbox
                            id="permits_cleared"
                            checked={formData.permits_cleared}
                            onCheckedChange={(checked) => handleCheckboxChange('permits_cleared', !!checked)}
                            className="mt-1"
                        />
                        <div className="space-y-1">
                            <Label htmlFor="permits_cleared" className="text-sm font-semibold cursor-pointer">Permits Cleared</Label>
                            <p className="text-xs text-muted-foreground">Environmental and local authority permits obtained.</p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-4 rounded-xl border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/50">
                        <Checkbox
                            id="financing_confirmed"
                            checked={formData.financing_confirmed}
                            onCheckedChange={(checked) => handleCheckboxChange('financing_confirmed', !!checked)}
                            className="mt-1"
                        />
                        <div className="space-y-1">
                            <Label htmlFor="financing_confirmed" className="text-sm font-semibold cursor-pointer">Financing Confirmed</Label>
                            <p className="text-xs text-muted-foreground">Internal or external funding source secured.</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label htmlFor="notes" className="text-sm font-semibold">Assessment Notes</Label>
                    <Textarea
                        id="notes"
                        placeholder="Provide details on the status of these preconditions..."
                        value={formData.notes || ''}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        className="min-h-[120px] bg-background/50 border-border/50 focus:border-primary/50"
                    />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-5">
                    <div className="space-y-1">
                        <Label className="text-base font-bold">Final Project Stand</Label>
                        <p className="text-xs text-muted-foreground max-w-md">
                            Manually set the final decision. Green indicates "GO" to move to PV Design and Pricing stages.
                        </p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className={cn("text-xs font-bold uppercase tracking-tighter", isGo ? "text-success" : "text-danger")}>
                            {isGo ? "Go" : "No-Go"}
                        </span>
                        <Switch
                            checked={formData.go_decision}
                            onCheckedChange={(checked) => setFormData({ ...formData, go_decision: checked })}
                        />
                    </div>
                </div>

                {precondition.blockers && precondition.blockers.length > 0 && (
                    <Alert variant="warning" className="border-warning/30 bg-warning/5">
                        <Info className="h-4 w-4" />
                        <AlertTitle className="text-sm font-bold">Incomplete Prerequisites</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc list-inside text-xs mt-2 space-y-1 text-muted-foreground">
                                {precondition.blockers.map((blocker, i) => (
                                    <li key={i}>{blocker}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t border-border/50 pt-6">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                    Last updated: {new Date().toLocaleDateString()}
                </p>
                <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="px-8"
                >
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Assessment
                </Button>
            </CardFooter>
        </Card>
    );
}
