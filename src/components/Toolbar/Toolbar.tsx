import React, { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  MousePointer2, 
  Hand, 
  Square, 
  Circle, 
  Diamond, 
  Triangle, 
  Minus, 
  ArrowRight,
  Type,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Star,
  Hexagon,
  Cloud,
  MessageSquare,
  StickyNote,
  Box,
  Image,
  Pencil,
  ChevronUp,
  ChevronDown,
  RotateCcw
} from 'lucide-react'
import { useAppStore, useDiagramStore } from '@/stores'
import type { Tool } from '@/types'
import { cn } from '@/utils'

interface ToolButtonProps {
  tool: Tool
  icon: React.ReactNode
  label: string
  shortcut?: string
}

// Memoized tool button to prevent re-renders
const ToolButton = memo(function ToolButton({ tool, icon, label, shortcut }: ToolButtonProps) {
  const currentTool = useAppStore(state => state.currentTool)
  const setCurrentTool = useAppStore(state => state.setCurrentTool)
  
  const isActive = currentTool === tool
  
  const handleClick = useCallback(() => {
    setCurrentTool(tool)
  }, [setCurrentTool, tool])
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        'group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200',
        'hover:bg-accent hover:scale-105',
        'active:scale-95',
        isActive && 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary/30'
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      {icon}
      {/* Tooltip on hover */}
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium bg-popover text-popover-foreground rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {label}{shortcut && <span className="ml-1 text-muted-foreground">({shortcut})</span>}
      </span>
    </button>
  )
})

// Memoized tool group
const ToolGroup = memo(function ToolGroup({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-1 px-2 py-2 rounded-2xl bg-muted/50 border border-border/50",
      className
    )}>
      {children}
    </div>
  )
})

export const Toolbar = memo(function Toolbar() {
  const { t } = useTranslation()
  const file = useDiagramStore(state => state.file)
  const setZoom = useDiagramStore(state => state.setZoom)
  const setPan = useDiagramStore(state => state.setPan)
  const updateCanvasState = useDiagramStore(state => state.updateCanvasState)
  const panelVisibility = useAppStore(state => state.panelVisibility)
  const togglePanel = useAppStore(state => state.togglePanel)
  
  const zoom = file?.canvasState.zoom ?? 1
  const grid = file?.canvasState.grid
  
  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(4, zoom * 1.2))
  }, [setZoom, zoom])
  
  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(0.1, zoom / 1.2))
  }, [setZoom, zoom])
  
  const handleZoomReset = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [setZoom, setPan])
  
  const handleToggleGrid = useCallback(() => {
    if (grid) {
      updateCanvasState({
        grid: { ...grid, enabled: !grid.enabled }
      })
    }
  }, [grid, updateCanvasState])
  
  const handleToggleToolbar = useCallback(() => {
    togglePanel('toolbar')
  }, [togglePanel])
  
  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom])
  
  // Collapsed state - minimal bar with expand button
  if (!panelVisibility.toolbar) {
    return (
      <div className="flex items-center justify-center px-4 py-2 bg-card/80 backdrop-blur-md border-b border-border/50">
        <button
          onClick={handleToggleToolbar}
          className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-accent transition-all text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown size={18} />
          Показать инструменты
        </button>
      </div>
    )
  }
  
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card/80 backdrop-blur-md border-b border-border/50">
      {/* Collapse button */}
      <button
        onClick={handleToggleToolbar}
        className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-accent transition-all"
        title="Скрыть панель инструментов"
      >
        <ChevronUp size={20} />
      </button>
      
      {/* Divider */}
      <div className="w-px h-8 bg-border" />
      
      {/* Navigation tools */}
      <ToolGroup>
        <ToolButton tool="select" icon={<MousePointer2 size={24} />} label={t('toolbar.select')} shortcut="V" />
        <ToolButton tool="pan" icon={<Hand size={24} />} label={t('toolbar.pan')} shortcut="H" />
      </ToolGroup>
      
      {/* Shape tools - Basic */}
      <ToolGroup>
        <ToolButton tool="rectangle" icon={<Square size={24} />} label={t('toolbar.rectangle')} shortcut="R" />
        <ToolButton tool="ellipse" icon={<Circle size={24} />} label={t('toolbar.ellipse')} shortcut="E" />
        <ToolButton tool="diamond" icon={<Diamond size={24} />} label={t('toolbar.diamond')} shortcut="D" />
        <ToolButton tool="triangle" icon={<Triangle size={24} />} label={t('toolbar.triangle')} />
      </ToolGroup>
      
      {/* Shape tools - Advanced */}
      <ToolGroup>
        <ToolButton tool="star" icon={<Star size={24} />} label="Звезда" shortcut="S" />
        <ToolButton tool="hexagon" icon={<Hexagon size={24} />} label="Шестиугольник" />
        <ToolButton tool="cloud" icon={<Cloud size={24} />} label="Облако" />
        <ToolButton tool="callout" icon={<MessageSquare size={24} />} label="Сноска" />
      </ToolGroup>
      
      {/* Special tools */}
      <ToolGroup>
        <ToolButton tool="note" icon={<StickyNote size={24} />} label="Заметка" shortcut="N" />
        <ToolButton tool="container" icon={<Box size={24} />} label="Контейнер" shortcut="C" />
        <ToolButton tool="image" icon={<Image size={24} />} label="Изображение" shortcut="I" />
        <ToolButton tool="freehand" icon={<Pencil size={24} />} label="Рисование" shortcut="P" />
      </ToolGroup>
      
      {/* Connection tools */}
      <ToolGroup>
        <ToolButton tool="line" icon={<Minus size={24} />} label={t('toolbar.line')} shortcut="L" />
        <ToolButton tool="arrow" icon={<ArrowRight size={24} />} label={t('toolbar.arrow')} shortcut="A" />
      </ToolGroup>
      
      {/* Text tool */}
      <ToolGroup>
        <ToolButton tool="text" icon={<Type size={24} />} label={t('toolbar.text')} shortcut="T" />
      </ToolGroup>
      
      <div className="flex-1" />
      
      {/* Zoom controls */}
      <ToolGroup className="gap-2">
        <button
          onClick={handleZoomOut}
          className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-accent transition-all"
          title={t('toolbar.zoomOut')}
        >
          <ZoomOut size={22} />
        </button>
        
        <button
          onClick={handleZoomReset}
          className="min-w-[60px] px-3 py-2 text-sm font-semibold text-center rounded-lg hover:bg-accent transition-all tabular-nums"
          title="Сбросить масштаб (Ctrl+0)"
        >
          {zoomPercent}%
        </button>
        
        <button
          onClick={handleZoomIn}
          className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-accent transition-all"
          title={t('toolbar.zoomIn')}
        >
          <ZoomIn size={22} />
        </button>
        
        <div className="w-px h-6 bg-border mx-1" />
        
        <button
          onClick={handleZoomReset}
          className="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-accent transition-all"
          title="Сбросить вид (Ctrl+0)"
        >
          <RotateCcw size={20} />
        </button>
        
        <button
          onClick={handleToggleGrid}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl transition-all',
            grid?.enabled 
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' 
              : 'hover:bg-accent'
          )}
          title={t('toolbar.toggleGrid')}
        >
          <Grid3X3 size={22} />
        </button>
      </ToolGroup>
    </div>
  )
})
