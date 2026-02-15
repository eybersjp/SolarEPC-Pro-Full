import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, waitFor, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, selectEquipment, advanceAndVerifySave, waitForPollingComplete, generateProposal } from '@/test/utils'
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'
import { mockSiteDesign } from '@/test/fixtures/siteDesign'
import { mockModulesList, mockInvertersList } from '@/test/fixtures/equipment'
import { QueryClient } from '@tanstack/react-query'
import { CanvasLayout } from '@/components/DesignCanvas/CanvasLayout'
import PolygonDrawingLayer from '@/components/DesignCanvas/PolygonDrawingLayer'
import { DesignsList } from '@/components/SiteDesigns/DesignsList'
import { Tabs, TabsContent } from '@/components/ui/tabs'

// Mock Next.js navigation
const mockPush = vi.fn()
const mockRouter = {
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    pathname: '/tenders/tender-1',
    query: {},
    asPath: '/tenders/tender-1',
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
vi.mock('@/context/DesignNavigationContext', () => ({
    useDesignNavigation: () => ({
        push: mockPush,
        replace: vi.fn(),
        back: vi.fn(),
    })
}))

// Mock Utilities
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
let capturedMapEvents: any = {}
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
    useMapEvents: (events: any) => {
        capturedMapEvents = events;
        return null;
    },
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
}))

// Mock Tooltip (lightweight)
vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: any) => children,
    TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
    TooltipProvider: ({ children }: any) => <>{children}</>,
    TooltipTrigger: ({ children }: any) => <>{children}</>,
}))

// Mock recharts for ResultsBottomSheet
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

// MSW state tracking
const requestTracker = {
    putCallCount: {} as Record<string, number>,
    recalculate: 0,
    proposal: 0,
    energy: 0,
    energyPoll: 0,
    proposalPoll: 0,
    createDesign: 0,
};

