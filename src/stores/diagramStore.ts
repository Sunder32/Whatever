import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { eventBus, AppEvents } from '@/services/eventBus'
import { storageService } from '@/services'
import { schemasApi } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import type { 
  WtvFile, 
  DiagramNode, 
  DiagramEdge, 
  CanvasState, 
  Layer,
  Position,
  NodeStyle,
  TextStyle
} from '@/types'

type SetState = (partial: DiagramState | Partial<DiagramState> | ((state: DiagramState) => DiagramState | Partial<DiagramState>)) => void
type GetState = () => DiagramState

interface HistoryEntry {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  timestamp: number
}

interface DiagramState {
  file: WtvFile | null
  history: HistoryEntry[]
  historyIndex: number
  maxHistory: number
  
  initNewFile: (name: string, projectId?: string) => void
  loadFile: (file: WtvFile) => void
  loadProjectFile: (projectId: string) => Promise<void>
  
  addNode: (node: Partial<DiagramNode>) => string
  updateNode: (id: string, updates: Partial<DiagramNode>) => void
  deleteNode: (id: string) => void
  getNode: (id: string) => DiagramNode | undefined
  
  addEdge: (edge: Partial<DiagramEdge>) => string
  updateEdge: (id: string, updates: Partial<DiagramEdge>) => void
  deleteEdge: (id: string) => void
  
  // Import file contents into a specific container node (scaled down)
  importIntoNode: (targetNodeId: string, importedFile: WtvFile) => void
  
  selectElements: (ids: string[]) => void
  addToSelection: (id: string) => void
  clearSelection: () => void
  
  updateCanvasState: (state: Partial<CanvasState>) => void
  
  addLayer: (name: string) => string
  updateLayer: (id: string, updates: Partial<Layer>) => void
  deleteLayer: (id: string) => void
  moveLayer: (fromIndex: number, toIndex: number) => void
  duplicateLayer: (id: string) => string
  mergeLayerDown: (id: string) => void
  moveElementToLayer: (elementId: string, layerId: string) => void
  setActiveLayer: (id: string) => void
  activeLayerId: string | null
  
  undo: () => void
  redo: () => void
  saveToHistory: () => void
  
  setZoom: (zoom: number) => void
  setPan: (pan: Position) => void
  
  getFileContent: () => WtvFile | null
  setThumbnail: (thumbnail: { data: string; width: number; height: number }) => void
  
  // Reset store (on logout)
  resetStore: () => void
}

const defaultNodeStyle: NodeStyle = {
  fill: '#3b82f6',
  stroke: '#60a5fa',
  strokeWidth: 2,
  opacity: 1,
  cornerRadius: 8,
}

const defaultTextStyle: TextStyle = {
  fontSize: 16,
  fontFamily: 'Inter',
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#ffffff',
  align: 'center',
  lineHeight: 1.4,
  letterSpacing: 0,
}

const createEmptyFile = (name: string, projectId?: string): WtvFile => ({
  id: uuidv4(),
  projectId,
  formatVersion: '1.0.0',
  metadata: {
    name,
    description: '',
    author: '',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    fileSize: 0,
    tags: [],
  },
  content: {
    nodes: [],
    edges: [],
    textElements: [],
    images: [],
    groups: [],
    layers: [
      {
        id: uuidv4(),
        name: 'Layer 1',
        visible: true,
        locked: false,
        elements: [],
      }
    ],
  },
  canvasState: {
    zoom: 1,
    pan: { x: 0, y: 0 },
    grid: {
      enabled: true,
      size: 20,
      snap: true,
      color: '#e5e7eb',
    },
    selectedElements: [],
    viewport: { width: 0, height: 0 },
  },
  assets: [],
  encryption: {
    encrypted: false,
    method: '',
  },
})

