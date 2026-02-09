I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The codebase follows a comprehensive testing strategy using Vitest, React Testing Library, and MSW (Mock Service Worker) for API mocking. Existing tests demonstrate patterns for:
- Component testing with user interactions and state management
- React Query hooks testing with optimistic updates and retry logic
- MSW handlers for simulating API responses with state transitions
- Test fixtures for consistent mock data
- Fake timers for testing debounced/delayed operations

The version management implementation includes four main hooks (`useCreateVersionMutation`, `useVersionsQuery`, `useVersionDetailQuery`, `useRestoreVersionMutation`) and two UI components (`SaveVersionModal`, `VersionList`) that need comprehensive test coverage.

## Approach

Create comprehensive unit tests following the established patterns in the codebase. The approach includes:
1. **Test Fixtures**: Create version-specific mock data following the pattern in `siteDesign.ts`
2. **MSW Handlers**: Add version API endpoint handlers with state management for testing transitions
3. **Component Tests**: Test SaveVersionModal and VersionList with user interactions, loading states, and error handling
4. **Hook Tests**: Test all version hooks with optimistic updates, retry logic, and cache invalidation
5. **Integration Tests**: Test complete workflows (create → list → restore)

All tests will use fake timers for debounced operations, follow accessibility best practices, and verify toast notifications.

## Implementation Instructions

### 1. Create Version Test Fixtures

**File**: `file:frontend/src/test/fixtures/designVersion.ts` (new file)

Create mock data for version management testing:

```typescript
import { DesignVersionResponse, DesignVersionDetail, DesignVersionRestoreResponse } from "@/types";
import { mockSiteDesign } from "./siteDesign";

export const mockVersionResponse: DesignVersionResponse = {
    id: "version-1",
    site_design_id: "design-1",
    version_name: "Initial Layout",
    notes: "First version with basic module placement",
    created_at: new Date().toISOString(),
    created_by_name: "Test User",
    total_modules: 80,
    system_size_kwp: 44.0,
};

export const mockVersionsList: DesignVersionResponse[] = [
    mockVersionResponse,
    {
        id: "version-2",
        site_design_id: "design-1",
        version_name: "Option A",
        notes: null,
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        created_by_name: "Test User",
        total_modules: 75,
        system_size_kwp: 41.25,
    },
    {
        id: "version-3",
        site_design_id: "design-1",
        version_name: "Option B",
        notes: "Increased setback for safety",
        created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        created_by_name: "Another User",
        total_modules: 70,
        system_size_kwp: 38.5,
    },
];

export const mockVersionDetail: DesignVersionDetail = {
    ...mockVersionResponse,
    snapshot_data: {
        site_boundary: mockSiteDesign.site_boundary,
        exclusion_zones: [],
        placement_settings: mockSiteDesign.placement_settings,
        module_placements: [],
    },
};

export const mockVersionRestoreResponse: DesignVersionRestoreResponse = {
    site_design: mockSiteDesign,
    recalculation_status: {
        placement_triggered: true,
        energy_triggered: true,
    },
};

export const createMockVersion = (overrides = {}): DesignVersionResponse => ({
    ...mockVersionResponse,
    ...overrides,
});
```

### 2. Add MSW Handlers for Version Endpoints

**File**: `file:frontend/src/test/mocks/handlers.ts`

Add version API handlers to the existing handlers array:

