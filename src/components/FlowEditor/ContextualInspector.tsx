import { memo, useCallback, useState } from 'react'
import { 
  Palette, 
  Type, 
  Lock, 
  Unlock, 
  Copy, 
  Trash2, 
  Layers,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  ChevronRight,
  X,
  MoveRight
} from 'lucide-react'
import { useGraphStore, type CustomNodeData, type FlowEdge } from '@/stores/graphStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { cn } from '@/utils'

/**
 * ContextualInspector - Контекстная панель свойств
 * 
 * Особенности:
 * - Пустая/свёрнутая когда ничего не выделено
 * - Показывает только релевантные настройки для выделенного объекта
 * - Компактный дизайн
 */

// Color presets
const colorPresets = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#6366f1',
  '#ffffff', '#f3f4f6', '#9ca3af', '#4b5563', '#1f2937',
]

interface ColorPickerProps {
  label: string
  value: string
  onChange: (color: string) => void
}

const ColorPicker = memo(function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="relative">
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg border border-border hover:border-primary/50 transition-colors"
      >
        <div 
          className="w-5 h-5 rounded border border-border/50"
          style={{ backgroundColor: value }}
        />
        <span className="text-xs font-mono flex-1 text-left">{value}</span>
        <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-popover border border-border rounded-lg shadow-xl z-50">
          <div className="grid grid-cols-5 gap-1">
            {colorPresets.map(color => (
              <button
                key={color}
                onClick={() => {
                  onChange(color)
                  setIsOpen(false)
                }}
                className={cn(
                  'w-6 h-6 rounded border transition-all',
                  value === color ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-border'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-8 mt-2 rounded cursor-pointer"
          />
        </div>
      )}
    </div>
  )
})

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

const Slider = memo(function Slider({ label, value, min, max, step = 1, unit = '', onChange }: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        <span className="text-xs font-mono text-muted-foreground">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  )
})

