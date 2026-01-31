import { create } from 'zustand'
import { 
  type Node, 
  type Edge, 
  type NodeChange, 
  type EdgeChange, 
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType
} from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import type { NodeType } from '@/types'
import { wtvFileToFlowData } from '@/utils/diagramAdapter'

/**
 * Graph Store - управление данными графа (nodes, edges)
 * Использует React Flow типы для совместимости
 */

// Расширенные данные узла для нашего приложения
export interface CustomNodeData extends Record<string, unknown> {
  label: string
  nodeType: NodeType
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  cornerRadius: number
  textColor: string
  fontSize: number
  fontFamily: string
  locked: boolean
  // Для контейнеров
  isContainer?: boolean
  children?: string[]
  // Для изображений
  imageData?: string
  // Для заметок
  noteContent?: string
  // Для freehand
  pathData?: string
  // Метаданные
  metadata?: Record<string, unknown>
}

// Наш кастомный тип узла
export type FlowNode = Node<CustomNodeData>

// Расширенные данные связи
export interface CustomEdgeData extends Record<string, unknown> {
  label?: string
  strokeStyle?: 'solid' | 'dashed' | 'dotted'
  animated?: boolean
  edgeType?: 'smoothstep' | 'straight' | 'bezier'
  markerStartType?: 'none' | 'arrow' | 'arrowclosed'
  markerEndType?: 'none' | 'arrow' | 'arrowclosed'
}

export type FlowEdge = Edge<CustomEdgeData>

interface GraphState {
  // Данные графа
  nodes: FlowNode[]
  edges: FlowEdge[]
  
  // Флаг изменений (для автосохранения)
  isDirty: boolean
  
  // История для undo/redo
  history: { nodes: FlowNode[]; edges: FlowEdge[] }[]
  historyIndex: number
  maxHistory: number
  
  // Viewport
  viewport: { x: number; y: number; zoom: number }
  
  // Grid settings
  gridEnabled: boolean
  snapToGrid: boolean
  gridSize: number
  
  // Синхронизация с WtvFile
  loadFromWtvFile: (file: import('@/types').WtvFile) => void
  markDirty: () => void
  markClean: () => void
  
  // Actions - React Flow callbacks
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void
  onConnect: (connection: Connection) => void
  
  // CRUD для узлов
  addNode: (type: NodeType, position: { x: number; y: number }, data?: Partial<CustomNodeData>, style?: Record<string, unknown>) => string
  updateNode: (id: string, updates: Partial<CustomNodeData>) => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void
  deleteNodes: (ids: string[]) => void
  duplicateNodes: (ids: string[]) => FlowNode[]
  
