import { create } from 'zustand';

interface DesignCanvasState {
    mode: 'select' | 'draw' | 'edit';
    selectedTool: string | null;
    selectedGeometry: { type: 'boundary' | 'exclusion'; index?: number } | null;
    syncState: 'pending' | 'syncing' | 'synced' | 'failed';
    placementLoading: boolean;
    rightPanelOpen: boolean;

    // Actions
    setMode: (mode: 'select' | 'draw' | 'edit') => void;
    setSelectedTool: (tool: string | null) => void;
    setSelectedGeometry: (geometry: { type: 'boundary' | 'exclusion'; index?: number } | null) => void;
    setSyncState: (state: 'pending' | 'syncing' | 'synced' | 'failed') => void;
    setPlacementLoading: (loading: boolean) => void;
    setRightPanelOpen: (isOpen: boolean) => void;
    toggleRightPanel: () => void;
}

export const useDesignCanvasStore = create<DesignCanvasState>((set) => ({
    mode: 'select',
    selectedTool: null,
    selectedGeometry: null,
    syncState: 'synced',
    placementLoading: false,
    rightPanelOpen: true,

    setMode: (mode) => set({
        mode,
        // Reset selection when changing modes
        selectedGeometry: null
    }),
    setSelectedTool: (selectedTool) => set({ selectedTool }),
    setSelectedGeometry: (selectedGeometry) => set({ selectedGeometry }),
    setSyncState: (syncState) => set({ syncState }),
    setPlacementLoading: (placementLoading) => set({ placementLoading }),
    setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
}));
