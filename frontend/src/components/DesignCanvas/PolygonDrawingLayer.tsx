"use client";

import { useState, useEffect, useCallback } from "react";
import { useMapEvents, Polyline, Polygon, Marker } from "react-leaflet";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { useUpdateSiteDesignMutation, useSiteDesignQuery } from "@/hooks/useSiteDesigns";
import { validatePolygon } from "@/lib/geojsonValidation";
import { toast } from "@/lib/toast";
import { GeoJSONPolygon, SiteType } from "@/types";
import L from "leaflet";

interface PolygonDrawingLayerProps {
    designId: string;
}

/**
 * PolygonDrawingLayer
 * Handles the interactive drawing of site boundaries and exclusion zones.
 */
export default function PolygonDrawingLayer({ designId }: PolygonDrawingLayerProps) {
    const mode = useDesignCanvasStore((state) => state.mode);
    const selectedTool = useDesignCanvasStore((state) => state.selectedTool);
    const setMode = useDesignCanvasStore((state) => state.setMode);
    const setSelectedTool = useDesignCanvasStore((state) => state.setSelectedTool);
    const hasEquipmentSelected = useDesignCanvasStore((state) => state.hasEquipmentSelected);
    const setSyncState = useDesignCanvasStore((state) => state.setSyncState);
    const { data: design } = useSiteDesignQuery(designId);
    const updateMutation = useUpdateSiteDesignMutation(designId);

    const [vertices, setVertices] = useState<[number, number][]>([]);
    const [mousePos, setMousePos] = useState<[number, number] | null>(null);

    // Reset state when tool or mode changes
    useEffect(() => {
        if (mode !== 'draw') {
            setVertices([]);
            setMousePos(null);
        }
    }, [mode, selectedTool]);

    const completeDrawing = useCallback(() => {
        if (vertices.length < 3) {
            toast.error("Drawing must have at least 3 points.");
            return;
        }

        // Convert Leaflet [lat, lng] to GeoJSON [lng, lat]
        const geojsonCoordinates = [...vertices, vertices[0]].map(([lat, lng]) => [lng, lat]);

        const newPolygon: GeoJSONPolygon = {
            type: 'Polygon',
            coordinates: [geojsonCoordinates]
        };

        const validation = validatePolygon(newPolygon);
        if (!validation.isValid) {
            toast.error(validation.error || "Invalid polygon geometry.");
            return;
        }

        // Prepare update data based on tool
        const updateData: any = {};

        if (selectedTool === 'exclusion') {
            const currentExclusions = design?.exclusion_zones || [];
            updateData.exclusion_zones = [...currentExclusions, newPolygon];
        } else {
            updateData.site_boundary = newPolygon;
            // Map tool to site type
            const toolToType: Record<string, SiteType> = {
                'roof': 'rooftop',
                'ground': 'ground_mount',
                'carport': 'carport'
            };
            if (selectedTool && toolToType[selectedTool]) {
                updateData.site_type = toolToType[selectedTool];
            }
        }

        setSyncState('pending');
        updateMutation.mutate(updateData, {
            onSuccess: () => {
                setMode('select');
                setSelectedTool(null);
                setVertices([]);
            }
        });
    }, [vertices, selectedTool, design, updateMutation, setMode, setSelectedTool, setSyncState]);

    // Map Events
    useMapEvents({
        click(e) {
            if (mode !== 'draw' || !hasEquipmentSelected) return;
            setVertices((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
        },
        mousemove(e) {
            if (mode !== 'draw' || vertices.length === 0 || !hasEquipmentSelected) return;
            setMousePos([e.latlng.lat, e.latlng.lng]);
        },
        dblclick(e) {
            if (mode !== 'draw' || !hasEquipmentSelected) return;
            // Prevent map zoom on dblclick when drawing
            L.DomEvent.stopPropagation(e as any);
            completeDrawing();
        }
    });

    // Keyboard Events (Enter to complete, Escape to cancel)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (mode !== 'draw' || !hasEquipmentSelected) return;

            if (e.key === 'Enter') {
                completeDrawing();
            } else if (e.key === 'Escape') {
                setVertices([]);
                setMousePos(null);
                setMode('select');
                setSelectedTool(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, completeDrawing, setMode, setSelectedTool]);

    if (mode !== 'draw' || vertices.length === 0) return null;

    // Line segments for visualization
    const drawingPath = [...vertices];
    if (mousePos) {
        drawingPath.push(mousePos);
    }

    return (
        <>
            {/* The line following the mouse */}
            <Polyline
                positions={drawingPath}
                pathOptions={{
                    color: selectedTool === 'exclusion' ? '#ef4444' : '#3b82f6',
                    dashArray: '5, 10',
                    weight: 2
                }}
            />

            {/* The semi-transparent polygon being formed */}
            {vertices.length >= 3 && (
                <Polygon
                    positions={vertices}
                    pathOptions={{
                        fillColor: selectedTool === 'exclusion' ? '#fecaca' : '#bfdbfe',
                        fillOpacity: 0.3,
                        stroke: false
                    }}
                />
            )}

            {/* Vertices as small circles */}
            {vertices.map((v, i) => (
                <Marker
                    key={i}
                    position={v}
                    icon={L.divIcon({
                        className: 'bg-white border-2 border-primary rounded-full w-2.5 h-2.5 -ml-1.25 -mt-1.25',
                        html: ''
                    })}
                />
            ))}
        </>
    );
}
