import { memo } from 'react'
import { Trash2, Copy, Clipboard, Eye, EyeOff, Lock, Unlock, Layers, ArrowUp, ArrowDown, Palette } from 'lucide-react'
import type { DiagramNode } from '@/types'

interface NodeContextMenuProps {
  x: number
  y: number
  node: DiagramNode
  onDuplicate: (node: DiagramNode) => void
  onCopy: (node: DiagramNode) => void
  onToggleVisibility: (nodeId: string, visible: boolean) => void
  onToggleLock: (nodeId: string, locked: boolean) => void
  onBringForward: (nodeId: string, currentZIndex: number) => void
  onSendBackward: (nodeId: string, currentZIndex: number) => void
  onImport: (nodeId: string) => void
  onOpenInspector: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

/**
 * Context menu displayed when right-clicking on a diagram node.
 * Extracted from Canvas.tsx for cleaner separation.
 */
export const NodeContextMenu = memo(function NodeContextMenu({
  x,
  y,
  node,
  onDuplicate,
  onCopy,
  onToggleVisibility,
  onToggleLock,
  onBringForward,
  onSendBackward,
  onImport,
  onOpenInspector,
  onDelete,
  onClose,
}: NodeContextMenuProps) {
  return (
    <div
      className="fixed bg-popover border rounded-xl shadow-xl py-2 z-50 min-w-[220px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Edit section */}
      <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Редактирование</div>

      <button
        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
        onClick={() => { onDuplicate(node); onClose() }}
      >
        <Copy size={16} className="text-muted-foreground" />
        Дублировать
        <span className="ml-auto text-xs text-muted-foreground">Ctrl+D</span>
      </button>

      <button
        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
        onClick={() => { onCopy(node); onClose() }}
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
        onClick={() => { onToggleVisibility(node.id, !node.visible); onClose() }}
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
        onClick={() => { onToggleLock(node.id, !node.locked); onClose() }}
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
        onClick={() => { onBringForward(node.id, node.zIndex || 0); onClose() }}
      >
        <ArrowUp size={16} className="text-muted-foreground" />
        На передний план
      </button>

      <button
        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
        onClick={() => { onSendBackward(node.id, node.zIndex || 0); onClose() }}
      >
        <ArrowDown size={16} className="text-muted-foreground" />
        На задний план
      </button>

      <div className="h-px bg-border my-1 mx-2" />

      {/* Import section */}
      <button
        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
        onClick={() => { onImport(node.id); onClose() }}
      >
        <Layers size={16} className="text-muted-foreground" />
        Импорт в объект
      </button>

      <button
        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-3 transition-colors"
        onClick={() => { onOpenInspector(node.id); onClose() }}
      >
        <Palette size={16} className="text-muted-foreground" />
        Настройки стиля
      </button>

      <div className="h-px bg-border my-1 mx-2" />

      {/* Delete section */}
      <button
        className="w-full px-4 py-2 text-sm text-left hover:bg-destructive/10 flex items-center gap-3 text-destructive transition-colors"
        onClick={() => { onDelete(node.id); onClose() }}
      >
        <Trash2 size={16} />
        Удалить
        <span className="ml-auto text-xs">Del</span>
      </button>
    </div>
  )
})
