import { useState, useEffect, useMemo, useCallback } from 'react'
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
import { useDiagramStore, useAppStore, useProjectStore, useGraphStore } from '@/stores'
import { useTheme, useOnlineStatus, useKeyboardShortcuts, useAutoSave } from '@/hooks'
import { storageService } from '@/services'
import { cn } from '@/utils'
import { type TemplateType, getTemplateById } from '@/utils/diagramTemplates'
import { syncFlowToWtvFile } from '@/utils/diagramAdapter'

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
  
  // Stores
  const file = useDiagramStore(state => state.file)
  const initNewFile = useDiagramStore(state => state.initNewFile)
  const loadProjectFile = useDiagramStore(state => state.loadProjectFile)
  const isSyncing = useAppStore(state => state.isSyncing)
  const setHasUnsavedChanges = useAppStore(state => state.setHasUnsavedChanges)
  const getProjectById = useProjectStore(state => state.getProjectById)
  const canEditProject = useProjectStore(state => state.canEditProject)
  
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
            <span className="font-medium text-sm max-w-[200px] truncate">
              {projectName}
            </span>
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
        <FlowEditor readOnly={!canEdit} />
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