```typescript
// Import version fixtures at the top
import { mockVersionsList, mockVersionDetail, mockVersionRestoreResponse } from '../fixtures/designVersion';

// Add to testState object
const testState = {
    // ... existing state
    versionCreateCount: {} as Record<string, number>,
    versionRestoreCount: {} as Record<string, number>,
    versions: {} as Record<string, DesignVersionResponse[]>,
    reset: () => {
        // ... existing resets
        testState.versionCreateCount = {};
        testState.versionRestoreCount = {};
        testState.versions = {};
    }
};

// Add these handlers to the handlers array:

// POST /api/site-designs/:id/versions
http.post('*/api/site-designs/:id/versions', async ({ params, request }) => {
    const designId = params.id as string;
    const body = await request.json() as any;
    
    testState.versionCreateCount[designId] = (testState.versionCreateCount[designId] || 0) + 1;
    
    const newVersion: DesignVersionResponse = {
        id: `version-${Date.now()}`,
        site_design_id: designId,
        version_name: body.version_name,
        notes: body.notes || null,
        created_at: new Date().toISOString(),
        created_by_name: "Test User",
        total_modules: 80,
        system_size_kwp: 44.0,
    };
    
    // Store in test state
    if (!testState.versions[designId]) {
        testState.versions[designId] = [];
    }
    testState.versions[designId].unshift(newVersion);
    
    return HttpResponse.json(newVersion, { status: 201 });
}),

// GET /api/site-designs/:id/versions
http.get('*/api/site-designs/:id/versions', ({ params }) => {
    const designId = params.id as string;
    
    if (designId.includes('no-versions')) {
        return HttpResponse.json([]);
    }
    
    if (designId.includes('error-versions')) {
        return HttpResponse.json({ detail: 'Failed to fetch versions' }, { status: 500 });
    }
    
    // Return stored versions or default mock
    const versions = testState.versions[designId] || mockVersionsList;
    return HttpResponse.json(versions);
}),

// GET /api/site-designs/:id/versions/:versionId
http.get('*/api/site-designs/:designId/versions/:versionId', ({ params }) => {
    const versionId = params.versionId as string;
    
    if (versionId.includes('not-found')) {
        return HttpResponse.json({ detail: 'Version not found' }, { status: 404 });
    }
    
    return HttpResponse.json(mockVersionDetail);
}),

// POST /api/site-designs/:id/restore/:versionId
http.post('*/api/site-designs/:designId/restore/:versionId', ({ params }) => {
    const designId = params.designId as string;
    const versionId = params.versionId as string;
    
    testState.versionRestoreCount[designId] = (testState.versionRestoreCount[designId] || 0) + 1;
    const count = testState.versionRestoreCount[designId];
    
    if (designId.includes('restore-fail') && count <= 3) {
        return new HttpResponse(null, { status: 500 });
    }
    
    return HttpResponse.json(mockVersionRestoreResponse);
}),
```

### 3. Create SaveVersionModal Component Tests

**File**: `file:frontend/src/components/DesignCanvas/__tests__/SaveVersionModal.test.tsx` (new file)

Test the SaveVersionModal component:

```typescript
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
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Loading Test');

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

            expect(screen.getByText(/Saving.../i)).toBeInTheDocument();
            expect(saveButton).toBeDisabled();
        });

        it('should disable cancel button during submission', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SaveVersionModal {...defaultProps} />);

            const nameInput = screen.getByLabelText(/Version Name/i);
            await user.type(nameInput, 'Test');

            const saveButton = screen.getByRole('button', { name: /Save Version/i });
            await user.click(saveButton);

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
```

### 4. Create VersionList Component Tests

**File**: `file:frontend/src/components/DesignCanvas/__tests__/VersionList.test.tsx` (new file)

Test the VersionList component:

