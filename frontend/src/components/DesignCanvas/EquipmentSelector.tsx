import React, { useEffect } from "react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { useEquipmentModulesQuery, useEquipmentInvertersQuery } from "@/hooks/useEquipment";
import { useSiteDesignQuery, useUpdateSiteDesignMutation } from "@/hooks/useSiteDesigns";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Loader2 } from "lucide-react";

interface EquipmentSelectorProps {
    designId: string;
}

export function EquipmentSelector({ designId }: EquipmentSelectorProps) {
    const { data: design, isLoading: isLoadingDesign } = useSiteDesignQuery(designId);
    const { data: modules, isLoading: isLoadingModules, error: moduleError } = useEquipmentModulesQuery();
    const { data: inverters, isLoading: isLoadingInverters, error: inverterError } = useEquipmentInvertersQuery();
    const updateMutation = useUpdateSiteDesignMutation(designId);
    const setEquipmentSelection = useDesignCanvasStore((state) => state.setEquipmentSelection);

    useEffect(() => {
        setEquipmentSelection(design?.equipment_module_id ?? null, design?.equipment_inverter_id ?? null);
    }, [design?.equipment_module_id, design?.equipment_inverter_id, setEquipmentSelection]);

    const handleModuleChange = (moduleId: string) => {
        updateMutation.mutate({ equipment_module_id: moduleId });
    };

    const handleInverterChange = (inverterId: string) => {
        updateMutation.mutate({ equipment_inverter_id: inverterId });
    };

    if (isLoadingDesign || isLoadingModules || isLoadingInverters) {
        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        );
    }

    if (moduleError || inverterError) {
        return (
            <Alert variant="destructive">
                <AlertDescription>
                    Failed to load equipment data. Please try again.
                </AlertDescription>
            </Alert>
        );
    }

    const selectedModule = modules?.find((m) => m.id === design?.equipment_module_id);
    const selectedInverter = inverters?.find((i) => i.id === design?.equipment_inverter_id);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="module-select">Solar Module</Label>
                    {updateMutation.isPending && updateMutation.variables?.equipment_module_id && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                </div>
                <Select
                    value={design?.equipment_module_id || ""}
                    onValueChange={handleModuleChange}
                    disabled={updateMutation.isPending}
                >
                    <SelectTrigger id="module-select">
                        <SelectValue placeholder="Select a module" />
                    </SelectTrigger>
                    <SelectContent>
                        {modules?.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                                {m.manufacturer} {m.model} ({m.wattage}W)
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedModule && (
                    <div className="bg-slate-50 p-2 rounded-md border text-[10px] space-y-1 mt-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Wattage:</span>
                            <span>{selectedModule.wattage}W</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Efficiency:</span>
                            <span>{selectedModule.efficiency}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Dimensions:</span>
                            <span>{selectedModule.length_m}m x {selectedModule.width_m}m</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="inverter-select">Inverter</Label>
                    {updateMutation.isPending && updateMutation.variables?.equipment_inverter_id && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                </div>
                <Select
                    value={design?.equipment_inverter_id || ""}
                    onValueChange={handleInverterChange}
                    disabled={updateMutation.isPending}
                >
                    <SelectTrigger id="inverter-select">
                        <SelectValue placeholder="Select an inverter" />
                    </SelectTrigger>
                    <SelectContent>
                        {inverters?.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                                {i.manufacturer} {i.model} ({i.capacity_kw}kW)
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedInverter && (
                    <div className="bg-slate-50 p-2 rounded-md border text-[10px] space-y-1 mt-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Capacity:</span>
                            <span>{selectedInverter.capacity_kw}kW</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">MPPT Channels:</span>
                            <span>{selectedInverter.num_mppt_channels}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Max DC Voltage:</span>
                            <span>{selectedInverter.max_dc_voltage}V</span>
                        </div>
                    </div>
                )}
            </div>

            {!selectedModule && !selectedInverter && (
                <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-blue-50/50 p-2 rounded-md border border-blue-100">
                    <InfoIcon className="h-3 w-3 mt-0.5 text-blue-500" />
                    <p>Select equipment to proceed with placement calculations.</p>
                </div>
            )}
        </div>
    );
}
