"use client";

import { useState } from "react";
import { Polygon, GeoJSON } from "react-leaflet";
import { useSiteDesignQuery } from "@/hooks/useSiteDesigns";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GeoJSONPolygon } from "@/types";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import L from "leaflet";

interface GeometryLayerProps {
    designId: string;
}

/**
 * GeometryLayer
 * Renders existing site boundaries, exclusion zones, and module placements.
 * Includes a small visibility toggle panel.
 */
export default function GeometryLayer({ designId }: GeometryLayerProps) {
    const { data: design } = useSiteDesignQuery(designId);
    const { mode, selectedGeometry, setSelectedGeometry } = useDesignCanvasStore();

    // Local visibility state
    const [showBoundary, setShowBoundary] = useState(true);
    const [showExclusions, setShowExclusions] = useState(true);
    const [showModules, setShowModules] = useState(true);

    if (!design) return null;

    // Helper to convert GeoJSON Polygon coordinates to Leaflet [lat, lng]
    const polygonToLatLng = (polygon: GeoJSONPolygon): [number, number][] => {
        if (!polygon || !polygon.coordinates || polygon.coordinates.length === 0) return [];
        return polygon.coordinates[0].map(coord => [coord[1], coord[0]]);
    };

    const isSelected = (type: 'boundary' | 'exclusion', index?: number) => {
        if (!selectedGeometry) return false;
        return selectedGeometry.type === type && selectedGeometry.index === index;
    };

    return (
        <>
            {/* 1. Site Boundary */}
            {showBoundary && design.site_boundary && (
                <Polygon
                    positions={polygonToLatLng(design.site_boundary)}
                    eventHandlers={{
                        click: () => {
                            if (mode === 'edit') {
                                setSelectedGeometry({ type: 'boundary' });
                            }
                        }
                    }}
                    pathOptions={{
                        color: isSelected('boundary') ? "#facc15" : "#3b82f6", // Yellow if selected
                        weight: isSelected('boundary') ? 5 : 3,
                        fillColor: "#3b82f6",
                        fillOpacity: 0.1,
                        className: mode === 'edit' ? "cursor-pointer" : ""
                    }}
                />
            )}

            {/* 2. Exclusion Zones */}
            {showExclusions && design.exclusion_zones?.map((zone, idx) => (
                <Polygon
                    key={`excl-${idx}`}
                    positions={polygonToLatLng(zone)}
                    eventHandlers={{
                        click: () => {
                            if (mode === 'edit') {
                                setSelectedGeometry({ type: 'exclusion', index: idx });
                            }
                        }
                    }}
                    pathOptions={{
                        color: isSelected('exclusion', idx) ? "#facc15" : "#ef4444", // Yellow if selected
                        weight: isSelected('exclusion', idx) ? 4 : 2,
                        fillColor: "#ef4444",
                        fillOpacity: 0.3,
                        dashArray: isSelected('exclusion', idx) ? "" : "5, 10",
                        className: mode === 'edit' ? "cursor-pointer" : ""
                    }}
                />
            ))}

            {/* 3. Module Placements (GeoJSON Features) */}
            {showModules && design.module_placements?.length > 0 && (
                <GeoJSON
                    key={`design-modules-${design.updated_at}`}
                    data={{
                        type: "FeatureCollection",
                        features: design.module_placements
                    } as any}
                    style={{
                        color: "#0d9488", // Teal
                        weight: 1,
                        fillColor: "#2dd4bf",
                        fillOpacity: 0.6,
                    }}
                />
            )}

            {/* Visibility Controls Panel */}
            <div
                className="absolute bottom-24 left-6 z-[500] bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/10 flex flex-col gap-4 min-w-[180px] pointer-events-auto"
            >
                <div className="flex items-center gap-2 mb-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Layer Management</span>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between group">
                        <Label htmlFor="toggle-boundary" className="text-xs font-semibold text-slate-200 cursor-pointer group-hover:text-white transition-colors">Site Boundary</Label>
                        <Switch
                            id="toggle-boundary"
                            checked={showBoundary}
                            onCheckedChange={setShowBoundary}
                            className="bg-slate-700 data-[state=checked]:bg-blue-500 scale-90"
                        />
                    </div>

                    <div className="flex items-center justify-between group">
                        <Label htmlFor="toggle-exclusions" className="text-xs font-semibold text-slate-200 cursor-pointer group-hover:text-white transition-colors">Exclusion Zones</Label>
                        <Switch
                            id="toggle-exclusions"
                            checked={showExclusions}
                            onCheckedChange={setShowExclusions}
                            className="bg-slate-700 data-[state=checked]:bg-red-500 scale-90"
                        />
                    </div>

                    <div className="flex items-center justify-between group">
                        <Label htmlFor="toggle-modules" className="text-xs font-semibold text-slate-200 cursor-pointer group-hover:text-white transition-colors">PV Modules</Label>
                        <Switch
                            id="toggle-modules"
                            checked={showModules}
                            onCheckedChange={setShowModules}
                            className="bg-slate-700 data-[state=checked]:bg-teal-500 scale-90"
                        />
                    </div>
                </div>

                <div className="pt-2 border-t border-white/5">
                    <div className="text-[9px] text-slate-500 font-medium">
                        Displaying {design.total_modules || 0} modules
                    </div>
                </div>
            </div>
        </>
    );
}
