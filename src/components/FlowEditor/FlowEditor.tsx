import { useCallback, useRef, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useReactFlow,
  ConnectionLineType,
  type OnConnect,
  type NodeMouseHandler,
  type ReactFlowInstance,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useGraphStore, type FlowNode, type FlowEdge } from '@/stores/graphStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { useAppStore, useAuthStore } from '@/stores'
import { useCollaboration } from '@/hooks'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'
import { FloatingToolbar } from './FloatingToolbar'
import { ContextualInspector } from './ContextualInspector'
import type { NodeType, Tool } from '@/types'

interface FlowEditorProps {
  readOnly?: boolean
  projectId?: string | null
}

/**
 * FlowEditor - Основной компонент редактора на базе React Flow
 * 
 * Особенности:
 * - Infinite canvas с зумом и панорамированием
 * - Кастомные узлы для всех типов фигур
 * - Умные связи (smoothstep edges)
 * - Minimap для навигации
 * - Snap to grid
 * - Контекстное меню
 * - Поддержка режима только просмотр (readOnly)
 */

function FlowEditorInner({ readOnly = false, projectId }: FlowEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useRef<ReactFlowInstance<FlowNode, FlowEdge> | null>(null)
  
  // Auth for collaboration
  const user = useAuthStore(state => state.user)
  
  // Graph store
  const nodes = useGraphStore(state => state.nodes)
  const edges = useGraphStore(state => state.edges)
  const onNodesChange = useGraphStore(state => state.onNodesChange)
  const onEdgesChange = useGraphStore(state => state.onEdgesChange)
  const onConnect = useGraphStore(state => state.onConnect)
  const addNode = useGraphStore(state => state.addNode)
  const deleteNodes = useGraphStore(state => state.deleteNodes)
  const deleteEdges = useGraphStore(state => state.deleteEdges)
  const gridEnabled = useGraphStore(state => state.gridEnabled)
  const snapToGrid = useGraphStore(state => state.snapToGrid)
  const gridSize = useGraphStore(state => state.gridSize)
  const setViewport = useGraphStore(state => state.setViewport)
  
  // Selection store
  const selectedNodeIds = useSelectionStore(state => state.selectedNodeIds)
  const selectedEdgeIds = useSelectionStore(state => state.selectedEdgeIds)
  const selectNodes = useSelectionStore(state => state.selectNodes)
  const selectEdges = useSelectionStore(state => state.selectEdges)
  const clearSelection = useSelectionStore(state => state.clearSelection)
  
  // App store
  const currentTool = useAppStore(state => state.currentTool)
  const setCurrentTool = useAppStore(state => state.setCurrentTool)
  
  const { screenToFlowPosition, fitView, getNode } = useReactFlow()
  
  // Clipboard state for copy/paste
  const [clipboard, setClipboard] = useState<FlowNode[]>([])
  
  // Collaboration state
  const [remoteCursors, setRemoteCursors] = useState<Map<string, { userId: string; userName: string; color: string; position: { x: number; y: number }; lastUpdate: number }>>(new Map())
  const [currentViewport, setCurrentViewport] = useState({ x: 0, y: 0, zoom: 1 })
  const lastCursorSend = useRef(0)
  
  // Collaboration handlers — only cursors (element sync is handled by EditorViewNew)
  const handleCursorUpdate = useCallback((cursors: Map<string, { userId: string; userName: string; color: string; position: { x: number; y: number }; lastUpdate: number }>) => {
    setRemoteCursors(new Map(cursors))
  }, [])
  
  // Collaboration hook — cursor-only (no onElementUpdate to avoid duplicate handling)
  const {
    sendCursorPosition,
  } = useCollaboration({
    schemaId: projectId || null,
    userId: user?.id || '',
    userName: user?.fullName || user?.username || 'Anonymous',
    enabled: !readOnly && !!user,
    onCursorUpdate: handleCursorUpdate,
  })
  
  // Throttled cursor position send on mouse move
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (readOnly || !user) return
    const now = Date.now()
    if (now - lastCursorSend.current < 50) return // 20fps throttle
    lastCursorSend.current = now
    
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    sendCursorPosition(flowPos)
  }, [readOnly, user, screenToFlowPosition, sendCursorPosition])
  
  // Wrap onNodesChange — position broadcasts are handled by EditorViewNew's store subscription
  const handleNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    onNodesChange(changes)
  }, [onNodesChange])
  
  // Track viewport for cursor rendering
  const handleViewportChange = useCallback((_e: unknown, vp: { x: number; y: number; zoom: number }) => {
    setCurrentViewport(vp)
  }, [])
  
  // Handle node selection sync
  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { 
    nodes: FlowNode[]
    edges: FlowEdge[] 
  }) => {
    selectNodes(selectedNodes.map(n => n.id))
    selectEdges(selectedEdges.map(e => e.id))
  }, [selectNodes, selectEdges])
  
  // Handle canvas click to add node
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    // Only add nodes if a shape tool is selected
    const shapeTools: Tool[] = ['rectangle', 'ellipse', 'diamond', 'triangle', 'star', 'hexagon', 'cylinder', 'cloud', 'callout', 'note', 'container', 'image']
    
    if (shapeTools.includes(currentTool)) {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      
      // Snap to grid if enabled
      if (snapToGrid) {
        position.x = Math.round(position.x / gridSize) * gridSize
        position.y = Math.round(position.y / gridSize) * gridSize
      }
      
      const nodeId = addNode(currentTool as NodeType, position)
      selectNodes([nodeId])
      
      // Switch back to select tool after adding
      setCurrentTool('select')
    } else if (currentTool === 'select') {
      clearSelection()
    }
  }, [currentTool, screenToFlowPosition, snapToGrid, gridSize, addNode, selectNodes, setCurrentTool, clearSelection])
  
  // Handle node click
  const handleNodeClick: NodeMouseHandler<FlowNode> = useCallback((event, node) => {
    if (event.shiftKey) {
      // Multi-select with shift
      selectNodes([node.id], true)
    } else {
      selectNodes([node.id])
    }
  }, [selectNodes])
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Don't handle shortcuts when typing in input/textarea
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }
    
    // Delete selected elements
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedNodeIds.length > 0) {
        deleteNodes(selectedNodeIds)
        clearSelection()
      }
      if (selectedEdgeIds.length > 0) {
        deleteEdges(selectedEdgeIds)
        clearSelection()
      }
    }
    
    // Copy selected nodes (Ctrl+C / Cmd+C)
    if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
      if (selectedNodeIds.length > 0) {
        const nodesToCopy = selectedNodeIds
          .map(id => getNode(id))
          .filter((n): n is FlowNode => n !== undefined)
        setClipboard(nodesToCopy)
      }
    }
    
    // Paste nodes (Ctrl+V / Cmd+V)
    if (event.key === 'v' && (event.ctrlKey || event.metaKey)) {
      if (clipboard.length > 0) {
        event.preventDefault()
        const offset = 30 // Offset for pasted nodes
        const newNodeIds: string[] = []
        
        clipboard.forEach((node, index) => {
          const newPosition = {
            x: node.position.x + offset + index * 10,
            y: node.position.y + offset + index * 10,
          }
          
          // Create new node with same data but new ID, preserve size
          const nodeId = addNode(
            node.data.nodeType,
            newPosition,
            {
              ...node.data,
              label: node.data.label ? node.data.label + ' (copy)' : '',
            },
            node.style as Record<string, unknown> // Preserve style including size
          )
          newNodeIds.push(nodeId)
        })
        
        // Select pasted nodes
        selectNodes(newNodeIds)
      }
    }
    
    // Duplicate selected nodes (Ctrl+D / Cmd+D)
    if (event.key === 'd' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (selectedNodeIds.length > 0) {
        const nodesToDuplicate = selectedNodeIds
          .map(id => getNode(id))
          .filter((n): n is FlowNode => n !== undefined)
        
        const offset = 30
        const newNodeIds: string[] = []
        
        nodesToDuplicate.forEach((node, index) => {
          const newPosition = {
            x: node.position.x + offset,
            y: node.position.y + offset + index * 10,
          }
          
          const nodeId = addNode(
            node.data.nodeType,
            newPosition,
            node.data,
            node.style as Record<string, unknown>
          )
          newNodeIds.push(nodeId)
        })
        
        selectNodes(newNodeIds)
      }
    }
    
    // Select all (Ctrl+A / Cmd+A)
    if (event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      selectNodes(nodes.map(n => n.id))
    }
    
    // Group nodes (Ctrl+G / Cmd+G)
    if (event.key === 'g' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      event.preventDefault()
      if (selectedNodeIds.length >= 2) {
        const groupId = useGraphStore.getState().groupNodes(selectedNodeIds)
        if (groupId) {
          selectNodes([groupId])
        }
      }
    }
    
    // Ungroup nodes (Ctrl+Shift+G / Cmd+Shift+G)
    if (event.key === 'g' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
      event.preventDefault()
      if (selectedNodeIds.length === 1) {
        const node = getNode(selectedNodeIds[0])
        if (node?.data.isContainer && node.data.childIds) {
          useGraphStore.getState().ungroupNodes(selectedNodeIds[0])
          selectNodes(node.data.childIds as string[])
        }
      }
    }
    
    // Undo (Ctrl+Z / Cmd+Z)
    if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      event.preventDefault()
      useGraphStore.getState().undo()
    }
    
    // Redo (Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y)
    if ((event.key === 'z' && (event.ctrlKey || event.metaKey) && event.shiftKey) ||
        (event.key === 'y' && (event.ctrlKey || event.metaKey))) {
      event.preventDefault()
      useGraphStore.getState().redo()
    }
    
    // Escape to clear selection
    if (event.key === 'Escape') {
      clearSelection()
      setCurrentTool('select')
    }
    
    // Fit view
    if (event.key === 'f' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      fitView({ padding: 0.2, duration: 300 })
    }
  }, [selectedNodeIds, selectedEdgeIds, deleteNodes, deleteEdges, clearSelection, setCurrentTool, fitView, getNode, clipboard, addNode, selectNodes, nodes])
  
  // Handle viewport change
  const handleMoveEnd = useCallback((_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
    setViewport(viewport)
    setCurrentViewport(viewport)
  }, [setViewport])
  
  // Cursor style based on tool
  const cursorStyle = useMemo(() => {
    switch (currentTool) {
      case 'pan': return 'grab'
      case 'select': return 'default'
      default: return 'crosshair'
    }
  }, [currentTool])
  
  // Edge styles
  const defaultEdgeOptions = useMemo(() => ({
    type: 'custom',
    style: { strokeWidth: 2, stroke: '#64748b' },
    markerEnd: { type: 'arrowclosed' as const, color: '#64748b' },
  }), [])
  
  // Connection line style (while dragging)
  const connectionLineStyle = useMemo(() => ({
    stroke: '#3b82f6',
    strokeWidth: 3,
  }), [])
  
  return (
    <div 
      ref={reactFlowWrapper} 
      className="w-full h-full relative"
      onKeyDown={readOnly ? undefined : handleKeyDown}
      onMouseMove={handleMouseMove}
      tabIndex={readOnly ? -1 : 0}
      style={{ cursor: readOnly ? 'default' : cursorStyle }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : handleNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect as OnConnect}
        onSelectionChange={readOnly ? undefined : handleSelectionChange}
        onPaneClick={readOnly ? undefined : handlePaneClick}
        onNodeClick={readOnly ? undefined : handleNodeClick}
        onMoveEnd={handleMoveEnd}
        onMove={handleViewportChange}
        onInit={(instance) => { reactFlowInstance.current = instance }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={connectionLineStyle}
        connectOnClick={!readOnly}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        snapToGrid={!readOnly && snapToGrid}
        snapGrid={[gridSize, gridSize]}
        panOnDrag={currentTool === 'pan' || currentTool === 'select'}
        selectionOnDrag={!readOnly && currentTool === 'select'}
        selectNodesOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        minZoom={0.1}
        maxZoom={4}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        {/* Background grid */}
        {gridEnabled && (
          <Background 
            variant={BackgroundVariant.Dots}
            gap={gridSize}
            size={1}
            color="hsl(var(--muted-foreground) / 0.3)"
          />
        )}
        
        {/* Controls removed (replaced by FloatingToolbar) */}
        
        {/* Minimap */}
        <MiniMap 
          position="bottom-left"
          nodeColor={(node) => (node.data as unknown as { fill: string }).fill || '#3b82f6'}
          nodeStrokeWidth={2}
          maskColor="hsl(var(--background) / 0.85)"
          bgColor="hsl(var(--card))"
          zoomable
          pannable
          className="!bg-card/95 !border-border/50 !rounded-xl !shadow-lg [&>svg]:!bg-transparent"
          style={{ width: 150, height: 100 }}
        />
        
        {/* Floating Toolbar - скрыт в режиме просмотра */}
        {!readOnly && (
          <Panel position="top-center" className="!m-0 !p-0">
            <FloatingToolbar />
          </Panel>
        )}
        
        {/* Contextual Inspector - только для просмотра свойств в readOnly */}
        {!readOnly && (
          <Panel position="top-right" className="!m-4 !p-0">
            <ContextualInspector />
          </Panel>
        )}
      </ReactFlow>
      
      {/* Remote collaboration cursors */}
      {remoteCursors.size > 0 && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from(remoteCursors.values()).map(cursor => {
            const sx = cursor.position.x * currentViewport.zoom + currentViewport.x
            const sy = cursor.position.y * currentViewport.zoom + currentViewport.y
            return (
              <div
                key={cursor.userId}
                className="absolute"
                style={{
                  left: sx,
                  top: sy,
                  transition: 'left 0.15s ease-out, top 0.15s ease-out',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" className="drop-shadow-sm">
                  <path d="M5 2L19 12L12 14L8 22Z" fill={cursor.color || '#3b82f6'} stroke="white" strokeWidth="1.5" />
                </svg>
                <span
                  className="absolute left-4 top-3 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-sm"
                  style={{ backgroundColor: cursor.color || '#3b82f6' }}
                >
                  {cursor.userName}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Export with provider wrapper
export function FlowEditor({ readOnly, projectId }: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner readOnly={readOnly} projectId={projectId} />
    </ReactFlowProvider>
  )
}
