import { useTranslation } from 'react-i18next'
import { useDiagramStore, useAppStore } from '@/stores'
import { cn } from '@/utils'
import { Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Link, PanelRightClose } from 'lucide-react'
import type { DiagramEdge, RelationType } from '@/types'

// Helper function to convert any color format to hex for color input
function toHexColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback
  
  // Already hex format
  if (color.startsWith('#')) {
    // Ensure 6-digit hex
    if (color.length === 4) {
      return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
    }
    return color.slice(0, 7) // Remove alpha if present (#rrggbbaa)
  }
  
  // rgba or rgb format
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  
  return fallback
}

export function Inspector() {
  const { t } = useTranslation()
  const file = useDiagramStore(state => state.file)
  const updateNode = useDiagramStore(state => state.updateNode)
  const updateEdge = useDiagramStore(state => state.updateEdge)
  const getNode = useDiagramStore(state => state.getNode)
  const panelVisibility = useAppStore(state => state.panelVisibility)
  const togglePanel = useAppStore(state => state.togglePanel)
  
  const selectedIds = file?.canvasState.selectedElements ?? []
  const nodes = file?.content.nodes ?? []
  const edges = file?.content.edges ?? []
  
  // Check if selected element is a node or edge
  const selectedNode = selectedIds.length === 1 ? getNode(selectedIds[0]) : null
  const selectedEdge = selectedIds.length === 1 ? edges.find(e => e.id === selectedIds[0]) : null
  
  const handlePositionChange = (axis: 'x' | 'y', value: string) => {
    if (!selectedNode) return
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return
    
    updateNode(selectedNode.id, {
      position: { ...selectedNode.position, [axis]: numValue }
    })
  }
  
  const handleSizeChange = (dimension: 'width' | 'height', value: string) => {
    if (!selectedNode) return
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue < 10) return
    
    updateNode(selectedNode.id, {
      size: { ...selectedNode.size, [dimension]: numValue }
    })
  }
  
  const handleStyleChange = (property: string, value: string | number) => {
    if (!selectedNode) return
    
    updateNode(selectedNode.id, {
      style: { ...selectedNode.style, [property]: value }
    })
  }
  
  const handleRotationChange = (value: string) => {
    if (!selectedNode) return
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return
    
    updateNode(selectedNode.id, { rotation: numValue })
  }
  
  const handleTextChange = (value: string) => {
    if (!selectedNode) return
    updateNode(selectedNode.id, { text: value })
  }
  
  const handleTextStyleChange = (property: string, value: string | number) => {
    if (!selectedNode) return
    updateNode(selectedNode.id, {
      textStyle: { ...selectedNode.textStyle, [property]: value }
    })
  }
  
  // Edge style handlers
  const handleEdgeStyleChange = (property: string, value: string | number) => {
    if (!selectedEdge) return
    updateEdge(selectedEdge.id, {
      style: { ...selectedEdge.style, [property]: value }
    })
  }
  
  const handleEdgeChange = (property: keyof DiagramEdge, value: unknown) => {
    if (!selectedEdge) return
    updateEdge(selectedEdge.id, { [property]: value })
  }
  
  // Collapsed state - don't render at all, let canvas take full width
  if (!panelVisibility.inspector) {
    return null
  }
  
  // Render header with collapse button
  const renderHeader = (title: string) => (
    <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
      <h2 className="text-base font-semibold text-foreground/90">{title}</h2>
      <button
        onClick={() => togglePanel('inspector')}
        className="p-1.5 rounded hover:bg-accent transition-colors"
        title={t('inspector.hide', 'Скрыть инспектор')}
      >
        <PanelRightClose size={18} />
      </button>
    </div>
  )
  
  if (!file) {
    return (
      <div className="w-80 bg-card/30 backdrop-blur-sm border-l border-border/50 p-5">
        <p className="text-base text-muted-foreground text-center">
          {t('inspector.noFileOpen')}
        </p>
      </div>
    )
  }
  
  if (selectedIds.length === 0) {
    return (
      <div className="w-80 bg-card/30 backdrop-blur-sm border-l border-border/50">
        {renderHeader(t('inspector.canvas'))}
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground/70">{t('inspector.zoom')}</label>
              <p className="text-base font-medium">{Math.round((file.canvasState.zoom ?? 1) * 100)}%</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground/70">{t('inspector.grid')}</label>
              <p className="text-base font-medium">{file.canvasState.grid?.enabled ? t('inspector.enabled') : t('inspector.disabled')}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground/70">{t('inspector.nodes')}</label>
              <p className="text-base font-medium">{file.content.nodes.length}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground/70">{t('inspector.edges')}</label>
              <p className="text-base font-medium">{file.content.edges.length}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (selectedIds.length > 1) {
    return (
      <div className="w-80 bg-card/30 backdrop-blur-sm border-l border-border/50">
        {renderHeader(t('inspector.multipleSelection'))}
        <div className="p-5">
          <p className="text-base text-muted-foreground">
            {selectedIds.length} {t('inspector.elementsSelected')}
          </p>
        </div>
      </div>
    )
  }
  
  // Render Edge Inspector
  if (selectedEdge) {
    const sourceNode = nodes.find(n => n.id === selectedEdge.source)
    const targetNode = nodes.find(n => n.id === selectedEdge.target)
    
    return (
      <div className="w-80 bg-card/30 backdrop-blur-sm border-l border-border/50 overflow-y-auto scrollbar-thin max-h-full">
        {renderHeader('Связь')}
        
        <div className="p-5 space-y-5">
          {/* Connection info */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2 flex items-center gap-1">
              <Link size={10} />
              Соединение
            </h3>
            <div className="text-sm space-y-2 bg-secondary/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">От:</span>
                <span className="font-medium text-xs truncate max-w-[140px]">
                  {sourceNode?.text || sourceNode?.type || 'Узел'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">К:</span>
                <span className="font-medium text-xs truncate max-w-[140px]">
                  {targetNode?.text || targetNode?.type || 'Узел'}
                </span>
              </div>
            </div>
          </section>
          
          {/* Relation Type */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Тип связи</h3>
            <select
              value={selectedEdge.relationType || 'one-to-one'}
              onChange={(e) => handleEdgeChange('relationType', e.target.value as RelationType)}
              className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            >
              <option value="one-to-one">Один к одному (1:1)</option>
              <option value="one-to-many">Один ко многим (1:N)</option>
              <option value="many-to-one">Многие к одному (N:1)</option>
              <option value="many-to-many">Многие ко многим (N:M)</option>
            </select>
          </section>
          
          {/* Line Style */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Стиль линии</h3>
            <select
              value={selectedEdge.style.strokeStyle || 'solid'}
              onChange={(e) => handleEdgeStyleChange('strokeStyle', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            >
              <option value="solid">Сплошная</option>
              <option value="dashed">Пунктирная</option>
              <option value="dotted">Точечная</option>
            </select>
          </section>
          
          {/* Arrow Type */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Наконечник</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground/60">Начало</label>
                <select
                  value={selectedEdge.arrowStart || 'none'}
                  onChange={(e) => handleEdgeChange('arrowStart', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                >
                  <option value="none">Нет</option>
                  <option value="arrow">Стрелка</option>
                  <option value="diamond">Ромб</option>
                  <option value="circle">Круг</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground/60">Конец</label>
                <select
                  value={selectedEdge.arrowEnd || 'arrow'}
                  onChange={(e) => handleEdgeChange('arrowEnd', e.target.value)}
                  className="w-full px-2 py-1.5 text-xs bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                >
                  <option value="none">Нет</option>
                  <option value="arrow">Стрелка</option>
                  <option value="diamond">Ромб</option>
                  <option value="circle">Круг</option>
                </select>
              </div>
            </div>
          </section>
          
          {/* Color */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Цвет</h3>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={toHexColor(selectedEdge.style.stroke, '#64748b')}
                onChange={(e) => handleEdgeStyleChange('stroke', e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-secondary/30 border border-border/30"
              />
              <input
                type="text"
                value={selectedEdge.style.stroke || '#64748b'}
                onChange={(e) => handleEdgeStyleChange('stroke', e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
              />
            </div>
          </section>
          
          {/* Stroke Width */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">
              Толщина: {selectedEdge.style.strokeWidth || 2}px
            </h3>
            <input
              type="range"
              min="1"
              max="8"
              step="0.5"
              value={selectedEdge.style.strokeWidth || 2}
              onChange={(e) => handleEdgeStyleChange('strokeWidth', parseFloat(e.target.value))}
              className="w-full accent-primary"
            />
          </section>
          
          {/* Label */}
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Подпись</h3>
            <input
              type="text"
              value={selectedEdge.label || ''}
              onChange={(e) => handleEdgeChange('label', e.target.value)}
              placeholder="Введите подпись..."
              className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </section>
        </div>
      </div>
    )
  }
  
  if (!selectedNode) return null
  
  return (
    <div className="w-80 bg-card/30 backdrop-blur-sm border-l border-border/50 overflow-y-auto scrollbar-thin max-h-full">
      {renderHeader(selectedNode.type)}
      
      <div className="p-5 space-y-5">
        {/* Text Content Section */}
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2 flex items-center gap-1">
            <Type size={10} />
            {t('inspector.text', 'Текст')}
          </h3>
          <textarea
            value={selectedNode.text || ''}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={t('inspector.enterText', 'Введите текст...')}
            className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
            rows={3}
          />
        </section>
        
        {/* Text Style Section */}
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">{t('inspector.textStyle', 'Стиль текста')}</h3>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={selectedNode.textStyle?.fontFamily || 'Arial'}
                onChange={(e) => handleTextStyleChange('fontFamily', e.target.value)}
                className="flex-1 px-2 py-1.5 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              >
                <option value="Arial">Arial</option>
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
              </select>
              <input
                type="number"
                min="8"
                max="72"
                value={selectedNode.textStyle?.fontSize || 14}
                onChange={(e) => handleTextStyleChange('fontSize', parseInt(e.target.value))}
                className="w-16 px-2 py-1.5 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/30">
              <button
                onClick={() => handleTextStyleChange('fontWeight', selectedNode.textStyle?.fontWeight === 'bold' ? 'normal' : 'bold')}
                className={cn(
                  'p-1.5 rounded-md hover:bg-secondary/80 transition-colors',
                  selectedNode.textStyle?.fontWeight === 'bold' && 'bg-primary/80 text-primary-foreground'
                )}
                title={t('inspector.bold', 'Жирный')}
              >
                <Bold size={13} />
              </button>
              <button
                onClick={() => handleTextStyleChange('fontStyle', selectedNode.textStyle?.fontStyle === 'italic' ? 'normal' : 'italic')}
                className={cn(
                  'p-1.5 rounded-md hover:bg-secondary/80 transition-colors',
                  selectedNode.textStyle?.fontStyle === 'italic' && 'bg-primary/80 text-primary-foreground'
                )}
                title={t('inspector.italic', 'Курсив')}
              >
                <Italic size={13} />
              </button>
              <div className="w-px h-4 bg-border/50 mx-1" />
              <button
                onClick={() => handleTextStyleChange('align', 'left')}
                className={cn(
                  'p-1.5 rounded-md hover:bg-secondary/80 transition-colors',
                  selectedNode.textStyle?.align === 'left' && 'bg-primary/80 text-primary-foreground'
                )}
              >
                <AlignLeft size={13} />
              </button>
              <button
                onClick={() => handleTextStyleChange('align', 'center')}
                className={cn(
                  'p-1.5 rounded-md hover:bg-secondary/80 transition-colors',
                  (selectedNode.textStyle?.align === 'center' || !selectedNode.textStyle?.align) && 'bg-primary/80 text-primary-foreground'
                )}
              >
                <AlignCenter size={13} />
              </button>
              <button
                onClick={() => handleTextStyleChange('align', 'right')}
                className={cn(
                  'p-1.5 rounded-md hover:bg-secondary/80 transition-colors',
                  selectedNode.textStyle?.align === 'right' && 'bg-primary/80 text-primary-foreground'
                )}
              >
                <AlignRight size={13} />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted-foreground/60">{t('inspector.textColor', 'Цвет текста')}</label>
              <input
                type="color"
                value={toHexColor(selectedNode.textStyle?.color, '#e2e8f0')}
                onChange={(e) => handleTextStyleChange('color', e.target.value)}
                className="w-7 h-7 rounded-lg cursor-pointer bg-secondary/30 border border-border/30"
              />
            </div>
          </div>
        </section>
        
        <div className="border-t border-border/50 pt-5">
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">{t('inspector.position')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground/60">X</label>
                <input
                  type="number"
                  value={Math.round(selectedNode.position.x)}
                  onChange={(e) => handlePositionChange('x', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground/60">Y</label>
                <input
                  type="number"
                  value={Math.round(selectedNode.position.y)}
                  onChange={(e) => handlePositionChange('y', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>
          </section>
        </div>
        
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">{t('inspector.size')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground/60">{t('inspector.width')}</label>
              <input
                type="number"
                value={Math.round(selectedNode.size.width)}
                onChange={(e) => handleSizeChange('width', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground/60">{t('inspector.height')}</label>
              <input
                type="number"
                value={Math.round(selectedNode.size.height)}
                onChange={(e) => handleSizeChange('height', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            </div>
          </div>
        </section>
        
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">{t('inspector.rotation')}</h3>
          <input
            type="number"
            value={Math.round(selectedNode.rotation)}
            onChange={(e) => handleRotationChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </section>
        
        <div className="border-t border-border/50 pt-5">
          <section>
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">{t('inspector.fill')}</h3>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={toHexColor(selectedNode.style.fill, '#3b82f6')}
                onChange={(e) => handleStyleChange('fill', e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-secondary/30 border border-border/30"
              />
              <input
                type="text"
                value={selectedNode.style.fill || '#3b82f6'}
                onChange={(e) => handleStyleChange('fill', e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
              />
            </div>
          </section>
        </div>
        
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">{t('inspector.stroke')}</h3>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="color"
              value={toHexColor(selectedNode.style.stroke, '#60a5fa')}
              onChange={(e) => handleStyleChange('stroke', e.target.value)}
              className="w-9 h-9 rounded-lg cursor-pointer bg-secondary/30 border border-border/30"
            />
            <input
              type="text"
              value={selectedNode.style.stroke || '#60a5fa'}
              onChange={(e) => handleStyleChange('stroke', e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground/60">{t('inspector.strokeWidth')}</label>
            <input
              type="number"
              min="0"
              max="20"
              value={selectedNode.style.strokeWidth ?? 2}
              onChange={(e) => handleStyleChange('strokeWidth', parseFloat(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-secondary/50 rounded-lg border border-border/30 outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>
        </section>
        
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">
            {t('inspector.cornerRadius', 'Скругление')}: {selectedNode.style.cornerRadius || 0}px
          </h3>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={selectedNode.style.cornerRadius || 0}
            onChange={(e) => handleStyleChange('cornerRadius', parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </section>
        
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">
            {t('inspector.opacity')}: {Math.round(selectedNode.style.opacity * 100)}%
          </h3>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={selectedNode.style.opacity}
            onChange={(e) => handleStyleChange('opacity', parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </section>
        
        {/* Shadow Section */}
        <section>
          <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">
            {t('inspector.shadow', 'Тень')}
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-muted-foreground/60 w-16">{t('inspector.shadowColor', 'Цвет')}</label>
              <input
                type="color"
                value={selectedNode.style.shadowColor || '#000000'}
                onChange={(e) => handleStyleChange('shadowColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0"
              />
              <input
                type="text"
                value={selectedNode.style.shadowColor || '#000000'}
                onChange={(e) => handleStyleChange('shadowColor', e.target.value)}
                className="flex-1 text-[10px] bg-secondary/50 rounded px-1.5 py-0.5 border-0 outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground/60">
                {t('inspector.shadowBlur', 'Размытие')}: {selectedNode.style.shadowBlur || 0}px
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={selectedNode.style.shadowBlur || 0}
                onChange={(e) => handleStyleChange('shadowBlur', parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground/60">{t('inspector.shadowOffsetX', 'X')}</label>
                <input
                  type="number"
                  value={selectedNode.style.shadowOffsetX || 0}
                  onChange={(e) => handleStyleChange('shadowOffsetX', parseFloat(e.target.value))}
                  className="w-full text-[10px] bg-secondary/50 rounded px-1.5 py-0.5 border-0 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground/60">{t('inspector.shadowOffsetY', 'Y')}</label>
                <input
                  type="number"
                  value={selectedNode.style.shadowOffsetY || 0}
                  onChange={(e) => handleStyleChange('shadowOffsetY', parseFloat(e.target.value))}
                  className="w-full text-[10px] bg-secondary/50 rounded px-1.5 py-0.5 border-0 outline-none"
                />
              </div>
            </div>
          </div>
        </section>
        
        {/* Linked Data Section */}
        {selectedNode.linkedData && selectedNode.linkedData.length > 0 && (
          <section className="border-t border-border/30 pt-4 mt-4">
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2 flex items-center gap-1">
              <Link size={10} />
              Привязанные данные
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              {selectedNode.linkedData.map((item, index) => (
                <div 
                  key={index} 
                  className="bg-secondary/40 rounded-lg p-2 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-primary/80 truncate">
                      {item.source || 'Импортированные данные'}
                    </span>
                    <button
                      onClick={() => {
                        const newLinkedData = selectedNode.linkedData?.filter((_, i) => i !== index) || []
                        updateNode(selectedNode.id, { linkedData: newLinkedData })
                      }}
                      className="text-destructive/60 hover:text-destructive text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                  {typeof item.data === 'object' && item.data !== null ? (
                    <div className="space-y-0.5">
                      {Object.entries(item.data as Record<string, unknown>).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-muted-foreground">
                          <span className="truncate max-w-[80px]">{key}:</span>
                          <span className="truncate max-w-[100px] text-foreground/80">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                      {Object.keys(item.data as Record<string, unknown>).length > 5 && (
                        <div className="text-muted-foreground/60 text-center">
                          +{Object.keys(item.data as Record<string, unknown>).length - 5} ещё...
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground truncate">{String(item.data)}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-2">
              Всего записей: {selectedNode.linkedData.length}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