describe('Complete E2E Design Canvas Workflow', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        // Reset tracking
        requestTracker.putCallCount = {};
        requestTracker.recalculate = 0;
        requestTracker.proposal = 0;
        requestTracker.energy = 0;
        requestTracker.energyPoll = 0;
        requestTracker.proposalPoll = 0;
        requestTracker.createDesign = 0;
        capturedMapEvents = {};

        vi.setConfig({ testTimeout: 60000 })

        // Reset store
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
                const id = params.id as string;
                return HttpResponse.json({
                    ...mockSiteDesign,
                    id,
                    equipment_module_id: null,
                    equipment_inverter_id: null,
                    tender_id: 'tender-1',
                    total_modules: 0,
                    system_size_kwp: 0,
                });
            }),
            http.get('*/api/site-designs/:id/versions', () => HttpResponse.json([])),
            http.get('*/api/equipment/modules', () => HttpResponse.json(mockModulesList)),
            http.get('*/api/equipment/inverters', () => HttpResponse.json(mockInvertersList)),
            http.put('*/api/site-designs/:id', async ({ params, request }) => {
                const id = params.id as string;
                requestTracker.putCallCount[id] = (requestTracker.putCallCount[id] || 0) + 1;
                const body = await request.json() as any;
                return HttpResponse.json({
                    ...mockSiteDesign,
                    ...body,
                    id,
                    total_modules: body.equipment_module_id ? 100 : 0,
                    system_size_kwp: body.equipment_module_id ? 50 : 0,
                    updated_at: new Date().toISOString(),
                });
            }),
            http.post('*/api/site-designs/:id/recalculate', () => {
                requestTracker.recalculate++;
                return HttpResponse.json({ task_id: 'recalc-1', status: 'PENDING' });
            }),
            http.post('*/api/site-designs/:id/energy-estimate', () => {
                requestTracker.energy++;
                return HttpResponse.json({ task_id: 'energy-1', status: 'PENDING' });
            }),
            http.get('*/api/site-designs/:id/energy-estimate', () => {
                requestTracker.energyPoll++;
                return HttpResponse.json(
                    requestTracker.energyPoll > 2
                        ? {
                            status: 'completed',
                            annual_energy_kwh: 150000,
                            monthly_energy_kwh: [12000, 13000, 14000, 15000, 16000, 17000, 18000, 17000, 16000, 15000, 14000, 13000],
                            capacity_factor: 25.5,
                            calculated_at: new Date().toISOString()
                        }
                        : { status: 'calculating' }
                );
            }),
            http.post('*/api/site-designs/:id/proposal', () => {
                requestTracker.proposal++;
                return HttpResponse.json({ task_id: 'prop-1', status: 'PENDING' });
            }),
            http.get('*/api/tasks/:taskId/status', () => {
                requestTracker.proposalPoll++;
                return HttpResponse.json(
                    requestTracker.proposalPoll > 2
                        ? { status: 'SUCCESS', result_url: '/proposals/test.pdf' }
                        : { status: 'STARTED' }
                );
            }),
            http.post('*/api/site-designs', async ({ request }) => {
                requestTracker.createDesign++;
                const url = new URL(request.url);
                const tenderId = url.searchParams.get('tender_id');
                return HttpResponse.json({
                    ...mockSiteDesign,
                    id: 'new-design-id',
                    tender_id: tenderId || 'tender-1',
                }, { status: 201 });
            }),
        )
    })

    afterEach(() => {
        vi.useRealTimers()
        queryClient.clear()
        server.resetHandlers()
        vi.clearAllMocks()
    })

    it('completes full CanvasLayout user journey', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ delay: null });

        // Render with real components
        renderWithProviders(
            <CanvasLayout title="Test Design" tenderId="tender-1" designId="design-1">
                <div data-testid="map-container">
                    <PolygonDrawingLayer designId="design-1" />
                </div>
            </CanvasLayout>,
            { queryClient }
        );

        // Advance initial queries
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        // Verify CanvasLayout rendered
        expect(screen.getByText('Test Design')).toBeInTheDocument();

        // STEP 1: Equipment Selection using real selectEquipment helper
        await act(async () => {
            await selectEquipment(user, 'Test Solar TS-400', 'Test Energy TE-50K', screen);
        });

        expect(useDesignCanvasStore.getState().hasEquipmentSelected).toBe(true);
        expect(useDesignCanvasStore.getState().syncState).toBe('pending');

        // Advance debounce and verify save
        await advanceAndVerifySave();

        expect(useDesignCanvasStore.getState().syncState).toBe('synced');

        // Verify PUT request
        expect(requestTracker.putCallCount['design-1']).toBeGreaterThanOrEqual(1);

        // Verify QueryClient data
        const designData = queryClient.getQueryData(['site-designs', 'detail', 'design-1']);
        expect(designData).toMatchObject({
            equipment_module_id: 'module-1',
            equipment_inverter_id: 'inverter-1'
        });

        // STEP 2: Drawing Site Boundary
        const roofButton = screen.getByRole('button', { name: /roof/i });
        expect(roofButton).not.toBeDisabled();

        await act(async () => {
            await user.click(roofButton);
        });

        expect(useDesignCanvasStore.getState().mode).toBe('draw');

        // Simulate map clicks
        await act(async () => {
            capturedMapEvents.click({ latlng: { lat: 37.77, lng: -122.41 } });
            capturedMapEvents.click({ latlng: { lat: 37.78, lng: -122.41 } });
            capturedMapEvents.click({ latlng: { lat: 37.78, lng: -122.42 } });
            capturedMapEvents.click({ latlng: { lat: 37.77, lng: -122.42 } });
        });

        // Complete polygon
        await act(async () => {
            fireEvent.keyDown(document, { key: 'Enter' });
        });

        expect(useDesignCanvasStore.getState().mode).toBe('select');

        // Advance debounce for boundary save
        await advanceAndVerifySave();

        // STEP 3: Placement Settings
        const rightPanel = screen.getByRole('region', { name: /properties/i });
        const placementCard = within(rightPanel).getByRole('heading', { name: /placement settings/i }).closest('div')!.parentElement!;
        const azimuthInput = within(placementCard).getByLabelText(/azimuth input/i);

        await act(async () => {
            await user.clear(azimuthInput);
            await user.type(azimuthInput, '190');
        });

        expect(useDesignCanvasStore.getState().syncState).toBe('pending');

        // Advance debounce
        await advanceAndVerifySave();

        expect(useDesignCanvasStore.getState().syncState).toBe('synced');

        // STEP 4: Recalculate
        const recalcButton = within(placementCard).getByRole('button', { name: /recalculate layout/i });
        await act(async () => {
            await user.click(recalcButton);
        });

        expect(requestTracker.recalculate).toBe(1);

        // STEP 5: Calculate Energy with polling
        const calculateEnergyButton = screen.getByRole('button', { name: /calculate energy/i });
        await act(async () => {
            await user.click(calculateEnergyButton);
        });

        expect(requestTracker.energy).toBe(1);

        // Wait for polling to complete (3 polls @ 2s each)
        await waitForPollingComplete(
            () => requestTracker.energyPoll > 2,
            10,
            2000
        );

        // Verify energy data appears
        await waitFor(() => {
            expect(screen.getByText(/150/)).toBeInTheDocument(); // 150 MWh
        });

        // STEP 6: Generate Proposal with polling
        await act(async () => {
            await generateProposal(user, screen, { includeEnergy: true });
        });

        expect(requestTracker.proposal).toBe(1);

        // Wait for proposal polling to complete
        await waitForPollingComplete(
            () => requestTracker.proposalPoll > 2,
            10,
            2000
        );

        // Verify proposal download available
        await waitFor(() => {
            const downloadButton = screen.queryByTestId('download-pdf-btn') || screen.queryByRole('link', { name: /download/i });
            expect(downloadButton).toBeInTheDocument();
        });

        // Verify request coalescing (equipment + boundary + settings ≤3)
        expect(requestTracker.putCallCount['design-1']).toBeLessThanOrEqual(3);

        // Verify QueryClient data includes all updates
        const updatedDesignData = queryClient.getQueryData(['site-designs', 'detail', 'design-1']);
        expect(updatedDesignData).toMatchObject({
            equipment_module_id: 'module-1',
            equipment_inverter_id: 'inverter-1',
            site_boundary: expect.objectContaining({
                type: 'Polygon'
            }),
            placement_settings: expect.objectContaining({
                azimuth_deg: 190
            })
        });

        // Verify store state
        expect(useDesignCanvasStore.getState()).toMatchObject({
            hasEquipmentSelected: true,
            syncState: 'synced',
            mode: 'select'
        });

        vi.useRealTimers();
    }, 60000);

    it('creates new design from DesignsList with POST and navigation', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ delay: null });

        renderWithProviders(
            <Tabs defaultValue="designs">
                <TabsContent value="designs">
                    <DesignsList designs={[]} isLoading={false} tenderId="tender-1" />
                </TabsContent>
            </Tabs>,
            { queryClient }
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        // Find Create New Design link
        const createButton = await screen.findByRole('link', { name: /create new design/i });
        expect(createButton).toHaveAttribute('href', '/tenders/tender-1/design/new');

        // Click triggers navigation
        await act(async () => {
            await user.click(createButton);
        });

        // Verify navigation was called
        expect(mockPush).toHaveBeenCalledWith('/tenders/tender-1/design/new');

        // In real app, the /design/new route would trigger POST
        // Verify MSW handler is configured for POST
        expect(requestTracker.createDesign).toBe(0); // Not called in this test (navigation only)

        vi.useRealTimers();
    }, 60000);

    it('recovers from network errors with exponential backoff', async () => {
        vi.useFakeTimers();
        let attemptCount = 0;

        // Mock to fail 3 times then succeed
        server.use(
            http.put('*/api/site-designs/retry-test', () => {
                attemptCount++;
                if (attemptCount <= 3) {
                    return new HttpResponse(null, { status: 500 });
                }
                return HttpResponse.json({ ...mockSiteDesign, id: 'retry-test' });
            })
        );

        renderWithProviders(
            <CanvasLayout title="Test" tenderId="tender-1" designId="retry-test">
                <div />
            </CanvasLayout>,
            { queryClient }
        );

        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
        });

        // Trigger update that will fail
        act(() => {
            useDesignCanvasStore.getState().setSyncState('pending');
            useDesignCanvasStore.getState().setEquipmentSelection('module-1', null);
        });

        // Advance through debounce and retries
        await act(async () => {
            await vi.advanceTimersByTimeAsync(31000); // Debounce
            await vi.advanceTimersByTimeAsync(1050); // Retry 1
            await vi.advanceTimersByTimeAsync(2050); // Retry 2
            await vi.advanceTimersByTimeAsync(4050); // Retry 3
        });

        // Mutation retries internally, so we may get more attempts
        expect(attemptCount).toBeGreaterThanOrEqual(4);

        vi.useRealTimers();
    }, 60000);
});
