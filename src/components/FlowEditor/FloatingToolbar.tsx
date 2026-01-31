import { memo, useCallback, useRef, useState } from 'react'
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'
import { 
  MousePointer2, 
  Hand, 
  Square, 
  Circle, 
  Diamond, 
  Triangle,
  Star,
  Hexagon,
  Cloud,
  MessageSquare,
  StickyNote,
  Box,
  Image,
  Pencil,
  Minus,
  ArrowRight,
  Type,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Undo2,
  Redo2,
  Trash2,
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Download,
  FileImage,
  FileCode
} from 'lucide-react'
import { useAppStore } from '@/stores'
import { useGraphStore } from '@/stores/graphStore'
import { useSelectionStore } from '@/stores/selectionStore'
import type { Tool } from '@/types'
import { cn } from '@/utils'

/**
 * FloatingToolbar - Плавающая панель инструментов (как в Figma/Miro)
 * 
 * Расположена внизу по центру экрана
 * Группирует инструменты логически
 * Показывает активный инструмент
 */

interface ToolButtonProps {
  tool: Tool
  icon: React.ReactNode
  label: string
  shortcut?: string
  isActive: boolean
  onClick: () => void
}

const ToolButton = memo(function ToolButton({ 
  icon, 
  label, 
  shortcut, 
  isActive, 
  onClick 
}: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150',
        'hover:bg-accent/80 active:scale-95',
        isActive && 'bg-primary text-primary-foreground shadow-md'
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {icon}
      {/* Tooltip - показываем снизу */}
      <span className={cn(
        'absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1',
        'text-xs font-medium bg-popover text-popover-foreground rounded-md shadow-lg',
        'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50'
      )}>
        {label}
        {shortcut && <span className="ml-1 text-muted-foreground">({shortcut})</span>}
      </span>
    </button>
  )
})

const Divider = () => (
  <div className="w-px h-6 bg-border/50 mx-1" />
)

