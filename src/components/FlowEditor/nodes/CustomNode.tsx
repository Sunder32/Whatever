import { memo, useCallback, useState, useEffect, useRef } from 'react'
import { Handle, Position, NodeProps, useReactFlow, NodeResizer } from '@xyflow/react'
import { cn } from '@/utils'
import { useSelectionStore } from '@/stores/selectionStore'
import { useGraphStore, type CustomNodeData, type FlowNode } from '@/stores/graphStore'

/**
 * Базовый кастомный узел для React Flow
 * Поддерживает все типы фигур через CSS/SVG
 * + NodeResizer для изменения размеров
 * + Правильное сохранение текста
 */

interface BaseNodeProps extends NodeProps<FlowNode> {
  data: CustomNodeData
}

// SVG пути для разных форм
const shapeComponents: Record<string, React.FC<{ data: CustomNodeData; width: number; height: number }>> = {
  rectangle: ({ data, width, height }) => (
    <rect
      width={width}
      height={height}
      fill={data.fill}
      stroke={data.stroke}
      strokeWidth={data.strokeWidth}
      rx={data.cornerRadius}
      ry={data.cornerRadius}
      opacity={data.opacity}
    />
  ),
  ellipse: ({ data, width, height }) => (
    <ellipse
      cx={width / 2}
      cy={height / 2}
      rx={width / 2 - data.strokeWidth}
      ry={height / 2 - data.strokeWidth}
      fill={data.fill}
      stroke={data.stroke}
      strokeWidth={data.strokeWidth}
      opacity={data.opacity}
    />
  ),
  diamond: ({ data, width, height }) => (
    <polygon
      points={`${width/2},0 ${width},${height/2} ${width/2},${height} 0,${height/2}`}
      fill={data.fill}
      stroke={data.stroke}
      strokeWidth={data.strokeWidth}
      opacity={data.opacity}
    />
  ),
  triangle: ({ data, width, height }) => (
    <polygon
      points={`${width/2},0 ${width},${height} 0,${height}`}
      fill={data.fill}
      stroke={data.stroke}
      strokeWidth={data.strokeWidth}
      opacity={data.opacity}
    />
  ),
  star: ({ data, width, height }) => {
    const cx = width / 2
    const cy = height / 2
    const outerR = Math.min(width, height) / 2 - data.strokeWidth
    const innerR = outerR * 0.4
    const points: string[] = []
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR
      const angle = (Math.PI / 5) * i - Math.PI / 2
      points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
    }
    return (
      <polygon
        points={points.join(' ')}
        fill={data.fill}
        stroke={data.stroke}
        strokeWidth={data.strokeWidth}
        opacity={data.opacity}
      />
    )
  },
  hexagon: ({ data, width, height }) => {
    const cx = width / 2
    const cy = height / 2
    const r = Math.min(width, height) / 2 - data.strokeWidth
    const points: string[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6
      points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
    }
    return (
      <polygon
        points={points.join(' ')}
        fill={data.fill}
        stroke={data.stroke}
        strokeWidth={data.strokeWidth}
        opacity={data.opacity}
      />
    )
  },
  cylinder: ({ data, width, height }) => {
    const ellipseHeight = height * 0.15
    return (
      <g opacity={data.opacity}>
        {/* Body */}
        <rect
          x={data.strokeWidth / 2}
          y={ellipseHeight / 2}
          width={width - data.strokeWidth}
          height={height - ellipseHeight}
          fill={data.fill}
          stroke={data.stroke}
          strokeWidth={data.strokeWidth}
        />
        {/* Top ellipse */}
        <ellipse
          cx={width / 2}
          cy={ellipseHeight / 2 + data.strokeWidth}
          rx={width / 2 - data.strokeWidth}
          ry={ellipseHeight / 2}
          fill={data.fill}
          stroke={data.stroke}
          strokeWidth={data.strokeWidth}
        />
        {/* Bottom ellipse */}
        <ellipse
          cx={width / 2}
          cy={height - ellipseHeight / 2 - data.strokeWidth}
          rx={width / 2 - data.strokeWidth}
          ry={ellipseHeight / 2}
          fill={data.fill}
          stroke={data.stroke}
          strokeWidth={data.strokeWidth}
        />
      </g>
    )
  },
  cloud: ({ data, width, height }) => {
    // Упрощённое облако через path
    const w = width
    const h = height
    return (
      <path
        d={`M${w*0.2},${h*0.7} 
            Q${w*0.05},${h*0.7} ${w*0.05},${h*0.5} 
            Q${w*0.05},${h*0.3} ${w*0.2},${h*0.3}
            Q${w*0.25},${h*0.1} ${w*0.45},${h*0.15}
            Q${w*0.55},${h*0.05} ${w*0.7},${h*0.15}
            Q${w*0.9},${h*0.1} ${w*0.95},${h*0.35}
            Q${w},${h*0.55} ${w*0.85},${h*0.7}
            Z`}
        fill={data.fill}
        stroke={data.stroke}
        strokeWidth={data.strokeWidth}
        opacity={data.opacity}
      />
    )
  },
  callout: ({ data, width, height }) => {
    const tailSize = 20
    return (
      <path
        d={`M${data.cornerRadius},0 
            H${width - data.cornerRadius} 
            Q${width},0 ${width},${data.cornerRadius}
            V${height - tailSize - data.cornerRadius}
            Q${width},${height - tailSize} ${width - data.cornerRadius},${height - tailSize}
            H${width * 0.4}
            L${width * 0.3},${height}
            L${width * 0.25},${height - tailSize}
            H${data.cornerRadius}
            Q0,${height - tailSize} 0,${height - tailSize - data.cornerRadius}
            V${data.cornerRadius}
            Q0,0 ${data.cornerRadius},0
            Z`}
        fill={data.fill}
        stroke={data.stroke}
        strokeWidth={data.strokeWidth}
        opacity={data.opacity}
      />
    )
  },
  note: ({ data, width, height }) => {
    const foldSize = 20
    return (
      <g opacity={data.opacity}>
        <path
          d={`M0,0 H${width - foldSize} L${width},${foldSize} V${height} H0 Z`}
          fill={data.fill}
          stroke={data.stroke}
          strokeWidth={data.strokeWidth}
        />
        {/* Folded corner */}
        <path
          d={`M${width - foldSize},0 V${foldSize} H${width}`}
          fill="rgba(0,0,0,0.1)"
          stroke={data.stroke}
          strokeWidth={data.strokeWidth / 2}
        />
      </g>
    )
  },
  container: ({ data, width, height }) => (
    <rect
      width={width}
      height={height}
      fill={data.fill}
      stroke={data.stroke}
      strokeWidth={data.strokeWidth}
      strokeDasharray="8 4"
      rx={data.cornerRadius}
      ry={data.cornerRadius}
      opacity={data.opacity}
    />
  ),
  image: ({ data, width, height }) => (
    <rect
      width={width}
      height={height}
      fill={data.fill}
      stroke={data.stroke}
      strokeWidth={data.strokeWidth}
      rx={4}
      ry={4}
      opacity={data.opacity}
    />
  ),
  freehand: ({ data, width, height }) => (
    <path
      d={data.pathData || `M0,${height/2} Q${width/4},0 ${width/2},${height/2} T${width},${height/2}`}
      fill="none"
      stroke={data.stroke}
      strokeWidth={data.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={data.opacity}
    />
  ),
}

