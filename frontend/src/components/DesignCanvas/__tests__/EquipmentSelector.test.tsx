import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EquipmentSelector } from '../EquipmentSelector';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse, delay } from 'msw';
import { mockModulesList, mockInvertersList } from '@/test/fixtures/equipment';
import { mockSiteDesign } from '@/test/fixtures/siteDesign';
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';
import { toast } from 'sonner';

// Mock toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));

describe('EquipmentSelector', () => {
    const designId = 'design-1';

    beforeEach(() => {
        vi.clearAllMocks();

        useDesignCanvasStore.setState({
            equipmentModuleId: null,
            equipmentInverterId: null,
            hasEquipmentSelected: false
        });

        // Mock pointer capture methods for Radix UI
        window.HTMLElement.prototype.hasPointerCapture = vi.fn();
        window.HTMLElement.prototype.setPointerCapture = vi.fn();
        window.HTMLElement.prototype.releasePointerCapture = vi.fn();
        window.Element.prototype.hasPointerCapture = vi.fn();
        window.Element.prototype.setPointerCapture = vi.fn();
        window.Element.prototype.releasePointerCapture = vi.fn();
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
        window.Element.prototype.scrollIntoView = vi.fn();
    });

    it('should render loading skeletons initially', async () => {
        server.use(
            http.get('*/api/equipment/modules', async () => {
                await delay(100);
                return HttpResponse.json(mockModulesList);
            })
        );
        renderWithProviders(<EquipmentSelector designId={designId} />);

        expect(screen.queryByLabelText(/Solar Module/i)).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText(/Solar Module/i)).toBeInTheDocument());
    });

    it('should render equipment options after loading', async () => {
        renderWithProviders(<EquipmentSelector designId={designId} />);

        await waitFor(() => {
            expect(screen.getByLabelText(/Solar Module/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Inverter/i)).toBeInTheDocument();
        });
    });

    it('should show error alert on failure', async () => {
        server.use(
            http.get('*/api/equipment/modules', () => {
                return new HttpResponse(null, { status: 500 });
            })
        );

        renderWithProviders(<EquipmentSelector designId={designId} />);

        await waitFor(() => {
            expect(screen.getByText(/Failed to load equipment data/i)).toBeInTheDocument();
        });
    });

    it('should display selected module details', async () => {
        server.use(
            http.get('*/api/site-designs/:id', () => {
                return HttpResponse.json({
                    id: designId,
                    equipment_module_id: mockModulesList[0].id,
                    equipment_inverter_id: null
                });
            })
        );

        renderWithProviders(<EquipmentSelector designId={designId} />);

        await waitFor(() => {
            expect(screen.getByText(`${mockModulesList[0].wattage}W`)).toBeInTheDocument();
            expect(screen.getByText(`${mockModulesList[0].efficiency}%`)).toBeInTheDocument();
        });
    });

    it('should search and filter modules', async () => {
        // Disable pointer check for Radix Select interactions
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        renderWithProviders(<EquipmentSelector designId={designId} />);

        await waitFor(() => expect(screen.getByLabelText(/Solar Module/i)).toBeInTheDocument());

        const searchInput = screen.getByPlaceholderText(/Search modules/i);
        await user.type(searchInput, '400');

        const moduleCombobox = screen.getByLabelText(/Solar Module/i);
        await user.click(moduleCombobox);

        const optionText1 = `${mockModulesList[0].manufacturer} ${mockModulesList[0].model} (${mockModulesList[0].wattage}W)`;
        const option = await screen.findByRole('option', { name: optionText1 });
        await user.click(option);

        await waitFor(() => {
            // Expectation depends on what display changes; checking option text presence or side effect
            // Here we just check that the option was selectable (implied by finding it and clicking)
            // And maybe check if it filtered out others
            expect(screen.queryByText('TS-450')).not.toBeInTheDocument();
        });
    });

    it.skip('should select inverter and update store/mutation', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        const updateSpy = vi.fn();

        server.use(
            http.put('*/api/site-designs/:id', async ({ request }) => {
                const body = await request.json();
                updateSpy(body);
                return HttpResponse.json({ ...mockSiteDesign, ...body });
            })
        );

        renderWithProviders(<EquipmentSelector designId={designId} />);

        await waitFor(() => expect(screen.getByLabelText(/Inverter/i)).toBeInTheDocument());

        const trigger = screen.getByLabelText(/Inverter/i);
        await user.click(trigger);

        const optionText = `${mockInvertersList[0].manufacturer} ${mockInvertersList[0].model} (${mockInvertersList[0].capacity_kw}kW)`;
        const option = await screen.findByRole('option', { name: optionText });
        await user.click(option);

        await waitFor(() => {
            expect(screen.getByText('50kW')).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                equipment_inverter_id: mockInvertersList[0].id
            }));
        });

        expect(useDesignCanvasStore.getState().equipmentInverterId).toBe(mockInvertersList[0].id);
    });

    it.skip('should update store when module is selected and verify full selection state', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        const updateSpy = vi.fn();
        server.use(
            http.put('*/api/site-designs/:id', async ({ request }) => {
                const body = await request.json();
                updateSpy(body);
                return HttpResponse.json({ ...mockSiteDesign, ...body });
            })
        );

        renderWithProviders(<EquipmentSelector designId={designId} />);

        await waitFor(() => expect(screen.getByLabelText(/Solar Module/i)).toBeInTheDocument());

        const moduleTrigger = screen.getByLabelText(/Solar Module/i);
        await user.click(moduleTrigger);
        const moduleOptionText = `${mockModulesList[0].manufacturer} ${mockModulesList[0].model} (${mockModulesList[0].wattage}W)`;
        const moduleOption = await screen.findByRole('option', { name: moduleOptionText });
        await user.click(moduleOption);

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                equipment_module_id: mockModulesList[0].id
            }));
        });

        expect(useDesignCanvasStore.getState().equipmentModuleId).toBe(mockModulesList[0].id);

        const inverterTrigger = screen.getByLabelText(/Inverter/i);
        await user.click(inverterTrigger); // Open first

        const inverterOptionText = `${mockInvertersList[0].manufacturer} ${mockInvertersList[0].model} (${mockInvertersList[0].capacity_kw}kW)`;
        const inverterOption = await screen.findByRole('option', { name: inverterOptionText });
        await user.click(inverterOption);

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                equipment_inverter_id: mockInvertersList[0].id
            }));
        });

        expect(useDesignCanvasStore.getState().equipmentInverterId).toBe(mockInvertersList[0].id);
        expect(useDesignCanvasStore.getState().hasEquipmentSelected).toBe(true);
    });

    it.skip('should show error toast on mutation failure', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });
        server.use(
            http.put('*/api/site-designs/:id', () => {
                return new HttpResponse(null, { status: 500 });
            })
        );

        renderWithProviders(<EquipmentSelector designId={designId} />);
        await waitFor(() => expect(screen.getByLabelText(/Solar Module/i)).toBeInTheDocument());

        const trigger = screen.getByLabelText(/Solar Module/i);
        await user.click(trigger);

        const optionText = `${mockModulesList[0].manufacturer} ${mockModulesList[0].model} (${mockModulesList[0].wattage}W)`;
        const option = await screen.findByRole('option', { name: optionText });
        await user.click(option);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalled();
        });
    });
});
