import { describe, it, expect } from 'vitest'
import { validatePolygon } from '../geojsonValidation'
import {
    createValidPolygon,
    createInvalidPolygon,
    createSelfIntersectingPolygon,
} from '../../test/factories/geojson'

describe('validatePolygon', () => {
    it('should return isValid: true for a valid polygon', () => {
        const polygon = createValidPolygon()
        const result = validatePolygon(polygon)
        expect(result.isValid).toBe(true)
        expect(result.error).toBeUndefined()
    })

    it('should return isValid: false for invalid structure', () => {
        // @ts-ignore
        const result = validatePolygon({ type: 'Point', coordinates: [0, 0] })
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Invalid polygon structure.')
    })

    it('should return isValid: false for missing coordinates', () => {
        // @ts-ignore
        const result = validatePolygon({ type: 'Polygon' })
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Invalid polygon structure.')
    })

    it('should return isValid: false for too few points', () => {
        const polygon = createInvalidPolygon('too_few_points')
        const result = validatePolygon(polygon)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Polygon must have at least 3 points.')
    })

    it('should return isValid: false for unclosed polygon', () => {
        const polygon = createInvalidPolygon('unclosed')
        const result = validatePolygon(polygon)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Polygon must be closed (start and end points must match).')
    })

    it('should return isValid: false for zero area polygon', () => {
        const polygon = {
            type: 'Polygon' as const,
            coordinates: [
                [
                    [0, 0],
                    [0, 0],
                    [0, 0],
                    [0, 0],
                ],
            ],
        }
        const result = validatePolygon(polygon)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Polygon must have a positive area.')
    })

    it('should return isValid: false for self-intersecting polygon', () => {
        const polygon = createSelfIntersectingPolygon()
        const result = validatePolygon(polygon)
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Polygon cannot self-intersect (no overlapping loops).')
    })

    it('should catch errors and return a generic error message', () => {
        // @ts-ignore
        const result = validatePolygon({ type: 'Polygon', coordinates: null })
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('An error occurred during validation.')
    })
})
