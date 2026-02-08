// @ts-ignore
import * as turf from '@turf/turf';
import { LatLngBoundsExpression } from 'leaflet';

/**
 * Default map configuration settings.
 */
export const DEFAULT_MAP_CONFIG = {
    center: [25.0, 45.0] as [number, number], // Central Saudi Arabia
    minZoom: 3,
    maxZoom: 20,
    defaultZoom: 13,
};

/**
 * Tile layer types supported by the application.
 */
export type TileLayerType = 'standard' | 'satellite';

/**
 * Configuration for map tile layers.
 */
export const TILE_LAYERS = {
    standard: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    satellite: {
        // Using Esri World Imagery as a reliable satellite source
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community',
    },
};

/**
 * Selects the tile layer configuration based on the type.
 * @param type The type of tile layer ('standard' or 'satellite').
 * @returns The tile layer configuration.
 */
export function selectTileLayerByType(type: TileLayerType = 'standard') {
    return TILE_LAYERS[type] || TILE_LAYERS.standard;
}

/**
 * Derives Leaflet-compatible bounds from a GeoJSON object.
 * @param geojson The GeoJSON object (Polygon, MultiPolygon, etc.).
 * @returns Leaflet LatLngBoundsExpression or null if invalid.
 */
export function deriveBoundsFromGeoJSON(geojson: any): LatLngBoundsExpression | null {
    if (!geojson) return null;

    try {
        const bbox = turf.bbox(geojson);
        // turf.bbox returns [minX, minY, maxX, maxY] (West, South, East, North)
        // Leaflet LatLngBounds needs [[south, west], [north, east]]
        return [
            [bbox[1], bbox[0]],
            [bbox[3], bbox[2]],
        ];
    } catch (error) {
        console.error('Error deriving bounds from GeoJSON:', error);
        return null;
    }
}