```typescript
import { render, screen, waitFor, within } from '@testing-library/react';
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
        it('should render loading state', () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            // Check for loading spinner in trigger button
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

            // Verify refetch was triggered (loading state appears)
            expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
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
                // Recent dates should show relative time
                expect(screen.getByText(/ago/i)).toBeInTheDocument();
            });
        });

        it('should handle versions without notes', async () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Option A')).toBeInTheDocument();
            });

            // Version without notes should not show notes section
            const versionItem = screen.getByText('Option A').closest('div');
            expect(versionItem).not.toHaveTextContent('notes');
        });

        it('should show restore button on hover', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            // Restore buttons should be present (opacity controlled by CSS)
            const restoreButtons = screen.getAllByRole('button', { name: /Restore/i });
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
            expect(screen.getByText(/Initial Layout/i)).toBeInTheDocument();
        });

        it('should successfully restore version', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            const restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
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

        it('should close dropdown after successful restore', async () => {
            const user = userEvent.setup();
            renderWithProviders(<VersionList {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Initial Layout')).toBeInTheDocument();
            });

            const restoreButtons = screen.getAllByRole('button', { name: /Restore to version/i });
            await user.click(restoreButtons[0]);

            const confirmButton = screen.getByRole('button', { name: /Confirm/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
            });
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            const trigger = screen.getByRole('button', { name: /Version history/i });
            expect(trigger).toHaveAttribute('aria-label', 'Version history');
        });

        it('should have aria-busy during loading', () => {
            renderWithProviders(<VersionList {...defaultProps} />);

            // Dropdown content should have aria-busy
            const content = screen.getByRole('menu', { hidden: true });
            expect(content).toHaveAttribute('aria-busy');
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

            await waitFor(() => {
                expect(screen.getByText(/View and restore previous versions/i)).toBeInTheDocument();
            });
        });
    });
});
```

### 5. Create Version Hooks Tests

**File**: `file:frontend/src/hooks/__tests__/useSiteDesigns.test.tsx`

Add version hook tests to the existing test file:

