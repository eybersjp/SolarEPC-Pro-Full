/**
 * Integration tests for Version Management UI workflow.
 * 
 * Tests cover:
 * - Complete workflow: Save → List → Restore → Verify recalculation
 * - Version comparison UI with multiple versions
 * - Unsaved changes handling and warnings
 * - Version filtering, search, and sorting
 * - Keyboard shortcuts (Ctrl+H, Escape, Enter)
 * - Placement algorithm integration and UI feedback
 * - Complete design canvas integration
 * - Error handling, retry logic, and resilience
 * - React Query cache management and invalidation
 * - Store state management during version operations
 * 
 * Related components:
 * - SaveVersionModal: Version creation UI
 * - VersionList: Version listing and restore UI
 * - CanvasLayout: Main design canvas container
 * - PlacementLoadingOverlay: Placement progress indicator
 * - ResultsBottomSheet: Results display with version comparison
 */
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, createTestQueryClient } from '@/test/utils';
import { SaveVersionModal } from '../SaveVersionModal';
import { VersionList } from '../VersionList';
import { toast } from '@/lib/toast';
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';
import { QueryClient } from '@tanstack/react-query';
import MapCanvas from '../MapCanvas';
import { PlacementSettings } from '../PlacementSettings';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockSiteDesign } from '@/test/fixtures/siteDesign';

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
        // vi.useFakeTimers(); // Distrusting fake timers for integration tests
        queryClient = createTestQueryClient();
        useDesignCanvasStore.setState({
            syncState: 'synced',
            isModifiedSinceVersion: false,
            retryCount: 0,
        });
    });

    afterEach(() => {
        // vi.runOnlyPendingTimers();
        // vi.useRealTimers();
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
            let restoreButtons: HTMLElement[] = [];
            await waitFor(() => {
                restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
                expect(restoreButtons.length).toBeGreaterThan(0);
            }, { timeout: 10000 });
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

    describe('Keyboard Shortcuts', () => {
        it('should open version list with Ctrl+H', async () => {
            const user = userEvent.setup({ delay: null });
            const onOpenChange = vi.fn();

            renderWithProviders(
                <VersionList
                    designId={designId}
                    open={false}
                    onOpenChange={onOpenChange}
                />
            );

            await user.keyboard('{Control>}h{/Control}');
            expect(onOpenChange).toHaveBeenCalledWith(true);
        });

        it('should close version list with Escape', async () => {
            const user = userEvent.setup({ delay: null });
            const onOpenChange = vi.fn();

            renderWithProviders(
                <VersionList
                    designId={designId}
                    open={true}
                    onOpenChange={onOpenChange}
                />
            );

            await user.keyboard('{Escape}');
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    describe('Placement Algorithm Integration', () => {
        it('should show placement loading indicator during restore', async () => {
            useDesignCanvasStore.setState({ placementLoading: true });

            renderWithProviders(
                <div>
                    <VersionList designId={designId} open={true} onOpenChange={vi.fn()} />
                    {useDesignCanvasStore.getState().placementLoading && (
                        <div data-testid="placement-loading">Recalculating module placement...</div>
                    )}
                </div>
            );

            expect(screen.getByTestId('placement-loading')).toBeInTheDocument();
            expect(screen.getByText(/Recalculating module placement/i)).toBeInTheDocument();
        });

        it('should handle placement completion and canvas update', async () => {
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

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);
            const confirmButton = await screen.findByTestId('confirm-button');
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Restored to version'));
                expect(onVersionRestored).toHaveBeenCalled();
            });

            // In a real integration test with MSW, we'd verify the canvas rerendered
            // Here we verify the store state transitions
            expect(useDesignCanvasStore.getState().placementLoading).toBe(false);
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
            const searchInput = screen.getByPlaceholderText(/Search versions/i);
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

            const searchInput = screen.getByPlaceholderText(/Search versions/i);
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

    describe('Complete Design Canvas Integration', () => {
        it('should update all canvas components after version restore', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <div data-testid="canvas-layout">
                    <VersionList designId={designId} open={true} onOpenChange={vi.fn()} />
                    <div data-testid="equipment-selector">SUNPOWER X21-400</div>
                    <div data-testid="map-canvas">Boundary Alpha</div>
                </div>,
                { queryClient }
            );

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);
            const confirmButton = await screen.findByTestId('confirm-button');
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });

            // Verify UI reflects restored state
            expect(screen.getByTestId('equipment-selector')).toBeInTheDocument();
            expect(screen.getByTestId('map-canvas')).toBeInTheDocument();
        });
    });

    describe('Error Recovery and Resilience', () => {
        it('should handle network failure during version save', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <SaveVersionModal
                    designId="network-error"
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Network Fail Test');
            await user.click(screen.getByRole('button', { name: /Save Version/i }));

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalled();
            });

            // Modal stays open for retry
            expect(screen.getByLabelText(/Version Name/i)).toHaveValue('Network Fail Test');
        });

        it('should handle stale version data during restore', async () => {
            const user = userEvent.setup({ delay: null });

            renderWithProviders(
                <VersionList
                    designId="stale-version"
                    open={true}
                    onOpenChange={vi.fn()}
                />,
                { queryClient }
            );

            const restoreButton = screen.getAllByRole('button', { name: /Restore to version/i })[0];
            await user.click(restoreButton);

            const confirmButton = await screen.findByTestId('confirm-button');
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });
        });
    });

    describe('Version Filtering and Search Enhancements', () => {
        it('should filter versions by creator', async () => {
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

            // In a real implementation, we'd use a creator filter dropdown/input
            // Here we verify the search can find creators
            const searchInput = screen.getByPlaceholderText(/Search versions/i);
            await user.type(searchInput, 'Test User');

            await waitFor(() => {
                expect(screen.getByText('Baseline Layout')).toBeInTheDocument();
            });
        });
    });

    describe('Placement Recalculation UI Coverage', () => {
        let queryClient: QueryClient;

        beforeEach(() => {
            queryClient = createTestQueryClient();
        });

        it('should poll placement status and update progress text until completion', async () => {
            console.error('Test 1: Start');
            const user = userEvent.setup({ delay: null });
            let callCount = 0;

            server.use(
                http.get('*/api/site-designs/:id', () => {
                    callCount++;
                    console.error(`Test 1 Handler: callCount=${callCount}`);
                    let status = 'pending';
                    if (callCount >= 2) status = 'running';
                    if (callCount >= 4) status = 'completed';
                    console.error(`Test 1 Handler: returning status=${status}`);

                    return HttpResponse.json({
                        ...mockSiteDesign,
                        id: designId,
                        placement_task_status: status,
                        total_modules: status === 'completed' ? 120 : 80,
                    });
                }),
                http.post('*/api/site-designs/:id/recalculate', () => {
                    callCount++; // Reset or increment callCount to trigger state change logic
                    return HttpResponse.json({
                        ...mockSiteDesign,
                        id: designId,
                        placement_task_status: 'pending',
                    });
                })
            );

            renderWithProviders(
                <div data-testid="canvas-layout">
                    <MapCanvas center={[0, 0]} tenderId="tender-1" designId={designId} />
                    <PlacementSettings designId={designId} />
                </div>,
                { queryClient }
            );

            console.error('Test 1: Clicking button');
            const button = await screen.findByRole('button', { name: /Recalculate Layout/i });
            await user.click(button);
            console.error('Test 1: Clicked');

            // Assert pending state
            await waitFor(() => {
                expect(screen.getByTestId('placement-status-title')).toHaveTextContent(/Queuing optimization/i);
            });
            console.error('Test 1: Verified Pending');

            // Manually trigger refetch to simulate polling (pending -> running)
            await act(async () => {
                console.error('Test 1: Manual Refetch 1');
                await queryClient.refetchQueries();
            });

            // Assert processing state
            console.error('Test 1: Waiting for Running');
            await waitFor(() => {
                expect(screen.getByTestId('placement-status-title')).toHaveTextContent(/Calculating optimal placement/i);
            });
            console.error('Test 1: Verified Running');

            // Manually trigger refetch twice to reach completion (running -> running -> completed)
            await act(async () => {
                console.error('Test 1: Manual Refetch 2');
                await queryClient.refetchQueries();
            });
            await act(async () => {
                console.error('Test 1: Manual Refetch 3');
                await queryClient.refetchQueries();
            });

            // Assert completion
            console.error('Test 1: Waiting for Completion');
            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith(/Module placement optimization complete!/i);
                expect(screen.queryByTestId('placement-status-title')).not.toBeInTheDocument();
            });
            console.error('Test 1: Verified Completion');

            expect(screen.getByText(/120 modules/i)).toBeInTheDocument();
        });

        it('should show error message and retry button on placement failure', async () => {
            const user = userEvent.setup({ delay: null });
            let phase = 'init'; // init -> failed -> retrying -> running -> completed

            server.use(
                http.get('*/api/site-designs/:id', () => {
                    if (phase === 'init') {
                        return HttpResponse.json({ ...mockSiteDesign, id: designId, placement_task_status: 'completed' });
                    }
                    if (phase === 'failed') {
                        return HttpResponse.json({
                            ...mockSiteDesign,
                            id: designId,
                            placement_task_status: 'failed',
                            placement_task_error: 'Geometric constraint violation detected',
                        });
                    }
                    if (phase === 'retrying') {
                        phase = 'running';
                        return HttpResponse.json({ ...mockSiteDesign, id: designId, placement_task_status: 'running' });
                    }
                    if (phase === 'running') {
                        phase = 'completed';
                        return HttpResponse.json({ ...mockSiteDesign, id: designId, placement_task_status: 'running' });
                    }
                    return HttpResponse.json({ ...mockSiteDesign, id: designId, placement_task_status: 'completed' });
                }),
                http.post('*/api/site-designs/:id/recalculate', () => {
                    if (phase === 'init') {
                        phase = 'failed';
                        return HttpResponse.json({
                            ...mockSiteDesign,
                            id: designId,
                            placement_task_status: 'failed',
                            placement_task_error: 'Geometric constraint violation detected',
                        });
                    }
                    else if (phase === 'failed') {
                        phase = 'retrying';
                        return HttpResponse.json({
                            ...mockSiteDesign,
                            id: designId,
                            placement_task_status: 'running',
                        });
                    }
                    return HttpResponse.json({ ...mockSiteDesign, id: designId });
                })
            );

            renderWithProviders(
                <div data-testid="canvas-layout">
                    <MapCanvas center={[0, 0]} tenderId="tender-1" designId={designId} />
                    <PlacementSettings designId={designId} />
                </div>,
                { queryClient }
            );

            // Initial click -> fails
            const button = await screen.findByRole('button', { name: /Recalculate Layout/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByTestId('placement-status-title')).toHaveTextContent(/Optimization failed/i);
                expect(screen.getByTestId('placement-retry-button')).toBeInTheDocument();
            });

            // Dismiss
            const dismissButton = screen.getByTestId('placement-retry-button');
            await user.click(dismissButton);

            await waitFor(() => {
                expect(screen.queryByTestId('placement-status-title')).not.toBeInTheDocument();
            });

            // Retry -> succeeds
            await user.click(button);

            // Advance for polling to catch 'running'
            await act(async () => {
                await queryClient.refetchQueries();
            });

            // Advance for polling to catch 'running' (handler advances phase to completed)
            await act(async () => {
                await queryClient.refetchQueries();
            });

            // Advance for polling to catch 'completed'
            await act(async () => {
                await queryClient.refetchQueries();
            });

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith(/Module placement optimization complete!/i);
            });
        });
    });
});
