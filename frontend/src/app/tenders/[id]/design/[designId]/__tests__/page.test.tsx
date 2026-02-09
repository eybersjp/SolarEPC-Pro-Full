import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import DesignCanvasPage from '../page';
import { renderWithProviders } from '@/test/utils';
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';
import { mockSiteDesign } from '@/test/fixtures/siteDesign';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

// Mock next/navigation
const mockBack = vi.fn();
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        back: mockBack,
        push: mockPush,
    }),
    useParams: () => ({
        id: 'tender-1',
        designId: 'design-1',
    }),
}));

// Mock ConfirmDialog to avoid Radix UI complexities in this test
vi.mock('@/components/common/ConfirmDialog', () => ({
    ConfirmDialog: ({ open, title, onConfirm, onOpenChange }: any) => (
        open ? (
            <div data-testid="confirm-dialog">
                <h1>{title}</h1>
                <button onClick={() => onConfirm()}>Confirm</button>
                <button onClick={() => onOpenChange(false)}>Cancel</button>
            </div>
        ) : null
    )
}));

describe('DesignCanvasPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useDesignCanvasStore.setState({
            syncState: 'synced',
            retryCount: 0,
        });

        server.use(
            http.get('*/api/site-designs/:id', () => {
                return HttpResponse.json(mockSiteDesign);
            })
        );
    });

    it('should prevent window unload when there are unsaved changes (pending or failed)', async () => {
        // Test pending
        useDesignCanvasStore.setState({ syncState: 'pending' });
        const { unmount } = renderWithProviders(<DesignCanvasPage />);
        await waitFor(() => expect(screen.queryByTestId('canvas-layout')).toBeInTheDocument());

        const event1 = new BeforeUnloadEvent();
        const spy1 = vi.spyOn(event1, 'preventDefault');
        window.dispatchEvent(event1);
        expect(spy1).toHaveBeenCalled();
        expect(event1.returnValue).toBe('');

        unmount();

        // Test failed
        useDesignCanvasStore.setState({ syncState: 'failed' });
        renderWithProviders(<DesignCanvasPage />);
        await waitFor(() => expect(screen.queryByTestId('canvas-layout')).toBeInTheDocument());

        const event2 = new BeforeUnloadEvent();
        const spy2 = vi.spyOn(event2, 'preventDefault');
        window.dispatchEvent(event2);
        expect(spy2).toHaveBeenCalled();
        expect(event2.returnValue).toBe('');
    });

    it('should NOT prevent window unload when changes are synced', async () => {
        useDesignCanvasStore.setState({ syncState: 'synced' });
        renderWithProviders(<DesignCanvasPage />);

        await waitFor(() => expect(screen.queryByTestId('canvas-layout')).toBeInTheDocument());

        const event = new BeforeUnloadEvent();
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        window.dispatchEvent(event);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should show navigation warning when clicking back with unsaved changes', async () => {
        useDesignCanvasStore.setState({ syncState: 'pending' });
        renderWithProviders(<DesignCanvasPage />);

        await waitFor(() => expect(screen.getByText(/Main Test Design/i)).toBeInTheDocument());

        // Click Back button in Toolbar
        const backButton = screen.getByRole('button', { name: /Back to Designs/i });
        fireEvent.click(backButton);

        // Verify dialog is shown
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText(/Unsaved Changes/i)).toBeInTheDocument();
    });

    it('should proceed with navigation when user confirms dialog', async () => {
        useDesignCanvasStore.setState({ syncState: 'pending' });
        renderWithProviders(<DesignCanvasPage />);

        await waitFor(() => expect(screen.getByText(/Main Test Design/i)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Back to Designs/i }));

        // Click Confirm in mocked dialog
        fireEvent.click(screen.getByText('Confirm'));

        expect(mockBack).toHaveBeenCalled();
        expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('should cancel navigation when user cancels dialog', async () => {
        useDesignCanvasStore.setState({ syncState: 'pending' });
        renderWithProviders(<DesignCanvasPage />);

        await waitFor(() => expect(screen.getByText(/Main Test Design/i)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Back to Designs/i }));

        // Click Cancel in mocked dialog
        fireEvent.click(screen.getByText('Cancel'));

        expect(mockBack).not.toHaveBeenCalled();
        expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('should navigate immediately when changes are synced', async () => {
        useDesignCanvasStore.setState({ syncState: 'synced' });
        renderWithProviders(<DesignCanvasPage />);

        await waitFor(() => expect(screen.getByText(/Main Test Design/i)).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: /Back to Designs/i }));

        expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
        expect(mockBack).toHaveBeenCalled();
    });
});
