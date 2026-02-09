import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGenerateProposalMutation, useTaskStatusQuery, useExportCSV } from '@/hooks/useProposal';
import { createWrapper, createTestQueryClient } from '@/test/utils';
import { toast } from 'sonner';
import { proposalsApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { QueryClientProvider } from '@tanstack/react-query';

// Mock sonner toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}));

describe('useProposal Hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset MSW state if needed, but handlers handle their own state usually
    });

    describe('useGenerateProposalMutation', () => {
        it('should successfully trigger proposal generation', async () => {
            const { result } = renderHook(() => useGenerateProposalMutation('design-1'), {
                wrapper: createWrapper(),
            });

            result.current.mutate({
                title: 'Test Proposal',
                include_cover: true
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data?.task_id).toBeDefined();
            expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('started'));
        });

        it('should handle proposal generation error', async () => {
            // Mock error
            vi.spyOn(proposalsApi, 'generateProposal').mockRejectedValueOnce(new Error('Generation failed'));
            const { result } = renderHook(() => useGenerateProposalMutation('design-error'), {
                wrapper: createWrapper(),
            });

            await act(async () => {
                result.current.mutate({ title: 'Fail' });
            });

            await waitFor(() => expect(result.current.isError).toBe(true));
            // Hook wraps non-ApiErrors with generic message
            expect(toast.error).toHaveBeenCalledWith('Failed to generate proposal');
        });
    });

    describe('useTaskStatusQuery', () => {
        beforeEach(() => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
        });

        afterEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it('should poll task status every 2 seconds until SUCCESS', async () => {
            const taskId = `task-poll-test-${Date.now()}`;
            const { result } = renderHook(
                () => useTaskStatusQuery(taskId, 'design-1'),
                { wrapper: createWrapper() }
            );

            // Initial fetch - PENDING (count 1)
            await waitFor(() => expect(result.current.data?.status).toBe('PENDING'));

            // Verify refetchInterval is 2000
            // Note: internal implementation detail, but we can infer from polling behavior

            // Advance 2 seconds - STARTED (count 2)
            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });
            await waitFor(() => expect(result.current.data?.status).toBe('STARTED'));

            // Advance 2 more seconds - SUCCESS (count 3)
            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });
            await waitFor(() => expect(result.current.data?.status).toBe('SUCCESS'));
            expect(result.current.data?.result_url).toBeDefined();

            // Verify polling stops (no more updates expected if we wait)
            // Ideally check query observer status or just that it remains success
        });

        it('should stop polling on SUCCESS and invalidate queries', async () => {
            const taskId = `task-success-test-${Date.now()}`;
            const designId = 'design-inval';

            // Mock queryClient to check invalidation
            const { result, queryClient } = renderHookWithClient(
                () => useTaskStatusQuery(taskId, designId)
            );
            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

            // Wait for SUCCESS (using handlers logic 1->2->3 calls)
            // Initial (1)
            await waitFor(() => expect(result.current.data?.status).toBe('PENDING'));

            // Advance to STARTED (2)
            await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
            // Advance to SUCCESS (3)
            await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

            await waitFor(() => expect(result.current.data?.status).toBe('SUCCESS'));

            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.siteDesigns.detail(designId) });

            // Verify refetchInterval logic: if data is success, it should return false
            // We can check query options if accessible, or just infer from no more fetches
        });

        it('should stop polling on FAILURE', async () => {
            const taskId = `task-fail-test-${Date.now()}`;
            const { result } = renderHook(
                () => useTaskStatusQuery(taskId, 'design-1'),
                { wrapper: createWrapper() }
            );

            await waitFor(() => expect(result.current.data?.status).toBe('FAILURE'));
            expect(result.current.data?.error).toBeDefined();
        });

        it('should not poll if enabled is false', async () => {
            const taskId = 'task-disabled';
            const { result } = renderHook(
                () => useTaskStatusQuery(taskId, 'design-1', false),
                { wrapper: createWrapper() }
            );

            expect(result.current.fetchStatus).toBe('idle');
            expect(result.current.isPending).toBe(true); // Should be pending/idle if disabled and no data
        });

        it('should not poll if task ID is null', async () => {
            const { result } = renderHook(
                () => useTaskStatusQuery(null as any, 'design-1'),
                { wrapper: createWrapper() }
            );

            expect(result.current.isPending).toBe(true);
            expect(result.current.fetchStatus).toBe('idle');
        });
    });

    describe('useExportCSV', () => {
        it('should download CSV successfully', async () => {
            // Mock URL.createObjectURL and URL.revokeObjectURL
            const mockUrl = 'blob:http://localhost/mock-blob';
            global.URL.createObjectURL = vi.fn(() => mockUrl);
            global.URL.revokeObjectURL = vi.fn();

            // Mock document.createElement logic
            const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
            // Verify: We must capture original implementation because spy will replace it
            const originalCreateElement = document.createElement.bind(document);
            const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
                if (tagName === 'a') return link as any;
                return originalCreateElement(tagName, options);
            });
            const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
            const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

            const { result } = renderHook(() => useExportCSV('design-1'), {
                wrapper: createWrapper(),
            });

            result.current.mutate();

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(createElementSpy).toHaveBeenCalledWith('a');
            expect(link.href).toBe(mockUrl);
            expect(link.download).toContain('design-1');
            expect(link.click).toHaveBeenCalled();
            expect(toast.success).toHaveBeenCalled();

            // Cleanup mocks
            vi.restoreAllMocks();
        });

        it('should handle CSV export error', async () => {
            vi.spyOn(proposalsApi, 'exportCSV').mockRejectedValueOnce(new Error('Export failed'));

            const { result } = renderHook(() => useExportCSV('design-error'), {
                wrapper: createWrapper(),
            });

            await act(async () => {
                result.current.mutate();
            });

            await waitFor(() => expect(result.current.isError).toBe(true));
            expect(toast.error).toHaveBeenCalledWith('Failed to export CSV');
        });
    });
});

// Helper for queryClient access
function renderHookWithClient<TResult, TProps>(
    render: (initialProps: TProps) => TResult,
) {
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(render, { wrapper });
    return { result, rerender, unmount, queryClient };
}
