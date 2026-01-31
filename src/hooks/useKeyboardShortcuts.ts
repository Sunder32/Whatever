import { useEffect, useCallback } from 'react'
import { useDiagramStore, useAppStore } from '@/stores'

// Default keyboard shortcuts configuration
export const defaultShortcuts = {
  // File operations
  newFile: { key: 'n', ctrl: true, description: 'Новый файл' },
  save: { key: 's', ctrl: true, description: 'Сохранить' },
  saveAs: { key: 's', ctrl: true, shift: true, description: 'Сохранить как' },
  open: { key: 'o', ctrl: true, description: 'Открыть' },
  
  // Edit operations
  undo: { key: 'z', ctrl: true, description: 'Отменить' },
  redo: { key: 'y', ctrl: true, description: 'Повторить' },
  redoAlt: { key: 'z', ctrl: true, shift: true, description: 'Повторить (альт.)' },
  cut: { key: 'x', ctrl: true, description: 'Вырезать' },
  copy: { key: 'c', ctrl: true, description: 'Копировать' },
  paste: { key: 'v', ctrl: true, description: 'Вставить' },
  duplicate: { key: 'd', ctrl: true, description: 'Дублировать' },
  delete: { key: 'Delete', description: 'Удалить' },
  deleteAlt: { key: 'Backspace', description: 'Удалить (альт.)' },
  selectAll: { key: 'a', ctrl: true, description: 'Выделить всё' },
  deselect: { key: 'Escape', description: 'Снять выделение' },
  
  // View operations
  zoomIn: { key: '+', ctrl: true, description: 'Приблизить' },
  zoomInAlt: { key: '=', ctrl: true, description: 'Приблизить (альт.)' },
  zoomOut: { key: '-', ctrl: true, description: 'Отдалить' },
  zoomReset: { key: '0', ctrl: true, description: 'Сбросить масштаб' },
  fitToScreen: { key: '1', ctrl: true, description: 'Вписать в экран' },
  toggleGrid: { key: 'g', ctrl: true, description: 'Переключить сетку' },
  
  // Tools (without modifiers)
  toolSelect: { key: 'v', description: 'Выделение' },
  toolPan: { key: 'h', description: 'Рука (перемещение)' },
  toolRectangle: { key: 'r', description: 'Прямоугольник' },
  toolEllipse: { key: 'e', description: 'Эллипс' },
  toolDiamond: { key: 'd', description: 'Ромб' },
  toolTriangle: { key: 'y', description: 'Треугольник' },
  toolLine: { key: 'l', description: 'Линия' },
  toolArrow: { key: 'a', description: 'Стрелка' },
  toolText: { key: 't', description: 'Текст' },
  toolImage: { key: 'i', description: 'Изображение' },
  toolFreehand: { key: 'p', description: 'Карандаш' },
  toolStar: { key: 's', description: 'Звезда' },
  toolNote: { key: 'n', description: 'Заметка' },
  
  // UI
  commandPalette: { key: 'k', ctrl: true, description: 'Панель команд' },
  settings: { key: ',', ctrl: true, description: 'Настройки' },
  help: { key: 'F1', description: 'Помощь' },
} as const

export type ShortcutAction = keyof typeof defaultShortcuts

// Base shortcut config (without description) - for user customizations
interface BaseShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

// Full shortcut config (with description) - for default shortcuts
export interface ShortcutConfig extends BaseShortcutConfig {
  description: string
}

// Check if a keyboard event matches a shortcut
export function matchesShortcut(e: KeyboardEvent, shortcut: BaseShortcutConfig): boolean {
  const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase()
  const ctrlMatches = (e.ctrlKey || e.metaKey) === !!shortcut.ctrl
  const shiftMatches = e.shiftKey === !!shortcut.shift
  const altMatches = e.altKey === !!shortcut.alt
  
  return keyMatches && ctrlMatches && shiftMatches && altMatches
}

// Format shortcut for display
export function formatShortcut(shortcut: BaseShortcutConfig): string {
  const parts: string[] = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')
  
  let key = shortcut.key
  // Format special keys
  if (key === 'Delete') key = 'Del'
  else if (key === 'Backspace') key = '⌫'
  else if (key === 'Escape') key = 'Esc'
  else if (key === ' ') key = 'Space'
  else key = key.toUpperCase()
  
  parts.push(key)
  return parts.join('+')
}

