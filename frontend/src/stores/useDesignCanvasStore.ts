import { create } from 'zustand';

interface DesignCanvasState {
    mode: 'select' | 'draw';
    selectedTool: string | null;
    syncState: 'pending' | 'syncing' | 'synced' | 'failed';
    rightPanelOpen: boolean;

    // Actions
    setMode: (mode: 'select' | 'draw') => void;
    setSelectedTool: (tool: string | null) => void;
    setSyncState: (state: 'pending' | 'syncing' | 'synced' | 'failed') => void;
    setRightPanelOpen: (isOpen: boolean) => void;
    toggleRightPanel: () => void;
}

export const useDesignCanvasStore = create<DesignCanvasState>((set) => ({
    mode: 'select',
    selectedTool: null,
    syncState: 'synced',
    rightPanelOpen: true,

    setMode: (mode) => set({ mode }),
    setSelectedTool: (selectedTool) => set({ selectedTool }),
    setSyncState: (syncState) => set({ syncState }),
    setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
}));
