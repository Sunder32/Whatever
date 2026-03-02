import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { 
  ArrowLeft, 
  Save, 
  Download, 
  Upload, 
  Settings,
  Share2,
  Layers,
  Library,
  Sun,
  Moon,
  Cloud,
  CloudOff,
  Loader2,
  HardDrive,
  Command,
  Eye
} from 'lucide-react'
import { toJpeg } from 'html-to-image'
import { 
  LayersPanel,
  TemplateLibrary,
  SettingsDialog,
  ExportImportDialog,
  ShareDialog,
  CommandPalette
} from '@/components'
import { FlowEditor } from '@/components/FlowEditor'
import { useDiagramStore, useAppStore, useProjectStore, useGraphStore, useAuthStore } from '@/stores'
import { useTheme, useOnlineStatus, useKeyboardShortcuts, useAutoSave, useCollaboration } from '@/hooks'
import { storageService, webSocketService } from '@/services'
import { cn } from '@/utils'
import { type TemplateType, getTemplateById } from '@/utils/diagramTemplates'
import { syncFlowToWtvFile } from '@/utils/diagramAdapter'
import type { FlowNode, FlowEdge } from '@/stores/graphStore'

interface EditorViewProps {
  projectId: string | null
  templateType?: TemplateType | null
  onBack: () => void
}

/**
 * EditorView - Новая версия редактора на базе React Flow
 * 
 * Особенности:
 * - Чистый интерфейс без визуального шума
 * - Floating toolbar интегрирован в FlowEditor
 * - Контекстный inspector интегрирован в FlowEditor
 * - Минимальный хедер с основными действиями
 * - Синхронизация с diagramStore для сохранения
 */
