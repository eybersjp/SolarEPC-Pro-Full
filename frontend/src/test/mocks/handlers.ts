import { http, HttpResponse } from 'msw'
import { mockSiteDesign, mockEnergyEstimate, mockFinancialAnalysis } from '../fixtures/siteDesign'
import { mockModulesList, mockInvertersList } from '../fixtures/equipment'
import { mockPVDesign } from '../fixtures/pvDesign' // Added PV Design fixture if it exists or assuming it does

export const handlers = [
    // GET /api/site-designs/:id
    http.get('*/api/site-designs/:id', ({ params }) => {
        return HttpResponse.json({
            ...mockSiteDesign,
            id: params.id,
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
        return HttpResponse.json({
            ...mockEnergyEstimate,
            design_id: params.id,
        })
    }),

    // POST /api/site-designs/:id/energy-estimate
    http.post('*/api/site-designs/:id/energy-estimate', ({ params }) => {
        return HttpResponse.json({
            ...mockEnergyEstimate,
            design_id: params.id,
            status: 'calculating',
        })
    }),

    // GET /api/site-designs/:id/financial-analysis
    http.get('*/api/site-designs/:id/financial-analysis', ({ params }) => {
        return HttpResponse.json({
            ...mockFinancialAnalysis,
            design_id: params.id,
        })
    }),

    // GET /api/pv-designs/:id
    http.get('*/api/pv-designs/:id', ({ params }) => {
        return HttpResponse.json({
            ...mockPVDesign,
            id: params.id,
        })
    }),
]
