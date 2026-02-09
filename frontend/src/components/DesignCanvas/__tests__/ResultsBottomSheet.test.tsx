import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { ResultsBottomSheet } from '../ResultsBottomSheet';
import { toast } from 'sonner';
import {
    mockSiteDesign,
    mockEnergyEstimate,
    mockFinancialAnalysis,
    mockEnergyEstimateCalculating,
    mockEnergyEstimateFailed,
    mockEnergyEstimateIncomplete,
    mockSiteDesignZeroCapacity
} from '@/test/fixtures/siteDesign';

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
    }
}));

// Mock Recharts
vi.mock('recharts', async () => {
    return {
        ResponsiveContainer: ({ children }: any) => <div style={{ width: '100%', height: '100%' }}>{children}</div>,
        BarChart: ({ children, data }: any) => (
            <div data-testid="bar-chart" data-data-length={data?.length}>
                {children}
                <div data-testid="chart-data">{JSON.stringify(data)}</div>
            </div>
        ),
        XAxis: ({ dataKey }: any) => <div data-testid="x-axis">{dataKey}</div>,
        YAxis: () => <div />,
        CartesianGrid: () => <div />,
        Tooltip: () => <div />,
        Bar: () => <div />,
    };
});

// Mock Sheet Portal
vi.mock('@/components/ui/sheet', async () => {
    const Actual = await vi.importActual('@/components/ui/sheet');
    return {
        ...Actual,
        SheetPortal: ({ children }: any) => <div data-testid="sheet-portal">{children}</div>,
    };
});

// Simple Tabs mock
vi.mock('@/components/ui/tabs', async () => {
    return {
        Tabs: ({ children }: any) => <div data-testid="tabs">{children}</div>,
        TabsList: ({ children }: any) => <div role="tablist">{children}</div>,
        TabsTrigger: ({ children, value }: any) => (
            <button role="tab" data-testid={`tab-trigger-${value}`} data-value={value}>{children}</button>
        ),
        TabsContent: ({ children, value }: any) => (
            <div role="tabpanel" data-testid={`tab-content-${value}`}>{children}</div>
        ),
    };
});

