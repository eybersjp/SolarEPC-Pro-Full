import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDesignCanvasStore } from "@/stores/useDesignCanvasStore";
import { useUpdateSiteDesignMutation } from "@/hooks/useSiteDesigns";
import { useGenerateProposalMutation } from "@/hooks/useProposal";
import { toast } from "sonner";
import { mockSiteDesign } from "@/test/fixtures/siteDesign";
import React from "react";

// Mock dependencies
vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
    },
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "tender-1", designId: "design-1" }),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

// MSW Setup with state counters
const designId = "design-1";
const endpoint = `*/api/v1/site-designs/${designId}`;
const energyEndpoint = `*/api/v1/site-designs/${designId}/energy-estimate`;
const proposalEndpoint = `*/api/v1/site-designs/${designId}/proposal`;

// State tracking for MSW handlers
let attemptCount = 0;

const handlers = [
    http.patch(endpoint, () => {
        return HttpResponse.json({ id: designId, name: "Updated Design" });
    }),
    http.get(energyEndpoint, () => {
        return HttpResponse.json({
            id: "energy-1",
            status: "completed",
            annual_energy_kwh: 150000
        });
    }),
    http.post(proposalEndpoint, () => {
        return HttpResponse.json({ task_id: "task-123", status: "PENDING" });
    }),
];

const server = setupServer(...handlers);

// Global queryClient for testing
let queryClient: QueryClient;

beforeEach(() => {
    server.listen();
    vi.stubEnv('NODE_ENV', 'test');

    // Reset attempt counter
    attemptCount = 0;

    // Create fresh QueryClient for each test
    queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }, // Overridden in hook
        },
    });

    // Reset store state
    useDesignCanvasStore.setState({
        syncState: 'synced',
        retryCount: 0,
        lastMutationData: null,
        lastSyncedAt: null,
    });
});

