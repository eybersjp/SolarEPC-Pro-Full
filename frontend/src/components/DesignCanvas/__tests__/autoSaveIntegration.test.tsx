import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlacementSettings } from '../PlacementSettings';
import { Toolbar } from '../Toolbar';
import { renderWithProviders } from '@/test/utils';
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockSiteDesign } from '@/test/fixtures/siteDesign';
import { toast } from '@/lib/toast';

// Mock toast
vi.mock('@/lib/toast', () => ({
    toast: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    }
}));

describe('Auto-save Integration', () => {
    const designId = 'integration-test-design';

    beforeEach(() => {
        vi.clearAllMocks();
        useDesignCanvasStore.setState({
            syncState: 'synced',
            retryCount: 0,
            placementSettings: mockSiteDesign.placement_settings,
        });

        // Reset MSW handlers state via special endpoint or manual reset if exposed
        // Since testState isn't exported, we rely on the specific designId to avoid collisions
    });

    it('should handle complete flow: change -> debounce -> failure -> retry -> success', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        let putCallCount = 0;
        server.use(
            http.put('*/api/site-designs/:id', async () => {
                putCallCount++;
                if (putCallCount <= 2) {
                    return new HttpResponse(null, { status: 500 });
                }
                return HttpResponse.json({ ...mockSiteDesign, id: designId });
            })
        );

        renderWithProviders(
            <>
                <Toolbar
                    title="Integration Test"
                    tenderId="tender-1"
                    designId={designId}
                    isVersionListOpen={false}
                    onVersionListOpenChange={vi.fn()}
                />
                <PlacementSettings designId={designId} />
            </>
        );

        // 1. Trigger change
        await screen.findAllByRole('spinbutton');
        const azimuthInput = screen.getAllByRole('spinbutton')[0];
        await user.clear(azimuthInput);
        await user.type(azimuthInput, '190');

        expect(useDesignCanvasStore.getState().syncState).toBe('pending');
        expect(screen.getByText(/Saved/i)).toBeInTheDocument(); // Still shows last saved until syncing starts

        // 2. Advance 30s for debounce
        act(() => { vi.advanceTimersByTime(31000); });

        await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('syncing'));
        expect(screen.getByText(/Saving.../i)).toBeInTheDocument();

        // 3. First failure happens. Should trigger retry logic.
        await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(1));
        expect(useDesignCanvasStore.getState().syncState).toBe('failed');
        expect(screen.getByText(/Failed to save \(attempt 1\/3\)/i)).toBeInTheDocument();
        expect(toast.error).toHaveBeenCalledWith("Failed to save changes. Retrying...");

        // 4. Advance 1s for first retry
        act(() => { vi.advanceTimersByTime(1100); });
        await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(2));

        // 5. Advance 2s for second retry (which will succeed)
        act(() => { vi.advanceTimersByTime(2100); });

        await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('synced'));
        expect(useDesignCanvasStore.getState().retryCount).toBe(0);
        expect(toast.success).toHaveBeenCalledWith("Design saved");
        expect(screen.getByText(/Auto-saved just now/i)).toBeInTheDocument();

        expect(putCallCount).toBe(3);
        vi.useRealTimers();
    });

    it('should allow manual retry after all automatic retries fail', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        server.use(
            http.put('*/api/site-designs/:id', () => {
                return new HttpResponse(null, { status: 500 });
            })
        );

        renderWithProviders(
            <>
                <Toolbar
                    title="Integration Test"
                    tenderId="tender-1"
                    designId={designId}
                    isVersionListOpen={false}
                    onVersionListOpenChange={vi.fn()}
                />
                <PlacementSettings designId={designId} />
            </>
        );

        // Trigger change
        await screen.findAllByRole('spinbutton');
        const azimuthInput = screen.getAllByRole('spinbutton')[0];
        await user.clear(azimuthInput);
        await user.type(azimuthInput, '200');

        // Advance debounce + all retries (30s + 1s + 2s + 4s)
        act(() => { vi.advanceTimersByTime(30000 + 1000 + 2000 + 4000 + 1000); });

        await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('failed'));
        expect(useDesignCanvasStore.getState().retryCount).toBe(3);
        expect(screen.getByText(/Failed to save \(attempt 3\/3\)/i)).toBeInTheDocument();

        // Now setup success for manual retry
        server.use(
            http.put('*/api/site-designs/:id', async ({ request }) => {
                const body = await request.json() as any;
                return HttpResponse.json({ ...mockSiteDesign, ...body, id: designId });
            })
        );

        // Click manual retry
        const retryButton = screen.getByRole('button', { name: /Failed to save/i });
        fireEvent.click(retryButton);

        expect(toast.info).toHaveBeenCalledWith("Retrying save...");

        // Wait for success
        await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('synced'));
        expect(useDesignCanvasStore.getState().retryCount).toBe(0);
        expect(toast.success).toHaveBeenCalledWith("Design saved");

        vi.useRealTimers();
    });
});