```typescript
// Add these test suites to the existing file

describe('Version Management Hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useDesignCanvasStore.setState({
            syncState: 'synced',
            retryCount: 0,
            lastSyncedAt: null,
            placementLoading: false,
        });
    });

    describe('useCreateVersionMutation', () => {
        it('should successfully create a version with optimistic update', async () => {
            const { queryClient, wrapper } = createWrapper();
            const designId = 'design-1';

            // Seed the cache with existing versions
            queryClient.setQueryData(queryKeys.designVersions.list(designId), []);

            const { result } = renderHook(() => useCreateVersionMutation(designId), { wrapper });

            await act(async () => {
                result.current.mutate({
                    version_name: 'Test Version',
                    notes: 'Test notes',
                });
            });

            // Verify optimistic update
            await waitFor(() => {
                const versions = queryClient.getQueryData<any[]>(queryKeys.designVersions.list(designId));
                expect(versions).toHaveLength(1);
                expect(versions![0].version_name).toBe('Test Version');
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(useDesignCanvasStore.getState().syncState).toBe('synced');
            expect(toast.success).toHaveBeenCalledWith('Version saved successfully');
        });

        it('should handle error and rollback optimistic update', async () => {
            const { queryClient, wrapper } = createWrapper();
            const designId = 'error-design';

            server.use(
                http.post('*/api/site-designs/:id/versions', async () => {
                    await new Promise(r => setTimeout(r, 20));
                    return new HttpResponse(null, { status: 500 });
                })
            );

            const existingVersions = [{ id: 'v1', version_name: 'Existing' }];
            queryClient.setQueryData(queryKeys.designVersions.list(designId), existingVersions);

            const { result } = renderHook(() => useCreateVersionMutation(designId), { wrapper });

            await act(async () => {
                result.current.mutate({ version_name: 'Failed Version' });
            });

            await waitFor(() => expect(result.current.isError).toBe(true));

            // Verify rollback
            const versions = queryClient.getQueryData<any[]>(queryKeys.designVersions.list(designId));
            expect(versions).toEqual(existingVersions);
            expect(useDesignCanvasStore.getState().syncState).toBe('failed');
            expect(toast.error).toHaveBeenCalled();
        });

        it('should retry on failure with exponential backoff', async () => {
            vi.useFakeTimers();
            const { wrapper } = createWrapper();
            const designId = 'design-retry';

            let callCount = 0;
            server.use(
                http.post('*/api/site-designs/:id/versions', async () => {
                    callCount++;
                    if (callCount <= 2) {
                        return new HttpResponse(null, { status: 500 });
                    }
                    return HttpResponse.json({
                        id: 'version-success',
                        version_name: 'Retry Success',
                        site_design_id: designId,
                        notes: null,
                        created_at: new Date().toISOString(),
                        created_by_name: 'Test',
                        total_modules: 80,
                        system_size_kwp: 44.0,
                    });
                })
            );

            const { result } = renderHook(() => useCreateVersionMutation(designId), { wrapper });

            act(() => {
                result.current.mutate({ version_name: 'Retry Success' });
            });

            // Wait for retries
            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(1));
            act(() => { vi.advanceTimersByTime(1100); });

            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(2));
            act(() => { vi.advanceTimersByTime(2100); });

            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('synced'));

            expect(callCount).toBe(3);
            expect(toast.success).toHaveBeenCalledWith('Version saved successfully');

            vi.useRealTimers();
        });
    });

    describe('useVersionsQuery', () => {
        it('should fetch versions list', async () => {
            const { wrapper } = createWrapper();
            const designId = 'design-1';

            const { result } = renderHook(() => useVersionsQuery(designId), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(result.current.data).toBeDefined();
            expect(result.current.data!.length).toBeGreaterThan(0);
            expect(result.current.data![0]).toHaveProperty('version_name');
        });

        it('should return empty array when no versions exist', async () => {
            const { wrapper } = createWrapper();
            const designId = 'no-versions';

            const { result } = renderHook(() => useVersionsQuery(designId), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(result.current.data).toEqual([]);
        });

        it('should handle fetch error', async () => {
            const { wrapper } = createWrapper();
            const designId = 'error-versions';

            const { result } = renderHook(() => useVersionsQuery(designId), { wrapper });

            await waitFor(() => expect(result.current.isError).toBe(true));

            expect(result.current.error).toBeDefined();
        });

        it('should not fetch when designId is empty', () => {
            const { wrapper } = createWrapper();

            const { result } = renderHook(() => useVersionsQuery(''), { wrapper });

            expect(result.current.isFetching).toBe(false);
        });
    });

    describe('useVersionDetailQuery', () => {
        it('should fetch version detail with snapshot data', async () => {
            const { wrapper } = createWrapper();
            const designId = 'design-1';
            const versionId = 'version-1';

            const { result } = renderHook(() => useVersionDetailQuery(designId, versionId), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(result.current.data).toBeDefined();
            expect(result.current.data).toHaveProperty('snapshot_data');
            expect(result.current.data!.snapshot_data).toHaveProperty('site_boundary');
        });

        it('should handle not found error', async () => {
            const { wrapper } = createWrapper();
            const designId = 'design-1';
            const versionId = 'not-found';

            const { result } = renderHook(() => useVersionDetailQuery(designId, versionId), { wrapper });

            await waitFor(() => expect(result.current.isError).toBe(true));
        });

        it('should not fetch when IDs are empty', () => {
            const { wrapper } = createWrapper();

            const { result } = renderHook(() => useVersionDetailQuery('', ''), { wrapper });

            expect(result.current.isFetching).toBe(false);
        });
    });

    describe('useRestoreVersionMutation', () => {
        it('should successfully restore version and invalidate caches', async () => {
            const { queryClient, wrapper } = createWrapper();
            const designId = 'design-1';
            const versionId = 'version-1';

            // Seed caches
            queryClient.setQueryData(queryKeys.siteDesigns.detail(designId), mockSiteDesign);

            const { result } = renderHook(() => useRestoreVersionMutation(designId), { wrapper });

            await act(async () => {
                result.current.mutate(versionId);
            });

            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('syncing'));
            await waitFor(() => expect(useDesignCanvasStore.getState().placementLoading).toBe(true));

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            expect(useDesignCanvasStore.getState().syncState).toBe('synced');
            expect(useDesignCanvasStore.getState().placementLoading).toBe(false);

            // Verify cache updates
            const updatedDesign = queryClient.getQueryData(queryKeys.siteDesigns.detail(designId));
            expect(updatedDesign).toBeDefined();
        });

        it('should retry on failure', async () => {
            vi.useFakeTimers();
            const { wrapper } = createWrapper();
            const designId = 'restore-fail';

            let callCount = 0;
            server.use(
                http.post('*/api/site-designs/:designId/restore/:versionId', async () => {
                    callCount++;
                    if (callCount <= 2) {
                        return new HttpResponse(null, { status: 500 });
                    }
                    return HttpResponse.json(mockVersionRestoreResponse);
                })
            );

            const { result } = renderHook(() => useRestoreVersionMutation(designId), { wrapper });

            act(() => {
                result.current.mutate('version-1');
            });

            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(1));
            act(() => { vi.advanceTimersByTime(1100); });

            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(2));
            act(() => { vi.advanceTimersByTime(2100); });

            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('synced'));

            expect(callCount).toBe(3);

            vi.useRealTimers();
        });

        it('should handle final failure after retries', async () => {
            vi.useFakeTimers();
            const { wrapper } = createWrapper();
            const designId = 'restore-fail';

            server.use(
                http.post('*/api/site-designs/:designId/restore/:versionId', () => {
                    return new HttpResponse(null, { status: 500 });
                })
            );

            const { result } = renderHook(() => useRestoreVersionMutation(designId), { wrapper });

            act(() => {
                result.current.mutate('version-1');
            });

            // Advance through all retries
            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(1));
            act(() => { vi.advanceTimersByTime(1100); });

            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(2));
            act(() => { vi.advanceTimersByTime(2100); });

            await waitFor(() => expect(useDesignCanvasStore.getState().retryCount).toBe(3));
            act(() => { vi.advanceTimersByTime(4100); });

            await waitFor(() => expect(useDesignCanvasStore.getState().syncState).toBe('failed'));

            expect(toast.error).toHaveBeenCalled();
            expect(useDesignCanvasStore.getState().placementLoading).toBe(false);

            vi.useRealTimers();
        });

        it('should invalidate related queries on success', async () => {
            const { queryClient, wrapper } = createWrapper();
            const designId = 'design-1';

            const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

            const { result } = renderHook(() => useRestoreVersionMutation(designId), { wrapper });

            await act(async () => {
                result.current.mutate('version-1');
            });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));

            // Verify all related queries are invalidated
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.siteDesigns.lists() });
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.energyEstimation.detail(designId) });
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.financialAnalysis.detail(designId) });
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.siteDesigns.detail(designId) });
        });
    });
});
```

