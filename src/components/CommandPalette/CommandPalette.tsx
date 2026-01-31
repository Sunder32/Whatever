import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Command } from 'lucide-react'
import { useAppStore, useDiagramStore } from '@/stores'
import { cn } from '@/utils'

interface CommandItem {
  id: string
  label: string
  category: string
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const setCurrentTool = useAppStore(state => state.setCurrentTool)
  const initNewFile = useDiagramStore(state => state.initNewFile)
  const undo = useDiagramStore(state => state.undo)
  const redo = useDiagramStore(state => state.redo)
  const setZoom = useDiagramStore(state => state.setZoom)
  
  const commands: CommandItem[] = [
    { id: 'new-file', label: t('commands.newFile'), category: t('commands.categoryFile'), shortcut: 'Ctrl+N', action: () => initNewFile('Без названия') },
    { id: 'tool-select', label: t('commands.toolSelect'), category: t('commands.categoryTools'), shortcut: 'V', action: () => setCurrentTool('select') },
    { id: 'tool-pan', label: t('commands.toolPan'), category: t('commands.categoryTools'), shortcut: 'H', action: () => setCurrentTool('pan') },
    { id: 'tool-rectangle', label: t('commands.toolRectangle'), category: t('commands.categoryTools'), shortcut: 'R', action: () => setCurrentTool('rectangle') },
    { id: 'tool-ellipse', label: t('commands.toolEllipse'), category: t('commands.categoryTools'), shortcut: 'E', action: () => setCurrentTool('ellipse') },
    { id: 'tool-diamond', label: t('commands.toolDiamond'), category: t('commands.categoryTools'), shortcut: 'D', action: () => setCurrentTool('diamond') },
    { id: 'tool-line', label: t('commands.toolLine'), category: t('commands.categoryTools'), shortcut: 'L', action: () => setCurrentTool('line') },
    { id: 'tool-arrow', label: t('commands.toolArrow'), category: t('commands.categoryTools'), shortcut: 'A', action: () => setCurrentTool('arrow') },
    { id: 'tool-text', label: t('commands.toolText'), category: t('commands.categoryTools'), shortcut: 'T', action: () => setCurrentTool('text') },
    { id: 'undo', label: t('commands.undo'), category: t('commands.categoryEdit'), shortcut: 'Ctrl+Z', action: undo },
    { id: 'redo', label: t('commands.redo'), category: t('commands.categoryEdit'), shortcut: 'Ctrl+Shift+Z', action: redo },
    { id: 'zoom-in', label: t('commands.zoomIn'), category: t('commands.categoryView'), shortcut: 'Ctrl++', action: () => setZoom(1.5) },
    { id: 'zoom-out', label: t('commands.zoomOut'), category: t('commands.categoryView'), shortcut: 'Ctrl+-', action: () => setZoom(0.75) },
    { id: 'zoom-fit', label: t('commands.zoomFit'), category: t('commands.categoryView'), shortcut: 'Ctrl+0', action: () => setZoom(1) },
  ]
  
  const filteredCommands = query
    ? commands.filter(cmd => 
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.category.toLowerCase().includes(query.toLowerCase())
      )
    : commands
  
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, CommandItem[]>)
  
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])
  
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
          onClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [filteredCommands, selectedIndex, onClose])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg bg-popover border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 border-b">
          <Search size={16} className="text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('commandPalette.placeholder')}
            className="flex-1 py-3 bg-transparent border-0 outline-none text-sm"
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded">
            <Command size={12} />K
          </kbd>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto scrollbar-thin p-1">
          {Object.entries(groupedCommands).map(([category, items]) => (
            <div key={category} className="mb-2">
              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {category}
              </div>
              {items.map((item, _idx) => {
                const flatIndex = filteredCommands.indexOf(item)
                return (
                  <button
                    key={item.id}
                    className={cn(
                      'flex items-center justify-between w-full px-2 py-1.5 text-sm rounded',
                      flatIndex === selectedIndex && 'bg-accent'
                    )}
                    onClick={() => {
                      item.action()
                      onClose()
                    }}
                    onMouseEnter={() => setSelectedIndex(flatIndex)}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="text-xs text-muted-foreground">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          
          {filteredCommands.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('commandPalette.noResults')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