export const useDiagramStore = create<DiagramState>()((set: SetState, get: GetState) => ({
  file: null,
  history: [],
  historyIndex: -1,
  maxHistory: 100,

  initNewFile: (name: string, projectId?: string) => {
    const file = createEmptyFile(name, projectId)
    set({ 
      file, 
      history: [], 
      historyIndex: -1 
    })
  },

  loadFile: (file: WtvFile) => {
    set({ 
      file, 
      history: [], 
      historyIndex: -1 
    })
  },

  loadProjectFile: async (projectId: string) => {
    const isAuth = useAuthStore.getState().isAuthenticated
    const currentUserId = useAuthStore.getState().user?.id
    
    // Always fetch from the server (cloud-first)
    if (isAuth) {
      try {
        const result = await schemasApi.list(projectId, 1, 10)
        if (result.success && result.data && result.data.length > 0) {
          // Found schema on server — use it
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const serverSchema = result.data[0] as any
          const file: WtvFile = {
            id: serverSchema.id,
            projectId: serverSchema.projectId,
            formatVersion: serverSchema.formatVersion || '1.0.0',
            metadata: {
              name: serverSchema.name,
              description: serverSchema.metadata?.description || '',
              author: serverSchema.metadata?.author || '',
              created: serverSchema.createdAt,
              modified: serverSchema.updatedAt,
              fileSize: 0,
              tags: serverSchema.metadata?.tags || [],
            },
            content: serverSchema.content || { nodes: [], edges: [], textElements: [], images: [], groups: [], layers: [] },
            canvasState: serverSchema.canvasState || {
              zoom: 1,
              pan: { x: 0, y: 0 },
              grid: { enabled: true, size: 20, snap: true, color: '#e5e7eb' },
              selectedElements: [],
              viewport: { width: 0, height: 0 },
            },
            assets: [],
            encryption: { encrypted: false, method: '' },
          }
          
          set({ 
            file, 
            history: [], 
            historyIndex: -1 
          })
          return
        }
      } catch (error) {
        console.warn('Could not fetch schema from server:', error)
      }
    }
    
    // No schema on server — create an empty file
    const file = createEmptyFile('Проект', projectId)
    set({ 
      file, 
      history: [], 
      historyIndex: -1 
    })
    
    // Only save the empty file to server if this user is the project owner
    if (isAuth) {
      try {
        const { projectsApi } = await import('@/api')
        const projResp = await projectsApi.getById(projectId)
        const isOwner = projResp.success && projResp.data && projResp.data.ownerId === currentUserId
        if (isOwner) {
          await storageService.save(file)
        }
      } catch (error) {
        console.warn('Could not save new file to server:', error)
      }
    }
  },

  addNode: (nodeData: Partial<DiagramNode>) => {
    const id = uuidv4()
    const node: DiagramNode = {
      id,
      type: 'rectangle',
      position: { x: 100, y: 100 },
      size: { width: 160, height: 100 },
      style: { ...defaultNodeStyle },
      text: '',
      textStyle: { ...defaultTextStyle },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: 0,
      metadata: {},
      ...nodeData,
    }

    set((state: DiagramState) => {
      if (!state.file) return state
      const nodes = [...state.file.content.nodes, node]
      
      // Add to active layer, or first layer if no active layer
      const targetLayerId = state.activeLayerId || state.file.content.layers[0]?.id
      
      const layers = state.file.content.layers.map((layer: Layer) => 
        layer.id === targetLayerId ? { ...layer, elements: [...layer.elements, id] } : layer
      )
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, nodes, layers },
          metadata: { ...state.file.metadata, modified: new Date().toISOString() },
        }
      }
    })

    get().saveToHistory()
    return id
  },

  updateNode: (id: string, updates: Partial<DiagramNode>) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      const nodes = state.file.content.nodes.map((node: DiagramNode) =>
        node.id === id ? { ...node, ...updates } : node
      )
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, nodes },
          metadata: { ...state.file.metadata, modified: new Date().toISOString() },
        }
      }
    })
  },

  deleteNode: (id: string) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      const nodes = state.file.content.nodes.filter((node: DiagramNode) => node.id !== id)
      const edges = state.file.content.edges.filter(
        (edge: DiagramEdge) => edge.source !== id && edge.target !== id
      )
      const layers = state.file.content.layers.map((layer: Layer) => ({
        ...layer,
        elements: layer.elements.filter((elId: string) => elId !== id)
      }))
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, nodes, edges, layers },
          metadata: { ...state.file.metadata, modified: new Date().toISOString() },
        }
      }
    })
    get().saveToHistory()
  },

  getNode: (id: string) => {
    const state = get()
    return state.file?.content.nodes.find((node: DiagramNode) => node.id === id)
  },

  addEdge: (edgeData: Partial<DiagramEdge>) => {
    const id = uuidv4()
    const edge: DiagramEdge = {
      id,
      type: 'arrow',
      source: '',
      target: '',
      sourceAnchor: 'right',
      targetAnchor: 'left',
      points: [],
      style: {
        stroke: '#64748b',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
      },
      arrowStart: 'none',
      arrowEnd: 'arrow',
      label: '',
      labelPosition: 'middle',
      ...edgeData,
    }

    set((state: DiagramState) => {
      if (!state.file) return state
      const edges = [...state.file.content.edges, edge]
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, edges },
          metadata: { ...state.file.metadata, modified: new Date().toISOString() },
        }
      }
    })

    get().saveToHistory()
    return id
  },

  updateEdge: (id: string, updates: Partial<DiagramEdge>) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      const edges = state.file.content.edges.map((edge: DiagramEdge) =>
        edge.id === id ? { ...edge, ...updates } : edge
      )
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, edges },
          metadata: { ...state.file.metadata, modified: new Date().toISOString() },
        }
      }
    })
  },

  deleteEdge: (id: string) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      const edges = state.file.content.edges.filter((edge: DiagramEdge) => edge.id !== id)
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, edges },
          metadata: { ...state.file.metadata, modified: new Date().toISOString() },
        }
      }
    })
    get().saveToHistory()
  },

  // Import contents of a WTV file into a target container node
  // Elements are scaled and positioned relative to the target node
  importIntoNode: (targetNodeId: string, importedFile: WtvFile) => {
    const targetNode = get().getNode(targetNodeId)
    if (!targetNode) return
    
    // Calculate bounding box of imported elements
    const importedNodes = importedFile.content.nodes
    if (importedNodes.length === 0) return
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    importedNodes.forEach(node => {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + node.size.width)
      maxY = Math.max(maxY, node.position.y + node.size.height)
    })
    
    const importedWidth = maxX - minX
    const importedHeight = maxY - minY
    
    // Calculate scale to fit inside target node with padding
    const padding = 20
    const availableWidth = targetNode.size.width - padding * 2
    const availableHeight = targetNode.size.height - padding * 2
    
    const scaleX = availableWidth / importedWidth
    const scaleY = availableHeight / importedHeight
    const scale = Math.min(scaleX, scaleY, 1) // Don't scale up, only down
    
    // Create ID mapping for edges
    const idMap = new Map<string, string>()
    
    set((state: DiagramState) => {
      if (!state.file) return state
      
      // Transform and add nodes
      const newNodes: DiagramNode[] = importedNodes.map(node => {
        const newId = uuidv4()
        idMap.set(node.id, newId)
        
        // Calculate new position relative to target node
        const relX = (node.position.x - minX) * scale
        const relY = (node.position.y - minY) * scale
        
        return {
          ...node,
          id: newId,
          position: {
            x: targetNode.position.x + padding + relX,
            y: targetNode.position.y + padding + relY,
          },
          size: {
            width: node.size.width * scale,
            height: node.size.height * scale,
          },
          // Adjust text size proportionally
          textStyle: {
            ...node.textStyle,
            fontSize: Math.max(8, Math.round(node.textStyle.fontSize * scale)),
          },
          // Mark as belonging to parent container
          metadata: {
            ...node.metadata,
            parentContainerId: targetNodeId,
          },
        }
      })
      
      // Transform and add edges
      const newEdges: DiagramEdge[] = importedFile.content.edges
        .filter(edge => idMap.has(edge.source) && idMap.has(edge.target))
        .map(edge => ({
          ...edge,
          id: uuidv4(),
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        }))
      
      const allNodes = [...state.file.content.nodes, ...newNodes]
      const allEdges = [...state.file.content.edges, ...newEdges]
      
      // Add new node IDs to first layer
      const newNodeIds = newNodes.map(n => n.id)
      const layers = state.file.content.layers.map((layer: Layer, idx: number) => 
        idx === 0 ? { ...layer, elements: [...layer.elements, ...newNodeIds] } : layer
      )
      
      return {
        file: {
          ...state.file,
          content: { 
            ...state.file.content, 
            nodes: allNodes, 
            edges: allEdges,
            layers,
          },
          metadata: { ...state.file.metadata, modified: new Date().toISOString() },
        }
      }
    })
    
    get().saveToHistory()
  },

  selectElements: (ids: string[]) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      return {
        file: {
          ...state.file,
          canvasState: { ...state.file.canvasState, selectedElements: ids },
        }
      }
    })
  },

  addToSelection: (id: string) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      const selected = state.file.canvasState.selectedElements
      if (selected.includes(id)) return state
      return {
        file: {
          ...state.file,
          canvasState: { 
            ...state.file.canvasState, 
            selectedElements: [...selected, id] 
          },
        }
      }
    })
  },

  clearSelection: () => {
    set((state: DiagramState) => {
      if (!state.file) return state
      return {
        file: {
          ...state.file,
          canvasState: { ...state.file.canvasState, selectedElements: [] },
        }
      }
    })
  },

  updateCanvasState: (updates: Partial<CanvasState>) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      return {
        file: {
          ...state.file,
          canvasState: { ...state.file.canvasState, ...updates },
        }
      }
    })
  },

  addLayer: (name: string) => {
    const id = uuidv4()
    const layer: Layer = {
      id,
      name,
      visible: true,
      locked: false,
      elements: [],
    }

    set((state: DiagramState) => {
      if (!state.file) return state
      const layers = [...state.file.content.layers, layer]
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, layers },
        }
      }
    })

    return id
  },

  updateLayer: (id: string, updates: Partial<Layer>) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      const layers = state.file.content.layers.map((layer: Layer) =>
        layer.id === id ? { ...layer, ...updates } : layer
      )
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, layers },
        }
      }
    })
  },

  deleteLayer: (id: string) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      if (state.file.content.layers.length <= 1) return state
      const layers = state.file.content.layers.filter((layer: Layer) => layer.id !== id)
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, layers },
        }
      }
    })
  },

  moveLayer: (fromIndex: number, toIndex: number) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      const layers = [...state.file.content.layers]
      const [removed] = layers.splice(fromIndex, 1)
      layers.splice(toIndex, 0, removed)
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, layers },
        }
      }
    })
  },

  duplicateLayer: (id: string) => {
    const newId = uuidv4()
    set((state: DiagramState) => {
      if (!state.file) return state
      const layer = state.file.content.layers.find((l: Layer) => l.id === id)
      if (!layer) return state
      
      const newLayer: Layer = {
        ...layer,
        id: newId,
        name: `${layer.name} (копия)`,
        elements: [],
      }
      
      const layers = [...state.file.content.layers, newLayer]
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, layers },
        }
      }
    })
    return newId
  },

  mergeLayerDown: (id: string) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      const layers = state.file.content.layers
      const index = layers.findIndex((l: Layer) => l.id === id)
      if (index <= 0) return state // Can't merge first layer
      
      const currentLayer = layers[index]
      const targetLayer = layers[index - 1]
      
      const mergedLayer: Layer = {
        ...targetLayer,
        elements: [...targetLayer.elements, ...currentLayer.elements],
      }
      
      const newLayers = layers.filter((_: Layer, i: number) => i !== index)
      newLayers[index - 1] = mergedLayer
      
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, layers: newLayers },
        }
      }
    })
  },

  moveElementToLayer: (elementId: string, layerId: string) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      
      const layers = state.file.content.layers.map((layer: Layer) => ({
        ...layer,
        elements: layer.id === layerId 
          ? [...layer.elements.filter((id: string) => id !== elementId), elementId]
          : layer.elements.filter((id: string) => id !== elementId)
      }))
      
      return {
        file: {
          ...state.file,
          content: { ...state.file.content, layers },
        }
      }
    })
  },

  activeLayerId: null,

  setActiveLayer: (id: string) => {
    set({ activeLayerId: id })
  },

  saveToHistory: () => {
    set((state: DiagramState) => {
      if (!state.file) return state
      const entry: HistoryEntry = {
        nodes: JSON.parse(JSON.stringify(state.file.content.nodes)),
        edges: JSON.parse(JSON.stringify(state.file.content.edges)),
        timestamp: Date.now(),
      }
      
      const newHistory = state.history.slice(0, state.historyIndex + 1)
      newHistory.push(entry)
      
      if (newHistory.length > state.maxHistory) {
        newHistory.shift()
      }
      
      return {
        history: newHistory,
        historyIndex: newHistory.length - 1,
      }
    })
  },

  undo: () => {
    set((state: DiagramState) => {
      if (state.historyIndex <= 0 || !state.file) return state
      const newIndex = state.historyIndex - 1
      const entry = state.history[newIndex]
      return {
        historyIndex: newIndex,
        file: {
          ...state.file,
          content: {
            ...state.file.content,
            nodes: entry.nodes,
            edges: entry.edges,
          },
        }
      }
    })
  },

  redo: () => {
    set((state: DiagramState) => {
      if (state.historyIndex >= state.history.length - 1 || !state.file) return state
      const newIndex = state.historyIndex + 1
      const entry = state.history[newIndex]
      return {
        historyIndex: newIndex,
        file: {
          ...state.file,
          content: {
            ...state.file.content,
            nodes: entry.nodes,
            edges: entry.edges,
          },
        }
      }
    })
  },

  setZoom: (zoom: number) => {
    const clampedZoom = Math.max(0.1, Math.min(4, zoom))
    set((state: DiagramState) => {
      if (!state.file) return state
      return {
        file: {
          ...state.file,
          canvasState: { ...state.file.canvasState, zoom: clampedZoom },
        }
      }
    })
  },

  setPan: (pan: Position) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      return {
        file: {
          ...state.file,
          canvasState: { ...state.file.canvasState, pan },
        }
      }
    })
  },

  getFileContent: () => get().file,
  
  setThumbnail: (thumbnail: { data: string; width: number; height: number }) => {
    set((state: DiagramState) => {
      if (!state.file) return state
      return {
        file: {
          ...state.file,
          thumbnail,
        }
      }
    })
  },
  
  resetStore: () => set({
    file: null,
    history: [],
    historyIndex: -1,
    activeLayerId: null,
  }),
}))

// Subscribe to auth logout event
eventBus.on(AppEvents.AUTH_LOGOUT, () => {
  useDiagramStore.getState().resetStore()
})
