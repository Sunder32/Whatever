import React, { memo, useCallback, useEffect, useRef } from 'react'
import { 
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
  Type,
  ArrowRight,
  Minus,
  Image,
  Pencil,
  ClipboardPaste
} from 'lucide-react'
import { cn } from '@/utils'
import type { Tool } from '@/types'

export interface CanvasContextMenuProps {
  x: number
  y: number
  canvasX: number
  canvasY: number
  onClose: () => void
  onAddShape: (type: Tool, position: { x: number; y: number }) => void
  onPaste?: () => void
  hasClipboard?: boolean
}

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  shortcut?: string
  onClick: () => void
  danger?: boolean
}

const MenuItem = memo(function MenuItem({ icon, label, shortcut, onClick, danger }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "context-menu-item w-full text-left",
        danger && "text-destructive hover:bg-destructive/10"
      )}
    >
      <span className="icon">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
    </button>
  )
})

const MenuDivider = () => <div className="context-menu-divider" />

const MenuSection = memo(function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </div>
      {children}
    </div>
  )
})

export const CanvasContextMenu = memo(function CanvasContextMenu({
  x,
  y,
  canvasX,
  canvasY,
  onClose,
  onAddShape,
  onPaste,
  hasClipboard = false
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])
  
  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return
    
    const rect = menuRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    if (rect.right > viewportWidth) {
      menuRef.current.style.left = `${x - rect.width}px`
    }
    if (rect.bottom > viewportHeight) {
      menuRef.current.style.top = `${y - rect.height}px`
    }
  }, [x, y])
  
  const handleAddShape = useCallback((type: Tool) => {
    onAddShape(type, { x: canvasX, y: canvasY })
    onClose()
  }, [onAddShape, canvasX, canvasY, onClose])
  
  const shapes: Array<{ type: Tool; icon: React.ReactNode; label: string; shortcut?: string }> = [
    { type: 'rectangle', icon: <Square size={18} />, label: 'Прямоугольник', shortcut: 'R' },
    { type: 'ellipse', icon: <Circle size={18} />, label: 'Эллипс', shortcut: 'E' },
    { type: 'diamond', icon: <Diamond size={18} />, label: 'Ромб', shortcut: 'D' },
    { type: 'triangle', icon: <Triangle size={18} />, label: 'Треугольник' },
    { type: 'star', icon: <Star size={18} />, label: 'Звезда', shortcut: 'S' },
    { type: 'hexagon', icon: <Hexagon size={18} />, label: 'Шестиугольник' },
  ]
  
  const specialShapes: Array<{ type: Tool; icon: React.ReactNode; label: string }> = [
    { type: 'cloud', icon: <Cloud size={18} />, label: 'Облако' },
    { type: 'callout', icon: <MessageSquare size={18} />, label: 'Сноска' },
    { type: 'note', icon: <StickyNote size={18} />, label: 'Заметка' },
    { type: 'container', icon: <Box size={18} />, label: 'Контейнер' },
  ]
  
  const otherTools: Array<{ type: Tool; icon: React.ReactNode; label: string; shortcut?: string }> = [
    { type: 'text', icon: <Type size={18} />, label: 'Текст', shortcut: 'T' },
    { type: 'arrow', icon: <ArrowRight size={18} />, label: 'Стрелка', shortcut: 'A' },
    { type: 'line', icon: <Minus size={18} />, label: 'Линия', shortcut: 'L' },
    { type: 'image', icon: <Image size={18} />, label: 'Изображение', shortcut: 'I' },
    { type: 'freehand', icon: <Pencil size={18} />, label: 'Рисование', shortcut: 'P' },
  ]
  
  return (
    <div
      ref={menuRef}
      className="canvas-context-menu fixed z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      style={{ left: x, top: y }}
    >
      {/* Quick actions */}
      {hasClipboard && onPaste && (
        <>
          <MenuItem
            icon={<ClipboardPaste size={18} />}
            label="Вставить"
            shortcut="Ctrl+V"
            onClick={() => { onPaste(); onClose() }}
          />
          <MenuDivider />
        </>
      )}
      
      {/* Basic shapes */}
      <MenuSection title="Фигуры">
        <div className="grid grid-cols-3 gap-1 px-2 pb-2">
          {shapes.map(shape => (
            <button
              key={shape.type}
              onClick={() => handleAddShape(shape.type)}
              className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-accent transition-all group"
              title={`${shape.label}${shape.shortcut ? ` (${shape.shortcut})` : ''}`}
            >
              <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                {shape.icon}
              </span>
              <span className="text-xs truncate max-w-full">{shape.label}</span>
            </button>
          ))}
        </div>
      </MenuSection>
      
      {/* Special shapes */}
      <MenuSection title="Специальные">
        <div className="grid grid-cols-2 gap-1 px-2 pb-2">
          {specialShapes.map(shape => (
            <button
              key={shape.type}
              onClick={() => handleAddShape(shape.type)}
              className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-accent transition-all text-sm"
            >
              <span className="text-muted-foreground">{shape.icon}</span>
              <span>{shape.label}</span>
            </button>
          ))}
        </div>
      </MenuSection>
      
      <MenuDivider />
      
      {/* Other tools */}
      {otherTools.map(tool => (
        <MenuItem
          key={tool.type}
          icon={tool.icon}
          label={tool.label}
          shortcut={tool.shortcut}
          onClick={() => handleAddShape(tool.type)}
        />
      ))}
    </div>
  )
})