  // Выравнивание узлов
  alignNodes: (ids: string[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  distributeNodes: (ids: string[], direction: 'horizontal' | 'vertical') => void
  
  // Группировка узлов
  groupNodes: (ids: string[]) => string | null
  ungroupNodes: (groupId: string) => void
  
  // CRUD для связей
  addEdge: (source: string, target: string, data?: Partial<CustomEdgeData>) => string
  updateEdge: (id: string, updates: Partial<FlowEdge>) => void
  deleteEdges: (ids: string[]) => void
  
  // Viewport
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void
  fitView: () => void
  
  // Grid
  setGridEnabled: (enabled: boolean) => void
  setSnapToGrid: (snap: boolean) => void
  setGridSize: (size: number) => void
  
  // History
  saveToHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  
  // Сериализация
  exportGraph: () => { nodes: FlowNode[]; edges: FlowEdge[] }
  importGraph: (data: { nodes: FlowNode[]; edges: FlowEdge[] }) => void
  clearGraph: () => void
}

// Дефолтные стили для разных типов узлов
const defaultNodeStyles: Record<NodeType, Partial<CustomNodeData>> = {
  rectangle: { fill: '#3b82f6', stroke: '#2563eb', cornerRadius: 8 },
  ellipse: { fill: '#8b5cf6', stroke: '#7c3aed', cornerRadius: 9999 },
  diamond: { fill: '#f59e0b', stroke: '#d97706', cornerRadius: 0 },
  triangle: { fill: '#10b981', stroke: '#059669', cornerRadius: 0 },
  star: { fill: '#f43f5e', stroke: '#e11d48', cornerRadius: 0 },
  hexagon: { fill: '#06b6d4', stroke: '#0891b2', cornerRadius: 0 },
  cylinder: { fill: '#6366f1', stroke: '#4f46e5', cornerRadius: 8 },
  cloud: { fill: '#e5e7eb', stroke: '#9ca3af', cornerRadius: 20 },
  callout: { fill: '#fef3c7', stroke: '#f59e0b', cornerRadius: 8 },
  note: { fill: '#fef08a', stroke: '#eab308', cornerRadius: 4 },
  container: { fill: 'rgba(59, 130, 246, 0.1)', stroke: '#3b82f6', cornerRadius: 12, isContainer: true },
  image: { fill: '#f3f4f6', stroke: '#d1d5db', cornerRadius: 4 },
  freehand: { fill: 'transparent', stroke: '#374151', cornerRadius: 0 },
  custom: { fill: '#e5e7eb', stroke: '#6b7280', cornerRadius: 8 },
}

// Размеры по умолчанию (уменьшенные для лучшей эргономики)
const defaultSizes: Record<NodeType, { width: number; height: number }> = {
  rectangle: { width: 100, height: 50 },
  ellipse: { width: 80, height: 60 },
  diamond: { width: 80, height: 80 },
  triangle: { width: 80, height: 70 },
  star: { width: 70, height: 70 },
  hexagon: { width: 80, height: 70 },
  cylinder: { width: 60, height: 80 },
  cloud: { width: 100, height: 60 },
  callout: { width: 120, height: 60 },
  note: { width: 100, height: 100 },
  container: { width: 200, height: 150 },
  image: { width: 120, height: 90 },
  freehand: { width: 80, height: 80 },
  custom: { width: 100, height: 60 },
}

export const useGraphStore = create<GraphState>()((set, get) => ({
  nodes: [],
  edges: [],
  isDirty: false,
  history: [],
  historyIndex: -1,
  maxHistory: 50,
  viewport: { x: 0, y: 0, zoom: 1 },
  gridEnabled: true,
  snapToGrid: true,
  gridSize: 20,
  
  // Синхронизация с WtvFile
  loadFromWtvFile: (file) => {
    const { nodes, edges } = wtvFileToFlowData(file)
    set({ 
      nodes, 
      edges, 
      isDirty: false,
      history: [],
      historyIndex: -1,
      viewport: {
        x: file.canvasState.pan.x,
        y: file.canvasState.pan.y,
        zoom: file.canvasState.zoom,
      },
      gridEnabled: file.canvasState.grid.enabled,
      snapToGrid: file.canvasState.grid.snap,
      gridSize: file.canvasState.grid.size,
    })
    // Сохраняем начальное состояние в историю
    get().saveToHistory()
  },
  
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  
  // React Flow callbacks
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes), isDirty: true })
  },
  
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges), isDirty: true })
  },
  
  onConnect: (connection) => {
    const newEdge: FlowEdge = {
      id: uuidv4(),
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: 'custom', // Используем кастомный тип с лейблами
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { strokeStyle: 'solid', edgeType: 'smoothstep', label: '' }
    }
    set({ edges: addEdge(newEdge, get().edges), isDirty: true })
    get().saveToHistory()
  },
  
  // CRUD узлов
  addNode: (type, position, data = {}, styleOverrides = {}) => {
    const id = uuidv4()
    const defaults = defaultNodeStyles[type] || defaultNodeStyles.rectangle
    const size = defaultSizes[type] || defaultSizes.rectangle
    
    const newNode: FlowNode = {
      id,
      type: 'custom', // Наш кастомный тип для React Flow
      position,
      data: {
        label: type === 'note' ? 'Заметка' : '',
        nodeType: type,
        fill: defaults.fill || '#3b82f6',
        stroke: defaults.stroke || '#2563eb',
        strokeWidth: 2,
        opacity: 1,
        cornerRadius: defaults.cornerRadius || 8,
        textColor: type === 'note' ? '#1f2937' : '#ffffff',
        fontSize: 14,
        fontFamily: 'Inter',
        locked: false,
        isContainer: defaults.isContainer,
        ...data
      },
      style: {
        width: size.width,
        height: size.height,
        ...styleOverrides
      }
    }
    
    set({ nodes: [...get().nodes, newNode] })
    get().saveToHistory()
    return id
  },
  
  updateNode: (id, updates) => {
    set({
      nodes: get().nodes.map(node =>
        node.id === id
          ? { ...node, data: { ...node.data, ...updates } }
          : node
      )
    })
  },
  
  updateNodePosition: (id, position) => {
    set({
      nodes: get().nodes.map(node =>
        node.id === id ? { ...node, position } : node
      )
    })
  },
  
  deleteNodes: (ids) => {
    const idsSet = new Set(ids)
    set({
      nodes: get().nodes.filter(n => !idsSet.has(n.id)),
      edges: get().edges.filter(e => !idsSet.has(e.source) && !idsSet.has(e.target))
    })
    get().saveToHistory()
  },
  
  duplicateNodes: (ids) => {
    const nodesToDuplicate = get().nodes.filter(n => ids.includes(n.id))
    const newNodes: FlowNode[] = nodesToDuplicate.map(node => ({
      ...node,
      id: uuidv4(),
      position: {
        x: node.position.x + 40,
        y: node.position.y + 40
      }
    }))
    set({ nodes: [...get().nodes, ...newNodes] })
    get().saveToHistory()
    return newNodes
  },
  
  // Выравнивание узлов
  alignNodes: (ids, alignment) => {
    if (ids.length < 2) return
    
    const nodes = get().nodes
    const selectedNodes = nodes.filter(n => ids.includes(n.id))
    if (selectedNodes.length < 2) return
    
    // Получаем размеры узлов
    const getNodeSize = (node: FlowNode) => ({
      width: (node.style?.width as number) || 100,
      height: (node.style?.height as number) || 50
    })
    
    let targetValue: number
    
    switch (alignment) {
      case 'left':
        targetValue = Math.min(...selectedNodes.map(n => n.position.x))
        break
      case 'center':
        const minX = Math.min(...selectedNodes.map(n => n.position.x))
        const maxX = Math.max(...selectedNodes.map(n => n.position.x + getNodeSize(n).width))
        targetValue = (minX + maxX) / 2
        break
      case 'right':
        targetValue = Math.max(...selectedNodes.map(n => n.position.x + getNodeSize(n).width))
        break
      case 'top':
        targetValue = Math.min(...selectedNodes.map(n => n.position.y))
        break
      case 'middle':
        const minY = Math.min(...selectedNodes.map(n => n.position.y))
        const maxY = Math.max(...selectedNodes.map(n => n.position.y + getNodeSize(n).height))
        targetValue = (minY + maxY) / 2
        break
      case 'bottom':
        targetValue = Math.max(...selectedNodes.map(n => n.position.y + getNodeSize(n).height))
        break
    }
    
    const updatedNodes = nodes.map(node => {
      if (!ids.includes(node.id)) return node
      const size = getNodeSize(node)
      
      let newPosition = { ...node.position }
      switch (alignment) {
        case 'left':
          newPosition.x = targetValue
          break
        case 'center':
          newPosition.x = targetValue - size.width / 2
          break
        case 'right':
          newPosition.x = targetValue - size.width
          break
        case 'top':
          newPosition.y = targetValue
          break
        case 'middle':
          newPosition.y = targetValue - size.height / 2
          break
        case 'bottom':
          newPosition.y = targetValue - size.height
          break
      }
      
      return { ...node, position: newPosition }
    })
    
    set({ nodes: updatedNodes })
    get().saveToHistory()
  },
  
  distributeNodes: (ids, direction) => {
    if (ids.length < 3) return
    
    const nodes = get().nodes
    const selectedNodes = nodes.filter(n => ids.includes(n.id))
    if (selectedNodes.length < 3) return
    
    const getNodeSize = (node: FlowNode) => ({
      width: (node.style?.width as number) || 100,
      height: (node.style?.height as number) || 50
    })
    
    if (direction === 'horizontal') {
      // Сортируем по X
      const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalWidth = sorted.reduce((sum, n) => sum + getNodeSize(n).width, 0)
      const availableSpace = (last.position.x + getNodeSize(last).width) - first.position.x - totalWidth
      const gap = availableSpace / (sorted.length - 1)
      
      let currentX = first.position.x + getNodeSize(first).width + gap
      
      const updatedNodes = nodes.map(node => {
        const sortedIndex = sorted.findIndex(n => n.id === node.id)
        if (sortedIndex <= 0 || sortedIndex === sorted.length - 1) return node
        
        const newPosition = { ...node.position, x: currentX }
        currentX += getNodeSize(node).width + gap
        return { ...node, position: newPosition }
      })
      
      set({ nodes: updatedNodes })
    } else {
      // Сортируем по Y
      const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y)
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const totalHeight = sorted.reduce((sum, n) => sum + getNodeSize(n).height, 0)
      const availableSpace = (last.position.y + getNodeSize(last).height) - first.position.y - totalHeight
      const gap = availableSpace / (sorted.length - 1)
      
      let currentY = first.position.y + getNodeSize(first).height + gap
      
      const updatedNodes = nodes.map(node => {
        const sortedIndex = sorted.findIndex(n => n.id === node.id)
        if (sortedIndex <= 0 || sortedIndex === sorted.length - 1) return node
        
        const newPosition = { ...node.position, y: currentY }
        currentY += getNodeSize(node).height + gap
        return { ...node, position: newPosition }
      })
      
      set({ nodes: updatedNodes })
    }
    
    get().saveToHistory()
  },
  
  // Группировка узлов
  groupNodes: (ids) => {
    if (ids.length < 2) return null
    
    const nodes = get().nodes
    const selectedNodes = nodes.filter(n => ids.includes(n.id))
    if (selectedNodes.length < 2) return null
    
    // Вычисляем bounding box
    const getNodeSize = (node: FlowNode) => ({
      width: (node.style?.width as number) || 100,
      height: (node.style?.height as number) || 50
    })
    
    const minX = Math.min(...selectedNodes.map(n => n.position.x))
    const minY = Math.min(...selectedNodes.map(n => n.position.y))
    const maxX = Math.max(...selectedNodes.map(n => n.position.x + getNodeSize(n).width))
    const maxY = Math.max(...selectedNodes.map(n => n.position.y + getNodeSize(n).height))
    
    const padding = 20
    const groupId = uuidv4()
    
    // Создаём группу-контейнер
    const groupNode: FlowNode = {
      id: groupId,
      type: 'custom',
      position: { x: minX - padding, y: minY - padding },
      data: {
        label: 'Группа',
        nodeType: 'container',
        fill: 'rgba(59, 130, 246, 0.05)',
        stroke: '#3b82f6',
        strokeWidth: 1,
        opacity: 1,
        cornerRadius: 12,
        textColor: '#3b82f6',
        fontSize: 12,
        fontFamily: 'Inter',
        locked: false,
        isContainer: true,
        childIds: ids, // Сохраняем ID дочерних элементов
      },
      style: {
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
      },
      zIndex: -1, // Под дочерними
    }
    
    // Обновляем дочерние узлы - указываем parentId
    const updatedNodes = nodes.map(node => {
      if (ids.includes(node.id)) {
        return {
          ...node,
          parentId: groupId,
          position: {
            x: node.position.x - (minX - padding),
            y: node.position.y - (minY - padding),
          },
          extent: 'parent' as const,
        }
      }
      return node
    })
    
    set({ nodes: [groupNode, ...updatedNodes] })
    get().saveToHistory()
    return groupId
  },
  
  ungroupNodes: (groupId) => {
    const nodes = get().nodes
    const groupNode = nodes.find(n => n.id === groupId)
    if (!groupNode || !groupNode.data.isContainer) return
    
    const childIds = (groupNode.data.childIds as string[]) || []
    const groupPosition = groupNode.position
    
    // Возвращаем дочерние узлы в глобальные координаты
    const updatedNodes = nodes
      .filter(n => n.id !== groupId)
      .map(node => {
        if (childIds.includes(node.id)) {
          return {
            ...node,
            parentId: undefined,
            extent: undefined,
            position: {
              x: node.position.x + groupPosition.x,
              y: node.position.y + groupPosition.y,
            },
          }
        }
        return node
      })
    
    set({ nodes: updatedNodes })
    get().saveToHistory()
  },
  
  // CRUD связей
  addEdge: (source, target, data = {}) => {
    const id = uuidv4()
    const newEdge: FlowEdge = {
      id,
      source,
      target,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
      data: {
        strokeStyle: 'solid',
        ...data
      }
    }
    set({ edges: [...get().edges, newEdge] })
    get().saveToHistory()
    return id
  },
  
  updateEdge: (id, updates) => {
    set({
      edges: get().edges.map(edge =>
        edge.id === id 
          ? { 
              ...edge, 
              ...updates,
              data: { ...edge.data, ...updates.data }
            } 
          : edge
      ),
      isDirty: true
    })
  },
  
  deleteEdges: (ids) => {
    const idsSet = new Set(ids)
    set({ edges: get().edges.filter(e => !idsSet.has(e.id)) })
    get().saveToHistory()
  },
  
  // Viewport
  setViewport: (viewport) => set({ viewport }),
  fitView: () => {
    // This will be triggered externally via React Flow's fitView
  },
  
  // Grid
  setGridEnabled: (enabled) => set({ gridEnabled: enabled }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setGridSize: (size) => set({ gridSize: size }),
  
  // History
  saveToHistory: () => {
    const { nodes, edges, history, historyIndex, maxHistory } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) })
    
    if (newHistory.length > maxHistory) {
      newHistory.shift()
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1
    })
  },
  
  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1]
      set({
        nodes: prev.nodes,
        edges: prev.edges,
        historyIndex: historyIndex - 1
      })
    }
  },
  
  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1]
      set({
        nodes: next.nodes,
        edges: next.edges,
        historyIndex: historyIndex + 1
      })
    }
  },
  
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
  
  // Сериализация
  exportGraph: () => {
    const { nodes, edges } = get()
    return { nodes, edges }
  },
  
  importGraph: (data) => {
    set({
      nodes: data.nodes,
      edges: data.edges,
      history: [],
      historyIndex: -1
    })
    get().saveToHistory()
  },
  
  clearGraph: () => {
    set({
      nodes: [],
      edges: [],
      history: [],
      historyIndex: -1
    })
  }
}))