describe('ResultsBottomSheet Comprehensive', { timeout: 30000 }, () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useRealTimers();
        server.resetHandlers();
        // Reset the mock server internal state
        await fetch('http://localhost/api/test/reset');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const renderWithDesign = (designId: string, pollingInterval = 100, pollingTimeout = 300000) => {
        const user = userEvent.setup({ delay: null });
        return {
            user,
            ...renderWithProviders(<ResultsBottomSheet designId={designId} pollingInterval={pollingInterval} pollingTimeout={pollingTimeout} />)
        };
    };

    describe('Expansion & Basic Interactions', () => {
        it('should expand, show content, and collapse', async () => {
            renderWithDesign('design-1');
            const expandBtn = await screen.findByTestId('expand-button');
            fireEvent.click(expandBtn);

            await screen.findByText(/Design Performance/i);
            expect(screen.getByTestId('tab-content-overview')).toBeInTheDocument();

            const minimizeBtn = screen.getByRole('button', { name: /Minimize/i });
            fireEvent.click(minimizeBtn);

            await waitFor(() => {
                expect(screen.queryByText(/Design Performance/i)).not.toBeInTheDocument();
            });
        });

        it('should have correct accessibility attributes', async () => {
            renderWithDesign('calc-test');
            console.log('Waiting for status container...');
            const statusContainer = await screen.findByTestId('status-container');
            console.log('Found status container, checking aria-busy...');
            await waitFor(() => {
                console.log('Checking aria-busy:', statusContainer.getAttribute('aria-busy'));
                expect(statusContainer).toHaveAttribute('aria-busy', 'true');
            });
            expect(statusContainer).toHaveAttribute('aria-live', 'polite');
        });
    });

    describe('Chart Rendering', () => {
        it('renders full chart with 12 months', async () => {
            renderWithDesign('design-1');
            fireEvent.click(await screen.findByTestId('expand-button'));

            const chart = await screen.findByTestId('bar-chart');
            expect(chart).toHaveAttribute('data-data-length', '12');

            const chartDataEl = await screen.findByTestId('chart-data');
            const chartData = JSON.parse(chartDataEl.textContent || '[]');
            expect(chartData[0].month).toBe('Jan');
            expect(chartData[11].month).toBe('Dec');
        });

        it('renders partial chart and shows warning', async () => {
            renderWithDesign('partial-test');
            fireEvent.click(await screen.findByTestId('expand-button'));

            const chart = await screen.findByTestId('bar-chart');
            expect(chart).toHaveAttribute('data-data-length', '6');
            expect(await screen.findByText(/Incomplete monthly data/i)).toBeInTheDocument();
        });

        it('shows empty state when no modules are placed (shared handler)', async () => {
            renderWithDesign('design-zero');
            expect(await screen.findByText(/Design is empty/i)).toBeInTheDocument();
            expect(screen.getByTestId('expand-button')).toBeDisabled();
        });
    });

    describe('Financial Metrics', () => {
        it('renders financial metrics accurately', async () => {
            renderWithDesign('design-1');
            fireEvent.click(await screen.findByTestId('expand-button'));

            await waitFor(() => {
                const content = screen.getByTestId('tab-content-financial');
                const text = content.textContent || '';
                expect(text.replace(/\s/g, ' ')).toContain('$1,200,000');
                expect(text.replace(/\s/g, ' ')).toContain('$180,000/yr');
                expect(text).toContain('6.7');
                expect(text).toContain('15.4%');
            }, { timeout: 10000 });

            const assumptionsText = screen.getByText(/Retail Electricity Rate/i).parentElement?.textContent || '';
            expect(assumptionsText.replace(/\s/g, ' ')).toContain('$0.120/kWh');
        });

        it('shows financial unavailable (404 via shared handler)', async () => {
            renderWithDesign('no-finance');
            fireEvent.click(await screen.findByTestId('expand-button'));

            expect(await screen.findByText(/Financial Analysis Unavailable/i)).toBeInTheDocument();
            expect(screen.getByText(/Complete the Bill of Quantities/i)).toBeInTheDocument();
        });
    });

    describe('Polling Precision with Fake Timers', () => {
        it('polls at designated intervals precisely', async () => {
            vi.useFakeTimers();
            const fetchSpy = vi.fn();
            server.use(
                http.get('*/api/site-designs/calc-poll/energy-estimate', () => {
                    fetchSpy();
                    return HttpResponse.json({ ...mockEnergyEstimateCalculating, design_id: 'calc-poll' });
                })
            );

            renderWithProviders(<ResultsBottomSheet designId="calc-poll" pollingInterval={2000} />);
            // Wait for initial fetch AND calculating state to ensure polling is enabled
            await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
            console.log('Initial fetch happened. Calls:', fetchSpy.mock.calls.length);
            await waitFor(() => expect(screen.getAllByTestId('energy-calculating').length).toBeGreaterThan(0));
            console.log('Calculated state visible.');

            const initialCalls = fetchSpy.mock.calls.length;

            // Advance by 2 intervals (4000ms)
            console.log('Advancing timers 4000ms...');
            await act(async () => {
                await vi.advanceTimersByTimeAsync(4000);
            });

            // Should have called at least 2 more times (total 3+)
            // Note: React Query might have some slight delay or backoff, so we check >=
            await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(initialCalls + 2));

            expect(screen.getAllByTestId('energy-calculating').length).toBeGreaterThan(0);
            vi.useRealTimers();
        });

        it('stops polling on successful completion (shared handler)', async () => {
            vi.useFakeTimers();
            const fetchSpy = vi.fn();
            server.use(
                http.get('*/api/site-designs/poll-finish/energy-estimate', async (req) => {
                    fetchSpy();
                    // Fallthrough to shared handler which returns 'completed' after 2 calls
                    return;
                })
            );

            renderWithProviders(<ResultsBottomSheet designId="poll-finish" pollingInterval={1000} />);

            // Initial call (pollCount 1)
            await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

            // Advance (pollCount 2)
            await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
            expect(fetchSpy).toHaveBeenCalledTimes(2);

            // Advance (pollCount 3) -> should return 'completed'
            await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
            expect(fetchSpy).toHaveBeenCalledTimes(3);

            // Advance further -> should NOT call again
            await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
            expect(fetchSpy).toHaveBeenCalledTimes(3);

            await waitFor(() => expect(toast.success).toHaveBeenCalled());
            vi.useRealTimers();
        });
    });

    describe('Error Handling & Degradation', () => {
        it('shows specific guidance for location errors (shared handler)', async () => {
            renderWithDesign('loc-error');
            fireEvent.click(await screen.findByTestId('expand-button'));

            await waitFor(() => expect(screen.getAllByTestId('energy-failed').length).toBeGreaterThan(0));
            expect(screen.getByText(/verify the tender location coordinates/i)).toBeInTheDocument();
        });

        it('handles retry after failure (shared handler)', async () => {
            const { user } = renderWithDesign('retry-test');
            fireEvent.click(await screen.findByTestId('expand-button'));

            await waitFor(() => expect(screen.getAllByTestId('energy-failed').length).toBeGreaterThan(0));

            const retryBtn = await screen.findByRole('button', { name: /Retry Estimation/i });
            await user.click(retryBtn);

            // After retry POST, next GET returns completed in shared handler
            await waitFor(() => expect(toast.success).toHaveBeenCalled(), { timeout: 25000 });
        });

        it('handles unavailable energy (404 shared handler)', async () => {
            renderWithDesign('no-energy');
            fireEvent.click(await screen.findByTestId('expand-button'));

            await waitFor(() => {
                const container = screen.getByTestId('results-content-container');
                expect(container).toHaveAttribute('data-is-unavailable', 'true');
            }, { timeout: 15000 });

            expect(await screen.findByText(/Energy estimation unavailable/i)).toBeInTheDocument();

            const recalcBtn = screen.getByRole('button', { name: /Recalculate Now/i });
            fireEvent.click(recalcBtn);

            await waitFor(() => expect(screen.getAllByTestId('energy-calculating').length).toBeGreaterThan(0), { timeout: 15000 });
        });

        it('handles stale data (shared handler)', async () => {
            renderWithDesign('stale-test');
            fireEvent.click(await screen.findByTestId('expand-button'));

            await waitFor(() => expect(screen.getAllByTestId('energy-stale').length).toBeGreaterThan(0), { timeout: 15000 });

            const recalcBtn = screen.getByRole('button', { name: /Recalculate/i });
            fireEvent.click(recalcBtn);

            await waitFor(() => expect(screen.getAllByTestId('energy-calculating').length).toBeGreaterThan(0), { timeout: 15000 });
            expect(screen.queryByTestId('energy-stale')).not.toBeInTheDocument();
        });
    });

    describe('Timeout Recovery', () => {
        it('should allow recovery via "Check Status" after timeout', async () => {
            renderWithDesign('calc-test', 200, 1000);
            await waitFor(() => expect(toast.warning).toHaveBeenCalled(), { timeout: 15000 });

            const checkBtn = await screen.findByRole('button', { name: /Check Status/i });
            fireEvent.click(checkBtn);

            await waitFor(() => {
                expect(screen.queryByRole('button', { name: /Check Status/i })).not.toBeInTheDocument();
            }, { timeout: 15000 });
        });
    });
});
