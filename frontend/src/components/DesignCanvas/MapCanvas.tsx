"use client";

import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import { TILE_LAYERS, DEFAULT_MAP_CONFIG } from "@/lib/mapConfig";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { useEffect, useRef } from "react";
import L from "leaflet";
import PolygonDrawingLayer from "./PolygonDrawingLayer";
import GeometryLayer from "./GeometryLayer";
import PolygonEditLayer from "./PolygonEditLayer";
import StatsBadge from "./StatsBadge";
import PlacementLoadingOverlay from "./PlacementLoadingOverlay";
import { usePlacementMonitor } from "@/hooks/usePlacementMonitor";

interface MapCanvasProps {
    center: [number, number];
    tenderId: string;
    designId: string;
}

/**
 * MapCanvas Component
 * Renders the satellite map for solar design.
 * 
 * Consumes design mode and selected tool from useDesignCanvasStore
 * to eventually support drawing and interaction.
 */
export default function MapCanvas({ center, tenderId, designId }: MapCanvasProps) {
    const mode = useDesignCanvasStore((state) => state.mode);
    const selectedTool = useDesignCanvasStore((state) => state.selectedTool);
    const mapRef = useRef<L.Map | null>(null);

    // Monitor placement task status and fetch design data
    const { design } = usePlacementMonitor(designId);

    // Update map center if it changes prop-wise
    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.setView(center, mapRef.current.getZoom());
        }
    }, [center]);

    return (
        <div className="w-full h-full relative overflow-hidden rounded-lg shadow-inner">
            <MapContainer
                center={center}
                zoom={DEFAULT_MAP_CONFIG.defaultZoom}
                minZoom={DEFAULT_MAP_CONFIG.minZoom}
                maxZoom={DEFAULT_MAP_CONFIG.maxZoom}
                scrollWheelZoom={true}
                dragging={true}
                doubleClickZoom={mode !== 'draw'} // Disable double click zoom while drawing
                zoomControl={false}
                style={{ height: "100%", width: "100%", background: "#0f172a" }}
                ref={mapRef}
            >
                <TileLayer
                    url={TILE_LAYERS.satellite.url}
                    attribution={TILE_LAYERS.satellite.attribution}
                    maxNativeZoom={19}
                    maxZoom={20}
                />

                <ZoomControl position="bottomright" />

                {/* Interactive Layers */}
                <GeometryLayer designId={designId} />
                <PolygonDrawingLayer designId={designId} />
                <PolygonEditLayer designId={designId} />

                {/* UI Overlays */}
                <StatsBadge
                    totalModules={design?.total_modules ?? 0}
                    systemSizeKwp={design?.system_size_kwp ?? 0}
                    loading={!design}
                />

                <PlacementLoadingOverlay />

                {/* Status Indicator (Debug/Preview) */}
                <div className="absolute top-4 left-4 z-[400] bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[10px] font-medium tracking-wider uppercase border border-white/10 shadow-xl pointer-events-none">
                    <span className="opacity-60 mr-2">Mode:</span> {mode}
                    {selectedTool && (
                        <>
                            <span className="mx-2 opacity-20">|</span>
                            <span className="opacity-60 mr-2">Tool:</span> {selectedTool}
                        </>
                    )}
                </div>
            </MapContainer>
        </div>
    );
}
