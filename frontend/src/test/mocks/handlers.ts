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
import { mockVersionsList, mockVersionDetail, mockVersionRestoreResponse } from '../fixtures/designVersion'
import { DesignVersionResponse } from '@/types'

// Internal state for managing transitions in mocks
const testState = {
    energyFetchCount: {} as Record<string, number>,
    recalculateCount: {} as Record<string, number>,
    proposalTaskCount: {} as Record<string, number>,
    putCallCount: {} as Record<string, number>,
    versionCreateCount: {} as Record<string, number>,
    versionRestoreCount: {} as Record<string, number>,
    versions: {} as Record<string, DesignVersionResponse[]>,
    reset: () => {
        testState.energyFetchCount = {};
        testState.recalculateCount = {};
        testState.proposalTaskCount = {};
        testState.putCallCount = {};
        testState.versionCreateCount = {};
        testState.versionRestoreCount = {};
        testState.versions = {};
    }
};

export const handlers = [
    // Helper to reset state between tests (can be called via a special endpoint or just reset in beforeEach)
    http.get('*/api/test/reset', () => {
        testState.reset();
        return new HttpResponse(null, { status: 200 });
    }),

    // GET /api/site-designs/:id
    http.get('*/api/site-designs/:id', ({ params, request }) => {
        const id = params.id as string;
        const url = new URL(request.url);
        const isStale = url.searchParams.get('stale') === 'true' || id.includes('stale-test');

        if (id.includes('zero')) return HttpResponse.json(mockSiteDesignZeroCapacity);

        const now = new Date();
        const updatedAt = isStale
            ? new Date(now.getTime() - 1000 * 60 * 60).toISOString() // 1 hour ago
            : now.toISOString();

        return HttpResponse.json({
            ...mockSiteDesign,
            id,
            total_modules: 80,
            system_size_kwp: 44.0,
            updated_at: updatedAt,
        })
    }),

    // PUT /api/site-designs/:id
    http.put('*/api/site-designs/:id', async ({ params, request }) => {
        const id = params.id as string;
        const url = new URL(request.url);
        const retryTest = url.searchParams.get('retry-test');

        testState.putCallCount[id] = (testState.putCallCount[id] || 0) + 1;
        const count = testState.putCallCount[id];

        if (retryTest === 'true' || id.includes('retry-test')) {
            const failCount = parseInt(url.searchParams.get('fail-count') || '3');
            if (count <= failCount) {
                return new HttpResponse(null, { status: 500 });
            }
        }

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

    // POST /api/site-designs/:id/proposal
    http.post('*/api/site-designs/:id/proposal', ({ params }) => {
        const id = params.id as string;
        const taskId = `task-${id}-${Date.now()}`;
        testState.proposalTaskCount[taskId] = 0;
        return HttpResponse.json({ task_id: taskId, status: 'PENDING' });
    }),

    // GET /api/tasks/:taskId
    http.get('*/api/tasks/:taskId', ({ params }) => {
        const taskId = params.taskId as string;

        if (taskId.includes('fail')) {
            return HttpResponse.json({
                task_id: taskId,
                status: 'FAILURE',
                error: 'PDF generation failed'
            });
        }

        const currentCount = testState.proposalTaskCount[taskId] || 0;
        testState.proposalTaskCount[taskId] = currentCount + 1;
        const count = testState.proposalTaskCount[taskId];

        // Simulate transitions: PENDING -> STARTED -> SUCCESS
        if (count <= 1) return HttpResponse.json({ task_id: taskId, status: 'PENDING' });
        if (count === 2) return HttpResponse.json({ task_id: taskId, status: 'STARTED' });

        return HttpResponse.json({
            task_id: taskId,
            status: 'SUCCESS',
            result_url: `http://localhost/proposals/${taskId}.pdf`
        });
    }),

    // GET /api/site-designs/:id/export-csv
    http.get('*/api/site-designs/:id/export-csv', () => {
        return HttpResponse.text('mock,csv,data', {
            headers: { 'Content-Type': 'text/csv' }
        });
    }),

    // POST /api/site-designs/:id/versions
    http.post('*/api/site-designs/:id/versions', async ({ params, request }) => {
        const designId = params.id as string;
        const body = await request.json() as any;

        testState.versionCreateCount[designId] = (testState.versionCreateCount[designId] || 0) + 1;

        const newVersion: DesignVersionResponse = {
            id: `version-${Date.now()}`,
            site_design_id: designId,
            version_name: body.version_name,
            notes: body.notes || null,
            created_at: new Date().toISOString(),
            created_by_name: "Test User",
            total_modules: 80,
            system_size_kwp: 44.0,
        };

        if (designId.includes('error-design')) {
            return HttpResponse.json({ detail: 'Internal Server Error' }, { status: 500 });
        }

        // Store in test state
        if (!testState.versions[designId]) {
            testState.versions[designId] = [];
        }
        testState.versions[designId].unshift(newVersion);

        return HttpResponse.json(newVersion, { status: 201 });
    }),

    // GET /api/site-designs/:id/versions
    http.get('*/api/site-designs/:id/versions', ({ params }) => {
        const designId = params.id as string;

        if (designId.includes('no-versions')) {
            return HttpResponse.json([]);
        }

        if (designId.includes('error-versions')) {
            return HttpResponse.json({ detail: 'Failed to fetch versions' }, { status: 500 });
        }

        // Return stored versions or default mock
        const versions = testState.versions[designId] || mockVersionsList;
        return HttpResponse.json(versions);
    }),

    // GET /api/site-designs/:designId/versions/:versionId
    http.get('*/api/site-designs/:designId/versions/:versionId', ({ params }) => {
        const versionId = params.versionId as string;

        if (versionId.includes('not-found')) {
            return HttpResponse.json({ detail: 'Version not found' }, { status: 404 });
        }

        return HttpResponse.json(mockVersionDetail);
    }),

    // POST /api/site-designs/:designId/restore/:versionId
    http.post('*/api/site-designs/:designId/restore/:versionId', ({ params }) => {
        const designId = params.designId as string;

        testState.versionRestoreCount[designId] = (testState.versionRestoreCount[designId] || 0) + 1;
        const count = testState.versionRestoreCount[designId];

        if (designId.includes('restore-fail') && count <= 3) {
            return new HttpResponse(null, { status: 500 });
        }

        return HttpResponse.json(mockVersionRestoreResponse);
    }),
]
