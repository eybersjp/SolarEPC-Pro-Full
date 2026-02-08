import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlacementSettings } from '../PlacementSettings';
import { renderWithProviders } from '@/test/utils';
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockSiteDesign } from '@/test/fixtures/siteDesign';

describe('PlacementSettings', () => {
    const designId = 'design-1';

    beforeEach(() => {
        vi.clearAllMocks();
        useDesignCanvasStore.setState({
            placementSettings: {},
            syncState: 'synced'
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should render with initial values from design', async () => {
        server.use(
            http.get('*/api/site-designs/:id', () => {
                return HttpResponse.json({
                    id: designId,
                    placement_settings: {
                        azimuth_deg: 185,
                        row_spacing_m: 3.5,
                        tilt_deg: 25,
                        module_orientation: 'portrait'
                    }
                });
            })
        );

        renderWithProviders(<PlacementSettings designId={designId} />);

        const inputs = await screen.findAllByRole('spinbutton', {}, { timeout: 3000 });
        expect(inputs[0]).toHaveValue(185); // Azimuth
        expect(screen.getByText('3.5m')).toBeInTheDocument();
        expect(screen.getByText('25°')).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: /Portrait Orientation/i })).toBeChecked();
    });

    it('should handle Slider interactions and update store', async () => {
        renderWithProviders(<PlacementSettings designId={designId} />);
        await screen.findAllByRole('spinbutton', {}, { timeout: 3000 });

        const sliders = screen.getAllByRole('slider');
        const azimuthSlider = sliders[0];
        const rowSpacingSlider = sliders[1];
        const tiltSlider = sliders[2];

        act(() => {
            azimuthSlider.focus();
            fireEvent.keyDown(azimuthSlider, { key: 'ArrowRight', code: 'ArrowRight' });
        });
        expect(useDesignCanvasStore.getState().syncState).toBe('pending');
        expect(useDesignCanvasStore.getState().placementSettings.azimuth_deg).not.toBe(180);

        act(() => {
            rowSpacingSlider.focus();
            fireEvent.keyDown(rowSpacingSlider, { key: 'ArrowRight', code: 'ArrowRight' });
        });
        expect(useDesignCanvasStore.getState().placementSettings.row_spacing_m).not.toBe(2.5);

        act(() => {
            tiltSlider.focus();
            fireEvent.keyDown(tiltSlider, { key: 'ArrowRight', code: 'ArrowRight' });
        });
        expect(useDesignCanvasStore.getState().placementSettings.tilt_deg).not.toBe(20);
    });

    it('should debounce API calls', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const updateSpy = vi.fn();

        server.use(
            http.put('*/api/site-designs/:id', async ({ request }) => {
                const body = await request.json();
                updateSpy(body);
                return HttpResponse.json({ ...mockSiteDesign, ...body });
            })
        );

        renderWithProviders(<PlacementSettings designId={designId} />);
        await screen.findAllByRole('spinbutton', {}, { timeout: 3000 });

        const inputs = screen.getAllByRole('spinbutton');
        const azimuthInput = inputs[0];

        await user.clear(azimuthInput);
        await user.type(azimuthInput, '190');

        expect(useDesignCanvasStore.getState().syncState).toBe('pending');
        expect(updateSpy).not.toHaveBeenCalled();

        // Advance synchronously
        act(() => {
            vi.advanceTimersByTime(100);
        });
        expect(updateSpy).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                placement_settings: expect.objectContaining({
                    azimuth_deg: 190
                })
            }));
        });

        expect(useDesignCanvasStore.getState().syncState).toBe('synced');
    });

    it('should coalesce rapid changes into single API call', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const updateSpy = vi.fn();

        server.use(
            http.put('*/api/site-designs/:id', async ({ request }) => {
                const body = await request.json();
                updateSpy(body);
                return HttpResponse.json({ ...mockSiteDesign, ...body });
            })
        );

        renderWithProviders(<PlacementSettings designId={designId} />);
        await screen.findAllByRole('spinbutton', {}, { timeout: 3000 });

        const inputs = screen.getAllByRole('spinbutton');
        const azimuthInput = inputs[0];

        await user.clear(azimuthInput);
        await user.type(azimuthInput, '190');
        act(() => { vi.advanceTimersByTime(500); });

        await user.clear(azimuthInput);
        await user.type(azimuthInput, '195');
        act(() => { vi.advanceTimersByTime(500); });

        await user.clear(azimuthInput);
        await user.type(azimuthInput, '200');

        act(() => { vi.advanceTimersByTime(3500); });

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledTimes(1);
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                placement_settings: expect.objectContaining({
                    azimuth_deg: 200
                })
            }));
        });
    });

    it('should update all settings types and handle orientation toggle', async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const updateSpy = vi.fn();

        server.use(
            http.put('*/api/site-designs/:id', async ({ request }) => {
                const body = await request.json();
                updateSpy(body);
                return HttpResponse.json({ ...mockSiteDesign, ...body });
            })
        );

        renderWithProviders(<PlacementSettings designId={designId} />);
        await screen.findAllByRole('spinbutton', {}, { timeout: 3000 });

        const inputs = screen.getAllByRole('spinbutton');
        const rowSpacingInput = inputs[1];

        await user.clear(rowSpacingInput);
        await user.type(rowSpacingInput, '5.5');

        act(() => { vi.advanceTimersByTime(3500); });

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                placement_settings: expect.objectContaining({
                    row_spacing_m: 5.5
                })
            }));
        });

        updateSpy.mockClear();

        const orientationSwitch = screen.getByRole('switch', { name: /Portrait Orientation/i });
        await user.click(orientationSwitch);

        // Check local state
        expect(useDesignCanvasStore.getState().placementSettings.module_orientation).toBe('landscape');

        act(() => { vi.advanceTimersByTime(3500); });

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                placement_settings: expect.objectContaining({
                    module_orientation: 'landscape'
                })
            }));
        });
    });

    it('should trigger recalculation', async () => {
        const user = userEvent.setup();
        const recalculateSpy = vi.fn();

        server.use(
            http.post('*/api/site-designs/:id/recalculate', () => {
                recalculateSpy();
                return HttpResponse.json({ id: designId });
            })
        );

        renderWithProviders(<PlacementSettings designId={designId} />);
        await screen.findAllByRole('spinbutton', {}, { timeout: 3000 });

        const button = screen.getByText(/Recalculate Layout/i);
        await user.click(button);

        await waitFor(() => expect(recalculateSpy).toHaveBeenCalled());
    });
});
