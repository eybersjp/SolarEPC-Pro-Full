import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { Toolbar } from '../Toolbar';
import { renderWithProviders } from '@/test/utils';
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';
import { toast } from '@/lib/toast';

// Mock toast
vi.mock('@/lib/toast', () => ({
    toast: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    }
}));

// Mock useUpdateSiteDesignMutation
const mockMutate = vi.fn();
vi.mock('@/hooks/useSiteDesigns', () => ({
    useUpdateSiteDesignMutation: () => ({
        mutate: mockMutate,
        isPending: false,
    })
}));

// Mock useDesignNavigation
vi.mock('../../app/tenders/[id]/design/[designId]/page', () => ({
    useDesignNavigation: () => ({
        back: vi.fn(),
        push: vi.fn(),
        replace: vi.fn(),
    })
}));

describe('Toolbar', () => {
    const props = {
        title: 'Test Design',
        tenderId: 'tender-1',
        designId: 'design-1',
        isVersionListOpen: false,
        onVersionListOpenChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        useDesignCanvasStore.setState({
            syncState: 'synced',
            lastSyncedAt: new Date(),
            retryCount: 0,
            lastMutationData: null,
        });
    });

    it('should show "Saving..." when syncState is syncing', () => {
        useDesignCanvasStore.setState({ syncState: 'syncing' });
        renderWithProviders(<Toolbar {...props} />);

        expect(screen.getByText(/Saving.../i)).toBeInTheDocument();
        expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('should show "Saved" when syncState is synced', () => {
        renderWithProviders(<Toolbar {...props} />);
        expect(screen.getByText(/Auto-saved/i)).toBeInTheDocument();
    });

    it('should display relative time for last sync', () => {
        const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
        useDesignCanvasStore.setState({ lastSyncedAt: twoMinsAgo });

        renderWithProviders(<Toolbar {...props} />);
        expect(screen.getByText(/2 minutes ago/i)).toBeInTheDocument();
    });

    it('should show "just now" for very recent syncs', () => {
        const fiveSecsAgo = new Date(Date.now() - 5 * 1000);
        useDesignCanvasStore.setState({ lastSyncedAt: fiveSecsAgo });

        renderWithProviders(<Toolbar {...props} />);
        expect(screen.getByText(/just now/i)).toBeInTheDocument();
    });

    it('should show failed state with retry count and alert icon', () => {
        useDesignCanvasStore.setState({
            syncState: 'failed',
            retryCount: 3
        });
        renderWithProviders(<Toolbar {...props} />);

        expect(screen.getByText(/Failed to save \(attempt 3\/3\)/i)).toBeInTheDocument();
        expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
    });

    it('should trigger manual retry when button is clicked', () => {
        const mutationData = { name: 'Retry Me' };
        useDesignCanvasStore.setState({
            syncState: 'failed',
            lastMutationData: mutationData
        });

        renderWithProviders(<Toolbar {...props} />);

        const retryButton = screen.getByRole('button', { name: /Failed to save/i });
        fireEvent.click(retryButton);

        expect(mockMutate).toHaveBeenCalledWith(mutationData);
        expect(toast.info).toHaveBeenCalledWith("Retrying save...");
    });

    it('should disable retry button and show spinner during manual retry', () => {
        // Re-mock hook for this specific test
        const { useUpdateSiteDesignMutation } = require('@/hooks/useSiteDesigns');
        vi.mocked(useUpdateSiteDesignMutation).mockReturnValue({
            mutate: mockMutate,
            isPending: true,
        });

        useDesignCanvasStore.setState({ syncState: 'failed' });
        renderWithProviders(<Toolbar {...props} />);

        const retryButton = screen.getByRole('button', { name: /Failed to save/i });
        expect(retryButton).toBeDisabled();
        expect(screen.getByTestId('refresh-icon')).toHaveClass('animate-spin');
    });

    it('should update relative time periodically', () => {
        vi.useFakeTimers();
        const initialSync = new Date();
        useDesignCanvasStore.setState({ lastSyncedAt: initialSync });

        renderWithProviders(<Toolbar {...props} />);
        expect(screen.getByText(/just now/i)).toBeInTheDocument();

        // Advance 2 minutes
        act(() => {
            vi.advanceTimersByTime(2 * 60 * 1000 + 1000);
        });

        expect(screen.getByText(/2 minutes ago/i)).toBeInTheDocument();
        vi.useRealTimers();
    });
});