export const CustomNode = memo(function CustomNode({ id, data, selected }: BaseNodeProps) {
  const { getNode } = useReactFlow()
  const hoveredNodeId = useSelectionStore(state => state.hoveredNodeId)
  const setHoveredNode = useSelectionStore(state => state.setHoveredNode)
  const updateNode = useGraphStore(state => state.updateNode)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(data.label)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Авто-высота textarea
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [editText, isEditing])
  
  // Sync local state with props
  useEffect(() => {
    setEditText(data.label)
  }, [data.label])
  
  const node = getNode(id)
  const width = (node?.measured?.width || node?.style?.width || 200) as number
  const height = (node?.measured?.height || node?.style?.height || 100) as number
  
  const isHovered = hoveredNodeId === id
  const ShapeComponent = shapeComponents[data.nodeType] || shapeComponents.rectangle
  
  const handleDoubleClick = useCallback(() => {
    if (!data.locked) {
      setIsEditing(true)
      setEditText(data.label)
    }
  }, [data.locked, data.label])
  
  const handleBlur = useCallback(() => {
    setIsEditing(false)
    // Сохраняем текст в store при потере фокуса
    if (editText !== data.label) {
      updateNode(id, { label: editText })
    }
  }, [id, editText, data.label, updateNode])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setIsEditing(false)
      // Сохраняем текст
      if (editText !== data.label) {
        updateNode(id, { label: editText })
      }
    }
    if (e.key === 'Escape') {
      setIsEditing(false)
      setEditText(data.label) // Отмена изменений
    }
  }, [id, editText, data.label, updateNode])
  
  return (
    <>
      {/* Node Resizer - показываем только для выбранных и не заблокированных */}
      <NodeResizer
        isVisible={selected && !data.locked}
        minWidth={50}
        minHeight={30}
        lineClassName="!border-blue-500 !border-[1.5px]"
        handleClassName="!w-2 !h-2 !bg-blue-500 !border !border-white !rounded-sm"
      />
      
      <div
        className={cn(
          'relative transition-all duration-150',
          isHovered && !selected && 'ring-1 ring-blue-300 rounded-lg',
          data.locked && 'cursor-not-allowed opacity-80'
        )}
        onMouseEnter={() => setHoveredNode(id)}
        onMouseLeave={() => setHoveredNode(null)}
        onDoubleClick={handleDoubleClick}
        style={{ width, height }}
      >
        {/* Handles for connections - larger hitbox for easier connection */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-5 !h-5 !bg-blue-500 !border-2 !border-white opacity-0 hover:opacity-100 transition-opacity nodrag"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-5 !h-5 !bg-blue-500 !border-2 !border-white opacity-0 hover:opacity-100 transition-opacity nodrag"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-5 !h-5 !bg-blue-500 !border-2 !border-white opacity-0 hover:opacity-100 transition-opacity nodrag"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-5 !h-5 !bg-blue-500 !border-2 !border-white opacity-0 hover:opacity-100 transition-opacity nodrag"
        />
        
        {/* Shape SVG */}
        <svg 
          width={width} 
          height={height} 
          className="absolute inset-0 pointer-events-none"
          style={{ filter: selected ? 'drop-shadow(0 4px 12px rgba(59, 130, 246, 0.4))' : undefined }}
        >
          <ShapeComponent data={data} width={width} height={height} />
        </svg>
        
        {/* Text/Content */}
        <div 
          className="absolute inset-0 flex items-center justify-center p-3 pointer-events-none"
          style={{
            color: data.textColor,
            fontSize: data.fontSize,
            fontFamily: data.fontFamily,
          }}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                e.stopPropagation()
                handleKeyDown(e)
              }}
              onKeyUp={(e) => e.stopPropagation()}
              autoFocus
              className="w-full min-h-[1.5em] bg-transparent text-center resize-none outline-none pointer-events-auto nodrag nopan nowheel overflow-hidden z-50"
              style={{
                color: data.textColor,
                fontSize: data.fontSize,
                fontFamily: data.fontFamily,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-center line-clamp-4 select-none">
              {data.label}
            </span>
          )}
        </div>
      
        {/* Image overlay for image nodes */}
        {data.nodeType === 'image' && data.imageData && (
          <img 
            src={data.imageData} 
            alt="" 
            className="absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] object-cover rounded pointer-events-none"
          />
        )}
      
        {/* Lock indicator */}
        {data.locked && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    </>
  )
})

// Node types registry для React Flow
export const nodeTypes = {
  custom: CustomNode,
}
