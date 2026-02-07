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
})
