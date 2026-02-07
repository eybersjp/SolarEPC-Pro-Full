import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUpdateSiteDesignMutation, useCreateSiteDesignMutation, useDeleteSiteDesignMutation } from '../useSiteDesigns'
import { mockSiteDesign } from '../../test/fixtures/siteDesign'
import { server } from '../../test/mocks/server'
import { http, HttpResponse } from 'msw'
import React from 'react'

import { useDesignCanvasStore } from '../../stores/useDesignCanvasStore'
import { toast } from '../../lib/toast'
import { queryKeys } from '../../lib/queryKeys'

// Mock toast
vi.mock('../../lib/toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return {
        queryClient,
        wrapper: ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient} > {children} </QueryClientProvider>
        )
    }
}

describe('useSiteDesigns hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useDesignCanvasStore.setState({ syncState: 'synced' })
        // Add a small delay to all design API calls to ensure 'syncing' state is observable
        server.use(
            http.post('*/api/tenders/:id/site-designs', async ({ request }) => {
                const body = await request.json() as any
                await new Promise(r => setTimeout(r, 20))
                return HttpResponse.json({ ...mockSiteDesign, ...body, id: 'new-design-id' })
            }),
            http.put('*/api/site-designs/:id', async ({ request, params }) => {
                const body = await request.json() as any
                await new Promise(r => setTimeout(r, 20))
                return HttpResponse.json({ ...mockSiteDesign, ...body, id: params.id })
            }),
            http.delete('*/api/site-designs/:id', async () => {
                await new Promise(r => setTimeout(r, 20))
                return HttpResponse.json({ message: 'Deleted' })
            })
        )
    })

    describe('useUpdateSiteDesignMutation', () => {
        it('should successfully update a site design and sync state', async () => {
            const { queryClient, wrapper } = createWrapper()
            const designId = 'design-1'

            // Seed the cache
            queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), mockSiteDesign)

            const { result } = renderHook(() => useUpdateSiteDesignMutation(designId), { wrapper })

            await act(async () => {
                result.current.mutate({ name: 'Updated Name' })
            })

            // Verify optimistic update
            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('syncing'))
            await waitFor(() => {
                const optimisticData = queryClient.getQueryData<any>(queryKeys.siteDesigns.detail(designId))
                expect(optimisticData?.name).toBe('Updated Name')
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(useDesignCanvasStore.getState().syncState).toBe('synced')
            expect(toast.success).toHaveBeenCalledWith('Design saved')

            // Verify final data
            const finalData = queryClient.getQueryData<any>(queryKeys.siteDesigns.detail(designId))
            expect(finalData.name).toBe('Updated Name')
        })

        it('should handle error and rollback optimistically updated data', async () => {
            const { queryClient, wrapper } = createWrapper()
            const designId = 'design-1'

            server.use(
                http.put('*/api/site-designs/:id', async () => {
                    await new Promise(r => setTimeout(r, 20))
                    return new HttpResponse(null, { status: 500 })
                })
            )

            // Seed the cache with original data
            queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), {
                ...mockSiteDesign,
                name: 'Original Name'
            })

            const { result } = renderHook(() => useUpdateSiteDesignMutation(designId), { wrapper })

            await act(async () => {
                result.current.mutate({ name: 'Faulty Update' })
            })

            // Assert syncing state
            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('syncing'))

            // Assert optimistic change
            await waitFor(() => {
                const currentData = queryClient.getQueryData<any>(queryKeys.siteDesigns.detail(designId))
                expect(currentData?.name).toBe('Faulty Update')
            })

            await waitFor(() => expect(result.current.isError).toBe(true))

            // Assert rollback
            expect(queryClient.getQueryData<any>(queryKeys.siteDesigns.detail(designId)).name).toBe('Original Name')
            expect(useDesignCanvasStore.getState().syncState).toBe('failed')
            expect(toast.error).toHaveBeenCalled()
        })
    })

    describe('useCreateSiteDesignMutation', () => {
        it('should successfully create a site design and update sync state', async () => {
            const { wrapper } = createWrapper()
            const { result } = renderHook(() => useCreateSiteDesignMutation('tender-1'), { wrapper })

            await act(async () => {
                result.current.mutate({
                    name: 'New Design',
                    site_type: 'rooftop',
                    equipment_module_id: 'mod-1',
                    equipment_inverter_id: 'inv-1',
                    site_boundary: mockSiteDesign.site_boundary,
                    placement_settings: mockSiteDesign.placement_settings,
                })
            })

            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('syncing'))

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(result.current.data?.id).toBe('new-design-id')
            expect(useDesignCanvasStore.getState().syncState).toBe('synced')
            expect(toast.success).toHaveBeenCalledWith('Design created successfully')
        })
    })

    describe('useDeleteSiteDesignMutation', () => {
        it('should successfully delete a site design and update sync state', async () => {
            const { wrapper } = createWrapper()
            const { result } = renderHook(() => useDeleteSiteDesignMutation('tender-1'), { wrapper })

            await act(async () => {
                result.current.mutate('design-1')
            })

            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('syncing'))

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(useDesignCanvasStore.getState().syncState).toBe('synced')
            expect(toast.success).toHaveBeenCalledWith('Design deleted')
        })
    })
})
