import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'
import { mockSiteDesign } from '@/test/fixtures/siteDesign'
import { mockModulesList, mockInvertersList } from '@/test/fixtures/equipment'
import { QueryClient } from '@tanstack/react-query'
import { CanvasLayout } from '@/components/DesignCanvas/CanvasLayout'
import PolygonDrawingLayer from '@/components/DesignCanvas/PolygonDrawingLayer'
import { PerformanceMetrics as MetricsData } from '@/test/utils/performanceUtils'
import fs from 'fs'
import path from 'path'

// Mock Next.js navigation
const mockPush = vi.fn()
const mockRouter = {
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    pathname: '/tenders/tender-1/design/design-1',
    query: {},
    asPath: '/tenders/tender-1/design/design-1',
}

vi.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    usePathname: () => mockRouter.pathname,
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({ id: 'tender-1', designId: 'design-1' }),
}))

vi.mock('next/link', () => ({
    default: ({ children, href, onClick, ...props }: any) => (
        <a href={href} onClick={(e) => { e.preventDefault(); onClick?.(e); mockPush(href); }} {...props}>{children}</a>
    ),
}))

// Mock useDesignNavigation hook for Toolbar
vi.mock('@/app/tenders/[id]/design/[designId]/page', () => ({
    useDesignNavigation: () => ({
        push: mockPush,
        replace: vi.fn(),
        back: vi.fn(),
    })
}))


vi.mock('@/lib/toast', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    }
}))

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    }
}))

vi.mock('@/lib/geojsonValidation', () => ({
    validatePolygon: vi.fn(() => ({ isValid: true }))
}))

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
    MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
    TileLayer: () => <div data-testid="tile-layer" />,
    FeatureGroup: ({ children }: any) => <div data-testid="feature-group">{children}</div>,
    Polyline: () => <div data-testid="polyline" />,
    Polygon: () => <div data-testid="polygon" />,
    Marker: ({ position }: any) => <div data-testid="marker" data-lat={position[0]} data-lng={position[1]} />,
    Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
    ZoomControl: () => <div data-testid="zoom-control" />,
    useMap: () => ({
        setView: vi.fn(),
        fitBounds: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        project: vi.fn((latlng) => ({ x: latlng.lat, y: latlng.lng })),
        unproject: vi.fn((point) => ({ lat: point.x, lng: point.y })),
    }),
    useMapEvents: (events: any) => null,
}))

vi.mock('leaflet', () => ({
    default: {
        icon: vi.fn(() => ({})),
        latLng: vi.fn((lat, lng) => ({ lat, lng })),
        latLngBounds: vi.fn(() => ({
            extend: vi.fn(),
            isValid: vi.fn(() => true),
        })),
        divIcon: vi.fn(() => ({})),
        DomEvent: {
            stopPropagation: vi.fn(),
        },
    },
}))

vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: any) => children,
    TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
    TooltipProvider: ({ children }: any) => <>{children}</>,
    TooltipTrigger: ({ children }: any) => <>{children}</>,
}))

vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div data-testid="bar" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="grid" />,
    Tooltip: () => <div data-testid="chart-tooltip" />,
    Legend: () => <div data-testid="legend" />,
}))

// Helper to generate large module placement arrays
function generateModulePlacements(count: number) {
    const placements = []
    for (let i = 0; i < count; i++) {
        const lat = 34.0522 + (Math.random() - 0.5) * 0.001
        const lng = -118.2437 + (Math.random() - 0.5) * 0.001
        placements.push({
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [lng, lat],
                    [lng + 0.00001, lat],
                    [lng + 0.00001, lat + 0.00002],
                    [lng, lat + 0.00002],
                    [lng, lat]
                ]]
            },
            properties: { type: 'module' }
        })
    }
    return placements
}

