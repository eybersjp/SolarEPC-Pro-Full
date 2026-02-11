import { create } from 'zustand';
import { PlacementSettings, SiteDesignUpdate } from '@/types';

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
    lastMutationData: Partial<SiteDesignUpdate> | null;
    currentVersionName: string | null;
    isModifiedSinceVersion: boolean;
    placementStatus: string | null;
    placementError: string | null;

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
    setLastMutationData: (data: Partial<SiteDesignUpdate> | null) => void;
    setCurrentVersionName: (name: string | null) => void;
    setIsModifiedSinceVersion: (isModified: boolean) => void;
    setPlacementStatus: (status: string | null, error?: string | null) => void;
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
    lastMutationData: null,
    currentVersionName: null,
    isModifiedSinceVersion: false,
    placementStatus: null,
    placementError: null,

    setMode: (mode) => set({
        mode,
        // Reset selection when changing modes
        selectedGeometry: null
    }),
    setSelectedTool: (selectedTool) => set((state) => {
        if (state.selectedTool === selectedTool) return state;
        return { selectedTool };
    }),
    setSelectedGeometry: (selectedGeometry) => set({ selectedGeometry }),
    setSyncState: (syncState) => set((state) => {
        if (state.syncState === syncState) return state;
        return {
            syncState,
            retryCount: syncState === 'synced' ? 0 : state.retryCount,
            lastSyncedAt: syncState === 'synced' ? new Date() : state.lastSyncedAt
        };
    }),
    setPlacementLoading: (placementLoading) => set((state) => {
        if (state.placementLoading === placementLoading) return state;
        return { placementLoading };
    }),
    setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
    toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
    setPlacementSettings: (placementSettings) => set((state) => {
        const nextSettings = { ...state.placementSettings, ...placementSettings };
        // Simple equality check for primary fields
        if (JSON.stringify(state.placementSettings) === JSON.stringify(nextSettings)) {
            return state;
        }
        return {
            placementSettings: nextSettings,
            isModifiedSinceVersion: true
        };
    }),
    setEquipmentSelection: (moduleId, inverterId) => set((state) => {
        if (state.equipmentModuleId === moduleId && state.equipmentInverterId === inverterId) {
            return state;
        }

        const hasSelected = !!moduleId && !!inverterId;
        // If we are losing selection and currently drawing, reset to select mode
        const shouldResetMode = !hasSelected && state.mode === 'draw';

        return {
            ...state,
            equipmentModuleId: moduleId,
            equipmentInverterId: inverterId,
            hasEquipmentSelected: hasSelected,
            mode: shouldResetMode ? 'select' : state.mode,
            selectedTool: shouldResetMode ? null : state.selectedTool,
            isModifiedSinceVersion: true
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
            selectedTool: shouldResetMode ? null : state.selectedTool,
            isModifiedSinceVersion: true
        };
    }),
    setRetryCount: (retryCount) => set({ retryCount }),
    setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
    resetRetryCount: () => set({ retryCount: 0 }),
    setLastMutationData: (lastMutationData) => set({ lastMutationData }),
    setCurrentVersionName: (currentVersionName) => set((state) => {
        if (state.currentVersionName === currentVersionName) return state;
        return {
            currentVersionName,
            isModifiedSinceVersion: false // Reset modification flag when a new version context is set
        };
    }),
    setIsModifiedSinceVersion: (isModifiedSinceVersion) => set({ isModifiedSinceVersion }),
    setPlacementStatus: (placementStatus, placementError = null) => set({
        placementStatus,
        placementError
    }),
}));