export const ContextualInspector = memo(function ContextualInspector() {
  // Selection
  const selectedNodeIds = useSelectionStore(state => state.selectedNodeIds)
  const selectedEdgeIds = useSelectionStore(state => state.selectedEdgeIds)
  const clearSelection = useSelectionStore(state => state.clearSelection)
  
  // Graph - подписка на nodes для реактивного обновления
  const nodes = useGraphStore(state => state.nodes)
  const updateNode = useGraphStore(state => state.updateNode)
  const deleteNodes = useGraphStore(state => state.deleteNodes)
  const deleteEdges = useGraphStore(state => state.deleteEdges)
  const duplicateNodes = useGraphStore(state => state.duplicateNodes)
  
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  // Get selected node data - теперь реактивно обновляется
  const selectedNode = selectedNodeIds.length === 1 
    ? nodes.find(n => n.id === selectedNodeIds[0]) 
    : null
  const nodeData = selectedNode?.data as CustomNodeData | undefined
  
  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeIds.length > 0
  
  // Handlers
  const handleUpdate = useCallback((updates: Partial<CustomNodeData>) => {
    if (selectedNode) {
      updateNode(selectedNode.id, updates)
    }
  }, [selectedNode, updateNode])
  
  const handleDelete = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      deleteNodes(selectedNodeIds)
    }
    if (selectedEdgeIds.length > 0) {
      deleteEdges(selectedEdgeIds)
    }
    clearSelection()
  }, [selectedNodeIds, selectedEdgeIds, deleteNodes, deleteEdges, clearSelection])
  
  const handleDuplicate = useCallback(() => {
    if (selectedNodeIds.length > 0) {
      const newNodes = duplicateNodes(selectedNodeIds)
      // Select new nodes (would need to update selection store)
      if (import.meta.env.DEV) console.debug('Duplicated nodes:', newNodes.length)
    }
  }, [selectedNodeIds, duplicateNodes])
  
  const handleToggleLock = useCallback(() => {
    if (nodeData) {
      handleUpdate({ locked: !nodeData.locked })
    }
  }, [nodeData, handleUpdate])
  
  // Empty state when nothing selected
  if (!hasSelection) {
    return (
      <div className="w-64 p-4 bg-card/80 backdrop-blur-md border border-border/50 rounded-xl shadow-lg">
        <div className="text-center py-8 text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Выберите элемент</p>
          <p className="text-xs mt-1 opacity-60">Кликните на фигуру или связь для редактирования</p>
        </div>
      </div>
    )
  }
  
  // Multi-selection state
  if (selectedNodeIds.length > 1 || (selectedNodeIds.length > 0 && selectedEdgeIds.length > 0)) {
    return (
      <div className="w-64 p-4 bg-card/80 backdrop-blur-md border border-border/50 rounded-xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Множественный выбор</h3>
          <button
            onClick={clearSelection}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="text-sm text-muted-foreground mb-4">
          Выбрано: {selectedNodeIds.length} узлов, {selectedEdgeIds.length} связей
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleDuplicate}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent/80 transition-colors"
          >
            <Copy size={16} />
            <span className="text-sm">Копировать</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={16} />
            <span className="text-sm">Удалить</span>
          </button>
        </div>
      </div>
    )
  }
  
  // Single node selected
  if (selectedNode && nodeData) {
    return (
      <div className="w-72 bg-card/80 backdrop-blur-md border border-border/50 rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-0.5 rounded hover:bg-accent transition-colors"
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
            <h3 className="text-sm font-semibold capitalize">
              {nodeData.nodeType === 'rectangle' ? 'Прямоугольник' :
               nodeData.nodeType === 'ellipse' ? 'Эллипс' :
               nodeData.nodeType === 'diamond' ? 'Ромб' :
               nodeData.nodeType === 'triangle' ? 'Треугольник' :
               nodeData.nodeType === 'star' ? 'Звезда' :
               nodeData.nodeType === 'hexagon' ? 'Шестиугольник' :
               nodeData.nodeType === 'cloud' ? 'Облако' :
               nodeData.nodeType === 'callout' ? 'Сноска' :
               nodeData.nodeType === 'note' ? 'Заметка' :
               nodeData.nodeType === 'container' ? 'Контейнер' :
               nodeData.nodeType === 'image' ? 'Изображение' :
               nodeData.nodeType}
            </h3>
          </div>
          <button
            onClick={clearSelection}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        {!isCollapsed && (
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Text */}
            <div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Type size={12} />
                Текст
              </label>
              <input
                type="text"
                value={nodeData.label}
                onChange={(e) => handleUpdate({ label: e.target.value })}
                placeholder="Введите текст..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            
            {/* Colors section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Palette size={12} />
                Цвета
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <ColorPicker
                  label="Заливка"
                  value={nodeData.fill}
                  onChange={(color) => handleUpdate({ fill: color })}
                />
                <ColorPicker
                  label="Обводка"
                  value={nodeData.stroke}
                  onChange={(color) => handleUpdate({ stroke: color })}
                />
              </div>
              
              <ColorPicker
                label="Цвет текста"
                value={nodeData.textColor}
                onChange={(color) => handleUpdate({ textColor: color })}
              />
            </div>
            
            {/* Style sliders */}
            <div className="space-y-3">
              <Slider
                label="Толщина обводки"
                value={nodeData.strokeWidth}
                min={0}
                max={10}
                unit="px"
                onChange={(value) => handleUpdate({ strokeWidth: value })}
              />
              
              <Slider
                label="Прозрачность"
                value={Math.round(nodeData.opacity * 100)}
                min={10}
                max={100}
                unit="%"
                onChange={(value) => handleUpdate({ opacity: value / 100 })}
              />
              
              <Slider
                label="Скругление углов"
                value={nodeData.cornerRadius}
                min={0}
                max={50}
                unit="px"
                onChange={(value) => handleUpdate({ cornerRadius: value })}
              />
              
              <Slider
                label="Размер шрифта"
                value={nodeData.fontSize}
                min={10}
                max={48}
                unit="px"
                onChange={(value) => handleUpdate({ fontSize: value })}
              />
            </div>
            
            {/* Text alignment */}
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Выравнивание текста</label>
              <div className="flex gap-1">
                {[
                  { align: 'left' as const, icon: <AlignLeft size={16} /> },
                  { align: 'center' as const, icon: <AlignCenter size={16} /> },
                  { align: 'right' as const, icon: <AlignRight size={16} /> },
                ].map(({ align, icon }) => (
                  <button
                    key={align}
                    onClick={() => handleUpdate({ fontFamily: align })} // Using fontFamily temporarily for alignment
                    className={cn(
                      'flex-1 flex items-center justify-center py-2 rounded-lg transition-colors',
                      'hover:bg-accent'
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-border/50">
              <button
                onClick={handleToggleLock}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors',
                  nodeData.locked 
                    ? 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20' 
                    : 'bg-accent hover:bg-accent/80'
                )}
              >
                {nodeData.locked ? <Lock size={16} /> : <Unlock size={16} />}
                <span className="text-sm">{nodeData.locked ? 'Разблокировать' : 'Заблокировать'}</span>
              </button>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleDuplicate}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent/80 transition-colors"
              >
                <Copy size={16} />
                <span className="text-sm">Копировать</span>
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={16} />
                <span className="text-sm">Удалить</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
  
  // Edge selected
  if (selectedEdgeIds.length === 1) {
    const edges = useGraphStore.getState().edges
    const selectedEdge = edges.find(e => e.id === selectedEdgeIds[0])
    
    const edgeTypes = [
      { value: 'default', label: 'Прямая' },
      { value: 'smoothstep', label: 'Плавная' },
      { value: 'step', label: 'Ступенчатая' },
      { value: 'straight', label: 'Линия' },
    ]
    
    const strokeStyles = [
      { value: 'solid', label: 'Сплошная' },
      { value: 'dashed', label: 'Пунктирная' },
      { value: 'dotted', label: 'Точечная' },
    ]
    
    const markerTypes = [
      { value: 'none', label: 'Без стрелки' },
      { value: 'arrow', label: 'Стрелка' },
      { value: 'arrowclosed', label: 'Стрелка (заполненная)' },
    ]
    
    const handleUpdateEdge = (updates: Partial<FlowEdge>) => {
      if (selectedEdge) {
        useGraphStore.getState().updateEdge(selectedEdge.id, updates)
      }
    }
    
    return (
      <div className="w-72 bg-card/80 backdrop-blur-md border border-border/50 rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <MoveRight size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold">Связь</h3>
          </div>
          <button
            onClick={clearSelection}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
          {/* Edge Type */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Тип линии</label>
            <div className="grid grid-cols-2 gap-1.5">
              {edgeTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleUpdateEdge({ type: type.value as FlowEdge['type'] })}
                  className={cn(
                    'px-2 py-1.5 text-xs rounded-md transition-colors',
                    selectedEdge?.type === type.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Stroke Style */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Стиль штриха</label>
            <div className="flex gap-1.5">
              {strokeStyles.map((style) => (
                <button
                  key={style.value}
                  onClick={() => handleUpdateEdge({ 
                    style: { 
                      ...selectedEdge?.style as Record<string, unknown>,
                      strokeDasharray: style.value === 'dashed' ? '8 4' : style.value === 'dotted' ? '2 2' : undefined 
                    }
                  })}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs rounded-md transition-colors',
                    'bg-muted hover:bg-muted/80'
                  )}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Stroke Color */}
          <div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Palette size={12} />
              Цвет линии
            </label>
            <div className="grid grid-cols-8 gap-1">
              {colorPresets.map((color) => (
                <button
                  key={color}
                  onClick={() => handleUpdateEdge({ style: { ...selectedEdge?.style as Record<string, unknown>, stroke: color } })}
                  className={cn(
                    'w-6 h-6 rounded-md border-2 transition-all',
                    (selectedEdge?.style as { stroke?: string })?.stroke === color ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          
          {/* Marker End (Arrow) */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Конец линии</label>
            <div className="flex gap-1.5">
              {markerTypes.map((marker) => (
                <button
                  key={marker.value}
                  onClick={() => handleUpdateEdge({ 
                    markerEnd: marker.value === 'none' ? undefined : { type: marker.value === 'arrow' ? 'arrow' : 'arrowclosed' }
                  } as Partial<FlowEdge>)}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs rounded-md transition-colors',
                    'bg-muted hover:bg-muted/80'
                  )}
                >
                  {marker.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Marker Start (Arrow at beginning) */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Начало линии</label>
            <div className="flex gap-1.5">
              {markerTypes.map((marker) => (
                <button
                  key={marker.value}
                  onClick={() => handleUpdateEdge({ 
                    markerStart: marker.value === 'none' ? undefined : { type: marker.value === 'arrow' ? 'arrow' : 'arrowclosed' }
                  } as Partial<FlowEdge>)}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs rounded-md transition-colors',
                    'bg-muted hover:bg-muted/80'
                  )}
                >
                  {marker.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Stroke Width */}
          <Slider
            label="Толщина"
            value={(selectedEdge?.style as { strokeWidth?: number })?.strokeWidth || 2}
            min={1}
            max={8}
            unit="px"
            onChange={(value) => handleUpdateEdge({ style: { ...selectedEdge?.style as Record<string, unknown>, strokeWidth: value } })}
          />
          
          {/* Delete */}
          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={16} />
            <span className="text-sm">Удалить связь</span>
          </button>
        </div>
      </div>
    )
  }
  
  return null
})