### 6. Update Test Fixtures Export

**File**: `file:frontend/src/test/fixtures/siteDesign.ts`

Add version-related exports to the existing file:

```typescript
// Add at the end of the file
export { mockVersionResponse, mockVersionsList, mockVersionDetail, mockVersionRestoreResponse, createMockVersion } from './designVersion';
```

### 7. Integration Test for Complete Version Workflow

**File**: `file:frontend/src/components/DesignCanvas/__tests__/versionWorkflow.test.tsx` (new file)

Create an integration test for the complete version management workflow:

```typescript
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

        // Error should occur again
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledTimes(2);
        });
    });
});
```

## Summary

This implementation plan provides comprehensive unit tests for version management covering:

1. **Test Fixtures** (`designVersion.ts`): Mock data for versions, version details, and restore responses
2. **MSW Handlers**: API mocking for all version endpoints with state management
3. **SaveVersionModal Tests**: Form validation, submission, error handling, loading states, and accessibility
4. **VersionList Tests**: Rendering states, version display, restore functionality, dropdown behavior, and accessibility
5. **Version Hooks Tests**: All four hooks with optimistic updates, retry logic, error handling, and cache invalidation
6. **Integration Tests**: Complete workflows testing the interaction between components and hooks

All tests follow the existing patterns in the codebase, use fake timers for debounced operations, verify toast notifications, and include comprehensive accessibility checks.