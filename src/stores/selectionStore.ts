import { create } from 'zustand'

/**
 * Selection Store - управление состоянием выделения (UI state)
 * Отделён от данных графа для чистоты архитектуры
 */

interface SelectionState {
  // Выделенные элементы
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  
  // Режим выделения
  isMultiSelect: boolean
  selectionBox: { x: number; y: number; width: number; height: number } | null
  
  // Hover состояние
  hoveredNodeId: string | null
  hoveredEdgeId: string | null
  
  // Действия
  selectNodes: (ids: string[], addToSelection?: boolean) => void
  selectEdges: (ids: string[], addToSelection?: boolean) => void
  selectAll: (nodeIds: string[], edgeIds: string[]) => void
  clearSelection: () => void
  toggleNodeSelection: (id: string) => void
  toggleEdgeSelection: (id: string) => void
  
  setHoveredNode: (id: string | null) => void
  setHoveredEdge: (id: string | null) => void
  
  setMultiSelect: (value: boolean) => void
  setSelectionBox: (box: { x: number; y: number; width: number; height: number } | null) => void
  
  // Computed
  hasSelection: () => boolean
  getSelectedCount: () => number
}

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  selectedNodeIds: [],
  selectedEdgeIds: [],
  isMultiSelect: false,
  selectionBox: null,
  hoveredNodeId: null,
  hoveredEdgeId: null,
  
  selectNodes: (ids, addToSelection = false) => {
    set(state => ({
      selectedNodeIds: addToSelection 
        ? [...new Set([...state.selectedNodeIds, ...ids])]
        : ids,
      selectedEdgeIds: addToSelection ? state.selectedEdgeIds : []
    }))
  },
  
  selectEdges: (ids, addToSelection = false) => {
    set(state => ({
      selectedEdgeIds: addToSelection
        ? [...new Set([...state.selectedEdgeIds, ...ids])]
        : ids,
      selectedNodeIds: addToSelection ? state.selectedNodeIds : []
    }))
  },
  
  selectAll: (nodeIds, edgeIds) => {
    set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds })
  },
  
  clearSelection: () => {
    set({ selectedNodeIds: [], selectedEdgeIds: [] })
  },
  
  toggleNodeSelection: (id) => {
    set(state => {
      const isSelected = state.selectedNodeIds.includes(id)
      return {
        selectedNodeIds: isSelected
          ? state.selectedNodeIds.filter(nid => nid !== id)
          : [...state.selectedNodeIds, id]
      }
    })
  },
  
  toggleEdgeSelection: (id) => {
    set(state => {
      const isSelected = state.selectedEdgeIds.includes(id)
      return {
        selectedEdgeIds: isSelected
          ? state.selectedEdgeIds.filter(eid => eid !== id)
          : [...state.selectedEdgeIds, id]
      }
    })
  },
  
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setHoveredEdge: (id) => set({ hoveredEdgeId: id }),
  
  setMultiSelect: (value) => set({ isMultiSelect: value }),
  setSelectionBox: (box) => set({ selectionBox: box }),
  
  hasSelection: () => {
    const state = get()
    return state.selectedNodeIds.length > 0 || state.selectedEdgeIds.length > 0
  },
  
  getSelectedCount: () => {
    const state = get()
    return state.selectedNodeIds.length + state.selectedEdgeIds.length
  }
}))
