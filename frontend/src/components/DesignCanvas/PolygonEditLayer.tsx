"use client";

import { useState, useEffect, useCallback } from "react";
import { Marker, Polyline, useMap } from "react-leaflet";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { useSiteDesignQuery, useUpdateSiteDesignMutation } from "@/hooks/useSiteDesigns";
import { validatePolygon } from "@/lib/geojsonValidation";
import { GeoJSONPolygon } from "@/types";
import L from "leaflet";
import { toast } from "@/lib/toast";

interface PolygonEditLayerProps {
    designId: string;
}

/**
 * PolygonEditLayer
 * Handles interactive vertex editing for the selected polygon.
 */
export default function PolygonEditLayer({ designId }: PolygonEditLayerProps) {
    const { mode, selectedGeometry, setSelectedGeometry } = useDesignCanvasStore();
    const { data: design } = useSiteDesignQuery(designId);
    const updateMutation = useUpdateSiteDesignMutation(designId);
    const map = useMap();

    // Local state for vertices being edited [lat, lng]
    const [vertices, setVertices] = useState<[number, number][]>([]);
    const [originalVertices, setOriginalVertices] = useState<[number, number][]>([]);

    // Initialize vertices when selection changes
    useEffect(() => {
        if (!design || !selectedGeometry || mode !== 'edit') {
            setVertices([]);
            setOriginalVertices([]);
            return;
        }

        let polygon: GeoJSONPolygon | null = null;
        if (selectedGeometry.type === 'boundary') {
            polygon = design.site_boundary;
        } else if (selectedGeometry.type === 'exclusion' && selectedGeometry.index !== undefined) {
            polygon = design.exclusion_zones?.[selectedGeometry.index] || null;
        }

        if (polygon && polygon.coordinates.length > 0) {
            // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
            // We ignore the last point (which is same as first in GeoJSON) for easier editing
            const coords = polygon.coordinates[0].slice(0, -1).map(c => [c[1], c[0]] as [number, number]);
            setVertices(coords);
            setOriginalVertices(coords);
        } else {
            setVertices([]);
            setOriginalVertices([]);
        }
    }, [selectedGeometry, design, mode]);

    // Save changes to backend
    const saveChanges = useCallback(async (newVertices: [number, number][]) => {
        if (!design || !selectedGeometry) return;

        // Convert back to GeoJSON [lng, lat] and close the loop
        const geojsonCoords = [...newVertices, newVertices[0]].map(v => [v[1], v[0]]);
        const newPolygon: GeoJSONPolygon = {
            type: 'Polygon',
            coordinates: [geojsonCoords]
        };

        // Validate
        const validation = validatePolygon(newPolygon);
        if (!validation.isValid) {
            toast.error(validation.error || "Invalid geometry");
            // Rollback visual state
            setVertices(originalVertices);
            return;
        }

        try {
            if (selectedGeometry.type === 'boundary') {
                await updateMutation.mutateAsync({ site_boundary: newPolygon });
            } else if (selectedGeometry.type === 'exclusion' && selectedGeometry.index !== undefined) {
                const newExclusions = [...(design.exclusion_zones || [])];
                newExclusions[selectedGeometry.index] = newPolygon;
                await updateMutation.mutateAsync({ exclusion_zones: newExclusions });
            }
            // Update original vertices on success
            setOriginalVertices(newVertices);
        } catch (error) {
            // Rollback on server error
            setVertices(originalVertices);
            console.error("Failed to save edited polygon:", error);
        }
    }, [design, selectedGeometry, updateMutation, originalVertices]);

    if (mode !== 'edit' || !selectedGeometry || vertices.length === 0) return null;

    // Create a custom icon for vertex handles
    const vertexIcon = L.divIcon({
        className: 'bg-white border-2 border-yellow-500 rounded-full w-3 h-3 -ml-1.5 -mt-1.5 shadow-md hover:scale-125 transition-transform',
        html: ''
    });

    return (
        <>
            {/* 1. Visual outline of the polygon during edit */}
            <Polyline
                positions={[...vertices, vertices[0]]}
                pathOptions={{
                    color: "#facc15",
                    weight: 3,
                    dashArray: "5, 5",
                    opacity: 0.8
                }}
            />

            {/* 2. Draggable vertex handles */}
            {vertices.map((vertex, idx) => (
                <Marker
                    key={`vertex-${idx}`}
                    position={vertex}
                    icon={vertexIcon}
                    draggable={true}
                    eventHandlers={{
                        drag: (e) => {
                            const marker = e.target;
                            const position = marker.getLatLng();
                            setVertices(prev => {
                                const next = [...prev];
                                next[idx] = [position.lat, position.lng];
                                return next;
                            });
                        },
                        dragend: () => {
                            saveChanges(vertices);
                        }
                    }}
                />
            ))}
        </>
    );
}
