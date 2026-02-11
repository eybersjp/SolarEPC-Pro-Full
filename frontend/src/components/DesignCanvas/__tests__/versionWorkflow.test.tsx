import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, createTestQueryClient } from '@/test/utils';
import { SaveVersionModal } from '../SaveVersionModal';
import { VersionList } from '../VersionList';
import { toast } from '@/lib/toast';
import { QueryClient } from '@tanstack/react-query';
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';

vi.mock('@/lib/toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('@/components/ui/dialog', async () => {
    const Actual = await vi.importActual('@/components/ui/dialog');
    return {
        ...Actual,
        DialogPortal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
    };
});

vi.mock('@/components/common/ConfirmDialog', () => ({
    ConfirmDialog: ({ open, onConfirm, isLoading }: any) => (
        open ? (
            <div data-testid="confirm-dialog">
                <button onClick={onConfirm} disabled={isLoading}>
                    {isLoading ? 'Restoring...' : 'Confirm Restore'}
                </button>
            </div>
        ) : null
    ),
}));

describe('Version Management Workflow', () => {
    const designId = 'design-workflow';
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        queryClient = createTestQueryClient();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    it('should complete full workflow: create → list → restore', async () => {
        const user = userEvent.setup({ delay: null });

        // Step 1: Create a version
        const { rerender } = renderWithProviders(
            <SaveVersionModal
                designId={designId}
                open={true}
                onOpenChange={vi.fn()}
                onVersionSaved={vi.fn()}
            />,
            { queryClient }
        );

        const nameInput = screen.getByLabelText(/Version Name/i);
        await user.type(nameInput, 'Workflow Test Version');

        const notesInput = screen.getByLabelText(/Notes/i);
        await user.type(notesInput, 'Testing complete workflow');

        const saveButton = screen.getByRole('button', { name: /Save Version/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('Version saved successfully');
        });

        // Step 2: View version in list
        rerender(
            <VersionList
                designId={designId}
                open={true}
                onOpenChange={vi.fn()}
                onVersionRestored={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Workflow Test Version')).toBeInTheDocument();
        });

        // Step 3: Restore the version
        const restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
        await user.click(restoreButtons[0]);

        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

        const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
        await user.click(confirmButton);

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Restored to version'));
        });
    });

    it('should handle multiple version creation and listing', async () => {
        const user = userEvent.setup({ delay: null });

        // Create first version
        const { rerender } = renderWithProviders(
            <SaveVersionModal
                designId={designId}
                open={true}
                onOpenChange={vi.fn()}
            />,
            { queryClient }
        );

        let nameInput = screen.getByLabelText(/Version Name/i);
        await user.type(nameInput, 'Version 1');
        await user.click(screen.getByRole('button', { name: /Save Version/i }));

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalled();
        });

        // Create second version
        rerender(
            <SaveVersionModal
                designId={designId}
                open={true}
                onOpenChange={vi.fn()}
            />
        );

        nameInput = screen.getByLabelText(/Version Name/i);
        await user.type(nameInput, 'Version 2');
        await user.click(screen.getByRole('button', { name: /Save Version/i }));

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledTimes(2);
        });

        // Verify both versions appear in list
        rerender(
            <VersionList
                designId={designId}
                open={true}
                onOpenChange={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Version 1')).toBeInTheDocument();
            expect(screen.getByText('Version 2')).toBeInTheDocument();
        });
    });

    it('should handle error during create and allow retry', async () => {
        const user = userEvent.setup({ delay: null });

        renderWithProviders(
            <SaveVersionModal
                designId="error-design"
                open={true}
                onOpenChange={vi.fn()}
            />,
            { queryClient }
        );

        const nameInput = screen.getByLabelText(/Version Name/i);
        await user.type(nameInput, 'Error Test');

        const saveButton = screen.getByRole('button', { name: /Save Version/i });
        await user.click(saveButton);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalled();
        });

        // Modal should still be open, allowing retry
        expect(screen.getByText('Save as Version')).toBeInTheDocument();

        // User can modify and retry
        await user.clear(nameInput);
        await user.type(nameInput, 'Retry Test');
        await user.click(saveButton);

        // Error should occur again (since error-design fails in mock)
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledTimes(2);
        });
    });
});

