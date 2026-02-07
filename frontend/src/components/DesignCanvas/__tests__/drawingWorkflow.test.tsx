import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PolygonDrawingLayer from '../PolygonDrawingLayer'
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore'
import { renderWithProviders } from '@/test/utils'
import { useMapEvents } from 'react-leaflet'
import { toast } from '@/lib/toast'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'

// Mock react-leaflet's useMapEvents
vi.mock('react-leaflet', async () => {
    const actual = await vi.importActual('react-leaflet')
    return {
        ...actual,
        useMapEvents: vi.fn(),
        Polyline: () => <div data-testid="polyline" />,
        Polygon: () => <div data-testid="polygon" />,
        Marker: () => <div data-testid="marker" />,
    }
})

// Mock toast
vi.mock('@/lib/toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

describe('PolygonDrawingLayer Workflow', () => {
    let mapEvents: any = {}

    beforeEach(() => {
        vi.clearAllMocks()
        // Reset store
        useDesignCanvasStore.setState({
            mode: 'select',
            selectedTool: null,
            selectedGeometry: null,
        })

            // Capture map events
            ; (useMapEvents as any).mockImplementation((events: any) => {
                mapEvents = events
                return null
            })
    })

    it('should allow drawing a polygon and saving it successfully', async () => {
        const user = userEvent.setup()
        useDesignCanvasStore.setState({ mode: 'draw', selectedTool: 'roof' })

        renderWithProviders(<PolygonDrawingLayer designId="design-1" />)

        // Simulate clicking 3 points (valid triangle)
        mapEvents.click({ latlng: { lat: 0, lng: 0 } })
        mapEvents.click({ latlng: { lat: 0, lng: 10 } })
        mapEvents.click({ latlng: { lat: 10, lng: 0 } })

        const markers = await screen.findAllByTestId('marker')
        expect(markers).toHaveLength(3)

        // Complete drawing
        await user.keyboard('{Enter}')

        // Verify success flow
        await waitFor(() => {
            expect(useDesignCanvasStore.getState().mode).toBe('select')
        })
        expect(useDesignCanvasStore.getState().selectedTool).toBeNull()
        expect(toast.success).toHaveBeenCalledWith('Design saved')
    })

    it('should block save if polygon is self-intersecting', async () => {
        const user = userEvent.setup()
        useDesignCanvasStore.setState({ mode: 'draw', selectedTool: 'roof' })

        renderWithProviders(<PolygonDrawingLayer designId="design-1" />)

        // Create a figure-8 (self-intersecting)
        mapEvents.click({ latlng: { lat: 0, lng: 0 } })
        mapEvents.click({ latlng: { lat: 10, lng: 10 } })
        mapEvents.click({ latlng: { lat: 0, lng: 10 } })
        mapEvents.click({ latlng: { lat: 10, lng: 0 } })

        await user.keyboard('{Enter}')

        // Verify blocked flow
        expect(toast.error).toHaveBeenCalledWith('Polygon cannot self-intersect (no overlapping loops).')
        expect(useDesignCanvasStore.getState().mode).toBe('draw') // mode preserved
    })

    it('should handle API failure during save', async () => {
        const user = userEvent.setup()
        server.use(
            http.put('*/api/site-designs/:id', () => {
                return new HttpResponse(null, { status: 500 })
            })
        )

        useDesignCanvasStore.setState({ mode: 'draw', selectedTool: 'roof' })

        renderWithProviders(<PolygonDrawingLayer designId="design-1" />)

        mapEvents.click({ latlng: { lat: 0, lng: 0 } })
        mapEvents.click({ latlng: { lat: 0, lng: 10 } })
        mapEvents.click({ latlng: { lat: 10, lng: 0 } })

        await user.keyboard('{Enter}')

        // Wait for failure
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalled()
        })

        // Verify state was NOT reset on failure
        expect(useDesignCanvasStore.getState().mode).toBe('draw')
    })

    it('should show error if drawing has less than 3 points', async () => {
        const user = userEvent.setup()
        useDesignCanvasStore.setState({ mode: 'draw', selectedTool: 'roof' })

        renderWithProviders(<PolygonDrawingLayer designId="design-1" />)

        // Click only 2 points
        mapEvents.click({ latlng: { lat: 0, lng: 0 } })
        mapEvents.click({ latlng: { lat: 0, lng: 10 } })

        await user.keyboard('{Enter}')

        expect(toast.error).toHaveBeenCalledWith('Drawing must have at least 3 points.')
        expect(useDesignCanvasStore.getState().mode).toBe('draw') // Stayed in draw mode
    })

    it('should cancel drawing on Escape key', async () => {
        const user = userEvent.setup()
        useDesignCanvasStore.setState({ mode: 'draw', selectedTool: 'roof' })

        renderWithProviders(<PolygonDrawingLayer designId="design-1" />)

        mapEvents.click({ latlng: { lat: 0, lng: 0 } })

        await user.keyboard('{Escape}')

        expect(useDesignCanvasStore.getState().mode).toBe('select')
        expect(useDesignCanvasStore.getState().selectedTool).toBeNull()
    })
})
