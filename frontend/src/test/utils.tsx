import React, { ReactElement } from 'react'
import { render, RenderOptions, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })

const AllTheProviders = ({ children, queryClient }: { children: React.ReactNode, queryClient?: QueryClient }) => {
    const [client] = React.useState(() => queryClient || createTestQueryClient())
    return (
        <QueryClientProvider client={client}>
            {children}
        </QueryClientProvider>
    )
}

const renderWithProviders = (
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient }
) => {
    const { queryClient, ...renderOptions } = options || {}
    return render(ui, {
        wrapper: (props) => <AllTheProviders {...props} queryClient={queryClient} />,
        ...renderOptions
    })
}

export const createWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
}

/**
 * Helper to advance timers for debounce testing
 */
export const advanceDebounceTimer = async (ms = 30000) => {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
    // Flush microtasks
    await Promise.resolve();
};

/**
 * Helper to mock sync state in the store
 */
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';
export const mockSyncState = (state: 'synced' | 'pending' | 'syncing' | 'failed', overrides = {}) => {
    useDesignCanvasStore.setState({
        syncState: state,
        retryCount: 0,
        lastSyncedAt: state === 'synced' ? new Date() : null,
        ...overrides,
    });
};

export * from '@testing-library/react'
export { renderWithProviders, createTestQueryClient }

/**
 * Helper to simulate complete equipment selection
 */
export const selectEquipment = async (
    user: any,
    moduleId: string,
    inverterId: string,
    screen: any
) => {
    const { within } = await import('@testing-library/react')

    const equipmentPanel = screen.getByRole('region', { name: /equipment/i })

    // Select module
    const moduleSelect = within(equipmentPanel).getByLabelText(/select module/i)
    await user.click(moduleSelect)
    const moduleOption = await screen.findByRole('option', { name: new RegExp(moduleId, 'i') })
    await user.click(moduleOption)

    // Select inverter
    const inverterSelect = within(equipmentPanel).getByLabelText(/select inverter/i)
    await user.click(inverterSelect)
    const inverterOption = await screen.findByRole('option', { name: new RegExp(inverterId, 'i') })
    await user.click(inverterOption)
}


/**
 * Helper to advance through debounce and verify save
 */
export const advanceAndVerifySave = async (ms: number = 30000) => {
    const { waitFor } = await import('@testing-library/react')
    const { useDesignCanvasStore } = await import('@/stores/useDesignCanvasStore')

    act(() => {
        vi.advanceTimersByTime(ms)
    })

    await waitFor(() => {
        expect(useDesignCanvasStore.getState().syncState).toBe('synced')
    })
}

/**
 * Helper to wait for polling completion
 */
export const waitForPollingComplete = async (
    checkCondition: () => boolean,
    maxAttempts: number = 10,
    intervalMs: number = 2000
) => {
    const { waitFor } = await import('@testing-library/react')

    for (let i = 0; i < maxAttempts; i++) {
        act(() => {
            vi.advanceTimersByTime(intervalMs)
        })

        if (checkCondition()) {
            return
        }
    }

    await waitFor(() => {
        expect(checkCondition()).toBe(true)
    })
}

/**
 * Helper to simulate proposal generation flow
 */
export const generateProposal = async (
    user: any,
    screen: any,
    options?: { includeEnergy?: boolean; includeFinancial?: boolean }
) => {
    const { within, waitFor } = await import('@testing-library/react')

    // Click "Generate Proposal" button
    const generateProposalButton = screen.getByRole('button', { name: /generate proposal/i })
    await user.click(generateProposalButton)

    // Wait for wizard to open
    const proposalWizard = await screen.findByRole('dialog', { name: /proposal wizard/i })

    // Configure options if provided
    if (options?.includeEnergy) {
        const includeEnergy = within(proposalWizard).getByLabelText(/include energy analysis/i)
        await user.click(includeEnergy)
    }

    if (options?.includeFinancial) {
        const includeFinancial = within(proposalWizard).getByLabelText(/include financial analysis/i)
        await user.click(includeFinancial)
    }

    // Click "Generate" button
    const generateButton = within(proposalWizard).getByRole('button', { name: /generate/i })
    await user.click(generateButton)

    // Wait for generation to start
    await waitFor(() => {
        expect(within(proposalWizard).getByText(/generating/i)).toBeInTheDocument()
    })

    return proposalWizard
}
