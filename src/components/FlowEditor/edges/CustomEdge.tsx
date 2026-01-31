import { useState, useCallback, useRef, useEffect } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  type Position,
} from '@xyflow/react'
import { useGraphStore, type CustomEdgeData } from '@/stores/graphStore'
import { cn } from '@/utils'

// Пропсы для кастомного edge
interface CustomEdgeProps {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  selected?: boolean
  data?: CustomEdgeData
  style?: React.CSSProperties
  markerEnd?: string
  markerStart?: string
}

/**
 * CustomEdge - Кастомный компонент связи с поддержкой лейблов
 * 
 * Особенности:
 * - Редактируемый лейбл по двойному клику
 * - Разные стили линий (solid, dashed, dotted)
 * - Анимация для определенных связей
 * - Позиционирование лейбла по центру связи
 */
export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
  style,
  markerEnd,
  markerStart,
}: CustomEdgeProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [labelText, setLabelText] = useState(data?.label || '')
  const inputRef = useRef<HTMLInputElement>(null)
  
  const updateEdge = useGraphStore(state => state.updateEdge)
  
  // Calculate path based on edge type
  const edgeType = data?.edgeType || 'smoothstep'
  
  let edgePath: string
  let labelX: number
  let labelY: number
  
  if (edgeType === 'straight') {
    const [path, lx, ly] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    })
    edgePath = path
    labelX = lx
    labelY = ly
  } else if (edgeType === 'bezier') {
    const [path, lx, ly] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    })
    edgePath = path
    labelX = lx
    labelY = ly
  } else {
    // Default: smoothstep
    const [path, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    })
    edgePath = path
    labelX = lx
    labelY = ly
  }
  
  // Handle double click to edit label
  const handleDoubleClick = useCallback(() => {
    setIsEditing(true)
  }, [])
  
  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])
  
  // Handle label change
  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLabelText(e.target.value)
  }, [])
  
  // Handle blur - save label
  const handleBlur = useCallback(() => {
    setIsEditing(false)
    updateEdge(id, { data: { label: labelText } })
  }, [id, labelText, updateEdge])
  
  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur()
    }
    if (e.key === 'Escape') {
      setLabelText(data?.label || '')
      setIsEditing(false)
    }
  }, [handleBlur, data?.label])
  
  // Build stroke dasharray for dashed/dotted styles
  const strokeDasharray = data?.strokeStyle === 'dashed' ? '8 4' : 
                          data?.strokeStyle === 'dotted' ? '2 2' : 
                          undefined
  
  const edgeStyle = {
    ...style,
    strokeDasharray,
  }
  
  // Determine stroke color
  const strokeColor = selected ? '#3b82f6' : (style?.stroke as string) || '#64748b'
  
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...edgeStyle,
          stroke: strokeColor,
          strokeWidth: selected ? 3 : (style?.strokeWidth as number) || 2,
        }}
        markerEnd={markerEnd}
        markerStart={markerStart}
        className={cn(
          'transition-all duration-150',
          data?.animated && 'animated-edge'
        )}
      />
      
      {/* Edge Label */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
          onDoubleClick={handleDoubleClick}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={labelText}
              onChange={handleLabelChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={cn(
                'px-2 py-0.5 text-xs rounded border-2 border-primary',
                'bg-background text-foreground',
                'outline-none min-w-[60px] text-center'
              )}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            (data?.label || selected) && (
              <div
                className={cn(
                  'px-2 py-0.5 text-xs rounded',
                  'bg-background/95 backdrop-blur-sm',
                  'border shadow-sm',
                  selected ? 'border-primary text-foreground' : 'border-border text-muted-foreground',
                  'cursor-pointer hover:bg-muted/50 transition-colors',
                  !data?.label && 'opacity-50 border-dashed'
                )}
              >
                {data?.label || 'Добавить текст'}
              </div>
            )
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
