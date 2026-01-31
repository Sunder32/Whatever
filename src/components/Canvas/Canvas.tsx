import { useRef, useEffect, useCallback, useState } from 'react'
import { Stage, Layer, Rect, Ellipse, Line, RegularPolygon, Transformer, Text, Group, Arrow, Circle as KonvaCircle, Image as KonvaImage } from 'react-konva'
import { Trash2, Copy, Clipboard, Eye, EyeOff, Lock, Unlock, Layers, ArrowUp, ArrowDown, Palette } from 'lucide-react'
import type Konva from 'konva'
import { useDiagramStore, useAppStore } from '@/stores'
import type { DiagramNode, DiagramEdge, AnchorPosition } from '@/types'
import { snapToGrid, getAnchorPosition } from '@/utils'
import { CanvasContextMenu } from './CanvasContextMenu'
import { MiniMap } from './MiniMap'

interface CanvasProps {
  width: number
  height: number
}

// Hook to load image from data URL
const useImage = (imageData: string | undefined): HTMLImageElement | null => {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  
  useEffect(() => {
    if (!imageData) {
      setImage(null)
      return
    }
    
    const img = new window.Image()
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
    img.src = imageData
    
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [imageData])
  
  return image
}

// Connection creation state
interface ConnectionState {
  isCreating: boolean
  sourceId: string | null
  sourceAnchor: AnchorPosition | null
  tempTargetPos: { x: number; y: number } | null
}

// Image node content component (needs to be separate to use hooks)
interface ImageNodeContentProps {
  node: DiagramNode
  baseStyle: {
    fill: string
    stroke: string
    strokeWidth: number
    shadowColor: string
    shadowBlur: number
    shadowOffsetX: number
    shadowOffsetY: number
    opacity: number
  }
}

function ImageNodeContent({ node, baseStyle }: ImageNodeContentProps) {
  const image = useImage(node.imageData)
  
  if (!image) {
    // Placeholder while image loads or if no image
    return (
      <>
        <Rect
          width={node.size.width}
          height={node.size.height}
          fill="#f3f4f6"
          stroke={baseStyle.stroke}
          strokeWidth={baseStyle.strokeWidth}
          cornerRadius={4}
        />
        <Text
          x={0}
          y={node.size.height / 2 - 10}
          width={node.size.width}
          text={node.imageData ? 'Загрузка...' : '🖼️ Нет изображения'}
          fontSize={14}
          fill="#9ca3af"
          align="center"
        />
      </>
    )
  }
  
  return (
    <>
      <KonvaImage
        image={image}
        width={node.size.width}
        height={node.size.height}
        shadowColor={baseStyle.shadowColor}
        shadowBlur={baseStyle.shadowBlur}
      />
      <Rect
        width={node.size.width}
        height={node.size.height}
        fill="transparent"
        stroke={baseStyle.stroke}
        strokeWidth={baseStyle.strokeWidth}
      />
    </>
  )
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
      },
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
        e.cancelBubble = true
        setIsDragging(false)
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
    
    // Text element inside the shape
    const textElement = node.text ? (
      <Text
        text={node.text}
        x={0}
        y={0}
        width={node.size.width}
        height={node.size.height}
        fontSize={node.textStyle?.fontSize || 14}
        fontFamily={node.textStyle?.fontFamily || 'Arial'}
        fontStyle={node.textStyle?.fontStyle || 'normal'}
        fill={node.textStyle?.color || '#1f2937'}
        align={node.textStyle?.align || 'center'}
        verticalAlign="middle"
        padding={8}
        listening={false}
      />
    ) : null
    
    // Render shape based on type with Group wrapper
    const renderShape = () => {
      // Separate cornerRadius for Rect only
      const { ...baseStyle } = shapeStyle
      
      switch (node.type) {
        case 'rectangle':
          return (
            <>
              <Rect
                width={node.size.width}
                height={node.size.height}
                cornerRadius={node.style.cornerRadius || 8}
                {...baseStyle}
              />
              {textElement}
            </>
          )
        case 'ellipse':
          return (
            <>
              <Ellipse
                x={node.size.width / 2}
                y={node.size.height / 2}
                radiusX={node.size.width / 2}
                radiusY={node.size.height / 2}
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                shadowColor={baseStyle.shadowColor}
                shadowBlur={baseStyle.shadowBlur}
                shadowOffsetX={baseStyle.shadowOffsetX}
                shadowOffsetY={baseStyle.shadowOffsetY}
                opacity={baseStyle.opacity}
              />
              {textElement}
            </>
          )
        case 'diamond':
          return (
            <>
              <RegularPolygon
                x={node.size.width / 2}
                y={node.size.height / 2}
                sides={4}
                radius={Math.min(node.size.width, node.size.height) / 2}
                rotation={45}
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                shadowColor={baseStyle.shadowColor}
                shadowBlur={baseStyle.shadowBlur}
                shadowOffsetX={baseStyle.shadowOffsetX}
                shadowOffsetY={baseStyle.shadowOffsetY}
                opacity={baseStyle.opacity}
              />
              {textElement}
            </>
          )
        case 'triangle':
          return (
            <>
              <RegularPolygon
                x={node.size.width / 2}
                y={node.size.height / 2}
                sides={3}
                radius={Math.min(node.size.width, node.size.height) / 2}
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                shadowColor={baseStyle.shadowColor}
                shadowBlur={baseStyle.shadowBlur}
                shadowOffsetX={baseStyle.shadowOffsetX}
                shadowOffsetY={baseStyle.shadowOffsetY}
                opacity={baseStyle.opacity}
              />
              {textElement}
            </>
          )
        case 'star':
          return (
            <>
              <Line
                points={(() => {
                  const cx = node.size.width / 2
                  const cy = node.size.height / 2
                  const outerR = Math.min(node.size.width, node.size.height) / 2
                  const innerR = outerR * 0.4
                  const points: number[] = []
                  for (let i = 0; i < 10; i++) {
                    const angle = (i * Math.PI) / 5 - Math.PI / 2
                    const r = i % 2 === 0 ? outerR : innerR
                    points.push(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
                  }
                  return points
                })()}
                closed
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                opacity={baseStyle.opacity}
              />
              {textElement}
            </>
          )
        case 'hexagon':
          return (
            <>
              <RegularPolygon
                x={node.size.width / 2}
                y={node.size.height / 2}
                sides={6}
                radius={Math.min(node.size.width, node.size.height) / 2}
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                shadowColor={baseStyle.shadowColor}
                shadowBlur={baseStyle.shadowBlur}
                shadowOffsetX={baseStyle.shadowOffsetX}
                shadowOffsetY={baseStyle.shadowOffsetY}
                opacity={baseStyle.opacity}
              />
              {textElement}
            </>
          )
        case 'cylinder':
          return (
            <>
              {/* Cylinder body */}
              <Rect
                x={0}
                y={node.size.height * 0.1}
                width={node.size.width}
                height={node.size.height * 0.8}
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                opacity={baseStyle.opacity}
              />
              {/* Top ellipse */}
              <Ellipse
                x={node.size.width / 2}
                y={node.size.height * 0.1}
                radiusX={node.size.width / 2}
                radiusY={node.size.height * 0.1}
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                opacity={baseStyle.opacity}
              />
              {/* Bottom ellipse (half visible) */}
              <Ellipse
                x={node.size.width / 2}
                y={node.size.height * 0.9}
                radiusX={node.size.width / 2}
                radiusY={node.size.height * 0.1}
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                opacity={baseStyle.opacity}
              />
              {textElement}
            </>
          )
        case 'cloud':
          return (
            <>
              <Line
                points={(() => {
                  const w = node.size.width
                  const h = node.size.height
                  // Simple cloud shape using bezier-like points
                  return [
                    w * 0.2, h * 0.6,
                    w * 0.1, h * 0.4,
                    w * 0.2, h * 0.25,
                    w * 0.35, h * 0.2,
                    w * 0.5, h * 0.15,
                    w * 0.65, h * 0.2,
                    w * 0.8, h * 0.25,
                    w * 0.9, h * 0.4,
                    w * 0.85, h * 0.6,
                    w * 0.7, h * 0.75,
                    w * 0.5, h * 0.8,
                    w * 0.3, h * 0.75,
                    w * 0.2, h * 0.6,
                  ]
                })()}
                closed
                tension={0.5}
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                opacity={baseStyle.opacity}
              />
              {textElement}
            </>
          )
        case 'callout':
          return (
            <>
              <Line
                points={[
                  0, 0,
                  node.size.width, 0,
                  node.size.width, node.size.height * 0.75,
                  node.size.width * 0.3, node.size.height * 0.75,
                  node.size.width * 0.15, node.size.height,
                  node.size.width * 0.25, node.size.height * 0.75,
                  0, node.size.height * 0.75,
                  0, 0,
                ]}
                closed
                fill={baseStyle.fill}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                opacity={baseStyle.opacity}
              />
              {textElement}
            </>
          )
        case 'note':
          return (
            <>
              {/* Note body with folded corner */}
              <Line
                points={[
                  0, 0,
                  node.size.width - 20, 0,
                  node.size.width, 20,
                  node.size.width, node.size.height,
                  0, node.size.height,
                  0, 0,
                ]}
                closed
                fill={baseStyle.fill || '#ffffa5'}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                opacity={baseStyle.opacity}
              />
              {/* Folded corner */}
              <Line
                points={[
                  node.size.width - 20, 0,
                  node.size.width - 20, 20,
                  node.size.width, 20,
                ]}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                opacity={baseStyle.opacity}
              />
              {textElement}
            </>
          )
        case 'container':
          return (
            <>
              {/* Container with header */}
              <Rect
                width={node.size.width}
                height={node.size.height}
                cornerRadius={4}
                fill={baseStyle.fill || 'rgba(200, 200, 200, 0.1)'}
                stroke={baseStyle.stroke}
                strokeWidth={baseStyle.strokeWidth}
                strokeDash={[5, 5]}
                opacity={baseStyle.opacity}
              />
              {/* Header bar */}
              <Rect
                width={node.size.width}
                height={30}
                cornerRadius={[4, 4, 0, 0]}
                fill={baseStyle.stroke || '#666'}
                opacity={0.3}
              />
              <Text
                x={8}
                y={6}
                text={node.text || 'Container'}
                fontSize={14}
                fontStyle="bold"
                fill={node.textStyle?.color || '#fff'}
              />
            </>
          )
        case 'freehand':
          // Parse path data back to points
          const pathPoints = node.pathData 
            ? node.pathData.split(',').map(Number) 
            : []
          return (
            <Line
              points={pathPoints}
              stroke={baseStyle.stroke || '#3b82f6'}
              strokeWidth={node.style.strokeWidth || 3}
              opacity={baseStyle.opacity}
              lineCap="round"
              lineJoin="round"
              tension={0.5}
              shadowColor={baseStyle.shadowColor}
              shadowBlur={baseStyle.shadowBlur}
            />
          )
        case 'image':
          // Get image from imageData
          return <ImageNodeContent node={node} baseStyle={baseStyle} />
        default:
          return null
      }
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
        {renderShape()}
      </Group>
    )
  }

  const renderEdge = (edge: DiagramEdge) => {
    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    
    if (!sourceNode || !targetNode) return null
    
    const sourcePos = getAnchorPosition(
      sourceNode.position.x,
      sourceNode.position.y,
      sourceNode.size.width,
      sourceNode.size.height,
      edge.sourceAnchor
    )
    
    const targetPos = getAnchorPosition(
      targetNode.position.x,
      targetNode.position.y,
      targetNode.size.width,
      targetNode.size.height,
      edge.targetAnchor
    )
    
    const points = [sourcePos.x, sourcePos.y, targetPos.x, targetPos.y]
    
    // Check if edge is selected
    const isSelected = selectedIds.includes(edge.id)
    
    // Modern edge styling - clean lines with subtle shadows
    const baseStrokeWidth = edge.style.strokeWidth || 2
    const strokeWidth = isSelected ? baseStrokeWidth + 1 : baseStrokeWidth
    const strokeColor = isSelected ? '#60a5fa' : (edge.style.stroke || '#64748b')
    
    // Common event handlers for edges
    const edgeHandlers = {
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true
        const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey
        if (metaPressed) {
          if (selectedIds.includes(edge.id)) {
            selectElements(selectedIds.filter(id => id !== edge.id))
          } else {
            selectElements([...selectedIds, edge.id])
          }
        } else {
          selectElements([edge.id])
        }
      },
      onMouseEnter: () => {
        const stage = stageRef.current
        if (stage) stage.container().style.cursor = 'pointer'
      },
      onMouseLeave: () => {
        const stage = stageRef.current
        if (stage) stage.container().style.cursor = 'default'
      },
    }
    
    // Dash patterns
    const getDashPattern = () => {
      if (edge.style.strokeStyle === 'dashed') return [8, 4]
      if (edge.style.strokeStyle === 'dotted') return [2, 4]
      return undefined
    }
    
    if (edge.arrowEnd === 'arrow' || edge.type === 'arrow') {
      return (
        <Arrow
          key={edge.id}
          points={points}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={1}
          fill={strokeColor}
          pointerLength={10}
          pointerWidth={8}
          lineCap="round"
          lineJoin="round"
          hitStrokeWidth={16}
          dash={getDashPattern()}
          shadowColor={isSelected ? '#3b82f6' : 'rgba(0,0,0,0.2)'}
          shadowBlur={isSelected ? 6 : 2}
          shadowOpacity={isSelected ? 0.6 : 0.3}
          shadowOffsetY={1}
          {...edgeHandlers}
        />
      )
    }
    
    return (
      <Line
        key={edge.id}
        points={points}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={1}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={16}
        dash={getDashPattern()}
        shadowColor={isSelected ? '#3b82f6' : 'rgba(0,0,0,0.2)'}
        shadowBlur={isSelected ? 6 : 2}
        shadowOpacity={isSelected ? 0.6 : 0.3}
        shadowOffsetY={1}
        {...edgeHandlers}
      />
    )
  }
  
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
  
  // Render anchor points - show ONLY when connection tool is active OR when creating connection
  // NOT on simple hover with select tool - this prevents conflict with dragging
  const renderAnchorPoints = (node: DiagramNode) => {
    // Only show anchors when:
    // 1. Creating a connection (show on all potential target nodes)
    // 2. Using line/arrow tool AND hovering over this node
    const isConnectionTool = currentTool === 'line' || currentTool === 'arrow'
    const isHoveredWithConnectionTool = hoveredNodeId === node.id && isConnectionTool
    const showAnchors = connectionState.isCreating || isHoveredWithConnectionTool
    
    if (!showAnchors) return null
    
    const anchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left']
    
    // Check if this node is the source
    const isSourceNode = connectionState.sourceId === node.id
    
    return anchors.map(anchor => {
      const pos = getAnchorPosition(
        node.position.x,
        node.position.y,
        node.size.width,
        node.size.height,
        anchor
      )
      
      const isSourceAnchor = isSourceNode && connectionState.sourceAnchor === anchor
      const isNearestTarget = nearestTarget?.nodeId === node.id && nearestTarget?.anchor === anchor
      
      // BIG hit areas for easy clicking
      const hitRadius = 20  // Large clickable area
      const visualRadius = isNearestTarget ? 12 : (isSourceAnchor ? 10 : 8)
      const innerSize = isNearestTarget ? 4 : 3
      
      // Color scheme: soft blue, green for source, cyan glow for target
      const outerColor = isNearestTarget ? '#22d3ee' : (isSourceAnchor ? '#4ade80' : 'rgba(96, 165, 250, 0.9)')
      const innerColor = '#ffffff'
      
      return (
        <Group key={`anchor-${node.id}-${anchor}`}>
          {/* Glow effect for source or target */}
          {(isNearestTarget || isSourceAnchor) && (
            <KonvaCircle
              x={pos.x}
              y={pos.y}
              radius={24}
              fill="transparent"
              stroke={isSourceAnchor ? '#4ade80' : '#22d3ee'}
              strokeWidth={2}
              opacity={0.6}
              dash={[4, 4]}
              listening={false}
            />
          )}
          {/* Large clickable hit area */}
          <KonvaCircle
            x={pos.x}
            y={pos.y}
            radius={hitRadius}
            fill="rgba(96, 165, 250, 0.1)"
            stroke="transparent"
            onClick={(e) => {
              e.cancelBubble = true
              
              if (!connectionState.isCreating) {
                // First click - set source
                setConnectionState({
                  isCreating: true,
                  sourceId: node.id,
                  sourceAnchor: anchor,
                  tempTargetPos: { x: pos.x, y: pos.y },
                })
              } else {
                // Second click - complete connection (if not same node)
                if (connectionState.sourceId !== node.id) {
                  const isLineTool = currentTool === 'line'
                  addEdge({
                    type: isLineTool ? 'line' : 'arrow',
                    source: connectionState.sourceId!,
                    target: node.id,
                    sourceAnchor: connectionState.sourceAnchor!,
                    targetAnchor: anchor,
                    arrowStart: 'none',
                    arrowEnd: isLineTool ? 'none' : 'arrow',
                  })
                }
                // Reset state
                setConnectionState({
                  isCreating: false,
                  sourceId: null,
                  sourceAnchor: null,
                  tempTargetPos: null,
                })
                setNearestTarget(null)
              }
            }}
            onMouseEnter={(e) => {
              e.cancelBubble = true
              const stage = e.target.getStage()
              if (stage) stage.container().style.cursor = 'crosshair'
              // Show as potential target when creating
              if (connectionState.isCreating && connectionState.sourceId !== node.id) {
                setNearestTarget({ nodeId: node.id, anchor })
              }
            }}
            onMouseLeave={(e) => {
              e.cancelBubble = true
              const stage = e.target.getStage()
              if (stage && !connectionState.isCreating) {
                stage.container().style.cursor = 'default'
              }
              // Clear target highlight
              if (nearestTarget?.nodeId === node.id && nearestTarget?.anchor === anchor) {
                setNearestTarget(null)
              }
            }}
          />
          {/* Visual outer ring */}
          <KonvaCircle
            x={pos.x}
            y={pos.y}
            radius={visualRadius}
            fill={outerColor}
            stroke={isNearestTarget ? '#ffffff' : 'rgba(255,255,255,0.8)'}
            strokeWidth={isNearestTarget ? 2.5 : 2}
            shadowColor={isNearestTarget ? '#22d3ee' : '#3b82f6'}
            shadowBlur={isNearestTarget ? 16 : 6}
            shadowOpacity={isNearestTarget ? 0.9 : 0.5}
            listening={false}
          />
          {/* Inner dot */}
          <KonvaCircle
            x={pos.x}
            y={pos.y}
            radius={innerSize}
            fill={innerColor}
            listening={false}
          />
        </Group>
      )
    })
  }

  const renderGrid = () => {
    if (!grid?.enabled) return null
    
    const gridLines = []
    const gridSize = grid.size
    const largeGridSize = gridSize * 5 // Every 5th line is stronger
    const startX = Math.floor(-pan.x / zoom / gridSize) * gridSize
    const startY = Math.floor(-pan.y / zoom / gridSize) * gridSize
    const endX = startX + width / zoom + gridSize * 2
    const endY = startY + height / zoom + gridSize * 2
    
    // Softer grid colors for modern look
    const minorOpacity = 0.15
    const majorOpacity = 0.25
    
    for (let x = startX; x < endX; x += gridSize) {
      const isMajor = x % largeGridSize === 0
      gridLines.push(
        <Line
          key={`v-${x}`}
          points={[x, startY, x, endY]}
          stroke={grid.color}
          strokeWidth={isMajor ? 1 : 0.5}
          opacity={isMajor ? majorOpacity : minorOpacity}
        />
      )
    }
    
    for (let y = startY; y < endY; y += gridSize) {
      const isMajor = y % largeGridSize === 0
      gridLines.push(
        <Line
          key={`h-${y}`}
          points={[startX, y, endX, y]}
          stroke={grid.color}
          strokeWidth={isMajor ? 1 : 0.5}
          opacity={isMajor ? majorOpacity : minorOpacity}
        />
      )
    }
    
    return gridLines
  }

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
        {renderGrid()}
      </Layer>
      <Layer>
        {edges.map(renderEdge)}
        {nodes.map(renderNode)}
        {nodes.map(renderAnchorPoints)}
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
        <div
          className="fixed bg-popover border rounded-xl shadow-xl py-2 z-50 min-w-[220px]"
          style={{ 
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Edit section */}
          <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Редактирование</div>
          
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
            onClick={() => {
              // Duplicate node
              addNode({
                ...node,
                id: undefined,
                position: { x: node.position.x + 20, y: node.position.y + 20 },
              })
              setContextMenu(null)
            }}
          >
            <Copy size={16} className="text-muted-foreground" />
            Дублировать
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+D</span>
          </button>
          
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(node))
              setContextMenu(null)
            }}
          >
            <Clipboard size={16} className="text-muted-foreground" />
            Копировать
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+C</span>
          </button>
          
          <div className="h-px bg-border my-1 mx-2" />
          
          {/* View section */}
          <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Вид</div>
          
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
            onClick={() => {
              updateNode(node.id, { visible: !node.visible })
              setContextMenu(null)
            }}
          >
            {node.visible ? (
              <>
                <EyeOff size={16} className="text-muted-foreground" />
                Скрыть
              </>
            ) : (
              <>
                <Eye size={16} className="text-muted-foreground" />
                Показать
              </>
            )}
          </button>
          
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
            onClick={() => {
              updateNode(node.id, { locked: !node.locked })
              setContextMenu(null)
            }}
          >
            {node.locked ? (
              <>
                <Unlock size={16} className="text-muted-foreground" />
                Разблокировать
              </>
            ) : (
              <>
                <Lock size={16} className="text-muted-foreground" />
                Заблокировать
              </>
            )}
          </button>
          
          <div className="h-px bg-border my-1 mx-2" />
          
          {/* Order section */}
          <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Порядок</div>
          
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
            onClick={() => {
              updateNode(node.id, { zIndex: (node.zIndex || 0) + 1 })
              setContextMenu(null)
            }}
          >
            <ArrowUp size={16} className="text-muted-foreground" />
            На передний план
          </button>
          
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
            onClick={() => {
              updateNode(node.id, { zIndex: Math.max(0, (node.zIndex || 0) - 1) })
              setContextMenu(null)
            }}
          >
            <ArrowDown size={16} className="text-muted-foreground" />
            На задний план
          </button>
          
          <div className="h-px bg-border my-1 mx-2" />
          
          {/* Import section */}
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
            onClick={() => {
              const event = new CustomEvent('importIntoNode', { detail: { nodeId: contextMenu.nodeId } })
              window.dispatchEvent(event)
              setContextMenu(null)
            }}
          >
            <Layers size={16} className="text-muted-foreground" />
            Импорт в объект
          </button>
          
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
            onClick={() => {
              const event = new CustomEvent('openInspector', { detail: { nodeId: contextMenu.nodeId } })
              window.dispatchEvent(event)
              setContextMenu(null)
            }}
          >
            <Palette size={16} className="text-muted-foreground" />
            Настройки стиля
          </button>
          
          <div className="h-px bg-border my-1 mx-2" />
          
          {/* Delete section */}
          <button
            className="w-full px-4 py-2 text-sm text-left hover:bg-destructive/10 flex items-center gap-3 text-destructive transition-colors"
            onClick={() => {
              deleteNode(contextMenu.nodeId)
              setContextMenu(null)
            }}
          >
            <Trash2 size={16} />
            Удалить
            <span className="ml-auto text-xs">Del</span>
          </button>
        </div>
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
