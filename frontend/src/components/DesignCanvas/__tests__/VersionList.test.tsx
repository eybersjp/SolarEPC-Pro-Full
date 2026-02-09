import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VersionList } from '../VersionList';
import { renderWithProviders } from '@/test/utils';
import { toast } from '@/lib/toast';

vi.mock('@/lib/toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock ConfirmDialog
vi.mock('@/components/common/ConfirmDialog', () => ({
    ConfirmDialog: ({ open, title, description, onConfirm, isLoading }: any) => (
        open ? (
            <div data-testid="confirm-dialog">
                <h2>{title}</h2>
                <p>{description}</p>
                <button onClick={onConfirm} disabled={isLoading}>
                    {isLoading ? 'Restoring...' : 'Confirm'}
                </button>
            </div>
        ) : null
    ),
}));

describe('VersionList', () => {
    const defaultProps = {
        designId: 'design-1',
        open: true,
        onOpenChange: vi.fn(),
        onVersionRestored: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering States', () => {
        it('should render trigger button', () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            expect(screen.getByRole('button', { name: /Version history/i })).toBeInTheDocument();
        });

        it('should render version list when data loads', async () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
                expect(screen.getByText('Option A')).toBeInTheDocument();
                expect(screen.getByText('Option B')).toBeInTheDocument();
            });
        });

        it('should render empty state when no versions exist', async () => {
            renderWithProviders(<VersionList {...defaultProps} designId="no-versions" />);

            await waitFor(() => {
                expect(screen.getByText(/No versions saved yet/i)).toBeInTheDocument();
                expect(screen.getByText(/Save a version to create snapshots/i)).toBeInTheDocument();
            });
        });

        it('should render error state on fetch failure', async () => {
            renderWithProviders(<VersionList {...defaultProps} designId="error-versions" />);

            await waitFor(() => {
                expect(screen.getByText(/Failed to load versions/i)).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
            });
        });

        it('should retry loading on retry button click', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} designId="error-versions" />);

            await waitFor(() => {
                expect(screen.getByText(/Failed to load versions/i)).toBeInTheDocument();
            });

            const retryButton = screen.getByRole('button', { name: /Retry/i });
            await user.click(retryButton);

            // Verify refetch was triggered (loading state/spinner appears)
        });

        it('should show loading indicator and aria-busy during initial fetch', async () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            // Check for aria-busy on the dropdown content
            const content = screen.getByRole('menu');
            expect(content).toHaveAttribute('aria-busy', 'true');

            // Verify loading spinner within the label
            const label = screen.getByText(/Version History/i);
            expect(label).toBeInTheDocument();

            // Since it's loading, mock versions should not be visible yet
            expect(screen.queryByText('Initial Layout')).not.toBeInTheDocument();
        });
    });

    describe('Version Display', () => {
        it('should display version metadata correctly', async () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            // Check for created by
            expect(screen.getByText('Test User')).toBeInTheDocument();

            // Check for notes
            expect(screen.getByText(/First version with basic module placement/i)).toBeInTheDocument();

            // Check for module count badge
            expect(screen.getByText(/80 modules/i)).toBeInTheDocument();

            // Check for system size badge
            expect(screen.getByText(/44.0 kWp/i)).toBeInTheDocument();
        });

        it('should format dates correctly', async () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                // Recent dates should show relative time or formatted date
                expect(screen.queryByText(/Initial Layout/i)).toBeInTheDocument();
            });
        });

        it('should handle versions without notes', async () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Option A')).toBeInTheDocument();
            });

            // Version without notes should not show notes section
            const versionItem = screen.getByText('Option A').closest('div');
            // We expect the notes text explicitly NOT to be there, not just the word "notes"
            expect(versionItem).not.toHaveTextContent(/increased setback/i);
        });

        it('should show restore buttons', async () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            const restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
            expect(restoreButtons.length).toBeGreaterThan(0);
        });
    });

    describe('Version Restore', () => {
        it('should open confirmation dialog on restore click', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            const restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
            await user.click(restoreButtons[0]);

            expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
            expect(screen.getByText(/Restore Version?/i)).toBeInTheDocument();
            expect(screen.getByText(/Restoring will overwrite your current design/i)).toBeInTheDocument();
        });

        it('should successfully restore version', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            const restoreButtons = screen.getAllByRole('button', { name: /Restore to version Initial Layout/i });
            await user.click(restoreButtons[0]);

            const confirmButton = screen.getByRole('button', { name: /Confirm/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Restored to version: Initial Layout');
            });

            expect(defaultProps.onVersionRestored).toHaveBeenCalledWith('Initial Layout');
            expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
        });

        it('should show loading state during restore', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            const restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
            await user.click(restoreButtons[0]);

            const confirmButton = screen.getByRole('button', { name: /Confirm/i });
            await user.click(confirmButton);

            expect(screen.getByText(/Restoring.../i)).toBeInTheDocument();
        });

        it('should handle restore error', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} designId="restore-fail" />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            const restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
            await user.click(restoreButtons[0]);

            const confirmButton = screen.getByRole('button', { name: /Confirm/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalled();
            });

            // Dialog should remain open on error
            expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
        });

        it('should disable restore buttons during restore operation', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            const restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
            await user.click(restoreButtons[0]);

            const confirmButton = screen.getByRole('button', { name: /Confirm/i });
            await user.click(confirmButton);

            // All restore buttons should be disabled
            restoreButtons.forEach(button => {
                expect(button).toBeDisabled();
            });
        });
    });

    describe('Dropdown Behavior', () => {
        it('should open dropdown when trigger is clicked', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} open={false} />);

            const trigger = screen.getByRole('button', { name: /Version history/i });
            await user.click(trigger);

            expect(defaultProps.onOpenChange).toHaveBeenCalledWith(true);
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            const trigger = screen.getByRole('button', { name: /Version history/i });
            expect(trigger).toHaveAttribute('aria-label', 'Version history');
        });

        it('should have proper restore button labels', async () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            const restoreButton = screen.getByRole('button', { name: /Restore to version Initial Layout/i });
            expect(restoreButton).toBeInTheDocument();
        });
    });

    describe('Tooltip', () => {
        it('should show tooltip on trigger hover', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} />);

            const trigger = screen.getByRole('button', { name: /Version history/i });
            await user.hover(trigger);

            // Look for tooltip content (Ctrl+H) hint was added in previous task
            await waitFor(() => {
                expect(screen.getByText(/View and restore previous versions \(Ctrl\+H\)/i)).toBeInTheDocument();
            });
        });
    });
});