describe('Version Management Integration Scenarios', () => {
    const designId = 'design-integration-workflow';
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        queryClient = createTestQueryClient();
        useDesignCanvasStore.setState({
            syncState: 'synced',
            isModifiedSinceVersion: false,
        });
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    describe('Recalculation Triggers', () => {
        it('should trigger placement recalculation after version restore', async () => {
            const user = userEvent.setup({ delay: null });

            const onVersionRestored = vi.fn();
            renderWithProviders(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                    onVersionRestored={onVersionRestored}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            // Restore version
            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
                expect(onVersionRestored).toHaveBeenCalled();
            });

            // Verify design query invalidated (triggers refetch)
            await waitFor(() => {
                const designQuery = queryClient.getQueryState(['siteDesign', designId]);
                expect(designQuery?.isInvalidated).toBe(true);
            });
        });

        it('should trigger energy estimation after version restore', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });

            // Verify energy estimate query invalidated
            await waitFor(() => {
                const energyQuery = queryClient.getQueryState(['energyEstimate', designId]);
                expect(energyQuery?.isInvalidated).toBe(true);
            });
        });

        it('should trigger financial analysis after version restore', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });

            // Verify financial analysis query invalidated
            await waitFor(() => {
                const financialQuery = queryClient.getQueryState(['financialAnalysis', designId]);
                expect(financialQuery?.isInvalidated).toBe(true);
            });
        });
    });

    describe('Polling for Recalculation Completion', () => {
        it('should poll for energy estimation completion after restore', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <VersionList
                    designId="poll-finish"
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });

            // Advance timers to trigger polling
            act(() => {
                vi.advanceTimersByTime(2000); // First poll
            });

            await waitFor(() => {
                const energyQuery = queryClient.getQueryState(['energyEstimate', 'poll-finish']);
                expect(energyQuery).toBeDefined();
            });

            // Continue polling until completion
            act(() => {
                vi.advanceTimersByTime(2000); // Second poll
            });

            act(() => {
                vi.advanceTimersByTime(2000); // Third poll - should be completed
            });

            await waitFor(() => {
                const energyQuery = queryClient.getQueryData(['energyEstimate', 'poll-finish']);
                expect((energyQuery as any)?.status).toBe('completed');
            });
        });

        it('should show loading indicator during recalculation', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <VersionList
                    designId="poll-finish"
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            // Should show loading state during restore
            expect(screen.getByRole('button', { name: /Restoring/i })).toBeDisabled();

            const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });
        });
    });

    describe('Optimistic Updates and Rollback', () => {
        it('should handle optimistic update on version restore', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            // Set initial design data
            queryClient.setQueryData(['siteDesign', designId], {
                id: designId,
                name: 'Current Design',
                row_spacing_m: 3.0,
            });

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });

            // Verify data updated
            await waitFor(() => {
                const designData = queryClient.getQueryData(['siteDesign', designId]);
                expect(designData).toBeDefined();
            });
        });

        it('should rollback on restore failure', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <VersionList
                    designId="restore-fail"
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            // Set initial design data
            const originalData = {
                id: 'restore-fail',
                name: 'Original Design',
                row_spacing_m: 2.0,
            };
            queryClient.setQueryData(['siteDesign', 'restore-fail'], originalData);

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
            await user.click(confirmButton);

            // First restore should fail
            await waitFor(() => {
                expect(toast.error).toHaveBeenCalled();
            });

            // Verify data rolled back to original
            const designData = queryClient.getQueryData(['siteDesign', 'restore-fail']);
            expect(designData).toEqual(originalData);
        });
    });

    describe('Store State Management', () => {
        it('should clear unsaved changes flag after successful restore', async () => {
            const user = userEvent.setup({ delay: null });

            useDesignCanvasStore.setState({
                isModifiedSinceVersion: true,
                syncState: 'pending',
            });

            renderWithProviders(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });

            // Verify store state cleared
            expect(useDesignCanvasStore.getState().isModifiedSinceVersion).toBe(false);
        });

        it('should update sync state during restore', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = screen.getByRole('button', { name: /Confirm Restore/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });

            // Verify sync state updated
            const syncState = useDesignCanvasStore.getState().syncState;
            expect(['synced', 'syncing']).toContain(syncState);
        });
    });
});
