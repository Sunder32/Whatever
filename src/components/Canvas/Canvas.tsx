import { useRef, useEffect, useCallback, useState } from 'react'
import { Stage, Layer, Line, Transformer, Group, Arrow } from 'react-konva'
import type Konva from 'konva'
import { useDiagramStore, useAppStore } from '@/stores'
import type { DiagramNode, AnchorPosition } from '@/types'
import { snapToGrid, getAnchorPosition } from '@/utils'
import { CanvasContextMenu } from './CanvasContextMenu'
import { MiniMap } from './MiniMap'
import { ShapeRenderer } from './ShapeRenderer'
import { EdgeRenderer } from './EdgeRenderer'
import { AnchorPoints } from './AnchorPoints'
import { GridLayer } from './GridLayer'
import { NodeContextMenu } from './NodeContextMenu'

interface CanvasProps {
  width: number
  height: number
}

// Connection creation state
interface ConnectionState {
  isCreating: boolean
  sourceId: string | null
  sourceAnchor: AnchorPosition | null
  tempTargetPos: { x: number; y: number } | null
}

export function Canvas({ width, height }: CanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const groupRefs = useRef<Map<string, Konva.Group>>(new Map())
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Context menu state - for nodes
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  
  // Context menu state - for empty canvas (quick add)
  const [canvasContextMenu, setCanvasContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null)
  
  // Track nearest target anchor during connection drag
  const [nearestTarget, setNearestTarget] = useState<{ nodeId: string; anchor: AnchorPosition } | null>(null)
  
  // Freehand drawing state
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false)
  const [freehandPoints, setFreehandPoints] = useState<number[]>([])
  
  // Smart alignment guides
  const [guides, setGuides] = useState<{ x: number; y: number; orientation: 'H' | 'V' }[]>([])
  
  // Right-click pan state
  const [isRightClickPanning, setIsRightClickPanning] = useState(false)
  const [panStartPos, setPanStartPos] = useState({ x: 0, y: 0 })
  const [panStartPan, setPanStartPan] = useState({ x: 0, y: 0 })
  
  // Connection creation state
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isCreating: false,
    sourceId: null,
    sourceAnchor: null,
    tempTargetPos: null,
  })
  
  // Use ref to always have access to latest connection state in callbacks
  const connectionStateRef = useRef(connectionState)
  connectionStateRef.current = connectionState  // Sync immediately, not in useEffect
  
  
  const file = useDiagramStore(state => state.file)
  const addNode = useDiagramStore(state => state.addNode)
  const addEdge = useDiagramStore(state => state.addEdge)
  const updateNode = useDiagramStore(state => state.updateNode)
  const deleteNode = useDiagramStore(state => state.deleteNode)
  const deleteEdge = useDiagramStore(state => state.deleteEdge)
  const selectElements = useDiagramStore(state => state.selectElements)
  const clearSelection = useDiagramStore(state => state.clearSelection)
  const setZoom = useDiagramStore(state => state.setZoom)
  const setPan = useDiagramStore(state => state.setPan)
  const setThumbnail = useDiagramStore(state => state.setThumbnail)
  
  const currentTool = useAppStore(state => state.currentTool)
  const setCurrentTool = useAppStore(state => state.setCurrentTool)
  const preferences = useAppStore(state => state.preferences)

  const nodes = file?.content.nodes ?? []
  const edges = file?.content.edges ?? []
  const canvasState = file?.canvasState
  const selectedIds = canvasState?.selectedElements ?? []
  const zoom = canvasState?.zoom ?? 1
  const pan = canvasState?.pan ?? { x: 0, y: 0 }
  const grid = canvasState?.grid

  // Smart guides: compute alignment guides during drag
  const GUIDE_SNAP_THRESHOLD = 5 // px
  const computeSmartGuides = useCallback((draggedId: string, dragX: number, dragY: number) => {
    const draggedNode = nodes.find(n => n.id === draggedId)
    if (!draggedNode) return { guides: [] as { x: number; y: number; orientation: 'H' | 'V' }[], snapX: dragX, snapY: dragY }

    const dW = draggedNode.size.width
    const dH = draggedNode.size.height
    // Dragged node edges & center
    const dLeft = dragX, dRight = dragX + dW, dCenterX = dragX + dW / 2
    const dTop = dragY, dBottom = dragY + dH, dCenterY = dragY + dH / 2

    const newGuides: { x: number; y: number; orientation: 'H' | 'V' }[] = []
    let snapX = dragX, snapY = dragY
    let closestDx = GUIDE_SNAP_THRESHOLD + 1
    let closestDy = GUIDE_SNAP_THRESHOLD + 1

    for (const other of nodes) {
      if (other.id === draggedId || !other.visible) continue
      const oL = other.position.x, oR = other.position.x + other.size.width, oCX = other.position.x + other.size.width / 2
      const oT = other.position.y, oB = other.position.y + other.size.height, oCY = other.position.y + other.size.height / 2

      // Vertical guides (align X positions)
      const vPairs: [number, number][] = [
        [dLeft, oL], [dLeft, oR], [dLeft, oCX],
        [dRight, oL], [dRight, oR], [dRight, oCX],
        [dCenterX, oCX], [dCenterX, oL], [dCenterX, oR],
      ]
      for (const [dVal, oVal] of vPairs) {
        const diff = Math.abs(dVal - oVal)
        if (diff < GUIDE_SNAP_THRESHOLD && diff < closestDx) {
          closestDx = diff
          snapX = dragX + (oVal - dVal)
          newGuides.push({ x: oVal, y: Math.min(dTop, oT), orientation: 'V' })
        }
      }

      // Horizontal guides (align Y positions)
      const hPairs: [number, number][] = [
        [dTop, oT], [dTop, oB], [dTop, oCY],
        [dBottom, oT], [dBottom, oB], [dBottom, oCY],
        [dCenterY, oCY], [dCenterY, oT], [dCenterY, oB],
      ]
      for (const [dVal, oVal] of hPairs) {
        const diff = Math.abs(dVal - oVal)
        if (diff < GUIDE_SNAP_THRESHOLD && diff < closestDy) {
          closestDy = diff
          snapY = dragY + (oVal - dVal)
          newGuides.push({ x: Math.min(dLeft, oL), y: oVal, orientation: 'H' })
        }
      }
    }

    // Deduplicate guides by keeping only the best match per orientation
    const bestV = newGuides.filter(g => g.orientation === 'V').slice(-1)
    const bestH = newGuides.filter(g => g.orientation === 'H').slice(-1)

    return { guides: [...bestV, ...bestH], snapX, snapY }
  }, [nodes])
  
  // Generate thumbnail when nodes/edges change (debounced)
  useEffect(() => {
    if (!stageRef.current || nodes.length === 0) return
    
    const timer = setTimeout(() => {
      const stage = stageRef.current
      if (!stage) return
      
      try {
        // Create thumbnail with small dimensions
        const dataUrl = stage.toDataURL({
          mimeType: 'image/jpeg',
          quality: 0.6,
          pixelRatio: 0.3, // Lower resolution for smaller size
        })
        
        setThumbnail({
          data: dataUrl,
          width: 320,
          height: 200,
        })
        
        // Trigger auto-save after thumbnail generation
        const currentFile = useDiagramStore.getState().file
        if (currentFile) {
          import('@/services').then(({ storageService }) => {
            storageService.save(currentFile)
          })
        }
      } catch (error) {
        console.error('Failed to generate thumbnail:', error)
      }
    }, 3000) // 3 second debounce
    
    return () => clearTimeout(timer)
  }, [nodes.length, edges.length, setThumbnail])

  // Updated effect to use group refs for transformer
  useEffect(() => {
    if (!transformerRef.current) return
    
    const selectedNodes: Konva.Node[] = []
    selectedIds.forEach(id => {
      const groupRef = groupRefs.current.get(id)
      if (groupRef) {
        selectedNodes.push(groupRef)
      }
    })
    
    transformerRef.current.nodes(selectedNodes)
    transformerRef.current.getLayer()?.batchDraw()
  }, [selectedIds])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) return
      
      // Escape to cancel connection or deselect
      if (e.key === 'Escape') {
        if (connectionState.isCreating) {
          setConnectionState({
            isCreating: false,
            sourceId: null,
            sourceAnchor: null,
            tempTargetPos: null,
          })
          setNearestTarget(null)
          return
        }
        clearSelection()
        setCurrentTool('select')
      }
      
      // Delete selected elements
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault()
          selectedIds.forEach(id => {
            // Check if it's a node or an edge
            const isNode = nodes.some(n => n.id === id)
            if (isNode) {
              deleteNode(id)
            } else {
              deleteEdge(id)
            }
          })
          clearSelection()
        }
      }
      
      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') setCurrentTool('select')
      if (e.key === 'h' || e.key === 'H') setCurrentTool('pan')
      if (e.key === 'r' || e.key === 'R') setCurrentTool('rectangle')
      if (e.key === 'e' || e.key === 'E') setCurrentTool('ellipse')
      if (e.key === 'd' || e.key === 'D') setCurrentTool('diamond')
      if (e.key === 'l' || e.key === 'L') setCurrentTool('line')
      if (e.key === 'a' || e.key === 'A') setCurrentTool('arrow')
      if (e.key === 't' || e.key === 'T') setCurrentTool('text')
      if (e.key === 'i' || e.key === 'I') setCurrentTool('image')
      if (e.key === 'p' || e.key === 'P') setCurrentTool('freehand')
      
      // Zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        setZoom(Math.min(4, zoom * 1.2))
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        setZoom(Math.max(0.1, zoom / 1.2))
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        setZoom(1)
        setPan({ x: 0, y: 0 })
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingTextId, clearSelection, setCurrentTool, zoom, setZoom, setPan])
  
  // Handle paste for images from clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) continue
          
          const reader = new FileReader()
          reader.onload = (event) => {
            const imageData = event.target?.result as string
            
            const img = new window.Image()
            img.onload = () => {
              // Scale image if too large
              const maxSize = 400
              let imgWidth = img.width
              let imgHeight = img.height
              
              if (imgWidth > maxSize || imgHeight > maxSize) {
                const ratio = Math.min(maxSize / imgWidth, maxSize / imgHeight)
                imgWidth *= ratio
                imgHeight *= ratio
              }
              
              // Place in center of current view
              const centerX = (-pan.x + (window.innerWidth / 2)) / zoom - imgWidth / 2
              const centerY = (-pan.y + (window.innerHeight / 2)) / zoom - imgHeight / 2
              
              addNode({
                type: 'image',
                position: { x: centerX, y: centerY },
                size: { width: imgWidth, height: imgHeight },
                imageData,
                style: {
                  fill: 'transparent',
                  stroke: '#e5e7eb',
                  strokeWidth: 1,
                  opacity: 1,
                },
              })
            }
            img.src = imageData
          }
          reader.readAsDataURL(file)
          break  // Only handle first image
        }
      }
    }
    
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addNode, pan, zoom])

  // Handle export PNG request
  useEffect(() => {
    const handleExportRequest = () => {
      const stage = stageRef.current
      if (!stage) {
        window.dispatchEvent(new CustomEvent('exportPNGError'))
        return
      }
      
      try {
        const dataUrl = stage.toDataURL({ pixelRatio: 2 })
        window.dispatchEvent(new CustomEvent('exportPNGResult', { detail: { dataUrl } }))
      } catch (error) {
        window.dispatchEvent(new CustomEvent('exportPNGError'))
      }
    }
    
    window.addEventListener('requestExportPNG', handleExportRequest)
    return () => window.removeEventListener('requestExportPNG', handleExportRequest)
  }, [])

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    
    const stage = stageRef.current
    if (!stage) return

    // If dragging, don't zoom
    if (isDragging) return

    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const scaleBy = 1.08
    const oldScale = zoom
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
    const clampedScale = Math.max(0.1, Math.min(4, newScale))

    // Calculate new position to zoom towards mouse pointer
    const mousePointTo = {
      x: (pointer.x - pan.x) / oldScale,
      y: (pointer.y - pan.y) / oldScale,
    }

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    }

    setZoom(clampedScale)
    setPan(newPos)
  }, [zoom, pan, setZoom, setPan, isDragging])

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // Ignore right-click - it's used for panning
    if (e.evt.button === 2) return
    
    const clickedOnEmpty = e.target === e.target.getStage()
    
    if (clickedOnEmpty) {
      // Cancel connection creation if clicking empty space
      if (connectionState.isCreating) {
        setConnectionState({
          isCreating: false,
          sourceId: null,
          sourceAnchor: null,
          tempTargetPos: null,
        })
        return
      }
      
      // Always clear selection when clicking on empty space
      clearSelection()
      
      // Shape tools - basic and advanced shapes
      const shapeTools = ['rectangle', 'ellipse', 'diamond', 'triangle', 'star', 'hexagon', 'cylinder', 'cloud', 'callout', 'note', 'container']
      if (shapeTools.includes(currentTool)) {
        const stage = stageRef.current
        if (!stage) return
        
        const pointer = stage.getPointerPosition()
        if (!pointer) return
        
        const x = (pointer.x - pan.x) / zoom
        const y = (pointer.y - pan.y) / zoom
        
        const snappedX = preferences.snapToGrid ? snapToGrid(x, preferences.gridSize) : x
        const snappedY = preferences.snapToGrid ? snapToGrid(y, preferences.gridSize) : y
        
        // Default sizes based on shape type
        let defaultSize = { width: 120, height: 80 }
        let defaultStyle: any = {}
        
        if (currentTool === 'star') {
          defaultSize = { width: 100, height: 100 }
        } else if (currentTool === 'hexagon') {
          defaultSize = { width: 100, height: 90 }
        } else if (currentTool === 'cylinder') {
          defaultSize = { width: 80, height: 120 }
        } else if (currentTool === 'cloud') {
          defaultSize = { width: 140, height: 100 }
        } else if (currentTool === 'callout') {
          defaultSize = { width: 150, height: 100 }
        } else if (currentTool === 'note') {
          defaultSize = { width: 120, height: 120 }
          defaultStyle = { fill: '#ffffa5', stroke: '#e6e600' }
        } else if (currentTool === 'container') {
          defaultSize = { width: 300, height: 200 }
          defaultStyle = { fill: 'rgba(100, 150, 200, 0.1)', stroke: '#4a90d9' }
        }
        
        addNode({
          type: currentTool as any,
          position: { x: snappedX, y: snappedY },
          size: defaultSize,
          style: defaultStyle,
        })
        
        // Keep the tool active for continuous placement
        // User can press V or Escape to switch to select
      }
      
      // Text tool - create text element on canvas
      if (currentTool === 'text') {
        const stage = stageRef.current
        if (!stage) return
        
        const pointer = stage.getPointerPosition()
        if (!pointer) return
        
        const x = (pointer.x - pan.x) / zoom
        const y = (pointer.y - pan.y) / zoom
        
        const snappedX = preferences.snapToGrid ? snapToGrid(x, preferences.gridSize) : x
        const snappedY = preferences.snapToGrid ? snapToGrid(y, preferences.gridSize) : y
        
        // Create a node of type text (as a rectangle with text)
        const id = addNode({
          type: 'rectangle',
          position: { x: snappedX, y: snappedY },
          size: { width: 200, height: 60 },
          text: 'Введите текст',
          style: {
            fill: '#fef3c7',
            stroke: '#f59e0b',
            strokeWidth: 2,
            opacity: 1,
            cornerRadius: 8,
          },
        })
        
        selectElements([id])
        // Keep text tool active for continuous creation
      }
      
      // Image tool - open file picker and add image
      if (currentTool === 'image') {
        const stage = stageRef.current
        if (!stage) return
        
        const pointer = stage.getPointerPosition()
        if (!pointer) return
        
        const x = (pointer.x - pan.x) / zoom
        const y = (pointer.y - pan.y) / zoom
        
        const snappedX = preferences.snapToGrid ? snapToGrid(x, preferences.gridSize) : x
        const snappedY = preferences.snapToGrid ? snapToGrid(y, preferences.gridSize) : y
        
        // Create file input and trigger click
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (!file) return
          
          const reader = new FileReader()
          reader.onload = (event) => {
            const imageData = event.target?.result as string
            
            // Create image to get dimensions
            const img = new window.Image()
            img.onload = () => {
              // Scale image if too large (max 400px)
              const maxSize = 400
              let imgWidth = img.width
              let imgHeight = img.height
              
              if (imgWidth > maxSize || imgHeight > maxSize) {
                const ratio = Math.min(maxSize / imgWidth, maxSize / imgHeight)
                imgWidth *= ratio
                imgHeight *= ratio
              }
              
              addNode({
                type: 'image',
                position: { x: snappedX, y: snappedY },
                size: { width: imgWidth, height: imgHeight },
                imageData,
                style: {
                  fill: 'transparent',
                  stroke: '#e5e7eb',
                  strokeWidth: 1,
                  opacity: 1,
                },
              })
            }
            img.src = imageData
          }
          reader.readAsDataURL(file)
        }
        input.click()
      }
    }
  }, [currentTool, clearSelection, addNode, pan, zoom, preferences, setCurrentTool, connectionState, selectElements])

  const handleNodeClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>, nodeId: string) => {
    e.cancelBubble = true
    
    // Handle connection creation (Line/Arrow tool)
    if (currentTool === 'line' || currentTool === 'arrow') {
      const clickedNode = nodes.find(n => n.id === nodeId)
      if (!clickedNode) return
      
      if (!connectionState.isCreating) {
        // First click - set source
        const sourceAnchor = findClosestAnchor(clickedNode, e)
        setConnectionState({
          isCreating: true,
          sourceId: nodeId,
          sourceAnchor,
          tempTargetPos: null,
        })
      } else {
        // Second click - set target and create edge
        if (connectionState.sourceId && connectionState.sourceId !== nodeId) {
          const targetAnchor = findClosestAnchor(clickedNode, e)
          
          addEdge({
            type: currentTool === 'arrow' ? 'arrow' : 'line',
            source: connectionState.sourceId,
            target: nodeId,
            sourceAnchor: connectionState.sourceAnchor!,
            targetAnchor,
            arrowStart: 'none',
            arrowEnd: currentTool === 'arrow' ? 'arrow' : 'none',
          })
          
          // Reset connection state
          setConnectionState({
            isCreating: false,
            sourceId: null,
            sourceAnchor: null,
            tempTargetPos: null,
          })
          
          // Switch to select tool
          setCurrentTool('select')
        }
      }
      return
    }
    
    // Allow selection even when using other tools (click on existing element to select it)
    const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey
    
    if (metaPressed) {
      if (selectedIds.includes(nodeId)) {
        selectElements(selectedIds.filter(id => id !== nodeId))
      } else {
        selectElements([...selectedIds, nodeId])
      }
    } else {
      selectElements([nodeId])
    }
    
    // Switch to select tool when clicking on element
    if (currentTool !== 'select' && currentTool !== 'pan') {
      setCurrentTool('select')
    }
  }, [currentTool, selectedIds, selectElements, setCurrentTool, connectionState, nodes, addEdge])
  
  // Helper to find closest anchor point
  const findClosestAnchor = useCallback((node: DiagramNode, _e: Konva.KonvaEventObject<MouseEvent>): AnchorPosition => {
    const stage = stageRef.current
    if (!stage) return 'center'
    
    const pointer = stage.getPointerPosition()
    if (!pointer) return 'center'
    
    const clickX = (pointer.x - pan.x) / zoom
    const clickY = (pointer.y - pan.y) / zoom
    
    const cx = node.position.x + node.size.width / 2
    const cy = node.position.y + node.size.height / 2
    
    const dx = clickX - cx
    const dy = clickY - cy
    
    // Determine which side is closer
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    
    if (absDx > absDy) {
      return dx > 0 ? 'right' : 'left'
    } else {
      return dy > 0 ? 'bottom' : 'top'
    }
  }, [pan, zoom])

  const handleNodeDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>, nodeId: string) => {
    e.cancelBubble = true
    
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    
    // Double-click to edit text content
    const stage = stageRef.current
    if (!stage) return
    
    const stageBox = stage.container().getBoundingClientRect()
    const nodePos = {
      x: node.position.x * zoom + pan.x + stageBox.left,
      y: node.position.y * zoom + pan.y + stageBox.top,
    }
    
    const textarea = document.createElement('textarea')
    textarea.value = node.text || ''
    textarea.style.position = 'absolute'
    textarea.style.left = `${nodePos.x}px`
    textarea.style.top = `${nodePos.y}px`
    textarea.style.width = `${node.size.width * zoom}px`
    textarea.style.height = `${node.size.height * zoom}px`
    textarea.style.fontSize = `${14 * zoom}px`
    textarea.style.padding = '4px'
    textarea.style.border = '2px solid #3b82f6'
    textarea.style.borderRadius = '4px'
    textarea.style.outline = 'none'
    textarea.style.resize = 'none'
    textarea.style.background = 'white'
    textarea.style.zIndex = '1000'
    
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    
    setEditingTextId(nodeId)
    
    const handleBlur = () => {
      updateNode(nodeId, { text: textarea.value })
      document.body.removeChild(textarea)
      setEditingTextId(null)
    }
    
    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.key === 'Enter' && !evt.shiftKey) {
        evt.preventDefault()
        handleBlur()
      }
      if (evt.key === 'Escape') {
        document.body.removeChild(textarea)
        setEditingTextId(null)
      }
    }
    
    textarea.addEventListener('blur', handleBlur)
    textarea.addEventListener('keydown', handleKeyDown)
  }, [nodes, zoom, pan, updateNode])

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>, nodeId: string) => {
    let x = e.target.x()
    let y = e.target.y()
    
    if (preferences.snapToGrid) {
      x = snapToGrid(x, preferences.gridSize)
      y = snapToGrid(y, preferences.gridSize)
    }
    
    updateNode(nodeId, { position: { x, y } })
  }, [updateNode, preferences])

  const handleTransformEnd = useCallback((e: Konva.KonvaEventObject<Event>, nodeId: string) => {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    
    node.scaleX(1)
    node.scaleY(1)
    
    updateNode(nodeId, {
      position: { x: node.x(), y: node.y() },
      size: {
        width: Math.max(20, node.width() * scaleX),
        height: Math.max(20, node.height() * scaleY),
      },
      rotation: node.rotation(),
    })
  }, [updateNode])

  const renderNode = (node: DiagramNode) => {
    const isSelected = selectedIds.includes(node.id)
    const isHovered = hoveredNodeId === node.id
    
    // Common event handlers for the group
    const groupHandlers = {
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleNodeClick(e, node.id),
      onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => handleNodeDblClick(e, node.id),
      onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
        e.cancelBubble = true  // CRITICAL: Prevent Stage from receiving this event
        setIsDragging(true)
        const stage = stageRef.current
        if (stage) stage.container().style.cursor = 'grabbing'
      },
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => {
        e.cancelBubble = true  // Prevent Stage from moving
        // Smart alignment guides
        const target = e.target
        const { guides: newGuides, snapX, snapY } = computeSmartGuides(node.id, target.x(), target.y())
        if (newGuides.length > 0) {
          target.x(snapX)
          target.y(snapY)
        }
        setGuides(newGuides)
      },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        e.cancelBubble = true
        setIsDragging(false)
        setGuides([]) // Clear guides on drop
        handleDragEnd(e, node.id)
        const stage = stageRef.current
        if (stage) stage.container().style.cursor = 'default'
      },
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(e, node.id),
      onMouseEnter: () => {
        setHoveredNodeId(node.id)
        const stage = stageRef.current
        // Show move cursor for select tool, crosshair for connection tools
        if (stage) {
          const isConnectionToolActive = currentTool === 'line' || currentTool === 'arrow'
          if (connectionState.isCreating) {
            stage.container().style.cursor = 'crosshair'
          } else if (isConnectionToolActive) {
            stage.container().style.cursor = 'crosshair'
          } else if (!node.locked) {
            stage.container().style.cursor = 'move'
          }
        }
      },
      onMouseLeave: () => {
        setHoveredNodeId(null)
        const stage = stageRef.current
        if (stage && !connectionState.isCreating) {
          stage.container().style.cursor = 'default'
        }
      },
      onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => {
        e.evt.preventDefault()
        e.cancelBubble = true
        const stage = stageRef.current
        if (stage) {
          const stageBox = stage.container().getBoundingClientRect()
          setContextMenu({
            x: e.evt.clientX - stageBox.left,
            y: e.evt.clientY - stageBox.top,
            nodeId: node.id,
          })
          selectElements([node.id])
        }
      },
    }
    
    // Modern shape styling - cleaner, with subtle effects
    const baseShadowBlur = 8
    const shapeStyle = {
      fill: node.style.fill || '#1e293b',
      stroke: isSelected ? '#60a5fa' : isHovered ? '#94a3b8' : (node.style.stroke || '#334155'),
      strokeWidth: isSelected ? 2 : (isHovered ? 1.5 : (node.style.strokeWidth || 1)),
      shadowColor: isSelected ? '#3b82f6' : 'rgba(0,0,0,0.25)',
      shadowBlur: isSelected ? 12 : (isHovered ? baseShadowBlur + 4 : baseShadowBlur),
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      opacity: node.style.opacity ?? 1,
    }
    
    return (
      <Group
        key={node.id}
        ref={(ref) => {
          if (ref) {
            groupRefs.current.set(node.id, ref)
          }
        }}
        x={node.position.x}
        y={node.position.y}
        width={node.size.width}
        height={node.size.height}
        rotation={node.rotation}
        draggable={!node.locked}
        visible={node.visible}
        {...groupHandlers}
      >
        <ShapeRenderer node={node} style={shapeStyle} />
      </Group>
    )
  }

  // Edge selection callback for EdgeRenderer
  const handleEdgeSelect = useCallback((e: Konva.KonvaEventObject<MouseEvent>, edgeId: string) => {
    e.cancelBubble = true
    const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey
    if (metaPressed) {
      if (selectedIds.includes(edgeId)) {
        selectElements(selectedIds.filter(id => id !== edgeId))
      } else {
        selectElements([...selectedIds, edgeId])
      }
    } else {
      selectElements([edgeId])
    }
  }, [selectedIds, selectElements])
  
  // Render temporary connection line while creating
  const renderTempConnection = () => {
    if (!connectionState.isCreating || !connectionState.sourceId || !connectionState.tempTargetPos) {
      return null
    }
    
    const sourceNode = nodes.find(n => n.id === connectionState.sourceId)
    if (!sourceNode) return null
    
    const sourcePos = getAnchorPosition(
      sourceNode.position.x,
      sourceNode.position.y,
      sourceNode.size.width,
      sourceNode.size.height,
      connectionState.sourceAnchor || 'center'
    )
    
    const points = [
      sourcePos.x,
      sourcePos.y,
      connectionState.tempTargetPos.x,
      connectionState.tempTargetPos.y
    ]
    
    // Check if we're near a target - use different color
    const hasTarget = nearestTarget !== null
    const lineColor = hasTarget ? '#22d3ee' : '#60a5fa'
    
    // Always show arrow preview (more intuitive)
    return (
      <Arrow
        points={points}
        stroke={lineColor}
        strokeWidth={2}
        fill={lineColor}
        pointerLength={8}
        pointerWidth={6}
        dash={[6, 4]}
        opacity={0.8}
        shadowColor={lineColor}
        shadowBlur={6}
        shadowOpacity={0.4}
      />
    )
  }
  
  // Handle mouse move for connection preview and freehand drawing
  const handleStageMouseMove = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current
    if (!stage) return
    
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    
    const x = (pointer.x - pan.x) / zoom
    const y = (pointer.y - pan.y) / zoom
    
    // Freehand drawing
    if (isDrawingFreehand) {
      setFreehandPoints(prev => [...prev, x, y])
      return
    }
    
    if (!connectionState.isCreating) return
    
    setConnectionState(prev => ({
      ...prev,
      tempTargetPos: { x, y }
    }))
    
    // Find nearest target anchor for visual feedback
    let nearest: { nodeId: string; anchor: AnchorPosition } | null = null
    let minDist = 50  // Snap distance in canvas units
    
    nodes.forEach(n => {
      if (n.id === connectionState.sourceId) return // Skip source node
      const nodeAnchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left']
      nodeAnchors.forEach(a => {
        const anchorPos = getAnchorPosition(n.position.x, n.position.y, n.size.width, n.size.height, a)
        const dist = Math.sqrt(Math.pow(x - anchorPos.x, 2) + Math.pow(y - anchorPos.y, 2))
        if (dist < minDist) {
          minDist = dist
          nearest = { nodeId: n.id, anchor: a }
        }
      })
    })
    setNearestTarget(nearest)
  }, [connectionState.isCreating, connectionState.sourceId, pan, zoom, nodes, isDrawingFreehand])
  
  // Handle mouse up to complete connection
  const handleStageMouseUp = useCallback(() => {
    if (!connectionState.isCreating || !connectionState.sourceId) return
    
    // If we have a nearest target, create the edge
    if (nearestTarget) {
      const isLineTool = currentTool === 'line'
      addEdge({
        type: isLineTool ? 'line' : 'arrow',
        source: connectionState.sourceId,
        target: nearestTarget.nodeId,
        sourceAnchor: connectionState.sourceAnchor!,
        targetAnchor: nearestTarget.anchor,
        arrowStart: 'none',
        arrowEnd: isLineTool ? 'none' : 'arrow',
      })
    }
    
    // Reset connection state
    setConnectionState({
      isCreating: false,
      sourceId: null,
      sourceAnchor: null,
      tempTargetPos: null,
    })
    setNearestTarget(null)
    
    const stage = stageRef.current
    if (stage) stage.container().style.cursor = 'default'
  }, [connectionState, nearestTarget, currentTool, addEdge])
  
  // Anchor point callbacks for AnchorPoints component
  const handleAnchorClick = useCallback((nodeId: string, anchor: AnchorPosition, pos: { x: number; y: number }) => {
    if (!connectionState.isCreating) {
      setConnectionState({
        isCreating: true,
        sourceId: nodeId,
        sourceAnchor: anchor,
        tempTargetPos: pos,
      })
    } else {
      if (connectionState.sourceId !== nodeId) {
        const isLineTool = currentTool === 'line'
        addEdge({
          type: isLineTool ? 'line' : 'arrow',
          source: connectionState.sourceId!,
          target: nodeId,
          sourceAnchor: connectionState.sourceAnchor!,
          targetAnchor: anchor,
          arrowStart: 'none',
          arrowEnd: isLineTool ? 'none' : 'arrow',
        })
      }
      setConnectionState({
        isCreating: false,
        sourceId: null,
        sourceAnchor: null,
        tempTargetPos: null,
      })
      setNearestTarget(null)
    }
  }, [connectionState, currentTool, addEdge])

  const handleAnchorHover = useCallback((nodeId: string, anchor: AnchorPosition) => {
    if (connectionState.isCreating && connectionState.sourceId !== nodeId) {
      setNearestTarget({ nodeId, anchor })
    }
  }, [connectionState])

  const handleAnchorLeave = useCallback((nodeId: string, anchor: AnchorPosition) => {
    if (nearestTarget?.nodeId === nodeId && nearestTarget?.anchor === anchor) {
      setNearestTarget(null)
    }
  }, [nearestTarget])

  // renderGrid replaced by <GridLayer /> component

  // Check if we should enable stage dragging - only when select/pan tool AND clicking on empty space
  // Stage dragging is now handled manually to avoid conflicts with node dragging
  const isConnectionTool = currentTool === 'line' || currentTool === 'arrow'
  
  return (
    <>
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      scaleX={zoom}
      scaleY={zoom}
      x={pan.x}
      y={pan.y}
      onWheel={handleWheel}
      onClick={(e) => {
        // Close context menu on click
        setContextMenu(null)
        handleStageClick(e)
      }}
      draggable={false}
      onMouseDown={(e) => {
        // Right-click pan navigation
        if (e.evt.button === 2) {
          e.evt.preventDefault()
          const stage = stageRef.current
          if (!stage) return
          
          setIsRightClickPanning(true)
          setPanStartPos({ x: e.evt.clientX, y: e.evt.clientY })
          setPanStartPan({ x: pan.x, y: pan.y })
          stage.container().style.cursor = 'grabbing'
          return
        }
        
        // Only start dragging Stage if we clicked on empty space (the Stage itself)
        const clickedOnEmpty = e.target === e.target.getStage()
        
        // Freehand drawing
        if (clickedOnEmpty && currentTool === 'freehand') {
          const stage = stageRef.current
          if (!stage) return
          const pointer = stage.getPointerPosition()
          if (!pointer) return
          
          const x = (pointer.x - pan.x) / zoom
          const y = (pointer.y - pan.y) / zoom
          
          setIsDrawingFreehand(true)
          setFreehandPoints([x, y])
          stage.container().style.cursor = 'crosshair'
          return
        }
        
        if (clickedOnEmpty && stageRef.current && !isConnectionTool && currentTool !== 'freehand') {
          stageRef.current.container().style.cursor = 'grabbing'
          stageRef.current.draggable(true)
          stageRef.current.startDrag()
        }
      }}
      onDragEnd={(e) => {
        const stage = e.target as Konva.Stage
        if (stage === stageRef.current) {
          setPan({ x: stage.x(), y: stage.y() })
          stage.draggable(false)
          stage.container().style.cursor = 'default'
        }
      }}
      onMouseUp={() => {
        // End right-click pan
        if (isRightClickPanning) {
          setIsRightClickPanning(false)
          if (stageRef.current) {
            stageRef.current.container().style.cursor = 'default'
          }
          return
        }
        
        // Complete freehand drawing
        if (isDrawingFreehand && freehandPoints.length >= 4) {
          // Calculate bounding box
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (let i = 0; i < freehandPoints.length; i += 2) {
            minX = Math.min(minX, freehandPoints[i])
            maxX = Math.max(maxX, freehandPoints[i])
            minY = Math.min(minY, freehandPoints[i + 1])
            maxY = Math.max(maxY, freehandPoints[i + 1])
          }
          
          // Normalize points relative to bounding box
          const normalizedPoints = freehandPoints.map((val, i) => 
            i % 2 === 0 ? val - minX : val - minY
          )
          
          addNode({
            type: 'freehand',
            position: { x: minX, y: minY },
            size: { width: Math.max(20, maxX - minX), height: Math.max(20, maxY - minY) },
            pathData: normalizedPoints.join(','),
            style: {
              fill: 'transparent',
              stroke: '#3b82f6',
              strokeWidth: 3,
              opacity: 1,
            },
          })
          
          setIsDrawingFreehand(false)
          setFreehandPoints([])
        } else if (isDrawingFreehand) {
          setIsDrawingFreehand(false)
          setFreehandPoints([])
        }
        
        // Complete connection if creating
        handleStageMouseUp()
        // Reset stage state
        if (stageRef.current) {
          stageRef.current.container().style.cursor = 'default'
          stageRef.current.draggable(false)
        }
      }}
      onMouseMove={(e) => {
        // Handle right-click pan
        if (isRightClickPanning) {
          const dx = e.evt.clientX - panStartPos.x
          const dy = e.evt.clientY - panStartPos.y
          setPan({
            x: panStartPan.x + dx,
            y: panStartPan.y + dy
          })
          return
        }
        handleStageMouseMove(e)
      }}
      onContextMenu={(e) => {
        e.evt.preventDefault()
        
        // Only show canvas context menu when clicking on empty space (not on nodes)
        const clickedOnEmpty = e.target === e.target.getStage()
        if (clickedOnEmpty && currentTool === 'select') {
          const stage = stageRef.current
          if (!stage) return
          
          const pointer = stage.getPointerPosition()
          if (!pointer) return
          
          const canvasX = (pointer.x - pan.x) / zoom
          const canvasY = (pointer.y - pan.y) / zoom
          
          setCanvasContextMenu({
            x: e.evt.clientX,
            y: e.evt.clientY,
            canvasX,
            canvasY
          })
        }
      }}
    >
      <Layer>
        <GridLayer grid={grid} width={width} height={height} zoom={zoom} pan={pan} />
      </Layer>
      <Layer>
        {edges.map(edge => (
          <EdgeRenderer key={edge.id} edge={edge} nodes={nodes} selectedIds={selectedIds} onSelect={handleEdgeSelect} />
        ))}
        {nodes.map(renderNode)}
        {nodes.map(node => (
          <AnchorPoints
            key={`anchors-${node.id}`}
            node={node}
            currentTool={currentTool}
            hoveredNodeId={hoveredNodeId}
            connectionState={connectionState}
            nearestTarget={nearestTarget}
            onAnchorClick={handleAnchorClick}
            onAnchorHover={handleAnchorHover}
            onAnchorLeave={handleAnchorLeave}
          />
        ))}
        {renderTempConnection()}
        {/* Temporary freehand line while drawing */}
        {isDrawingFreehand && freehandPoints.length >= 2 && (
          <Line
            points={freehandPoints}
            stroke="#3b82f6"
            strokeWidth={3}
            lineCap="round"
            lineJoin="round"
            tension={0.5}
            opacity={0.8}
          />
        )}
        {/* Smart alignment guide lines */}
        {guides.map((g, i) =>
          g.orientation === 'V' ? (
            <Line key={`guide-v-${i}`} points={[g.x, -10000, g.x, 10000]} stroke="#f43f5e" strokeWidth={1} dash={[4, 4]} listening={false} />
          ) : (
            <Line key={`guide-h-${i}`} points={[-10000, g.y, 10000, g.y]} stroke="#f43f5e" strokeWidth={1} dash={[4, 4]} listening={false} />
          )
        )}
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) {
              return oldBox
            }
            return newBox
          }}
        />
      </Layer>
    </Stage>
    
    {/* MiniMap for navigation */}
    <div className="absolute bottom-4 right-4">
      <MiniMap />
    </div>
    
    {/* Canvas Context Menu - for adding elements on right-click */}
    {canvasContextMenu && (
      <CanvasContextMenu
        x={canvasContextMenu.x}
        y={canvasContextMenu.y}
        canvasX={canvasContextMenu.canvasX}
        canvasY={canvasContextMenu.canvasY}
        onClose={() => setCanvasContextMenu(null)}
        onAddShape={(type, position) => {
          // Map of default sizes for each shape type
          const defaultSizes: Record<string, { width: number; height: number }> = {
            rectangle: { width: 120, height: 80 },
            ellipse: { width: 100, height: 80 },
            diamond: { width: 100, height: 100 },
            triangle: { width: 100, height: 90 },
            star: { width: 100, height: 100 },
            hexagon: { width: 100, height: 90 },
            cloud: { width: 140, height: 100 },
            callout: { width: 150, height: 100 },
            note: { width: 120, height: 120 },
            container: { width: 300, height: 200 },
            text: { width: 200, height: 60 },
          }
          
          const defaultStyles: Record<string, any> = {
            note: { fill: '#ffffa5', stroke: '#e6e600' },
            container: { fill: 'rgba(100, 150, 200, 0.1)', stroke: '#4a90d9' },
            text: { fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 2, cornerRadius: 8 },
          }
          
          const size = defaultSizes[type] || { width: 120, height: 80 }
          const style = defaultStyles[type] || {}
          
          const snappedX = preferences.snapToGrid ? snapToGrid(position.x, preferences.gridSize) : position.x
          const snappedY = preferences.snapToGrid ? snapToGrid(position.y, preferences.gridSize) : position.y
          
          if (type === 'text') {
            addNode({
              type: 'rectangle',
              position: { x: snappedX, y: snappedY },
              size,
              text: 'Введите текст',
              style,
            })
          } else if (type === 'image') {
            // Open file picker for image
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/*'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (!file) return
              
              const reader = new FileReader()
              reader.onload = (event) => {
                const imageData = event.target?.result as string
                const img = new window.Image()
                img.onload = () => {
                  const maxSize = 400
                  let imgWidth = img.width
                  let imgHeight = img.height
                  
                  if (imgWidth > maxSize || imgHeight > maxSize) {
                    const ratio = Math.min(maxSize / imgWidth, maxSize / imgHeight)
                    imgWidth *= ratio
                    imgHeight *= ratio
                  }
                  
                  addNode({
                    type: 'image',
                    position: { x: snappedX, y: snappedY },
                    size: { width: imgWidth, height: imgHeight },
                    imageData,
                    style: { fill: 'transparent', stroke: '#e5e7eb', strokeWidth: 1, opacity: 1 },
                  })
                }
                img.src = imageData
              }
              reader.readAsDataURL(file)
            }
            input.click()
          } else if (type === 'arrow' || type === 'line') {
            // Switch to connection tool
            setCurrentTool(type)
          } else if (type === 'freehand') {
            setCurrentTool('freehand')
          } else {
            addNode({
              type: type as any,
              position: { x: snappedX, y: snappedY },
              size,
              style,
            })
          }
        }}
      />
    )}
    
    {/* Node Context Menu */}
    {contextMenu && (() => {
      const node = nodes.find(n => n.id === contextMenu.nodeId)
      if (!node) return null
      
      return (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={node}
          onDuplicate={(n) => {
            addNode({
              ...n,
              id: undefined,
              position: { x: n.position.x + 20, y: n.position.y + 20 },
            })
          }}
          onCopy={(n) => navigator.clipboard.writeText(JSON.stringify(n))}
          onToggleVisibility={(id, visible) => updateNode(id, { visible })}
          onToggleLock={(id, locked) => updateNode(id, { locked })}
          onBringForward={(id, z) => updateNode(id, { zIndex: z + 1 })}
          onSendBackward={(id, z) => updateNode(id, { zIndex: Math.max(0, z - 1) })}
          onImport={(id) => window.dispatchEvent(new CustomEvent('importIntoNode', { detail: { nodeId: id } }))}
          onOpenInspector={(id) => window.dispatchEvent(new CustomEvent('openInspector', { detail: { nodeId: id } }))}
          onDelete={(id) => deleteNode(id)}
          onClose={() => setContextMenu(null)}
        />
      )
    })()}
    
    {/* Click outside to close context menus */}
    {(contextMenu || canvasContextMenu) && (
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => { setContextMenu(null); setCanvasContextMenu(null) }}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu(null)
          setCanvasContextMenu(null)
        }}
      />
    )}
    </>
  )
}
