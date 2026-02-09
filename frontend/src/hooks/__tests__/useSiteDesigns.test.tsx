import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    useUpdateSiteDesignMutation,
    useCreateSiteDesignMutation,
    useDeleteSiteDesignMutation,
    useCreateVersionMutation,
    useVersionsQuery,
    useVersionDetailQuery,
    useRestoreVersionMutation
} from '../useSiteDesigns'
import { mockSiteDesign, mockVersionRestoreResponse } from '../../test/fixtures/siteDesign'
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
        useDesignCanvasStore.setState({
            syncState: 'synced',
            retryCount: 0,
            lastSyncedAt: null
        })
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

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllEnvs()
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

        it('should retry with exponential backoff and verify all stages', async () => {
            vi.useFakeTimers();
            const { wrapper } = createWrapper();
            const designId = 'design-retry-test';

            let callCount = 0;
            server.use(
                http.put('*/api/site-designs/:id', async () => {
                    callCount++;
                    if (callCount <= 3) { // Fail first 3 attempts
                        return new HttpResponse(null, { status: 500 });
                    }
                    return HttpResponse.json({ ...mockSiteDesign, name: 'Retry Success', id: designId });
                })
            );

            const { result } = renderHook(() => useUpdateSiteDesignMutation(designId), { wrapper });

            act(() => {
                result.current.mutate({ name: 'Retry Success' });
            });

            // 1. Initial attempt fails immediately
            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(1));
            expect(toast.error).toHaveBeenCalledWith("Failed to save changes. Retrying...");

            // 2. Wait 1000ms for first retry
            act(() => { vi.advanceTimersByTime(1100); });
            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(2));

            // 3. Wait 2000ms for second retry
            act(() => { vi.advanceTimersByTime(2100); });
            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(3));

            // 4. Wait 4000ms for third retry (which succeeds)
            act(() => { vi.advanceTimersByTime(4100); });
            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('synced'));

            expect(useDesignCanvasStore.getState().retryCount).toBe(0);
            expect(toast.success).toHaveBeenCalledWith("Design saved");
            expect(callCount).toBe(4);
        });

        it('should handle final failure after 3 retries and preserve lastMutationData', async () => {
            vi.useFakeTimers();
            const { wrapper } = createWrapper();
            const designId = 'design-failure-test';

            server.use(
                http.put('*/api/site-designs/:id', () => {
                    return new HttpResponse(null, { status: 500 });
                })
            );

            const { result } = renderHook(() => useUpdateSiteDesignMutation(designId), { wrapper });

            act(() => {
                result.current.mutate({ name: 'Persistent Failure' });
            });

            // Advance through all retries (1s, 2s, 4s)
            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(1));
            act(() => { vi.advanceTimersByTime(1100); }); // Wait for 1st retry

            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(2));
            act(() => { vi.advanceTimersByTime(2100); }); // Wait for 2nd retry

            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(3));
            act(() => { vi.advanceTimersByTime(4100); }); // Wait for 3rd retry

            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('failed'));

            expect(toast.error).toHaveBeenCalledWith("Failed to save changes after 3 attempts. Click retry to try again.");
            expect(useDesignCanvasStore.getState().lastMutationData).toEqual({ name: 'Persistent Failure' });
        });
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

    describe('Version Management Hooks', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            useDesignCanvasStore.setState({
                syncState: 'synced',
                retryCount: 0,
                lastSyncedAt: null,
                placementLoading: false,
            });
        });

        describe('useCreateVersionMutation', () => {
            it('should successfully create a version with optimistic update', async () => {
                const { queryClient, wrapper } = createWrapper();
                const designId = 'design-1';

                // Seed the cache with existing versions
                queryClient.setQueryData(queryKeys.designVersions.list(designId), []);

                const { result } = renderHook(() => useCreateVersionMutation(designId), { wrapper });

                await act(async () => {
                    result.current.mutate({
                        version_name: 'Test Version',
                        notes: 'Test notes',
                    });
                });

                // Verify optimistic update
                await waitFor(() => {
                    const versions = queryClient.getQueryData<any[]>(queryKeys.designVersions.list(designId));
                    expect(versions).toHaveLength(1);
                    expect(versions![0].version_name).toBe('Test Version');
                });

                await waitFor(() => expect(result.current.isSuccess).toBe(true));

                expect(useDesignCanvasStore.getState().syncState).toBe('synced');
                expect(toast.success).toHaveBeenCalledWith('Version saved successfully');
            });

            it('should handle error and rollback optimistic update', async () => {
                const { queryClient, wrapper } = createWrapper();
                const designId = 'error-design';

                server.use(
                    http.post('*/api/site-designs/:id/versions', async () => {
                        await new Promise(r => setTimeout(r, 20));
                        return new HttpResponse(null, { status: 500 });
                    })
                );

                const existingVersions = [{ id: 'v1', version_name: 'Existing' }];
                queryClient.setQueryData(queryKeys.designVersions.list(designId), existingVersions);

                const { result } = renderHook(() => useCreateVersionMutation(designId), { wrapper });

                await act(async () => {
                    result.current.mutate({ version_name: 'Failed Version' });
                });

                await waitFor(() => expect(result.current.isError).toBe(true));

                // Verify rollback
                const versions = queryClient.getQueryData<any[]>(queryKeys.designVersions.list(designId));
                expect(versions).toEqual(existingVersions);
                expect(useDesignCanvasStore.getState().syncState).toBe('failed');
                expect(toast.error).toHaveBeenCalled();
            });

            it('should retry on failure with exponential backoff', async () => {
                vi.useFakeTimers();
                const { wrapper } = createWrapper();
                const designId = 'design-retry-version';

                let callCount = 0;
                server.use(
                    http.post('*/api/site-designs/:id/versions', async () => {
                        callCount++;
                        if (callCount <= 2) {
                            return new HttpResponse(null, { status: 500 });
                        }
                        return HttpResponse.json({
                            id: 'version-success',
                            version_name: 'Retry Success',
                            site_design_id: designId,
                            notes: null,
                            created_at: new Date().toISOString(),
                            created_by_name: 'Test',
                            total_modules: 80,
                            system_size_kwp: 44.0,
                        });
                    })
                );

                const { result } = renderHook(() => useCreateVersionMutation(designId), { wrapper });

                act(() => {
                    result.current.mutate({ version_name: 'Retry Success' });
                });

                // Wait for retries
                await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(1));
                act(() => { vi.advanceTimersByTime(1100); });

                await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(2));
                act(() => { vi.advanceTimersByTime(2100); });

                await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('synced'));

                expect(callCount).toBe(3);
                expect(toast.success).toHaveBeenCalledWith('Version saved successfully');
            });
        });

        describe('useVersionsQuery', () => {
            it('should fetch versions list', async () => {
                const { wrapper } = createWrapper();
                const designId = 'design-1';

                const { result } = renderHook(() => useVersionsQuery(designId), { wrapper });

                await waitFor(() => expect(result.current.isSuccess).toBe(true));

                expect(result.current.data).toBeDefined();
                expect(result.current.data!.length).toBeGreaterThan(0);
                expect(result.current.data![0]).toHaveProperty('version_name');
            });

            it('should return empty array when no versions exist', async () => {
                const { wrapper } = createWrapper();
                const designId = 'no-versions';

                const { result } = renderHook(() => useVersionsQuery(designId), { wrapper });

                await waitFor(() => expect(result.current.isSuccess).toBe(true));

                expect(result.current.data).toEqual([]);
            });

            it('should handle fetch error', async () => {
                const { wrapper } = createWrapper();
                const designId = 'error-versions';

                const { result } = renderHook(() => useVersionsQuery(designId), { wrapper });

                await waitFor(() => expect(result.current.isError).toBe(true));

                expect(result.current.error).toBeDefined();
            });

            it('should not fetch when designId is empty', () => {
                const { wrapper } = createWrapper();

                const { result } = renderHook(() => useVersionsQuery(''), { wrapper });

                expect(result.current.isFetching).toBe(false);
            });
        });

        describe('useVersionDetailQuery', () => {
            it('should fetch version detail with snapshot data', async () => {
                const { wrapper } = createWrapper();
                const designId = 'design-1';
                const versionId = 'version-1';

                const { result } = renderHook(() => useVersionDetailQuery(designId, versionId), { wrapper });

                await waitFor(() => expect(result.current.isSuccess).toBe(true));

                expect(result.current.data).toBeDefined();
                expect(result.current.data).toHaveProperty('snapshot_data');
                expect(result.current.data!.snapshot_data).toHaveProperty('site_boundary');
            });

            it('should handle not found error', async () => {
                const { wrapper } = createWrapper();
                const designId = 'design-1';
                const versionId = 'not-found';

                const { result } = renderHook(() => useVersionDetailQuery(designId, versionId), { wrapper });

                await waitFor(() => expect(result.current.isError).toBe(true));
            });

            it('should not fetch when IDs are empty', () => {
                const { wrapper } = createWrapper();

                const { result } = renderHook(() => useVersionDetailQuery('', ''), { wrapper });

                expect(result.current.isFetching).toBe(false);
            });
        });

        describe('useRestoreVersionMutation', () => {
            it('should successfully restore version and invalidate caches', async () => {
                const { queryClient, wrapper } = createWrapper();
                const designId = 'design-1';
                const versionId = 'version-1';

                // Seed caches
                queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), mockSiteDesign);

                const { result } = renderHook(() => useRestoreVersionMutation(designId), { wrapper });

                await act(async () => {
                    result.current.mutate(versionId);
                });

                await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('syncing'));
                await waitFor(() => expect(useDesignCanvasStore.getState().placementLoading).toBe(true));

                await waitFor(() => expect(result.current.isSuccess).toBe(true));

                expect(useDesignCanvasStore.getState().syncState).toBe('synced');
                expect(useDesignCanvasStore.getState().placementLoading).toBe(false);

                // Verify cache updates
                const updatedDesign = queryClient.getQueryData(queryKeys.siteDesigns.detail(designId));
                expect(updatedDesign).toBeDefined();
            });

            it('should retry on failure', async () => {
                vi.useFakeTimers();
                const { wrapper } = createWrapper();
                const designId = 'restore-fail';

                let callCount = 0;
                server.use(
                    http.post('*/api/site-designs/:designId/restore/:versionId', async () => {
                        callCount++;
                        if (callCount <= 2) {
                            return new HttpResponse(null, { status: 500 });
                        }
                        return HttpResponse.json(mockVersionRestoreResponse);
                    })
                );

                const { result } = renderHook(() => useRestoreVersionMutation(designId), { wrapper });

                act(() => {
                    result.current.mutate('version-1');
                });

                await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(1));
                act(() => { vi.advanceTimersByTime(1100); });

                await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(2));
                act(() => { vi.advanceTimersByTime(2100); });

                await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('synced'));

                expect(callCount).toBe(3);
            });

            it('should handle final failure after retries', async () => {
                vi.useFakeTimers();
                const { wrapper } = createWrapper();
                const designId = 'restore-fail-final';

                server.use(
                    http.post('*/api/site-designs/:designId/restore/:versionId', () => {
                        return new HttpResponse(null, { status: 500 });
                    })
                );

                const { result } = renderHook(() => useRestoreVersionMutation(designId), { wrapper });

                act(() => {
                    result.current.mutate('version-1');
                });

                // Advance through all retries
                await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(1));
                act(() => { vi.advanceTimersByTime(1100); });

                await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(2));
                act(() => { vi.advanceTimersByTime(2100); });

                await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(3));
                act(() => { vi.advanceTimersByTime(4100); });

                await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('failed'));

                expect(toast.error).toHaveBeenCalled();
                expect(useDesignCanvasStore.getState().placementLoading).toBe(false);
            });

            it('should invalidate related queries on success', async () => {
                const { queryClient, wrapper } = createWrapper();
                const designId = 'design-1';

                const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

                const { result } = renderHook(() => useRestoreVersionMutation(designId), { wrapper });

                await act(async () => {
                    result.current.mutate('version-1');
                });

                await waitFor(() => expect(result.current.isSuccess).toBe(true));

                // Verify all related queries are invalidated
                expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.siteDesigns.lists() });
                expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.energyEstimation.detail(designId) });
                expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.financialAnalysis.detail(designId) });
                expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.siteDesigns.detail(designId) });
            });
        });
    });
});