interface UseKeyboardShortcutsOptions {
  onCommandPalette?: () => void
  onSettings?: () => void
  onNewFile?: () => void
  onSave?: () => void
  onOpen?: () => void
  disabled?: boolean
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onCommandPalette, onSettings, onNewFile, onSave, onOpen, disabled } = options
  
  const undo = useDiagramStore(state => state.undo)
  const redo = useDiagramStore(state => state.redo)
  const file = useDiagramStore(state => state.file)
  const deleteNode = useDiagramStore(state => state.deleteNode)
  const selectElements = useDiagramStore(state => state.selectElements)
  const clearSelection = useDiagramStore(state => state.clearSelection)
  const setZoom = useDiagramStore(state => state.setZoom)
  const setPan = useDiagramStore(state => state.setPan)
  const addNode = useDiagramStore(state => state.addNode)
  const updateCanvasState = useDiagramStore(state => state.updateCanvasState)
  
  const setCurrentTool = useAppStore(state => state.setCurrentTool)
  const customShortcuts = useAppStore(state => state.customShortcuts)
  
  const nodes = file?.content.nodes ?? []
  const selectedIds = file?.canvasState.selectedElements ?? []
  const zoom = file?.canvasState.zoom ?? 1
  const grid = file?.canvasState.grid
  
  // Merge default shortcuts with custom ones
  const getShortcut = useCallback((action: ShortcutAction): BaseShortcutConfig => {
    return customShortcuts[action] || defaultShortcuts[action]
  }, [customShortcuts])
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (disabled) return
    
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Allow Escape in inputs
      if (e.key !== 'Escape') return
    }
    
    // Command palette
    if (matchesShortcut(e, getShortcut('commandPalette'))) {
      e.preventDefault()
      onCommandPalette?.()
      return
    }
    
    // Settings
    if (matchesShortcut(e, getShortcut('settings'))) {
      e.preventDefault()
      onSettings?.()
      return
    }
    
    // Undo/Redo
    if (matchesShortcut(e, getShortcut('undo'))) {
      e.preventDefault()
      undo()
      return
    }
    if (matchesShortcut(e, getShortcut('redo')) || matchesShortcut(e, getShortcut('redoAlt'))) {
      e.preventDefault()
      redo()
      return
    }
    
    // Delete
    if (matchesShortcut(e, getShortcut('delete')) || matchesShortcut(e, getShortcut('deleteAlt'))) {
      if (selectedIds.length > 0) {
        e.preventDefault()
        selectedIds.forEach(id => deleteNode(id))
        clearSelection()
      }
      return
    }
    
    // Select all
    if (matchesShortcut(e, getShortcut('selectAll'))) {
      e.preventDefault()
      selectElements(nodes.map(n => n.id))
      return
    }
    
    // Deselect
    if (matchesShortcut(e, getShortcut('deselect'))) {
      clearSelection()
      return
    }
    
    // Zoom
    if (matchesShortcut(e, getShortcut('zoomIn')) || matchesShortcut(e, getShortcut('zoomInAlt'))) {
      e.preventDefault()
      setZoom(Math.min(4, zoom * 1.2))
      return
    }
    if (matchesShortcut(e, getShortcut('zoomOut'))) {
      e.preventDefault()
      setZoom(Math.max(0.1, zoom / 1.2))
      return
    }
    if (matchesShortcut(e, getShortcut('zoomReset'))) {
      e.preventDefault()
      setZoom(1)
      setPan({ x: 0, y: 0 })
      return
    }
    
    // Toggle grid
    if (matchesShortcut(e, getShortcut('toggleGrid'))) {
      e.preventDefault()
      if (grid) {
        updateCanvasState({ grid: { ...grid, enabled: !grid.enabled } })
      }
      return
    }
    
    // Duplicate selected
    if (matchesShortcut(e, getShortcut('duplicate'))) {
      e.preventDefault()
      if (selectedIds.length > 0) {
        const newIds: string[] = []
        selectedIds.forEach(id => {
          const node = nodes.find(n => n.id === id)
          if (node) {
            const newId = addNode({
              ...node,
              position: { x: node.position.x + 20, y: node.position.y + 20 },
            })
            newIds.push(newId)
          }
        })
        if (newIds.length > 0) {
          selectElements(newIds)
        }
      }
      return
    }
    
    // File operations
    if (matchesShortcut(e, getShortcut('newFile'))) {
      e.preventDefault()
      onNewFile?.()
      return
    }
    if (matchesShortcut(e, getShortcut('save'))) {
      e.preventDefault()
      onSave?.()
      return
    }
    if (matchesShortcut(e, getShortcut('open'))) {
      e.preventDefault()
      onOpen?.()
      return
    }
    
    // Tool shortcuts (no modifiers) - check against custom shortcuts
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      // Check each tool shortcut
      if (matchesShortcut(e, getShortcut('toolSelect'))) { setCurrentTool('select'); return }
      if (matchesShortcut(e, getShortcut('toolPan'))) { setCurrentTool('pan'); return }
      if (matchesShortcut(e, getShortcut('toolRectangle'))) { setCurrentTool('rectangle'); return }
      if (matchesShortcut(e, getShortcut('toolEllipse'))) { setCurrentTool('ellipse'); return }
      if (matchesShortcut(e, getShortcut('toolDiamond'))) { setCurrentTool('diamond'); return }
      if (matchesShortcut(e, getShortcut('toolTriangle'))) { setCurrentTool('triangle'); return }
      if (matchesShortcut(e, getShortcut('toolLine'))) { setCurrentTool('line'); return }
      if (matchesShortcut(e, getShortcut('toolArrow'))) { setCurrentTool('arrow'); return }
      if (matchesShortcut(e, getShortcut('toolText'))) { setCurrentTool('text'); return }
      if (matchesShortcut(e, getShortcut('toolImage'))) { setCurrentTool('image'); return }
      if (matchesShortcut(e, getShortcut('toolFreehand'))) { setCurrentTool('freehand'); return }
      if (matchesShortcut(e, getShortcut('toolStar'))) { setCurrentTool('star'); return }
      if (matchesShortcut(e, getShortcut('toolNote'))) { setCurrentTool('note'); return }
    }
  }, [
    disabled, onCommandPalette, onSettings, onNewFile, onSave, onOpen,
    undo, redo, deleteNode, clearSelection, selectElements, setZoom, setPan,
    setCurrentTool, updateCanvasState, addNode, getShortcut,
    nodes, selectedIds, zoom, grid
  ])
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
  
  return { shortcuts: defaultShortcuts, formatShortcut }
}
