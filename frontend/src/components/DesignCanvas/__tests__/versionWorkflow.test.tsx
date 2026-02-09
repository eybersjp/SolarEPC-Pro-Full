import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { SaveVersionModal } from '../SaveVersionModal';
import { VersionList } from '../VersionList';
import { toast } from '@/lib/toast';

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

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should complete full workflow: create → list → restore', async () => {
        const user = userEvent.setup();

        // Step 1: Create a version
        const { rerender } = renderWithProviders(
            <SaveVersionModal
                designId={designId}
                open={true}
                onOpenChange={vi.fn()}
                onVersionSaved={vi.fn()}
            />
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
        const user = userEvent.setup();

        // Create first version
        const { rerender } = renderWithProviders(
            <SaveVersionModal
                designId={designId}
                open={true}
                onOpenChange={vi.fn()}
            />
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
        const user = userEvent.setup();

        renderWithProviders(
            <SaveVersionModal
                designId="error-design"
                open={true}
                onOpenChange={vi.fn()}
            />
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