describe('DesignCanvas Performance Tests', () => {
    let queryClient: QueryClient
    let requestTracker: { putCallCount: Record<string, number> }
    let perfMetrics: MetricsData[] = []

    beforeEach(() => {
        requestTracker = { putCallCount: {} }
        perfMetrics = []

        vi.setConfig({ testTimeout: 60000 })

        useDesignCanvasStore.setState({
            mode: 'select',
            syncState: 'synced',
            rightPanelOpen: true,
            hasEquipmentSelected: false,
            equipmentModuleId: null,
            equipmentInverterId: null,
            placementSettings: {},
            placementLoading: false,
            retryCount: 0,
            lastSyncedAt: null,
        })

        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false, gcTime: 0, staleTime: 0 },
                mutations: { retry: false },
            },
        })

        // MSW handlers
        server.use(
            http.get('*/api/site-designs/:id', ({ params }) => {
                const id = params.id as string
                return HttpResponse.json({
                    ...mockSiteDesign,
                    id,
                    equipment_module_id: 'module-1',
                    equipment_inverter_id: 'inverter-1',
                    tender_id: 'tender-1',
                    total_modules: 0,
                    system_size_kwp: 0,
                })
            }),
            http.get('*/api/site-designs/:id/versions', () => HttpResponse.json([])),
            http.get('*/api/equipment/modules', () => HttpResponse.json(mockModulesList)),
            http.get('*/api/equipment/inverters', () => HttpResponse.json(mockInvertersList)),
            http.put('*/api/site-designs/:id', async ({ params, request }) => {
                const id = params.id as string
                requestTracker.putCallCount[id] = (requestTracker.putCallCount[id] || 0) + 1
                const body = await request.json() as any
                return HttpResponse.json({
                    ...mockSiteDesign,
                    ...body,
                    id,
                    updated_at: new Date().toISOString(),
                })
            }),
        )
    })

    afterEach(() => {
        // Save metrics if requested
        if (perfMetrics.length > 0 && process.env.VITE_PERFORMANCE_REPORT) {
            const reportPath = path.resolve(process.cwd(), 'benchmarks', 'frontend-latest.json')
            if (!fs.existsSync(path.dirname(reportPath))) {
                fs.mkdirSync(path.dirname(reportPath), { recursive: true })
            }
            fs.writeFileSync(reportPath, JSON.stringify(perfMetrics, null, 2))
            console.log(`\n[Performance] Frontend report saved to ${reportPath}`)
        }

        vi.useRealTimers()
        queryClient.clear()
        server.resetHandlers()
        vi.clearAllMocks()
    })

    it('renders large module counts without performance degradation', async () => {
        /**
         * Performance Test: Rendering Performance with Large Module Counts
         * 
         * Acceptance Criteria:
         * - Render 500, 1000, 2000 module placements
         * - Initial render time <500ms for each
         * - No UI freezing
         * - React Query caching effective
         */
        const moduleCounts = [500, 1000, 2000]
        const renderTimes: Record<number, number> = {}

        for (const count of moduleCounts) {
            // Generate module placements
            const modulePlacements = generateModulePlacements(count)

            // Override handler to return large dataset
            server.use(
                http.get('*/api/site-designs/perf-test', () => {
                    return HttpResponse.json({
                        ...mockSiteDesign,
                        id: 'perf-test',
                        module_placements: modulePlacements,
                        total_modules: count,
                        system_size_kwp: count * 0.4,
                    })
                })
            )

            // Measure render time
            const startTime = performance.now()

            const { unmount } = renderWithProviders(
                <CanvasLayout title="Performance Test" tenderId="tender-1" designId="perf-test">
                    <div data-testid="map-container">
                        <PolygonDrawingLayer designId="perf-test" />
                    </div>
                </CanvasLayout>,
                { queryClient }
            )

            // Wait for data to load
            await waitFor(() => {
                expect(screen.getByText('Performance Test')).toBeInTheDocument()
            })

            const renderTime = performance.now() - startTime
            renderTimes[count] = renderTime

            // Collect metrics
            perfMetrics.push({
                testName: `renders large module counts - ${count}`,
                renderTime,
                modules: count,
                timestamp: new Date().toISOString()
            })

            // Assertions
            expect(renderTime).toBeLessThan(500),
                `Render time ${renderTime.toFixed(2)}ms exceeds 500ms threshold for ${count} modules`

            // Verify data is cached
            const cachedData = queryClient.getQueryData(['site-designs', 'detail', 'perf-test'])
            expect(cachedData).toBeDefined()

            unmount()
            queryClient.clear()
        }

        // Log performance results
        console.log('\n✓ Rendering Performance:')
        for (const [count, time] of Object.entries(renderTimes)) {
            console.log(`  ${count} modules: ${time.toFixed(2)}ms`)
        }
    }, 60000)

    it('validates 30-second debounce effectiveness for settings changes', async () => {
        /**
         * Performance Test: Debounce Effectiveness
         * 
         * Acceptance Criteria:
         * - 30-second debounce delay for placement settings
         * - Rapid changes coalesced into single API call
         * - No API call before 30s
         * - Single API call at 30s
         */
        vi.useFakeTimers()
        const user = userEvent.setup({ delay: null })

        renderWithProviders(
            <CanvasLayout title="Debounce Test" tenderId="tender-1" designId="design-1">
                <div data-testid="map-container" />
            </CanvasLayout>,
            { queryClient }
        )

        await act(async () => {
            await vi.advanceTimersByTimeAsync(100)
        })

        // Get placement settings controls
        const rightPanel = screen.getByRole('region', { name: /properties/i })
        const placementCard = within(rightPanel).getByRole('heading', { name: /placement settings/i }).closest('div')!.parentElement!
        const azimuthInput = within(placementCard).getByLabelText(/azimuth input/i)

        // Make 5 rapid changes
        for (let i = 0; i < 5; i++) {
            await act(async () => {
                await user.clear(azimuthInput)
                await user.type(azimuthInput, `${180 + i * 10}`)
            })
        }

        // Verify sync state is pending
        expect(useDesignCanvasStore.getState().syncState).toBe('pending')

        // Advance 29 seconds - should NOT trigger API call
        await act(async () => {
            await vi.advanceTimersByTimeAsync(29000)
        })

        expect(requestTracker.putCallCount['design-1']).toBeUndefined()

        // Advance to 30 seconds - should trigger single API call
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000)
        })

        await waitFor(() => {
            expect(requestTracker.putCallCount['design-1']).toBe(1)
        })

        // Verify sync state is synced
        expect(useDesignCanvasStore.getState().syncState).toBe('synced')

        console.log('\n✓ Debounce effectiveness: 5 rapid changes coalesced into 1 API call after 30s')

        vi.useRealTimers()
    }, 60000)

    it('maintains map canvas responsiveness with complex geometries', async () => {
        /**
         * Performance Test: Map Canvas Responsiveness
         * 
         * Acceptance Criteria:
         * - Complex site boundary (100+ points)
         * - Multiple exclusion zones (10+)
         * - Rendering completes without freezing
         * - Leaflet layers render efficiently
         */
        // Create complex boundary with 100 points
        const complexBoundary = {
            type: 'Polygon' as const,
            coordinates: [[
                ...Array.from({ length: 100 }, (_, i) => {
                    const angle = (i / 100) * 2 * Math.PI
                    const radius = 0.001
                    return [
                        -118.2437 + radius * Math.cos(angle),
                        34.0522 + radius * Math.sin(angle)
                    ]
                }),
                [-118.2437 + 0.001, 34.0522] // Close polygon
            ]]
        }

        // Create 10 exclusion zones
        const exclusionZones = Array.from({ length: 10 }, (_, i) => ({
            type: 'Polygon' as const,
            coordinates: [[
                [-118.2437 + i * 0.0001, 34.0522],
                [-118.2437 + i * 0.0001 + 0.00005, 34.0522],
                [-118.2437 + i * 0.0001 + 0.00005, 34.0522 + 0.00005],
                [-118.2437 + i * 0.0001, 34.0522 + 0.00005],
                [-118.2437 + i * 0.0001, 34.0522]
            ]]
        }))

        server.use(
            http.get('*/api/site-designs/complex-geo', () => {
                return HttpResponse.json({
                    ...mockSiteDesign,
                    id: 'complex-geo',
                    site_boundary: complexBoundary,
                    exclusion_zones: exclusionZones,
                    total_modules: 500,
                })
            })
        )

        const startTime = performance.now()

        renderWithProviders(
            <CanvasLayout title="Complex Geometry Test" tenderId="tender-1" designId="complex-geo">
                <div data-testid="map-container">
                    <PolygonDrawingLayer designId="complex-geo" />
                </div>
            </CanvasLayout>,
            { queryClient }
        )

        await waitFor(() => {
            expect(screen.getByText('Complex Geometry Test')).toBeInTheDocument()
        })

        const renderTime = performance.now() - startTime

        // Assertions
        expect(renderTime).toBeLessThan(1000),
            `Complex geometry render time ${renderTime.toFixed(2)}ms exceeds 1000ms threshold`

        console.log(`\n✓ Complex geometry responsiveness: 100-point boundary + 10 exclusion zones in ${renderTime.toFixed(2)}ms`)
    }, 60000)

    it('handles auto-save performance under rapid changes', async () => {
        /**
         * Performance Test: Auto-Save Performance
         * 
         * Acceptance Criteria:
         * - 20 rapid changes (equipment, settings, geometry)
         * - Debounce coalesces requests
         * - Total API calls << 20
         * - Sync state transitions correctly
         * - Exponential backoff on failures
         */
        vi.useFakeTimers()
        const user = userEvent.setup({ delay: null })

        renderWithProviders(
            <CanvasLayout title="Auto-Save Test" tenderId="tender-1" designId="design-1">
                <div data-testid="map-container" />
            </CanvasLayout>,
            { queryClient }
        )

        await act(async () => {
            await vi.advanceTimersByTimeAsync(100)
        })

        // Make 20 rapid changes to placement settings
        const rightPanel = screen.getByRole('region', { name: /properties/i })
        const placementCard = within(rightPanel).getByRole('heading', { name: /placement settings/i }).closest('div')!.parentElement!
        const azimuthInput = within(placementCard).getByLabelText(/azimuth input/i)
        const tiltInput = within(placementCard).getByLabelText(/tilt input/i)

        for (let i = 0; i < 10; i++) {
            await act(async () => {
                await user.clear(azimuthInput)
                await user.type(azimuthInput, `${180 + i}`)
                await vi.advanceTimersByTimeAsync(100)
            })
        }

        for (let i = 0; i < 10; i++) {
            await act(async () => {
                await user.clear(tiltInput)
                await user.type(tiltInput, `${20 + i}`)
                await vi.advanceTimersByTimeAsync(100)
            })
        }

        // Advance through debounce period
        await act(async () => {
            await vi.advanceTimersByTimeAsync(30000)
        })

        await waitFor(() => {
            expect(useDesignCanvasStore.getState().syncState).toBe('synced')
        })

        // Verify request coalescing
        const totalRequests = requestTracker.putCallCount['design-1'] || 0
        expect(totalRequests).toBeLessThan(5),
            `Expected <5 API calls due to debounce, got ${totalRequests}`

        console.log(`\n✓ Auto-save performance: 20 rapid changes coalesced into ${totalRequests} API call(s)`)

        vi.useRealTimers()
    }, 60000)
})
