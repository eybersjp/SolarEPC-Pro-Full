import { http, HttpResponse } from 'msw'
import {
    mockSiteDesign,
    mockEnergyEstimate,
    mockFinancialAnalysis,
    mockEnergyEstimateCalculating,
    mockEnergyEstimateFailed,
    mockEnergyEstimateStale,
    mockEnergyEstimateIncomplete,
    mockSiteDesignZeroCapacity,
    mockSiteDesignNoLocation
} from '../fixtures/siteDesign'
import { mockModulesList, mockInvertersList } from '../fixtures/equipment'
import { mockPVDesign } from '../fixtures/pvDesign'

// Internal state for managing transitions in mocks
const testState = {
    energyFetchCount: {} as Record<string, number>,
    recalculateCount: {} as Record<string, number>,
    reset: () => {
        testState.energyFetchCount = {};
        testState.recalculateCount = {};
    }
};

export const handlers = [
    // Helper to reset state between tests (can be called via a special endpoint or just reset in beforeEach)
    http.get('*/api/test/reset', () => {
        testState.reset();
        return new HttpResponse(null, { status: 200 });
    }),

    // GET /api/site-designs/:id
    http.get('*/api/site-designs/:id', ({ params }) => {
        const id = params.id as string;
        if (id.includes('zero')) return HttpResponse.json(mockSiteDesignZeroCapacity);
        if (id.includes('stale-test')) {
            const now = new Date();
            return HttpResponse.json({
                ...mockSiteDesign,
                id,
                updated_at: now.toISOString(),
            });
        }

        return HttpResponse.json({
            ...mockSiteDesign,
            id,
            total_modules: 80,
            system_size_kwp: 44.0,
        })
    }),

    // PUT /api/site-designs/:id
    http.put('*/api/site-designs/:id', async ({ params, request }) => {
        const body = await request.json() as any
        return HttpResponse.json({
            ...mockSiteDesign,
            ...body,
            id: params.id,
            updated_at: new Date().toISOString(),
        })
    }),

    // POST /api/site-designs
    http.post('*/api/site-designs', async ({ request }) => {
        const url = new URL(request.url)
        const tenderId = url.searchParams.get('tender_id')
        const body = await request.json() as any
        return HttpResponse.json({
            ...mockSiteDesign,
            ...body,
            id: 'new-design-id',
            tender_id: tenderId || 'tender-1',
            created_at: new Date().toISOString(),
        }, { status: 201 })
    }),

    // DELETE /api/site-designs/:id
    http.delete('*/api/site-designs/:id', () => {
        return new HttpResponse(null, { status: 204 })
    }),

    // GET /api/tenders/:id/site-designs
    http.get('*/api/tenders/:id/site-designs', () => {
        return HttpResponse.json([mockSiteDesign])
    }),

    // GET /api/equipment/modules
    http.get('*/api/equipment/modules', ({ request }) => {
        const url = new URL(request.url)
        const manufacturer = url.searchParams.get('manufacturer')

        if (manufacturer) {
            return HttpResponse.json(
                mockModulesList.filter(m => m.manufacturer.includes(manufacturer))
            )
        }
        return HttpResponse.json(mockModulesList)
    }),

    // GET /api/equipment/inverters
    http.get('*/api/equipment/inverters', ({ request }) => {
        const url = new URL(request.url)
        const manufacturer = url.searchParams.get('manufacturer')

        if (manufacturer) {
            return HttpResponse.json(
                mockInvertersList.filter(i => i.manufacturer.includes(manufacturer))
            )
        }
        return HttpResponse.json(mockInvertersList)
    }),

    // GET /api/site-designs/:id/energy-estimate
    http.get('*/api/site-designs/:id/energy-estimate', ({ params }) => {
        const id = params.id as string;
        testState.energyFetchCount[id] = (testState.energyFetchCount[id] || 0) + 1;
        const count = testState.energyFetchCount[id];

        if (id.includes('no-energy')) {
            const isRecalculating = (testState.recalculateCount[id] || 0) > 0;
            if (isRecalculating) return HttpResponse.json({ ...mockEnergyEstimateCalculating, design_id: id });
            return HttpResponse.json({ detail: 'Estimation not found' }, { status: 404 });
        }

        if (id.includes('stale-test')) {
            const isRecalculating = (testState.recalculateCount[id] || 0) > 0;
            if (isRecalculating) return HttpResponse.json({ ...mockEnergyEstimateCalculating, design_id: id });

            // Return a completed estimate with an old timestamp to trigger "Outdated"
            const oldDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
            return HttpResponse.json({
                ...mockEnergyEstimate,
                status: 'completed',
                design_id: id,
                calculated_at: oldDate
            });
        }

        if (id.includes('poll-finish')) {
            return HttpResponse.json(count > 2 ? { ...mockEnergyEstimate, status: 'completed' } : { ...mockEnergyEstimateCalculating, design_id: id });
        }

        if (id.includes('partial')) return HttpResponse.json({ ...mockEnergyEstimateIncomplete, design_id: id });
        if (id.includes('loc-error')) return HttpResponse.json({ ...mockEnergyEstimateFailed, error_message: 'Invalid location coordinates', design_id: id });

        if (id.includes('retry-test')) {
            const isRetrying = (testState.recalculateCount[id] || 0) > 0;
            return HttpResponse.json(isRetrying ? { ...mockEnergyEstimate, status: 'completed' } : { ...mockEnergyEstimateFailed, design_id: id });
        }

        return HttpResponse.json({
            ...mockEnergyEstimate,
            design_id: params.id,
        })
    }),

    // POST /api/site-designs/:id/energy-estimate
    http.post('*/api/site-designs/:id/energy-estimate', ({ params }) => {
        const id = params.id as string;
        testState.recalculateCount[id] = (testState.recalculateCount[id] || 0) + 1;
        return HttpResponse.json({
            ...mockEnergyEstimate,
            design_id: id,
            status: 'calculating',
        })
    }),

    // GET /api/site-designs/:id/financial-analysis
    http.get('*/api/site-designs/:id/financial-analysis', ({ params }) => {
        const id = params.id as string;
        if (id.includes('no-finance')) return HttpResponse.json({ detail: 'Financial analysis not found' }, { status: 404 });
        return HttpResponse.json({
            ...mockFinancialAnalysis,
            design_id: id,
        })
    }),

    // GET /api/pv-designs/:id
    http.get('*/api/pv-designs/:id', ({ params }) => {
        const id = params.id as string;
        return HttpResponse.json({
            ...mockPVDesign,
            id,
        })
    }),
]
