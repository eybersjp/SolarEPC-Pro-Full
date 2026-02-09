import { create } from 'zustand';
import { PlacementSettings } from '@/types';

interface DesignCanvasState {
    mode: 'select' | 'draw' | 'edit';
    selectedTool: string | null;
    selectedGeometry: { type: 'boundary' | 'exclusion'; index?: number } | null;
    syncState: 'pending' | 'syncing' | 'synced' | 'failed';
    placementLoading: boolean;
    rightPanelOpen: boolean;
    placementSettings: Partial<PlacementSettings>;
    hasEquipmentSelected: boolean;
    equipmentModuleId: string | null;
    equipmentInverterId: string | null;
    retryCount: number;
    lastSyncedAt: Date | null;

    // Actions
    setMode: (mode: 'select' | 'draw' | 'edit') => void;
    setSelectedTool: (tool: string | null) => void;
    setSelectedGeometry: (geometry: { type: 'boundary' | 'exclusion'; index?: number } | null) => void;
    setSyncState: (state: 'pending' | 'syncing' | 'synced' | 'failed') => void;
    setPlacementLoading: (loading: boolean) => void;
    setRightPanelOpen: (isOpen: boolean) => void;
    toggleRightPanel: () => void;
    setPlacementSettings: (settings: Partial<PlacementSettings>) => void;
    setEquipmentSelection: (moduleId: string | null, inverterId: string | null) => void;
    clearEquipmentSelection: () => void;
    setRetryCount: (count: number) => void;
    setLastSyncedAt: (timestamp: Date) => void;
    resetRetryCount: () => void;
}

export const useDesignCanvasStore = create<DesignCanvasState>((set) => ({
    mode: 'select',
    selectedTool: null,
    selectedGeometry: null,
    syncState: 'synced',
    placementLoading: false,
    rightPanelOpen: true,
    placementSettings: {},
    hasEquipmentSelected: false,
    equipmentModuleId: null,
    equipmentInverterId: null,
    retryCount: 0,
    lastSyncedAt: null,

    setMode: (mode) => set({
        mode,
        // Reset selection when changing modes
        selectedGeometry: null
    }),
    setSelectedTool: (selectedTool) => set({ selectedTool }),
    setSelectedGeometry: (selectedGeometry) => set({ selectedGeometry }),
    setSyncState: (syncState) => set((state) => ({
        syncState,
        retryCount: syncState === 'synced' ? 0 : state.retryCount,
        lastSyncedAt: syncState === 'synced' ? new Date() : state.lastSyncedAt
    })),
    setPlacementLoading: (placementLoading) => set({ placementLoading }),
    setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
    setPlacementSettings: (placementSettings) => set((state) => ({
        placementSettings: { ...state.placementSettings, ...placementSettings }
    })),
    setEquipmentSelection: (moduleId, inverterId) => set((state) => {
        const hasSelected = !!moduleId && !!inverterId;
        // If we are losing selection and currently drawing, reset to select mode
        const shouldResetMode = !hasSelected && state.mode === 'draw';

        return {
            ...state,
            equipmentModuleId: moduleId,
            equipmentInverterId: inverterId,
            hasEquipmentSelected: hasSelected,
            mode: shouldResetMode ? 'select' : state.mode,
            selectedTool: shouldResetMode ? null : state.selectedTool
        };
    }),
    clearEquipmentSelection: () => set((state) => {
        const shouldResetMode = state.mode === 'draw';

        return {
            ...state,
            hasEquipmentSelected: false,
            equipmentModuleId: null,
            equipmentInverterId: null,
            mode: shouldResetMode ? 'select' : state.mode,
            selectedTool: shouldResetMode ? null : state.selectedTool
        };
    }),
    setRetryCount: (retryCount) => set({ retryCount }),
    setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
    resetRetryCount: () => set({ retryCount: 0 }),
}));
