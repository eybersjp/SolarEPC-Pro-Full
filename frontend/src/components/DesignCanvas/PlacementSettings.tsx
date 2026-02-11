"use client";

import { useEffect, useCallback } from "react";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { useSiteDesignQuery, useUpdateSiteDesignMutation, useRecalculatePlacementMutation } from "@/hooks/useSiteDesigns";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import { PlacementSettings as IPlacementSettings } from "@/types";
import { Loader2 } from "lucide-react";

interface PlacementSettingsProps {
    designId: string;
}

export function PlacementSettings({ designId }: PlacementSettingsProps) {
    const placementSettings = useDesignCanvasStore((state) => state.placementSettings);
    const setPlacementSettings = useDesignCanvasStore((state) => state.setPlacementSettings);
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);

    // Fetch current design data
    const { data: design } = useSiteDesignQuery(designId);
    const updateMutation = useUpdateSiteDesignMutation(designId);
    const recalculateMutation = useRecalculatePlacementMutation(designId);

    // Initialize local state from DB if not already set
    useEffect(() => {
        const hasDBSettings = design?.placement_settings && Object.keys(design.placement_settings).length > 0;
        const hasStoreSettings = Object.keys(placementSettings).length > 0;

        if (hasDBSettings && !hasStoreSettings) {
            setPlacementSettings(design.placement_settings!);
        }
    }, [design?.id, design?.placement_settings, placementSettings, setPlacementSettings]);

    // Debounced save
    const debouncedSettings = useDebounce(placementSettings, 30000); // 30s debounce for auto-save

    useEffect(() => {
        if (Object.keys(debouncedSettings).length > 0) {
            updateMutation.mutate({
                placement_settings: debouncedSettings as IPlacementSettings
            });
        }
    }, [debouncedSettings]);

    const handleSettingChange = useCallback((key: keyof IPlacementSettings, value: any) => {
        setPlacementSettings({ [key]: value });
        setSyncState('pending');
    }, [setPlacementSettings, setSyncState]);

    const handleRecalculate = () => {
        recalculateMutation.mutate();
    };

    if (!design) return <div className="p-4"><Loader2 className="animate-spin" /></div>;

    const settings = { ...design.placement_settings, ...placementSettings };

    return (
        <div className="space-y-6">
            {/* Azimuth */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="azimuth">Azimuth (°)</Label>
                    <span className="text-sm text-muted-foreground">{settings.azimuth_deg ?? 180}°</span>
                </div>
                <div className="flex gap-4 items-center">
                    <Slider
                        id="azimuth"
                        min={0}
                        max={360}
                        step={1}
                        value={[settings.azimuth_deg ?? 180]}
                        onValueChange={(val) => handleSettingChange('azimuth_deg', val[0])}
                    />
                    <Input
                        type="number"
                        aria-label="Azimuth Input"
                        value={settings.azimuth_deg ?? 180}
                        onChange={(e) => handleSettingChange('azimuth_deg', parseFloat(e.target.value))}
                        className="w-20"
                    />
                </div>
            </div>

            {/* Row Spacing */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="row_spacing">Row Spacing (m)</Label>
                    <span className="text-sm text-muted-foreground">{settings.row_spacing_m ?? 2.5}m</span>
                </div>
                <div className="flex gap-4 items-center">
                    <Slider
                        id="row_spacing"
                        min={0.5}
                        max={10}
                        step={0.1}
                        value={[settings.row_spacing_m ?? 2.5]}
                        onValueChange={(val) => handleSettingChange('row_spacing_m', val[0])}
                    />
                    <Input
                        type="number"
                        aria-label="Row Spacing Input"
                        value={settings.row_spacing_m ?? 2.5}
                        onChange={(e) => handleSettingChange('row_spacing_m', parseFloat(e.target.value))}
                        className="w-20"
                        step="0.1"
                    />
                </div>
            </div>

            {/* Tilt */}
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <Label htmlFor="tilt">Tilt (°)</Label>
                    <span className="text-sm text-muted-foreground">{settings.tilt_deg ?? 20}°</span>
                </div>
                <div className="flex gap-4 items-center">
                    <Slider
                        id="tilt"
                        min={0}
                        max={90}
                        step={1}
                        value={[settings.tilt_deg ?? 20]}
                        onValueChange={(val) => handleSettingChange('tilt_deg', val[0])}
                    />
                    <Input
                        type="number"
                        aria-label="Tilt Input"
                        value={settings.tilt_deg ?? 20}
                        onChange={(e) => handleSettingChange('tilt_deg', parseFloat(e.target.value))}
                        className="w-20"
                    />
                </div>
            </div>

            {/* Orientation */}
            <div className="flex items-center justify-between">
                <Label htmlFor="orientation">Portrait Orientation</Label>
                <Switch
                    id="orientation"
                    checked={settings.module_orientation === 'portrait'}
                    onCheckedChange={(checked) => handleSettingChange('module_orientation', checked ? 'portrait' : 'landscape')}
                />
            </div>

            {/* Recalculate Button */}
            <Button
                onClick={handleRecalculate}
                className="w-full mt-4"
                disabled={recalculateMutation.isPending}
            >
                {recalculateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Recalculate Layout
            </Button>
        </div>
    );
}
