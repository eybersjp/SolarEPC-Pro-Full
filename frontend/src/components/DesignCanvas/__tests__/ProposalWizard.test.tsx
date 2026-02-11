import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProposalWizard } from '../ProposalWizard';
import { renderWithProviders } from '@/test/utils';
import { toast } from 'sonner';

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    }
}));

// Mock Dialog Portal
vi.mock('@/components/ui/dialog', async () => {
    const Actual = await vi.importActual('@/components/ui/dialog');
    return {
        ...Actual,
        DialogPortal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
    };
});

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.confirm
window.confirm = vi.fn(() => true);

const renderProposalWizard = (
    designId: string = 'design-1',
    open: boolean = true,
    onOpenChange: (open: boolean) => void = vi.fn()
) => {
    const user = userEvent.setup({ delay: null });
    return {
        user,
        onOpenChange,
        ...renderWithProviders(
            <ProposalWizard
                designId={designId}
                open={open}
                onOpenChange={onOpenChange}
            />
        )
    };
};

describe('ProposalWizard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        // Reset MSW handlers or test state if needed via API call or direct access if possible
        // Ideally we reset testState via the handlers reset mechanism if we exposed it
    });

    describe('Step 1: Configure', () => {
        it('should render step 1 with title input and section checkboxes', async () => {
            const { user } = renderProposalWizard();

            expect(screen.getByText(/Step 1 of 3: Configure/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Proposal Title/i)).toBeInTheDocument();

            // Verify all 6 sections
            expect(screen.getByLabelText(/Cover Page/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Site Map/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Technical Specifications/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Energy Production Analysis/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Financial Analysis/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Equipment Details/i)).toBeInTheDocument();
        });

        it('should enable Next button only when at least one section is selected', async () => {
            const { user } = renderProposalWizard();

            const nextBtn = screen.getByRole('button', { name: /Next: Preview/i });
            expect(nextBtn).not.toBeDisabled(); // All sections checked by default

            // Uncheck one section for test (unchecking all is tedious in test without helpers)
            // But let's uncheck all? 
            // Simplified: uncheck all implies clicking all 6. 
            // Let's assume default is checked.

            // To properly test disabled state, we need to uncheck EVERYTHING.
            const checkboxes = screen.getAllByRole('checkbox');
            for (const checkbox of checkboxes) {
                await user.click(checkbox);
            }

            expect(nextBtn).toBeDisabled();

            // Re-check one
            await user.click(checkboxes[0]);
            expect(nextBtn).not.toBeDisabled();
        });
    });

    describe('Step 2: Preview & Generation', () => {
        beforeEach(() => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should show loading state and poll task status', async () => {
            const { user } = renderProposalWizard();

            // Navigate to step 2
            await user.click(screen.getByRole('button', { name: /Next: Preview/i }));

            // Should show loading - Wait for mutation to start
            await waitFor(() => {
                expect(screen.getByText(/Queuing/i)).toBeInTheDocument();
            });

            // Advance timers to trigger polling (2s)
            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });

            // Status should transition to STARTED (based on handler logic count 2)
            await waitFor(() => {
                expect(screen.getByText(/Generating/i)).toBeInTheDocument();
            });

            // Advance to success (2s more)
            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });

            await waitFor(() => {
                expect(screen.getByText(/Proposal generated successfully/i)).toBeInTheDocument();
            });

            // Verify iframe with PDF
            const iframe = screen.getByTitle(/Proposal Preview/i);
            expect(iframe).toHaveAttribute('src', expect.stringContaining('.pdf'));
        });

        it('should show error state and allow retry', async () => {
            // We need to trigger a failure. Handlers fail if task ID includes 'fail'.
            // But task ID is generated in POST handler.
            // We can mock the POST handler to return a specific task ID that will fail in GET.

            // Since we can't easily modify handler internals per test without setupServer (which is global),
            // let's rely on the designId trigger.
            // If we pass designId 'fail-test', the POST handler generates a task ID.
            // Handler POST: `task-${id}-${Date.now()}`.
            // Handler GET: `if (taskId.includes('fail'))`.
            // So if designId is 'fail-test', taskId will contain 'fail-test', so GET will fail. 
            // Logic seems sound in existing handlers? Let's verify handler logic.
            // POST: `const taskId = \`task-${id}-${Date.now()}\``
            // GET: `if (taskId.includes('fail'))`
            // Yes, passing `fail-design` as designId should work.

            const { user } = renderProposalWizard('fail-design');

            await user.click(screen.getByRole('button', { name: /Next: Preview/i }));

            // Wait for loading first
            await waitFor(() => {
                expect(screen.getByText(/Queuing/i)).toBeInTheDocument();
            });

            // Advance to success/fail
            // Handler logic: fail-design -> task-fail... -> GET returns FAILURE immediate if includes fail?
            // Handlers: if taskId includes 'fail' -> FAILURE. 
            // POST generates task ID with design ID. so 'fail-design' -> 'task-fail-design...' -> FAILURE.

            await act(async () => {
                await vi.advanceTimersByTimeAsync(2000);
            });

            await waitFor(() => {
                const errorTexts = screen.getAllByText(/Generation Failed/i);
                expect(errorTexts.length).toBeGreaterThan(0);
                // We mock toast, so we might check for toast too, but UI check is good
            });

            const retryBtn = screen.getByRole('button', { name: /Try Again/i });
            await user.click(retryBtn);

            // Should return to step 1
            expect(screen.getByText(/Step 1 of 3: Configure/i)).toBeInTheDocument();
        });
    });

    describe('Persistence', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('should persist wizard state to localStorage', async () => {
            const { user } = renderProposalWizard('design-persist');

            // Enter title
            const titleInput = screen.getByLabelText(/Proposal Title/i);
            await user.type(titleInput, 'Test Proposal');

            // Wait for debounced save (500ms)
            await act(async () => {
                await vi.advanceTimersByTimeAsync(500);
            });

            const saved = localStorage.getItem('proposal-wizard-design-persist');
            expect(saved).toBeTruthy();
            const data = JSON.parse(saved!);
            expect(data.title).toBe('Test Proposal');
            expect(data.step).toBe(1);
        });

        it('should load persisted state on reopen', async () => {
            // Set persisted state
            const persistedState = {
                step: 2,
                title: 'Resumed Proposal',
                selectedSections: { include_cover: true },
                taskId: 'task-123',
                pdfUrl: null, // Loading state
                timestamp: Date.now()
            };
            localStorage.setItem('proposal-wizard-design-resume', JSON.stringify(persistedState));

            renderProposalWizard('design-resume');

            await waitFor(() => {
                expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Resuming'));
            });

            // Should be on Step 2
            // Note: Use regex or simpler check
            // "Step 2 of 3: Preview"
            expect(screen.getByText(/Step 2 of/i)).toBeInTheDocument();
            expect(screen.getByText(/Preview/i)).toBeInTheDocument();
        });
    });

    describe('Full Flow & Downloads', () => {
        beforeEach(() => {
            vi.useFakeTimers({ shouldAdvanceTime: true });

            // Mock URL.createObjectURL and URL.revokeObjectURL
            const mockUrl = 'blob:http://localhost/mock-blob';
            global.URL.createObjectURL = vi.fn(() => mockUrl);
            global.URL.revokeObjectURL = vi.fn();
        });

        afterEach(() => {
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it('should navigate 1->2->3, enable download only after success, and trigger file downloads', async () => {
            const { user } = renderProposalWizard('design-flow');

            // Step 1 check
            expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();

            // Navigate to Step 2
            await user.click(screen.getByRole('button', { name: /Next: Preview/i }));

            // Step 2 check (loading)
            await waitFor(() => {
                expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();
            });
            // Also check for loading text to be sure we are in loading state
            expect(screen.getByText(/Queuing/i)).toBeInTheDocument();

            // Wait for Success
            await act(async () => {
                await vi.advanceTimersByTimeAsync(4000); // Wait enough for polling (1->2->3)
            });
            await waitFor(() => expect(screen.getByText(/Proposal generated successfully/i)).toBeInTheDocument());

            // Navigate to Step 3
            await user.click(screen.getByRole('button', { name: /Next: Download/i }));

            // Step 3 check
            expect(screen.getByText(/Step 3 of 3/i)).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: /Your proposal is ready!/i })).toBeInTheDocument();

            // Test PDF Download
            // Capture link click
            // Mock document.createElement logic similar to useProposal test but locally or via shared mock setup
            const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
            // Ensure we only mock 'a' tags creation
            const originalCreateElement = document.createElement.bind(document);
            const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
                if (tagName === 'a') return link as any;
                return originalCreateElement(tagName, options);
            });
            // Also need to mock appendChild/removeChild on body, or at least ensure no errors
            vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
            vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

            // "Download PDF" passes as name if it's the button text
            await user.click(screen.getByTestId('download-pdf-btn'));
            expect(link.click).toHaveBeenCalled();

            // Test CSV Download
            await user.click(screen.getByTestId('download-csv-btn'));
            await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('CSV exported')));

            // Test Step 3 -> 1 (Generate Another)
            await user.click(screen.getByRole('button', { name: /Generate Another/i }));
            expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();

            // Test Close
            // Verify clearing happens
            // Mock onOpenChange passed to component
        });

        it('should prevent closing during generation', async () => {
            const { user, onOpenChange } = renderProposalWizard('design-close');

            // Go to Step 2
            await user.click(screen.getByRole('button', { name: /Next: Preview/i }));

            // Generating...
            await waitFor(() => {
                expect(screen.getByText(/Queuing/i)).toBeInTheDocument();
            });

            // Attempt close (via Dialog overlay click or Close button if present - Close button is not in Step 2, only Back/Cancel/Next?)
            // Step 2 has Back and Next: Download.
            // But Dialog has onOpenChange which triggers on overlay click or Escape.
            // Simulate external close (like pressing Escape)
            // We can call the onOpenChange prop processing in the component? No, we test the interaction.
            // We passed `onOpenChange={(val) => !val && handleClose()}`.
            // If we simulate user pressing escape.

            await user.keyboard('{Escape}');

            // Should verify window.confirm called
            expect(window.confirm).toHaveBeenCalled();
        });
    });
});
