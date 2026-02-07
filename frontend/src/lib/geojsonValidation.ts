import * as turf from '@turf/turf';
import { GeoJSONPolygon } from '@/types';

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validates a GeoJSON Polygon for basic geometric constraints.
 * 
 * @param polygon The GeoJSON Polygon to validate.
 * @returns {ValidationResult} Result object with validity and optional error message.
 */
export function validatePolygon(polygon: GeoJSONPolygon): ValidationResult {
    try {
        // 1. Basic Structure Check
        if (!polygon || polygon.type !== 'Polygon' || !polygon.coordinates) {
            return { isValid: false, error: 'Invalid polygon structure.' };
        }

        const coords = polygon.coordinates[0]; // Outer ring

        // 2. Minimum Points Check
        // A valid polygon needs at least 3 distinct vertices plus the closure point (total 4)
        if (coords.length < 4) {
            return { isValid: false, error: 'Polygon must have at least 3 points.' };
        }

        // 3. Closure Check (Turf handle this usually, but good to be explicit)
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            return { isValid: false, error: 'Polygon must be closed (start and end points must match).' };
        }

        // 4. Self-Intersection Check (Kinks)
        const kinks = turf.kinks(polygon as any);
        if (kinks.features.length > 0) {
            return { isValid: false, error: 'Polygon cannot self-intersect (no overlapping loops).' };
        }

        // 5. Area Check
        const area = turf.area(polygon);
        if (area <= 0) {
            return { isValid: false, error: 'Polygon must have a positive area.' };
        }

        return { isValid: true };
    } catch (error) {
        console.error('Polygon validation error:', error);
        return { isValid: false, error: 'An error occurred during validation.' };
    }
}
