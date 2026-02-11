import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaveVersionModal } from '../SaveVersionModal';
import { renderWithProviders } from '@/test/utils';
import { toast } from '@/lib/toast';

vi.mock('@/lib/toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock Dialog Portal
vi.mock('@/components/ui/dialog', async () => {
    const Actual = await vi.importActual('@/components/ui/dialog');
    return {
        ...Actual,
        DialogPortal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
    };
});

// Mock useCreateVersionMutation
const { mockMutate, mockReset } = vi.hoisted(() => ({
    mockMutate: vi.fn(),
    mockReset: vi.fn(),
}));

vi.mock('@/hooks/useSiteDesigns', () => ({
    useCreateVersionMutation: () => ({
        mutate: mockMutate,
        reset: mockReset,
        isPending: false,
    })
}));

describe('SaveVersionModal', () => {
    const defaultProps = {
        designId: 'design-1',
        open: true,
        onOpenChange: vi.fn(),
        onVersionSaved: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering and Validation', () => {
        it('should render modal with form fields when open', () => {
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            expect(screen.getByText('Save as Version')).toBeInTheDocument();
            expect(screen.getByLabelText(/Version Name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Save Version/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
        });

        it('should not render when closed', () => {
            renderWithProviders(<SaveVersionModal {...defaultProps} open={false} />);
            expect(screen.queryByText('Save as Version')).not.toBeInTheDocument();
        });

        it('should show validation error for empty version name', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            expect(screen.getByText(/Version name is required/i)).toBeInTheDocument();
            expect(defaultProps.onVersionSaved).not.toHaveBeenCalled();
        });

        it('should show validation error for version name exceeding 255 characters', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const input = screen.getByLabelText(/Version Name/i);
            await user.type(input, 'a'.repeat(256));

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            expect(screen.getByText(/must be less than 255 characters/i)).toBeInTheDocument();
        });

        it('should show character count', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const input = screen.getByLabelText(/Version Name/i);
            await user.type(input, 'Test');

            expect(screen.getByText('4/255')).toBeInTheDocument();
        });

        it('should clear validation error when user corrects input', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            expect(screen.getByText(/Version name is required/i)).toBeInTheDocument();

            const input = screen.getByLabelText(/Version Name/i);
            await user.type(input, 'Valid Name');

            expect(screen.queryByText(/Version name is required/i)).not.toBeInTheDocument();
        });
    });

    describe('Form Submission', () => {
        it('should successfully create version with valid data', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            const notesInput = screen.getByLabelText(/Notes/i);

            await user.type(nameInput, 'Test Version');
            await user.type(notesInput, 'Test notes');

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Version saved successfully');
            });

            expect(defaultProps.onVersionSaved).toHaveBeenCalledWith('Test Version');
            expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
        });

        it('should trim whitespace from inputs', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, '  Trimmed Name  ');

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(defaultProps.onVersionSaved).toHaveBeenCalledWith('Trimmed Name');
            });
        });

        it('should handle optional notes field', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Version Without Notes');

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });
        });

        it('should show loading state during submission', async () => {
            const user = userEvent.setup();
            // Initial render with isPending: false
            const { rerender } = renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Loading Test');

            // Update mock to return isPending: true and rerender
            // We need to re-import to access the mocked function
            const { useCreateVersionMutation } = await import('@/hooks/useSiteDesigns');
            vi.mocked(useCreateVersionMutation).mockReturnValue({
                mutate: mockMutate,
                reset: mockReset,
                isPending: true,
                data: undefined,
                variables: undefined,
                error: null,
                isError: false,
                isIdle: false,
                isSuccess: false,
                status: 'pending',
                context: undefined,
                failureCount: 0,
                failureReason: null,
                isPaused: false,
                submittedAt: 0,
                mutateAsync: vi.fn(),
            } as any);

            rerender(<SaveVersionModal {...defaultProps} />);

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            expect(screen.getByText(/Saving.../i)).toBeInTheDocument();
            expect(saveButton).toBeDisabled();
        });

        it('should disable cancel button during submission', async () => {
            const user = userEvent.setup();
            const { rerender } = renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Test');

            // Update mock to return isPending: true and rerender
            const { useCreateVersionMutation } = await import('@/hooks/useSiteDesigns');
            vi.mocked(useCreateVersionMutation).mockReturnValue({
                mutate: mockMutate,
                reset: mockReset,
                isPending: true,
                data: undefined,
                variables: undefined,
                error: null,
                isError: false,
                isIdle: false,
                isSuccess: false,
                status: 'pending',
                context: undefined,
                failureCount: 0,
                failureReason: null,
                isPaused: false,
                submittedAt: 0,
                mutateAsync: vi.fn(),
            } as any);

            rerender(<SaveVersionModal {...defaultProps} />);

            const cancelButton = screen.getByRole('button', { name: /Cancel/i });
            expect(cancelButton).toBeDisabled();
        });

        it('should prevent closing during submission', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Test');

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            // Try to close via Escape
            await user.keyboard('{Escape}');

            // Modal should still be open
            expect(screen.getByText('Save as Version')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('should show error toast on submission failure', async () => {
            const user = userEvent.setup();
            // Use a design ID that triggers error in handlers
            renderWithProviders(<SaveVersionModal {...defaultProps} designId="error-design" />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Error Test');

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalled();
            });

            // Modal should remain open on error
            expect(screen.getByText('Save as Version')).toBeInTheDocument();
        });
    });

    describe('Form Reset', () => {
        it('should reset form when modal closes', async () => {
            const user = userEvent.setup();
            const { rerender } = renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            const notesInput = screen.getByLabelText(/Notes/i);

            await user.type(nameInput, 'Test Name');
            await user.type(notesInput, 'Test Notes');

            // Close modal
            rerender(<SaveVersionModal {...defaultProps} open={false} />);

            // Reopen modal
            rerender(<SaveVersionModal {...defaultProps} open={true} />);

            const newNameInput = screen.getByLabelText(/Version Name/i);
            const newNotesInput = screen.getByLabelText(/Notes/i);

            expect(newNameInput).toHaveValue('');
            expect(newNotesInput).toHaveValue('');
        });

        it('should clear validation errors when modal reopens', async () => {
            const user = userEvent.setup();
            const { rerender } = renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            expect(screen.getByText(/Version name is required/i)).toBeInTheDocument();

            // Close and reopen
            rerender(<SaveVersionModal {...defaultProps} open={false} />);
            rerender(<SaveVersionModal {...defaultProps} open={true} />);

            expect(screen.queryByText(/Version name is required/i)).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA attributes', () => {
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            expect(nameInput).toHaveAttribute('aria-invalid', 'false');
        });

        it('should set aria-invalid when validation fails', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            const nameInput = screen.getByLabelText(/Version Name/i);
            expect(nameInput).toHaveAttribute('aria-invalid', 'true');
            expect(nameInput).toHaveAttribute('aria-describedby', 'version-name-error');
        });

        it('should focus version name input on open', () => {
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            expect(nameInput).toHaveFocus();
        });
    });
});
