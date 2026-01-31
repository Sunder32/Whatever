import { useAppStore, useDiagramStore } from '@/stores'
import type { Tool } from '@/types'
import { ChevronDown } from 'lucide-react'

const toolHints: Record<Tool, { action: string; tip: string }> = {
  select: { action: 'Выбор и перемещение', tip: 'Тяни от точки привязки — создать связь' },
  pan: { action: 'Панорамирование', tip: 'Зажми и тащи холст' },
  rectangle: { action: 'Прямоугольник', tip: 'Кликни для создания • R' },
  ellipse: { action: 'Эллипс', tip: 'Кликни для создания • E' },
  diamond: { action: 'Ромб', tip: 'Кликни для создания • D' },
  triangle: { action: 'Треугольник', tip: 'Кликни для создания' },
  line: { action: 'Линия', tip: 'Тяни от точки к точке • L' },
  arrow: { action: 'Стрелка', tip: 'Тяни от точки к точке • A' },
  text: { action: 'Текст', tip: 'Кликни для создания • T' },
  star: { action: 'Звезда', tip: 'Кликни для создания' },
  hexagon: { action: 'Шестиугольник', tip: 'Кликни для создания' },
  cylinder: { action: 'Цилиндр', tip: 'Кликни для создания (БД)' },
  cloud: { action: 'Облако', tip: 'Кликни для создания' },
  callout: { action: 'Выноска', tip: 'Кликни для создания' },
  image: { action: 'Изображение', tip: 'Кликни для вставки' },
  freehand: { action: 'Свободное рисование', tip: 'Рисуй мышкой' },
  note: { action: 'Заметка', tip: 'Кликни для создания' },
  container: { action: 'Контейнер', tip: 'Группировка элементов' },
}

export function StatusBar() {
  const currentTool = useAppStore(state => state.currentTool)
  const file = useDiagramStore(state => state.file)
  const panelVisibility = useAppStore(state => state.panelVisibility)
  const togglePanel = useAppStore(state => state.togglePanel)
  
  const hint = toolHints[currentTool] || { action: '', tip: '' }
  const zoom = file?.canvasState.zoom ?? 1
  const nodesCount = file?.content.nodes.length ?? 0
  const edgesCount = file?.content.edges.length ?? 0
  const selectedCount = file?.canvasState.selectedElements.length ?? 0
  
  // Collapsed state - minimal line
  if (!panelVisibility.statusBar) {
    return (
      <div 
        className="h-1 bg-card/30 border-t border-border/20 cursor-pointer hover:bg-primary/20 transition-colors"
        onClick={() => togglePanel('statusBar')}
        title="Показать статус-бар"
      />
    )
  }
  
  return (
    <div className="h-7 bg-card/50 backdrop-blur-sm border-t border-border/30 flex items-center justify-between px-4 text-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={() => togglePanel('statusBar')}
          className="p-0.5 rounded hover:bg-accent transition-colors"
          title="Скрыть статус-бар"
        >
          <ChevronDown size={12} />
        </button>
        <span className="font-medium text-foreground/80">{hint.action}</span>
        {hint.tip && (
          <>
            <span className="text-border/60">•</span>
            <span className="text-muted-foreground/70">{hint.tip}</span>
          </>
        )}
      </div>
      
      <div className="flex items-center gap-4 text-muted-foreground/70">
        {selectedCount > 0 && (
          <span className="text-primary/80 font-medium">{selectedCount} выбрано</span>
        )}
        <span>{nodesCount} узлов</span>
        <span>{edgesCount} связей</span>
        <span className="bg-secondary/50 px-2 py-0.5 rounded text-foreground/70 font-mono text-[10px]">
          {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  )
}
