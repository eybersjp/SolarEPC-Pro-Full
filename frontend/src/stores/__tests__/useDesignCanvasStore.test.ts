import { describe, it, expect, beforeEach } from 'vitest'
import { useDesignCanvasStore } from '../useDesignCanvasStore'

describe('useDesignCanvasStore', () => {
    beforeEach(() => {
        // Reset store to initial state
        useDesignCanvasStore.setState({
            mode: 'select',
            selectedTool: null,
            selectedGeometry: null,
            syncState: 'synced',
            placementLoading: false,
            rightPanelOpen: true,
        })
    })

    it('should have initial state', () => {
        const state = useDesignCanvasStore.getState()
        expect(state.mode).toBe('select')
        expect(state.selectedTool).toBeNull()
        expect(state.selectedGeometry).toBeNull()
        expect(state.syncState).toBe('synced')
        expect(state.placementLoading).toBe(false)
        expect(state.rightPanelOpen).toBe(true)
    })

    it('should setMode and reset selectedGeometry', () => {
        useDesignCanvasStore.getState().setMode('draw')
        expect(useDesignCanvasStore.getState().mode).toBe('draw')
        expect(useDesignCanvasStore.getState().selectedGeometry).toBeNull()

        useDesignCanvasStore.getState().setSelectedGeometry({ type: 'boundary' })
        useDesignCanvasStore.getState().setMode('edit')
        expect(useDesignCanvasStore.getState().mode).toBe('edit')
        expect(useDesignCanvasStore.getState().selectedGeometry).toBeNull()
    })

    it('should setSelectedTool', () => {
        useDesignCanvasStore.getState().setSelectedTool('polygon')
        expect(useDesignCanvasStore.getState().selectedTool).toBe('polygon')
    })

    it('should setSelectedGeometry', () => {
        const geometry = { type: 'exclusion' as const, index: 1 }
        useDesignCanvasStore.getState().setSelectedGeometry(geometry)
        expect(useDesignCanvasStore.getState().selectedGeometry).toEqual(geometry)
    })

    it('should setSyncState', () => {
        useDesignCanvasStore.getState().setSyncState('syncing')
        expect(useDesignCanvasStore.getState().syncState).toBe('syncing')
    })

    it('should setPlacementLoading', () => {
        useDesignCanvasStore.getState().setPlacementLoading(true)
        expect(useDesignCanvasStore.getState().placementLoading).toBe(true)
    })

    it('should toggleRightPanel', () => {
        const initial = useDesignCanvasStore.getState().rightPanelOpen
        useDesignCanvasStore.getState().toggleRightPanel()
        expect(useDesignCanvasStore.getState().rightPanelOpen).toBe(!initial)
    })

    describe('equipment selection', () => {
        it('should update equipment selection and set hasEquipmentSelected', () => {
            useDesignCanvasStore.getState().setEquipmentSelection('mod-1', 'inv-1')
            const state = useDesignCanvasStore.getState()

            expect(state.equipmentModuleId).toBe('mod-1')
            expect(state.equipmentInverterId).toBe('inv-1')
            expect(state.hasEquipmentSelected).toBe(true)
        })

        it('should clear equipment selection', () => {
            // Setup initial state
            useDesignCanvasStore.getState().setEquipmentSelection('mod-1', 'inv-1')
            expect(useDesignCanvasStore.getState().hasEquipmentSelected).toBe(true)

            // Clear
            useDesignCanvasStore.getState().clearEquipmentSelection()
            const state = useDesignCanvasStore.getState()

            expect(state.equipmentModuleId).toBeNull()
            expect(state.equipmentInverterId).toBeNull()
            expect(state.hasEquipmentSelected).toBe(false)
        })

        it('should reset mode from draw to select when equipment is cleared', () => {
            // Setup: selected equipment and draw mode
            useDesignCanvasStore.getState().setEquipmentSelection('mod-1', 'inv-1')
            useDesignCanvasStore.getState().setMode('draw')
            useDesignCanvasStore.getState().setSelectedTool('roof')

            expect(useDesignCanvasStore.getState().mode).toBe('draw')

            // Clear equipment
            useDesignCanvasStore.getState().clearEquipmentSelection()
            const state = useDesignCanvasStore.getState()

            expect(state.hasEquipmentSelected).toBe(false)
            expect(state.mode).toBe('select')
            expect(state.selectedTool).toBeNull()
        })

        it('should NOT reset mode when equipment is cleared if not in draw mode', () => {
            // Setup: selected equipment and select mode
            useDesignCanvasStore.getState().setEquipmentSelection('mod-1', 'inv-1')
            useDesignCanvasStore.getState().setMode('select')

            // Clear equipment
            useDesignCanvasStore.getState().clearEquipmentSelection()
            const state = useDesignCanvasStore.getState()

            expect(state.mode).toBe('select')
        })
    })
})