export function EditorViewNew({ projectId, templateType, onBack }: EditorViewProps) {
  const { theme, setTheme } = useTheme()
  const { isOnline } = useOnlineStatus()
  
  // Dialogs state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [layersPanelOpen, setLayersPanelOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [storageMode, setStorageMode] = useState<'local' | 'cloud' | 'syncing'>('local')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  
  // Online collaboration users
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const currentUser = useAuthStore(state => state.user)
  
  // Flag to prevent echo: when applying remote changes, skip broadcasting them back
  const isRemoteRef = useRef(false)
  
  // Realtime collaboration via WebSocket
  const handleElementUpdate = useCallback((elementId: string, changes: Record<string, unknown>) => {
    isRemoteRef.current = true
    try {
      const { nodes } = useGraphStore.getState()
      const existingNode = nodes.find(n => n.id === elementId)
      if (existingNode) {
        if (changes.position) {
          useGraphStore.getState().updateNodePosition(elementId, changes.position as { x: number; y: number })
        }
        const dataChanges = { ...changes }
        delete dataChanges.position
        if (Object.keys(dataChanges).length > 0) {
          useGraphStore.getState().updateNode(elementId, dataChanges as any)
        }
      }
    } finally {
      isRemoteRef.current = false
    }
  }, [])

  // Handle remote element creation (new nodes / new edges from other users)
  const handleRemoteCreate = useCallback((data: Record<string, unknown>) => {
    isRemoteRef.current = true
    try {
      if (data.node) {
        const node = data.node as FlowNode
        const { nodes } = useGraphStore.getState()
        if (!nodes.find(n => n.id === node.id)) {
          useGraphStore.setState({ nodes: [...nodes, node] })
        }
      }
      if (data.edge) {
        const edge = data.edge as FlowEdge
        const { edges } = useGraphStore.getState()
        if (!edges.find(e => e.id === edge.id)) {
          useGraphStore.setState({ edges: [...edges, edge] })
        }
      }
    } finally {
      isRemoteRef.current = false
    }
  }, [])

  // Handle remote element deletion
  const handleRemoteDelete = useCallback((data: Record<string, unknown>) => {
    isRemoteRef.current = true
    try {
      if (data.elementId) {
        const id = data.elementId as string
        const { nodes, edges } = useGraphStore.getState()
        useGraphStore.setState({
          nodes: nodes.filter(n => n.id !== id),
          edges: edges.filter(e => e.source !== id && e.target !== id),
        })
      }
      if (data.edgeId) {
        const id = data.edgeId as string
        const { edges } = useGraphStore.getState()
        useGraphStore.setState({ edges: edges.filter(e => e.id !== id) })
      }
    } finally {
      isRemoteRef.current = false
    }
  }, [])
  
  const { sendElementUpdate } = useCollaboration({
    schemaId: projectId || null,
    userId: currentUser?.id || '',
    userName: currentUser?.fullName || currentUser?.username || 'Anonymous',
    enabled: !!projectId && !!currentUser,
    onElementUpdate: handleElementUpdate,
    onElementCreate: handleRemoteCreate,
    onElementDelete: handleRemoteDelete,
    onUserJoin: useCallback((userId: string) => {
      setOnlineUsers(prev => prev.includes(userId) ? prev : [...prev, userId])
    }, []),
    onUserLeave: useCallback((userId: string) => {
      setOnlineUsers(prev => prev.filter(id => id !== userId))
    }, []),
  })
  
  // Subscribe to graph changes and broadcast via WebSocket
  useEffect(() => {
    if (!projectId || !currentUser) return
    
    const unsub = useGraphStore.subscribe((state, prevState) => {
      // Skip broadcasting when we're applying remote changes
      if (isRemoteRef.current) return
      
      // --- Node changes ---
      if (state.nodes !== prevState.nodes) {
        const prevMap = new Map(prevState.nodes.map(n => [n.id, n]))
        const currMap = new Map(state.nodes.map(n => [n.id, n]))
        
        // New nodes → broadcast element_create
        for (const node of state.nodes) {
          if (!prevMap.has(node.id)) {
            webSocketService.send('element_create', {
              room: `schema:${projectId}`,
              node,
              userId: currentUser.id,
            })
          }
        }
        
        // Changed nodes → broadcast element_update
        for (const node of state.nodes) {
          const prev = prevMap.get(node.id)
          if (!prev) continue
          
          const changes: Record<string, unknown> = {}
          if (node.position.x !== prev.position.x || node.position.y !== prev.position.y) {
            changes.position = node.position
          }
          if (node.data !== prev.data) {
            Object.assign(changes, node.data)
          }
          if (node.style !== prev.style && node.style) {
            changes.style = node.style
          }
          if (Object.keys(changes).length > 0) {
            sendElementUpdate(node.id, changes)
          }
        }
        
        // Deleted nodes → broadcast element_delete
        for (const prev of prevState.nodes) {
          if (!currMap.has(prev.id)) {
            webSocketService.send('element_delete', {
              room: `schema:${projectId}`,
              elementId: prev.id,
              userId: currentUser.id,
            })
          }
        }
      }
      
      // --- Edge changes ---
      if (state.edges !== prevState.edges) {
        const prevMap = new Map(prevState.edges.map(e => [e.id, e]))
        const currMap = new Map(state.edges.map(e => [e.id, e]))
        
        // New edges
        for (const edge of state.edges) {
          if (!prevMap.has(edge.id)) {
            webSocketService.send('element_create', {
              room: `schema:${projectId}`,
              edge,
              userId: currentUser.id,
            })
          }
        }
        
        // Deleted edges
        for (const prev of prevState.edges) {
          if (!currMap.has(prev.id)) {
            webSocketService.send('element_delete', {
              room: `schema:${projectId}`,
              edgeId: prev.id,
              userId: currentUser.id,
            })
          }
        }
      }
    })
    
    return () => unsub()
  }, [projectId, currentUser, sendElementUpdate])
  
  // Stores
  const file = useDiagramStore(state => state.file)
  const initNewFile = useDiagramStore(state => state.initNewFile)
  const loadProjectFile = useDiagramStore(state => state.loadProjectFile)
  const isSyncing = useAppStore(state => state.isSyncing)
  const setHasUnsavedChanges = useAppStore(state => state.setHasUnsavedChanges)
  const getProjectById = useProjectStore(state => state.getProjectById)
  const canEditProject = useProjectStore(state => state.canEditProject)
  const updateProject = useProjectStore(state => state.updateProject)
  
  // Проверка прав на редактирование
  const canEdit = useMemo(() => {
    if (!projectId) return true // Новый проект - можно редактировать
    return canEditProject(projectId)
  }, [projectId, canEditProject])
  
  // Graph store for sync
  const loadFromWtvFile = useGraphStore(state => state.loadFromWtvFile)
  const markClean = useGraphStore(state => state.markClean)
  const isDirty = useGraphStore(state => state.isDirty)
  
  // Local sync implementation to avoid circular dependency in stores
  const syncToWtvFile = useCallback(() => {
    const { nodes, edges, viewport } = useGraphStore.getState()
    const { file, loadFile } = useDiagramStore.getState()
    if (file) {
      const updatedFile = syncFlowToWtvFile(file, nodes, edges, viewport)
      loadFile(updatedFile)
      markClean()
    }
  }, [markClean])
  
  // Sync isDirty to appStore.hasUnsavedChanges
  useEffect(() => {
    setHasUnsavedChanges(isDirty)
  }, [isDirty, setHasUnsavedChanges])
  
  // Project name
  const projectName = useMemo(() => {
    if (projectId) {
      const project = getProjectById(projectId)
      return project?.name || file?.metadata.name || 'Проект'
    }
    return file?.metadata.name || 'Новый проект'
  }, [projectId, getProjectById, file?.metadata.name])
  
  // Generate thumbnail from canvas
  const generateThumbnail = useCallback(async (): Promise<string | null> => {
    try {
      const viewport = document.querySelector('.react-flow__viewport') as HTMLElement
      if (!viewport) return null
      
      const dataUrl = await toJpeg(viewport, {
        quality: 0.7,
        width: 400,
        height: 300,
        backgroundColor: '#1a1a2e',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'center center',
        }
      })
      return dataUrl
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error)
      return null
    }
  }, [])
  
  // Handle save with sync and thumbnail
  const handleSave = useCallback(async () => {
    if (!canEdit) return // Нельзя сохранять чужой проект
    
    // Сначала синхронизируем React Flow -> WtvFile
    syncToWtvFile()
    
    // Generate thumbnail
    const thumbnail = await generateThumbnail()
    
    // Затем сохраняем через storageService
    setTimeout(() => {
      const currentFile = useDiagramStore.getState().file
      if (currentFile) {
        // Update thumbnail in file if generated
        if (thumbnail) {
          currentFile.thumbnail = {
            data: thumbnail,
            width: 400,
            height: 300
          }
        }
        storageService.save(currentFile)
      }
    }, 100) // Небольшая задержка для завершения синхронизации
  }, [syncToWtvFile, canEdit, generateThumbnail])
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: () => setCommandPaletteOpen(true),
    onSettings: () => setSettingsOpen(true),
    onNewFile: () => initNewFile('Untitled', projectId || undefined),
    onSave: handleSave,
    onOpen: () => setImportDialogOpen(true),
  })

  // Auto-save
  useAutoSave({
    enabled: canEdit,
    onSave: handleSave,
    interval: 30000,
  })
  
  // Load file into graphStore when diagramStore.file changes
  useEffect(() => {
    if (file) {
      loadFromWtvFile(file)
    }
  }, [file, loadFromWtvFile])
  
  // Initialize file for project
  useEffect(() => {
    if (projectId) {
      loadProjectFile(projectId)
    } else if (!file) {
      initNewFile('Новый проект')
    }
  }, [projectId, loadProjectFile, initNewFile])
  
  // Load template data when a template is selected for new project
  useEffect(() => {
    if (templateType && file) {
      const template = getTemplateById(templateType)
      if (template && template.nodes.length > 0) {
        // Import template nodes and edges to graph store
        const importGraph = useGraphStore.getState().importGraph
        
        // Convert template nodes to React Flow nodes with proper structure
        const flowNodes = template.nodes.map(node => ({
          id: node.id,
          type: 'customNode', // Use our custom node type
          position: node.position,
          data: {
            label: node.label || 'Node',
            nodeType: (node.type || 'rectangle') as any,
            fill: '#3b82f6',
            stroke: '#2563eb',
            strokeWidth: 2,
            opacity: 1,
            cornerRadius: 8,
            textColor: '#ffffff',
            fontSize: 14,
            fontFamily: 'Inter',
            locked: false,
          }
        }))
        
        // Convert template edges to React Flow edges
        const flowEdges = template.edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          label: edge.label,
          style: { stroke: '#64748b' }
        }))
        
        importGraph({ nodes: flowNodes as any, edges: flowEdges as any })
      }
    }
  }, [templateType, file])
  
  // Subscribe to storage mode
  useEffect(() => {
    const unsubscribe = storageService.subscribe((state) => {
      setStorageMode(state.mode)
    })
    return () => unsubscribe()
  }, [])
  
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Read-only banner */}
      {!canEdit && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-sm">
          <Eye size={16} />
          <span>Режим просмотра — вы не можете редактировать этот проект</span>
        </div>
      )}
      
      {/* Minimal header */}
      <header className="flex items-center justify-between px-4 h-11 bg-card/50 backdrop-blur-md border-b border-border/50 shrink-0 z-50">
        {/* Left section */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm"
            title="Назад к проектам"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline text-muted-foreground">Назад</span>
          </button>
          
          <div className="w-px h-5 bg-border/50" />
          
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <input
                autoFocus
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onBlur={() => {
                  const trimmed = editNameValue.trim()
                  if (trimmed && trimmed !== projectName && projectId) {
                    updateProject(projectId, { name: trimmed })
                  }
                  setIsEditingName(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setIsEditingName(false)
                }}
                className="font-medium text-sm max-w-[200px] px-1 py-0.5 rounded bg-secondary border border-primary/50 outline-none"
              />
            ) : (
              <span
                className="font-medium text-sm max-w-[200px] truncate cursor-pointer hover:bg-secondary/50 px-1 py-0.5 rounded transition-colors"
                onDoubleClick={() => {
                  if (canEdit && projectId) {
                    setEditNameValue(projectName)
                    setIsEditingName(true)
                  }
                }}
                title={canEdit ? 'Двойной клик для переименования' : projectName}
              >
                {projectName}
              </span>
            )}
            {isDirty && canEdit && (
              <span className="w-2 h-2 rounded-full bg-yellow-500" title="Есть несохранённые изменения" />
            )}
            {!canEdit && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">Только просмотр</span>
            )}
          </div>
        </div>
        
        {/* Center - Command palette trigger */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-sm text-muted-foreground"
        >
          <Command size={14} />
          <span>Поиск команд...</span>
          <kbd className="px-1.5 py-0.5 rounded bg-background text-xs border border-border/50">Ctrl+K</kbd>
        </button>
        
        {/* Right section */}
        <div className="flex items-center gap-1">
          {/* Quick actions */}
          <button
            onClick={() => setLibraryOpen(!libraryOpen)}
            className={cn("p-2 rounded-lg hover:bg-accent transition-colors", libraryOpen && "bg-accent")}
            title="Шаблоны"
          >
            <Library size={16} />
          </button>
          
          <button
            onClick={() => setLayersPanelOpen(!layersPanelOpen)}
            className={cn("p-2 rounded-lg hover:bg-accent transition-colors", layersPanelOpen && "bg-accent")}
            title="Слои"
          >
            <Layers size={16} />
          </button>
          
          <div className="w-px h-5 bg-border/50 mx-1" />
          
          <button
            onClick={() => setImportDialogOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Импорт"
          >
            <Upload size={16} />
          </button>
          
          <button
            onClick={() => setExportDialogOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Экспорт"
          >
            <Download size={16} />
          </button>
          
          <button
            onClick={handleSave}
            disabled={!canEdit}
            className={cn(
              "p-2 rounded-lg transition-colors",
              !canEdit && "opacity-50 cursor-not-allowed",
              isDirty && canEdit
                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                : "hover:bg-accent"
            )}
            title={canEdit ? "Сохранить (Ctrl+S)" : "Нет прав на сохранение"}
          >
            <Save size={16} />
          </button>
          
          <div className="w-px h-5 bg-border/50 mx-1" />
          
          <button
            onClick={() => setShareOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Поделиться"
          >
            <Share2 size={16} />
          </button>
          
          {/* Online collaboration users */}
          {onlineUsers.length > 0 && (
            <div className="flex items-center -space-x-1.5 ml-1">
              {onlineUsers.slice(0, 4).map((userId, i) => {
                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                return (
                  <div
                    key={userId}
                    className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: colors[i % colors.length], zIndex: 10 - i }}
                    title={`User online`}
                  >
                    {String(i + 1)}
                  </div>
                )
              })}
              {onlineUsers.length > 4 && (
                <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                  +{onlineUsers.length - 4}
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Настройки"
          >
            <Settings size={16} />
          </button>
          
          <div className="w-px h-5 bg-border/50 mx-1" />
          
          {/* Sync status indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/30 text-xs">
            {storageMode === 'cloud' && <Cloud size={12} className="text-green-500" />}
            {storageMode === 'local' && <HardDrive size={12} className="text-yellow-500" />}
            {storageMode === 'syncing' && <Loader2 size={12} className="animate-spin text-blue-500" />}
            {isSyncing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : isOnline ? (
              <span className="w-2 h-2 rounded-full bg-green-500" />
            ) : (
              <CloudOff size={12} className="text-amber-500" />
            )}
          </div>
        </div>
      </header>
      
      {/* Main editor - React Flow based */}
      <div className="flex-1 overflow-hidden">
        <FlowEditor readOnly={!canEdit} projectId={projectId} />
      </div>
      
      {/* Dialogs - rendered outside main flow */}
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />
      
      <SettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      
      <ExportImportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        mode="export"
      />
      
      <ExportImportDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        mode="import"
      />
      
      <LayersPanel
        isOpen={layersPanelOpen}
        onClose={() => setLayersPanelOpen(false)}
      />
      
      <TemplateLibrary
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
      />
      
      <ShareDialog
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  )
}
