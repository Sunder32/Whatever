import React, { memo, useMemo, useCallback, useRef } from 'react'
import { useDiagramStore } from '@/stores'
import { cn } from '@/utils'

interface MiniMapProps {
  width?: number
  height?: number
  className?: string
}

export const MiniMap = memo(function MiniMap({ 
  width = 200, 
  height = 150,
  className 
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const file = useDiagramStore(state => state.file)
  const setPan = useDiagramStore(state => state.setPan)
  
  const nodes = file?.content.nodes ?? []
  const canvasState = file?.canvasState
  const zoom = canvasState?.zoom ?? 1
  const pan = canvasState?.pan ?? { x: 0, y: 0 }
  
  // Calculate bounding box of all nodes
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 800 }
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    nodes.forEach(node => {
      minX = Math.min(minX, node.position.x)
      minY = Math.min(minY, node.position.y)
      maxX = Math.max(maxX, node.position.x + node.size.width)
      maxY = Math.max(maxY, node.position.y + node.size.height)
    })
    
    // Add padding
    const padding = 100
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    }
  }, [nodes])
  
  // Calculate scale to fit all content
  const scale = useMemo(() => {
    const contentWidth = bounds.maxX - bounds.minX
    const contentHeight = bounds.maxY - bounds.minY
    
    return Math.min(width / contentWidth, height / contentHeight)
  }, [bounds, width, height])
  
  // Calculate viewport rectangle
  const viewportRect = useMemo(() => {
    const viewportWidth = window.innerWidth / zoom
    const viewportHeight = window.innerHeight / zoom
    
    const viewportX = -pan.x / zoom
    const viewportY = -pan.y / zoom
    
    return {
      x: (viewportX - bounds.minX) * scale,
      y: (viewportY - bounds.minY) * scale,
      width: viewportWidth * scale,
      height: viewportHeight * scale
    }
  }, [pan, zoom, bounds, scale])
  
  // Handle click to navigate
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    
    // Convert click position to canvas coordinates
    const canvasX = clickX / scale + bounds.minX
    const canvasY = clickY / scale + bounds.minY
    
    // Center the view on the clicked point
    const newPanX = -canvasX * zoom + window.innerWidth / 2
    const newPanY = -canvasY * zoom + window.innerHeight / 2
    
    setPan({ x: newPanX, y: newPanY })
  }, [scale, bounds, zoom, setPan])
  
  // Don't render if no nodes
  if (nodes.length === 0) return null
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        "bg-card/90 backdrop-blur-md rounded-xl border border-border/50 shadow-lg overflow-hidden cursor-crosshair",
        className
      )}
      style={{ width, height }}
      onClick={handleClick}
    >
      <svg width={width} height={height}>
        {/* Grid pattern */}
        <defs>
          <pattern id="minimap-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#minimap-grid)" />
        
        {/* Nodes */}
        {nodes.map(node => {
          const x = (node.position.x - bounds.minX) * scale
          const y = (node.position.y - bounds.minY) * scale
          const w = Math.max(2, node.size.width * scale)
          const h = Math.max(2, node.size.height * scale)
          
          let fill = '#60a5fa'
          if (node.type === 'note') fill = '#fbbf24'
          else if (node.type === 'container') fill = '#34d399'
          else if (node.type === 'ellipse') fill = '#a78bfa'
          else if (node.type === 'diamond') fill = '#f472b6'
          
          return (
            <rect
              key={node.id}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={2}
              fill={fill}
              opacity={0.8}
            />
          )
        })}
        
        {/* Viewport indicator */}
        <rect
          x={Math.max(0, viewportRect.x)}
          y={Math.max(0, viewportRect.y)}
          width={Math.min(viewportRect.width, width - Math.max(0, viewportRect.x))}
          height={Math.min(viewportRect.height, height - Math.max(0, viewportRect.y))}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="#3b82f6"
          strokeWidth="2"
          rx="4"
        />
      </svg>
    </div>
  )
})
