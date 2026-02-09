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
            retryCount: 0,
            lastSyncedAt: null,
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

    describe('retry logic', () => {
        it('should initialize retryCount and lastSyncedAt', () => {
            const state = useDesignCanvasStore.getState()
            expect(state.retryCount).toBe(0)
            expect(state.lastSyncedAt).toBeNull()
        })

        it('should update retryCount', () => {
            useDesignCanvasStore.getState().setRetryCount(2)
            expect(useDesignCanvasStore.getState().retryCount).toBe(2)
        })

        it('should reset retryCount', () => {
            useDesignCanvasStore.getState().setRetryCount(3)
            useDesignCanvasStore.getState().resetRetryCount()
            expect(useDesignCanvasStore.getState().retryCount).toBe(0)
        })

        it('should update lastSyncedAt', () => {
            const now = new Date()
            useDesignCanvasStore.getState().setLastSyncedAt(now)
            expect(useDesignCanvasStore.getState().lastSyncedAt).toEqual(now)
        })

        it('should reset retryCount and update lastSyncedAt when syncState becomes synced', () => {
            // Set initial state
            useDesignCanvasStore.setState({ retryCount: 3, lastSyncedAt: null })

            // Transition to synced
            useDesignCanvasStore.getState().setSyncState('synced')

            const state = useDesignCanvasStore.getState()
            expect(state.syncState).toBe('synced')
            expect(state.retryCount).toBe(0)
            expect(state.lastSyncedAt).toBeInstanceOf(Date)
        })

        it('should NOT reset retryCount when syncState becomes other than synced', () => {
            // Set initial state
            useDesignCanvasStore.setState({ retryCount: 2 })

            // Transition to syncing
            useDesignCanvasStore.getState().setSyncState('syncing')
            expect(useDesignCanvasStore.getState().retryCount).toBe(2)

            // Transition to failed
            useDesignCanvasStore.getState().setSyncState('failed')
            expect(useDesignCanvasStore.getState().retryCount).toBe(2)
        })
    })
})
