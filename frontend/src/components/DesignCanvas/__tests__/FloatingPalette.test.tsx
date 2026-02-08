import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloatingPalette } from '../FloatingPalette';
import { renderWithProviders } from '@/test/utils';
import { useDesignCanvasStore } from '@/stores/useDesignCanvasStore';

describe('FloatingPalette', () => {
    beforeEach(() => {
        useDesignCanvasStore.setState({
            mode: 'select',
            selectedTool: null,
            hasEquipmentSelected: false
        });
    });

    it('should render all tools', () => {
        renderWithProviders(<FloatingPalette />);

        expect(screen.getByTitle('Select')).toBeInTheDocument();
        expect(screen.getByTitle('Edit Geometry')).toBeInTheDocument();
        expect(screen.getByTitle('Roof')).toBeInTheDocument();
        expect(screen.getByTitle('Ground')).toBeInTheDocument();
        expect(screen.getByTitle('Carport')).toBeInTheDocument();
        expect(screen.getByTitle('Exclusion')).toBeInTheDocument();
    });

    it('should disable drawing tools when no equipment is selected', async () => {
        const user = userEvent.setup();
        renderWithProviders(<FloatingPalette />);

        const roofTool = screen.getByTitle('Roof');

        // Check if disabled (button should have disabled attribute or class)
        expect(roofTool).toBeDisabled();

        // Hover to check tooltip (if implemented with TooltipProvider, might need waiting)
        await user.hover(roofTool);
        await waitFor(() => {
            expect(screen.getByText('Select equipment to enable drawing tools')).toBeInTheDocument();
        });
    });

    it('should enable drawing tools when equipment is selected', async () => {
        useDesignCanvasStore.setState({ hasEquipmentSelected: true });
        renderWithProviders(<FloatingPalette />);

        const roofTool = screen.getByTitle('Roof');
        expect(roofTool).not.toBeDisabled();
    });

    it('should update store when tool is clicked', async () => {
        useDesignCanvasStore.setState({ hasEquipmentSelected: true });
        const user = userEvent.setup();
        renderWithProviders(<FloatingPalette />);

        const roofTool = screen.getByTitle('Roof');
        await user.click(roofTool);

        expect(useDesignCanvasStore.getState().mode).toBe('draw');
        expect(useDesignCanvasStore.getState().selectedTool).toBe('roof');
    });

    it('should switch back to select mode', async () => {
        useDesignCanvasStore.setState({
            hasEquipmentSelected: true,
            mode: 'draw',
            selectedTool: 'roof'
        });
        const user = userEvent.setup();
        renderWithProviders(<FloatingPalette />);

        const selectTool = screen.getByTitle('Select');
        await user.click(selectTool);

        expect(useDesignCanvasStore.getState().mode).toBe('select');
        expect(useDesignCanvasStore.getState().selectedTool).toBeNull();
    });
});