afterEach(() => {
    server.resetHandlers();
    queryClient.clear();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

// Test Components
const TestSaveComponent = ({ onMutate }: { onMutate?: () => void }) => {
    const mutation = useUpdateSiteDesignMutation(designId);

    return (
        <button
            onClick={() => {
                if (onMutate) onMutate();
                mutation.mutate({ name: "New Name", placement_settings: { edge_setback_m: 5 } });
            }}
        >
            Save Design
        </button>
    );
};

const TestSaveComponentWithRetry = () => {
    const mutation = useUpdateSiteDesignMutation(designId);
    const syncState = useDesignCanvasStore(state => state.syncState);
    const retryCount = useDesignCanvasStore(state => state.retryCount);

    return (
        <div>
            <button onClick={() => mutation.mutate({ name: "New Name", placement_settings: { edge_setback_m: 5 } })}>
                Save Design
            </button>
            {syncState === 'failed' && (
                <button onClick={() => mutation.mutate({ name: "New Name", placement_settings: { edge_setback_m: 5 } })}>
                    Retry Save
                </button>
            )}
            <span data-testid="sync-state">{syncState}</span>
            <span data-testid="retry-count">{retryCount}</span>
        </div>
    );
};

const TestProposalComponent = () => {
    const mutation = useGenerateProposalMutation(designId);

    return (
        <div>
            <button onClick={() => mutation.mutate()}>Generate Proposal</button>
            {mutation.isPending && <span>Generating...</span>}
            {mutation.isError && <span>Proposal generation failed</span>}
            {mutation.isSuccess && <span>Proposal generated</span>}
        </div>
    );
};

// BeforeunloadHandler component that mimics page.tsx behavior
const BeforeunloadHandlerComponent = () => {
    const syncState = useDesignCanvasStore(state => state.syncState);

    React.useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            const currentSyncState = useDesignCanvasStore.getState().syncState;
            const hasUnsavedChanges = currentSyncState === 'pending' || currentSyncState === 'failed';

            if (hasUnsavedChanges) {
                event.preventDefault();
                event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return 'You have unsaved changes. Are you sure you want to leave?';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [syncState]);

    return <div data-testid="beforeunload-component">Sync state: {syncState}</div>;
};

const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("DesignCanvas Error Handling & Retries", () => {

    it("should retry with precise exponential backoff (1s, 2s, 4s) and track exact attempt counts", async () => {
        vi.useFakeTimers({ now: 0 });

        // Mock to fail exactly 3 times (initial + 3 retries = 4 attempts total)
        server.use(
            http.patch(endpoint, () => {
                attemptCount++;
                return new HttpResponse(null, { status: 500 });
            })
        );

        render(<TestSaveComponent />, { wrapper: Wrapper });

        // Trigger save
        fireEvent.click(screen.getByText("Save Design"));

        // Wait for mutation to start
        await vi.waitFor(() => {
            expect(useDesignCanvasStore.getState().syncState).toBe('syncing');
        });
        expect(attemptCount).toBe(1); // Initial attempt

        // First retry after 1000ms
        await vi.advanceTimersByTimeAsync(1050);
        await vi.waitFor(() => {
            expect(useDesignCanvasStore.getState().retryCount).toBe(1);
        });
        expect(attemptCount).toBe(2);

        // Second retry after 2000ms
        await vi.advanceTimersByTimeAsync(2050);
        await vi.waitFor(() => {
            expect(useDesignCanvasStore.getState().retryCount).toBe(2);
        });
        expect(attemptCount).toBe(3);

        // Third retry after 4000ms
        await vi.advanceTimersByTimeAsync(4050);
        await vi.waitFor(() => {
            expect(useDesignCanvasStore.getState().retryCount).toBe(3);
        });
        expect(attemptCount).toBe(4);

        // Should transition to failed state after all retries exhausted
        await vi.waitFor(() => {
            expect(useDesignCanvasStore.getState().syncState).toBe('failed');
        });

        expect(attemptCount).toBe(4); // Initial + 3 retries
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Failed to save changes"));

        vi.useRealTimers();
    });

    it("should complete full sync state transition chain: pending → syncing → synced", async () => {
        vi.useFakeTimers({ now: 0 });

        // Mock successful response
        server.use(
            http.patch(endpoint, () => {
                return HttpResponse.json({ id: designId, name: "New Name", placement_settings: { edge_setback_m: 5 } });
            })
        );

        render(<TestSaveComponentWithRetry />, { wrapper: Wrapper });

        // Initial: synced
        expect(screen.getByTestId("sync-state")).toHaveTextContent('synced');

        // Trigger save
        fireEvent.click(screen.getByText("Save Design"));

        // Should transition to syncing (hook sets syncing directly in mutationFn)
        await vi.waitFor(() => {
            expect(screen.getByTestId("sync-state")).toHaveTextContent('syncing');
        });

        // Advance timers to complete the request
        await vi.advanceTimersByTimeAsync(100);

        // Should transition to synced
        await vi.waitFor(() => {
            expect(screen.getByTestId("sync-state")).toHaveTextContent('synced');
        });

        expect(screen.getByTestId("retry-count")).toHaveTextContent('0');
        expect(useDesignCanvasStore.getState().lastSyncedAt).not.toBeNull();
        expect(toast.success).toHaveBeenCalledWith("Design saved");

        vi.useRealTimers();
    });

    it("should complete full sync state transition chain: syncing → failed → syncing → synced (manual retry)", async () => {
        vi.useFakeTimers({ now: 0 });

        // Fail first attempt, succeed on manual retry
        server.use(
            http.patch(endpoint, () => {
                attemptCount++;
                if (attemptCount <= 4) {  // Fail initial + 3 retries
                    return new HttpResponse(null, { status: 500 });
                }
                return HttpResponse.json({ id: designId, name: "Updated Name", placement_settings: { edge_setback_m: 5 } });
            })
        );

        render(<TestSaveComponentWithRetry />, { wrapper: Wrapper });

        // Trigger save → syncing
        fireEvent.click(screen.getByText("Save Design"));

        await vi.waitFor(() => {
            expect(screen.getByTestId("sync-state")).toHaveTextContent('syncing');
        });

        // Advance through all retries
        await vi.advanceTimersByTimeAsync(1050); // First retry
        await vi.advanceTimersByTimeAsync(2050); // Second retry
        await vi.advanceTimersByTimeAsync(4050); // Third retry

        // Wait for failure after all retries exhausted
        await vi.waitFor(() => {
            expect(screen.getByTestId("sync-state")).toHaveTextContent('failed');
        });

        // Reset attempt count for manual retry
        attemptCount = 0;

        // Mock success for manual retry
        server.resetHandlers();
        server.use(
            http.patch(endpoint, () => {
                return HttpResponse.json({ id: designId, name: "Updated Name", placement_settings: { edge_setback_m: 5 } });
            })
        );

        // Manual retry button should appear
        expect(screen.getByText("Retry Save")).toBeInTheDocument();

        // Click retry
        fireEvent.click(screen.getByText("Retry Save"));

        // Should go syncing → synced
        await vi.waitFor(() => {
            expect(screen.getByTestId("sync-state")).toHaveTextContent('syncing');
        });

        await vi.advanceTimersByTimeAsync(100);

        await vi.waitFor(() => {
            expect(screen.getByTestId("sync-state")).toHaveTextContent('synced');
        });

        // Verify retryCount reset to 0 after successful save
        expect(screen.getByTestId("retry-count")).toHaveTextContent('0');
        expect(toast.success).toHaveBeenCalledWith("Design saved");

        vi.useRealTimers();
    });

    it("should rollback optimistic updates on permanent failure", async () => {
        vi.useFakeTimers({ now: 0 });

        // Setup QueryClient with existing data for rollback
        queryClient.setQueryData(["site-designs", "detail", designId], {
            id: designId,
            name: "Original Name",
            placement_settings: { edge_setback_m: 1 }
        });

        server.use(
            http.patch(endpoint, () => {
                return new HttpResponse(null, { status: 500 });
            })
        );

        render(<TestSaveComponent />, { wrapper: Wrapper });
        fireEvent.click(screen.getByText("Save Design"));

        // Advance through all retries
        await vi.advanceTimersByTimeAsync(1050);
        await vi.advanceTimersByTimeAsync(2050);
        await vi.advanceTimersByTimeAsync(4050);

        // Wait for all retries to fail
        await vi.waitFor(() => {
            expect(useDesignCanvasStore.getState().syncState).toBe('failed');
        });

        // Verify cache rolled back
        const data = queryClient.getQueryData<any>(["site-designs", "detail", designId]);
        expect(data.name).toBe("Original Name");
        expect(data.placement_settings.edge_setback_m).toBe(1);

        vi.useRealTimers();
    });

    it("should verify query invalidation after failed mutation", async () => {
        vi.useFakeTimers({ now: 0 });

        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

        server.use(
            http.patch(endpoint, () => {
                return new HttpResponse(null, { status: 500 });
            })
        );

        render(<TestSaveComponent />, { wrapper: Wrapper });
        fireEvent.click(screen.getByText("Save Design"));

        // Advance through all retries
        await vi.advanceTimersByTimeAsync(1050);
        await vi.advanceTimersByTimeAsync(2050);
        await vi.advanceTimersByTimeAsync(4050);

        await vi.waitFor(() => {
            expect(useDesignCanvasStore.getState().syncState).toBe('failed');
        });

        // Verify invalidation was called in onSettled
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["site-designs", "detail", designId] });

        invalidateSpy.mockRestore();
        vi.useRealTimers();
    });

    it("should integrate beforeunload handler: pending and failed states trigger warning", async () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        // Test with 'pending' state
        useDesignCanvasStore.setState({ syncState: 'pending' });

        const { rerender } = render(<BeforeunloadHandlerComponent />, { wrapper: Wrapper });

        // Verify event listener was added
        expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

        // Create beforeunload event and dispatch
        const beforeunloadEvent = new Event('beforeunload') as BeforeUnloadEvent;
        const preventDefaultSpy = vi.spyOn(beforeunloadEvent, 'preventDefault');

        window.dispatchEvent(beforeunloadEvent);

        // Verify preventDefault was called (indicates warning triggered)
        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(beforeunloadEvent.returnValue).toBe('You have unsaved changes. Are you sure you want to leave?');

        // Test with 'failed' state
        useDesignCanvasStore.setState({ syncState: 'failed' });
        rerender(<BeforeunloadHandlerComponent />);

        const beforeunloadEvent2 = new Event('beforeunload') as BeforeUnloadEvent;
        const preventDefaultSpy2 = vi.spyOn(beforeunloadEvent2, 'preventDefault');

        window.dispatchEvent(beforeunloadEvent2);

        expect(preventDefaultSpy2).toHaveBeenCalled();
        expect(beforeunloadEvent2.returnValue).toBe('You have unsaved changes. Are you sure you want to leave?');

        // Test with 'synced' state - should NOT trigger warning
        useDesignCanvasStore.setState({ syncState: 'synced' });
        rerender(<BeforeunloadHandlerComponent />);

        const beforeunloadEvent3 = new Event('beforeunload') as BeforeUnloadEvent;
        const preventDefaultSpy3 = vi.spyOn(beforeunloadEvent3, 'preventDefault');

        window.dispatchEvent(beforeunloadEvent3);

        expect(preventDefaultSpy3).not.toHaveBeenCalled();
        expect(beforeunloadEvent3.returnValue).not.toBe('You have unsaved changes. Are you sure you want to leave?');

        addEventListenerSpy.mockRestore();
    });

    it("should handle graceful degradation when energy estimate is missing (404)", async () => {
        // Mock energy estimate endpoint → 404
        server.use(
            http.get(energyEndpoint, () => {
                return new HttpResponse(null, { status: 404 });
            }),
            http.post(proposalEndpoint, () => {
                // Even without energy data, proposal should succeed
                return HttpResponse.json({ task_id: "task-456", status: "PENDING" });
            })
        );

        render(<TestProposalComponent />, { wrapper: Wrapper });

        // Trigger proposal generation
        fireEvent.click(screen.getByText("Generate Proposal"));

        // Should show generating state
        await waitFor(() => {
            expect(screen.queryByText("Generating...")).toBeInTheDocument();
        }, { timeout: 5000 });

        // Should proceed without crash and show success
        await waitFor(() => {
            expect(screen.getByText("Proposal generated")).toBeInTheDocument();
        }, { timeout: 10000 });

        // Verify toast.success was called (from useProposal hook)
        expect(toast.success).toHaveBeenCalledWith("Proposal generation started");

        // Verify no error toast
        expect(toast.error).not.toHaveBeenCalled();
    }, 20000);

    it("should handle graceful degradation when proposal generation fails", async () => {
        // Mock proposal endpoint to fail
        server.use(
            http.post(proposalEndpoint, () => {
                return new HttpResponse(null, { status: 500 });
            })
        );

        render(<TestProposalComponent />, { wrapper: Wrapper });

        // Trigger proposal generation
        fireEvent.click(screen.getByText("Generate Proposal"));

        // Should show error state
        await waitFor(() => {
            expect(screen.getByText("Proposal generation failed")).toBeInTheDocument();
        }, { timeout: 10000 });

        // Verify error toast was called
        expect(toast.error).toHaveBeenCalled();
    }, 20000);
});