export const FloatingToolbar = memo(function FloatingToolbar() {
  const { zoomIn, zoomOut, fitView, getZoom, screenToFlowPosition, getNodes } = useReactFlow()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  
  // App store
  const currentTool = useAppStore(state => state.currentTool)
  const setCurrentTool = useAppStore(state => state.setCurrentTool)
  
  // Graph store
  const gridEnabled = useGraphStore(state => state.gridEnabled)
  const setGridEnabled = useGraphStore(state => state.setGridEnabled)
  const undo = useGraphStore(state => state.undo)
  const redo = useGraphStore(state => state.redo)
  const canUndo = useGraphStore(state => state.canUndo)
  const canRedo = useGraphStore(state => state.canRedo)
  const deleteNodes = useGraphStore(state => state.deleteNodes)
  const deleteEdges = useGraphStore(state => state.deleteEdges)
  const addNode = useGraphStore(state => state.addNode)
  const alignNodes = useGraphStore(state => state.alignNodes)
  
  // Selection store
  const selectedNodeIds = useSelectionStore(state => state.selectedNodeIds)
  const selectedEdgeIds = useSelectionStore(state => state.selectedEdgeIds)
  const clearSelection = useSelectionStore(state => state.clearSelection)
  const hasSelection = useSelectionStore(state => state.hasSelection)
  const selectNodes = useSelectionStore(state => state.selectNodes)
  
  // Handle image file selection
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const imageData = event.target?.result as string
      
      // Create image node at center of viewport
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      
      const nodeId = addNode('image', position, {
        label: file.name,
        imageData,
      })
      
      selectNodes([nodeId])
      setCurrentTool('select')
    }
    reader.readAsDataURL(file)
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [screenToFlowPosition, addNode, selectNodes, setCurrentTool])
  
  const handleToolClick = useCallback((tool: Tool) => {
    // Special handling for image tool
    if (tool === 'image') {
      fileInputRef.current?.click()
      return
    }
    setCurrentTool(tool)
  }, [setCurrentTool])
  
  const handleDelete = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      deleteNodes(selectedNodeIds)
    }
    if (selectedEdgeIds.length > 0) {
      deleteEdges(selectedEdgeIds)
    }
    clearSelection()
  }, [selectedNodeIds, selectedEdgeIds, deleteNodes, deleteEdges, clearSelection])
  
  const handleZoomIn = useCallback(() => zoomIn({ duration: 200 }), [zoomIn])
  const handleZoomOut = useCallback(() => zoomOut({ duration: 200 }), [zoomOut])
  const handleFitView = useCallback(() => fitView({ padding: 0.2, duration: 300 }), [fitView])
  const handleToggleGrid = useCallback(() => setGridEnabled(!gridEnabled), [gridEnabled, setGridEnabled])
  
  // Export functions
  const handleExport = useCallback(async (format: 'png' | 'svg') => {
    setShowExportMenu(false)
    
    const nodes = getNodes()
    if (nodes.length === 0) return
    
    // Get the flow element
    const flowElement = document.querySelector('.react-flow') as HTMLElement
    if (!flowElement) return
    
    // Calculate bounds with padding
    const nodesBounds = getNodesBounds(nodes)
    const padding = 50
    const width = nodesBounds.width + padding * 2
    const height = nodesBounds.height + padding * 2
    
    // Get viewport that fits all nodes
    const viewport = getViewportForBounds(
      nodesBounds,
      width,
      height,
      0.5,
      2,
      padding
    )
    
    try {
      let dataUrl: string
      
      if (format === 'png') {
        dataUrl = await toPng(flowElement, {
          backgroundColor: '#1a1a1a',
          width,
          height,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          },
        })
      } else {
        dataUrl = await toSvg(flowElement, {
          backgroundColor: '#1a1a1a',
          width,
          height,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          },
        })
      }
      
      // Download the file
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `diagram.${format}`
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }, [getNodes])
  
  const zoom = Math.round(getZoom() * 100)
  
  const tools: { tool: Tool; icon: React.ReactNode; label: string; shortcut?: string }[] = [
    // Navigation
    { tool: 'select', icon: <MousePointer2 size={18} />, label: 'Выделение', shortcut: 'V' },
    { tool: 'pan', icon: <Hand size={18} />, label: 'Перемещение', shortcut: 'H' },
  ]
  
  const shapes: { tool: Tool; icon: React.ReactNode; label: string; shortcut?: string }[] = [
    { tool: 'rectangle', icon: <Square size={18} />, label: 'Прямоугольник', shortcut: 'R' },
    { tool: 'ellipse', icon: <Circle size={18} />, label: 'Эллипс', shortcut: 'O' },
    { tool: 'diamond', icon: <Diamond size={18} />, label: 'Ромб', shortcut: 'D' },
    { tool: 'triangle', icon: <Triangle size={18} />, label: 'Треугольник' },
    { tool: 'star', icon: <Star size={18} />, label: 'Звезда' },
    { tool: 'hexagon', icon: <Hexagon size={18} />, label: 'Шестиугольник' },
  ]
  
  const special: { tool: Tool; icon: React.ReactNode; label: string; shortcut?: string }[] = [
    { tool: 'cloud', icon: <Cloud size={18} />, label: 'Облако' },
    { tool: 'callout', icon: <MessageSquare size={18} />, label: 'Сноска' },
    { tool: 'note', icon: <StickyNote size={18} />, label: 'Заметка', shortcut: 'N' },
    { tool: 'container', icon: <Box size={18} />, label: 'Контейнер', shortcut: 'C' },
    { tool: 'image', icon: <Image size={18} />, label: 'Изображение', shortcut: 'I' },
    { tool: 'freehand', icon: <Pencil size={18} />, label: 'Рисование', shortcut: 'P' },
  ]
  
  const connections: { tool: Tool; icon: React.ReactNode; label: string; shortcut?: string }[] = [
    { tool: 'line', icon: <Minus size={18} />, label: 'Линия', shortcut: 'L' },
    { tool: 'arrow', icon: <ArrowRight size={18} />, label: 'Стрелка', shortcut: 'A' },
    { tool: 'text', icon: <Type size={18} />, label: 'Текст', shortcut: 'T' },
  ]
  
  return (
    <>
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      
      <div className="flex items-center gap-1 px-3 py-2 mt-4 bg-card/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-xl">
        {/* Navigation tools */}
        {tools.map(({ tool, icon, label, shortcut }) => (
          <ToolButton
            key={tool}
            tool={tool}
            icon={icon}
            label={label}
            shortcut={shortcut}
            isActive={currentTool === tool}
          onClick={() => handleToolClick(tool)}
        />
      ))}
      
      <Divider />
      
      {/* Basic shapes */}
      {shapes.map(({ tool, icon, label, shortcut }) => (
        <ToolButton
          key={tool}
          tool={tool}
          icon={icon}
          label={label}
          shortcut={shortcut}
          isActive={currentTool === tool}
          onClick={() => handleToolClick(tool)}
        />
      ))}
      
      <Divider />
      
      {/* Special shapes */}
      {special.map(({ tool, icon, label, shortcut }) => (
        <ToolButton
          key={tool}
          tool={tool}
          icon={icon}
          label={label}
          shortcut={shortcut}
          isActive={currentTool === tool}
          onClick={() => handleToolClick(tool)}
        />
      ))}
      
      <Divider />
      
      {/* Connections & text */}
      {connections.map(({ tool, icon, label, shortcut }) => (
        <ToolButton
          key={tool}
          tool={tool}
          icon={icon}
          label={label}
          shortcut={shortcut}
          isActive={currentTool === tool}
          onClick={() => handleToolClick(tool)}
        />
      ))}
      
      <Divider />
      
      {/* Alignment (показываем только при множественном выделении) */}
      {selectedNodeIds.length >= 2 && (
        <>
          <button
            onClick={() => alignNodes(selectedNodeIds, 'left')}
            className="flex items-center justify-center w-8 h-10 rounded-lg hover:bg-accent/80 transition-all"
            title="Выровнять по левому краю"
          >
            <AlignLeft size={16} />
          </button>
          <button
            onClick={() => alignNodes(selectedNodeIds, 'center')}
            className="flex items-center justify-center w-8 h-10 rounded-lg hover:bg-accent/80 transition-all"
            title="Выровнять по центру (горизонтально)"
          >
            <AlignCenterHorizontal size={16} />
          </button>
          <button
            onClick={() => alignNodes(selectedNodeIds, 'right')}
            className="flex items-center justify-center w-8 h-10 rounded-lg hover:bg-accent/80 transition-all"
            title="Выровнять по правому краю"
          >
            <AlignRight size={16} />
          </button>
          <button
            onClick={() => alignNodes(selectedNodeIds, 'top')}
            className="flex items-center justify-center w-8 h-10 rounded-lg hover:bg-accent/80 transition-all"
            title="Выровнять по верхнему краю"
          >
            <AlignStartVertical size={16} />
          </button>
          <button
            onClick={() => alignNodes(selectedNodeIds, 'middle')}
            className="flex items-center justify-center w-8 h-10 rounded-lg hover:bg-accent/80 transition-all"
            title="Выровнять по центру (вертикально)"
          >
            <AlignCenterVertical size={16} />
          </button>
          <button
            onClick={() => alignNodes(selectedNodeIds, 'bottom')}
            className="flex items-center justify-center w-8 h-10 rounded-lg hover:bg-accent/80 transition-all"
            title="Выровнять по нижнему краю"
          >
            <AlignEndVertical size={16} />
          </button>
          <Divider />
        </>
      )}
      
      {/* Actions */}
      <button
        onClick={undo}
        disabled={!canUndo()}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-lg transition-all',
          'hover:bg-accent/80 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed'
        )}
        title="Отменить (Ctrl+Z)"
      >
        <Undo2 size={18} />
      </button>
      
      <button
        onClick={redo}
        disabled={!canRedo()}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-lg transition-all',
          'hover:bg-accent/80 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed'
        )}
        title="Повторить (Ctrl+Y)"
      >
        <Redo2 size={18} />
      </button>
      
      <button
        onClick={handleDelete}
        disabled={!hasSelection()}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-lg transition-all',
          'hover:bg-red-500/20 hover:text-red-500 active:scale-95',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
        title="Удалить (Delete)"
      >
        <Trash2 size={18} />
      </button>
      
      <Divider />
      
      {/* Zoom controls */}
      <button
        onClick={handleZoomOut}
        className="flex items-center justify-center w-8 h-10 rounded-lg hover:bg-accent/80 transition-all"
        title="Уменьшить"
      >
        <ZoomOut size={16} />
      </button>
      
      <span className="text-sm font-medium text-muted-foreground min-w-[48px] text-center">
        {zoom}%
      </span>
      
      <button
        onClick={handleZoomIn}
        className="flex items-center justify-center w-8 h-10 rounded-lg hover:bg-accent/80 transition-all"
        title="Увеличить"
      >
        <ZoomIn size={16} />
      </button>
      
      <button
        onClick={handleFitView}
        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent/80 transition-all"
        title="Вписать в экран (Ctrl+F)"
      >
        <Maximize2 size={18} />
      </button>
      
      <button
        onClick={handleToggleGrid}
        className={cn(
          'flex items-center justify-center w-10 h-10 rounded-lg transition-all',
          'hover:bg-accent/80',
          gridEnabled && 'bg-accent text-accent-foreground'
        )}
        title="Сетка"
      >
        <Grid3X3 size={18} />
      </button>
      
      <Divider />
      
      {/* Export menu */}
      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg transition-all',
            'hover:bg-accent/80 active:scale-95',
            showExportMenu && 'bg-accent'
          )}
          title="Экспорт"
        >
          <Download size={18} />
        </button>
        
        {showExportMenu && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 py-1 px-1 bg-card border border-border rounded-lg shadow-xl min-w-[120px]">
            <button
              onClick={() => handleExport('png')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <FileImage size={16} />
              PNG
            </button>
            <button
              onClick={() => handleExport('svg')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
            >
              <FileCode size={16} />
              SVG
            </button>
          </div>
        )}
      </div>
      </div>
    </>
  )
})
