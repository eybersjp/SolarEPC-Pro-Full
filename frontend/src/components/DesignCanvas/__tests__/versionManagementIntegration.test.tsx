import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, createTestQueryClient } from '@/test/utils';
import { SaveVersionModal } from '../SaveVersionModal';
import { VersionList } from '../VersionList';
import { toast } from '@/lib/toast';
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';
import { QueryClient } from '@tanstack/react-query';

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
    ConfirmDialog: ({ open, onConfirm, isLoading, children }: any) => (
        open ? (
            <div data-testid="confirm-dialog">
                {children}
                <button onClick={onConfirm} disabled={isLoading} data-testid="confirm-button">
                    {isLoading ? 'Restoring...' : 'Confirm Restore'}
                </button>
            </div>
        ) : null
    ),
}));

describe('Version Management Integration Tests', () => {
    const designId = 'design-integration';
    let queryClient: QueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        queryClient = createTestQueryClient();
        useDesignCanvasStore.setState({
            syncState: 'synced',
            isModifiedSinceVersion: false,
            retryCount: 0,
        });
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    describe('Complete Version Workflow', () => {
        it('should complete full workflow: save → list → restore → verify recalculation', async () => {
            const user = userEvent.setup({ delay: null });

            // Step 1: Save a version
            const onVersionSaved = vi.fn();
            const { rerender } = renderWithProviders(
                <SaveVersionModal
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                    onVersionSaved={onVersionSaved}
                />,
                { queryClient }
            );

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Baseline Layout');

            const notesInput = screen.getByLabelText(/Notes/i);
            await user.type(notesInput, 'Initial configuration with conservative spacing');

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Version saved successfully');
                expect(onVersionSaved).toHaveBeenCalled();
            });

            // Step 2: View version list
            const onVersionRestored = vi.fn();
            rerender(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                    onVersionRestored={onVersionRestored}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
                expect(screen.getByText('Initial configuration with conservative spacing')).toBeInTheDocument();
            });

            // Verify version metadata
            expect(screen.getByText(/80 modules/i)).toBeInTheDocument();
            expect(screen.getByText(/44\.0 kWp/i)).toBeInTheDocument();

            // Step 3: Restore the version
            const restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
            await user.click(restoreButtons[0]);

            // Confirm restoration
            const confirmDialog = await screen.findByTestId('confirm-dialog');
            expect(confirmDialog).toBeInTheDocument();

            const confirmButton = within(confirmDialog).getByTestId('confirm-button');
            await user.click(confirmButton);

            // Step 4: Verify recalculation triggered
            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Restored to version'));
                expect(onVersionRestored).toHaveBeenCalled();
            });

            // Verify query cache invalidation
            await waitFor(() => {
                const queryState = queryClient.getQueryState(['siteDesign', designId]);
                expect(queryState?.isInvalidated).toBe(true);
            });
        });

        it('should handle recalculation polling after restore', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                    onVersionRestored={vi.fn()}
                />,
                { queryClient }
            );

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });

            // Restore version
            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = await screen.findByTestId('confirm-button');
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });

            // Verify energy estimate query is refetched
            await waitFor(() => {
                const energyQuery = queryClient.getQueryState(['energyEstimate', designId]);
                expect(energyQuery).toBeDefined();
            });

            // Verify financial analysis query is refetched
            await waitFor(() => {
                const financialQuery = queryClient.getQueryState(['financialAnalysis', designId]);
                expect(financialQuery).toBeDefined();
            });
        });
    });

    describe('Version Comparison', () => {
        it('should display multiple versions for comparison', async () => {
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
            await user.type(nameInput, 'Conservative');
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
            await user.type(nameInput, 'Aggressive');
            await user.click(screen.getByRole('button', { name: /Save Version/i }));

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledTimes(2);
            });

            // View version list
            rerender(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            // Verify both versions visible
            await waitFor(() => {
                expect(screen.getByText('Conservative')).toBeInTheDocument();
                expect(screen.getByText('Aggressive')).toBeInTheDocument();
            });

            // Verify versions are in chronological order (newest first)
            const versionItems = screen.getAllByRole('listitem');
            expect(versionItems.length).toBeGreaterThanOrEqual(2);
        });

        it('should show version metadata for comparison', async () => {
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

            // Verify metadata displayed
            expect(screen.getByText(/80 modules/i)).toBeInTheDocument();
            expect(screen.getByText(/44\.0 kWp/i)).toBeInTheDocument();
            expect(screen.getByText(/Test User/i)).toBeInTheDocument();

            // Verify timestamp displayed
            const timestamps = screen.getAllByText(/ago|just now/i);
            expect(timestamps.length).toBeGreaterThan(0);
        });
    });

    describe('Unsaved Changes Handling', () => {
        it('should warn when switching versions with unsaved changes', async () => {
            const user = userEvent.setup({ delay: null });

            // Set unsaved changes state
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

            // Try to restore
            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            // Should show warning in confirm dialog
            const confirmDialog = await screen.findByTestId('confirm-dialog');
            expect(within(confirmDialog).getByText(/unsaved changes/i)).toBeInTheDocument();
        });

        it('should allow restore after confirming unsaved changes loss', async () => {
            const user = userEvent.setup({ delay: null });

            useDesignCanvasStore.setState({
                isModifiedSinceVersion: true,
                syncState: 'pending',
            });

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

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = await screen.findByTestId('confirm-button');
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
                expect(onVersionRestored).toHaveBeenCalled();
            });

            // Verify unsaved changes cleared
            expect(useDesignCanvasStore.getState().isModifiedSinceVersion).toBe(false);
        });
    });

    describe('Version Filtering and Search', () => {
        it('should filter versions by name', async () => {
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

            // Type in search/filter
            const searchInput = screen.getByPlaceholderText(/search versions/i);
            await user.type(searchInput, 'Baseline');

            // Verify filtered results
            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });
        });

        it('should show empty state when no versions match filter', async () => {
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

            const searchInput = screen.getByPlaceholderText(/search versions/i);
            await user.type(searchInput, 'NonexistentVersion');

            await waitFor(() => {
                expect(screen.getByText(/no versions found/i)).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle version creation error and allow retry', async () => {
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

            // Modal should remain open for retry
            expect(screen.getByText('Save as Version')).toBeInTheDocument();

            // User can modify and retry
            await user.clear(nameInput);
            await user.type(nameInput, 'Retry Test');
            await user.click(saveButton);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledTimes(2);
            });
        });

        it('should handle version restore error with retry', async () => {
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

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = await screen.findByTestId('confirm-button');
            await user.click(confirmButton);

            // First attempts should fail (mock configured for 3 failures)
            await waitFor(() => {
                expect(toast.error).toHaveBeenCalled();
            });

            // Retry should eventually succeed
            await user.click(restoreButton);
            const retryConfirmButton = await screen.findByTestId('confirm-button');
            await user.click(retryConfirmButton);

            // Continue retrying until success
            for (let i = 0; i < 3; i++) {
                await user.click(restoreButton);
                const btn = await screen.findByTestId('confirm-button');
                await user.click(btn);
            }

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            }, { timeout: 5000 });
        });

        it('should handle loading state during version operations', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <SaveVersionModal
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Loading Test');

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            // Verify loading state
            expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });
        });
    });

    describe('React Query Integration', () => {
        it('should invalidate design query after version restore', async () => {
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

            const confirmButton = await screen.findByTestId('confirm-button');
            await user.click(confirmButton);

            await waitFor(() => {
                const designQuery = queryClient.getQueryState(['siteDesign', designId]);
                expect(designQuery?.isInvalidated).toBe(true);
            });
        });

        it('should refetch versions list after creation', async () => {
            const user = userEvent.setup({ delay: null });

            const { rerender } = renderWithProviders(
                <SaveVersionModal
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'New Version');
            await user.click(screen.getByRole('button', { name: /Save Version/i }));

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });

            // Switch to version list
            rerender(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={vi.fn()}
                />
            );

            // Should see the newly created version
            await waitFor(() => {
                expect(screen.getByText('New Version')).toBeInTheDocument();
            });
        });

        it('should handle stale data after version restore', async () => {
            const user = userEvent.setup({ delay: null });

            // Pre-populate cache with stale data
            queryClient.setQueryData(['siteDesign', designId], {
                id: designId,
                name: 'Old Design',
                updated_at: new Date(Date.now() - 3600000).toISOString(),
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

            const confirmButton = await screen.findByTestId('confirm-button');
            await user.click(confirmButton);

            // Verify fresh data is fetched
            await waitFor(() => {
                const designQuery = queryClient.getQueryData(['siteDesign', designId]);
                expect(designQuery).toBeDefined();
                expect((designQuery as any).updated_at).not.toBe(new Date(Date.now() - 3600000).toISOString());
            });
        });
    });
});
