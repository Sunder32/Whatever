import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  FileDown
} from 'lucide-react'
import { 
  Canvas, 
  Toolbar, 
  FileExplorer, 
  Inspector, 
  LayersPanel,
  TemplateLibrary,
  StatusBar,
  SettingsDialog,
  ExportImportDialog,
  ShareDialog,
  CommandPalette
} from '@/components'
import { useDiagramStore, useAppStore, useProjectStore } from '@/stores'
import { useTheme, useOnlineStatus, useKeyboardShortcuts } from '@/hooks'
import { storageService } from '@/services'
import { cn } from '@/utils'

interface EditorViewProps {
  projectId: string | null
  onBack: () => void
}

export function EditorView({ projectId, onBack }: EditorViewProps) {
  const { theme, setTheme } = useTheme()
  const { isOnline } = useOnlineStatus()
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [layersPanelOpen, setLayersPanelOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [storageMode, setStorageMode] = useState<'local' | 'cloud' | 'syncing'>('local')
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  
  const file = useDiagramStore(state => state.file)
  const initNewFile = useDiagramStore(state => state.initNewFile)
  const loadProjectFile = useDiagramStore(state => state.loadProjectFile)
  const loadFile = useDiagramStore(state => state.loadFile)
  const hasUnsavedChanges = useAppStore(state => state.hasUnsavedChanges)
  const isSyncing = useAppStore(state => state.isSyncing)
  const getProjectById = useProjectStore(state => state.getProjectById)
  
  // Get project name
  const projectName = useMemo(() => {
    if (projectId) {
      const project = getProjectById(projectId)
      return project?.name || file?.metadata.name || 'Проект'
    }
    return file?.metadata.name || 'Новый проект'
  }, [projectId, getProjectById, file?.metadata.name])
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCommandPalette: () => setCommandPaletteOpen(true),
    onSettings: () => setSettingsOpen(true),
    onNewFile: () => initNewFile('Untitled', projectId || undefined),
    onSave: () => {
      if (file) {
        storageService.save(file)
      }
    },
    onOpen: () => setImportDialogOpen(true),
  })
  
  // Initialize file for project
  useEffect(() => {
    if (projectId) {
      // Load file for this specific project
      loadProjectFile(projectId)
    } else if (!file) {
      // No project, create new file
      initNewFile('Новый проект')
    }
  }, [projectId, loadProjectFile, initNewFile])
  
  // Subscribe to storage mode
  useEffect(() => {
    const unsubscribe = storageService.subscribe((state) => {
      setStorageMode(state.mode)
    })
    return () => unsubscribe()
  }, [])
  
  // Update canvas size on resize
  useEffect(() => {
    const updateSize = () => {
      if (canvasContainerRef.current) {
        setCanvasSize({
          width: canvasContainerRef.current.offsetWidth,
          height: canvasContainerRef.current.offsetHeight
        })
      }
    }
    
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])
  
  // File drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    dragCounter.current = 0

    const droppedFiles = Array.from(e.dataTransfer.files)
    const schemaFile = droppedFiles.find(f => 
      f.name.endsWith('.wtv') || f.name.endsWith('.qwe') || f.name.endsWith('.json')
    )
    if (!schemaFile) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const parsed = JSON.parse(content)
        if (parsed && (parsed.content || parsed.metadata)) {
          loadFile(parsed)
        }
      } catch {
        console.warn('Failed to parse dropped file')
      }
    }
    reader.readAsText(schemaFile)
  }, [loadFile])
  
  return (
    <div
      className="flex flex-col h-full bg-background relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 bg-popover/95 p-8 rounded-xl shadow-2xl">
            <FileDown size={48} className="text-primary" />
            <p className="text-lg font-medium">Перетащите файл сюда</p>
            <p className="text-sm text-muted-foreground">.wtv, .qwe или .json</p>
          </div>
        </div>
      )}
      {/* Editor header */}
      <header className="flex items-center justify-between px-4 h-12 bg-background border-b shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Назад к проектам"
          >
            <ArrowLeft size={18} />
          </button>
          
          <div className="w-px h-6 bg-border" />
          
          <span className="font-medium">
            {projectName}
            {hasUnsavedChanges && ' •'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLibraryOpen(!libraryOpen)}
            className={cn("p-2 rounded-lg hover:bg-accent transition-colors", libraryOpen && "bg-accent")}
            title="Шаблоны"
          >
            <Library size={18} />
          </button>
          
          <button
            onClick={() => setLayersPanelOpen(!layersPanelOpen)}
            className={cn("p-2 rounded-lg hover:bg-accent transition-colors", layersPanelOpen && "bg-accent")}
            title="Слои"
          >
            <Layers size={18} />
          </button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <button
            onClick={() => setImportDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm"
            title="Импорт файла"
          >
            <Upload size={16} />
            <span className="hidden lg:inline">Импорт</span>
          </button>
          
          <button
            onClick={() => setExportDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm"
            title="Экспорт диаграммы"
          >
            <Download size={16} />
            <span className="hidden lg:inline">Экспорт</span>
          </button>
          
          <button
            onClick={() => {
              if (file) storageService.save(file)
            }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm",
              hasUnsavedChanges 
                ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                : "hover:bg-accent"
            )}
            title="Сохранить проект (Ctrl+S)"
          >
            <Save size={16} />
            <span className="hidden lg:inline">Сохранить</span>
          </button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          <button
            onClick={() => setShareOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Поделиться"
          >
            <Share2 size={18} />
          </button>
          
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="Настройки"
          >
            <Settings size={18} />
          </button>
          
          <div className="w-px h-6 bg-border mx-1" />
          
          {/* Sync status */}
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-secondary/50 text-sm">
            {storageMode === 'cloud' && <Cloud size={14} className="text-green-500" />}
            {storageMode === 'local' && <HardDrive size={14} className="text-yellow-500" />}
            {storageMode === 'syncing' && <Loader2 size={14} className="animate-spin text-blue-500" />}
            {isSyncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isOnline ? (
              <span className="text-green-500 text-xs">✓</span>
            ) : (
              <CloudOff size={14} className="text-amber-500" />
            )}
          </div>
        </div>
      </header>
      
      {/* Toolbar */}
      <Toolbar />
      
      {/* Main editor area */}
      <div className="flex flex-1 overflow-hidden">
        <FileExplorer />
        
        <div 
          ref={canvasContainerRef}
          className="flex-1 bg-muted/30 overflow-hidden"
        >
          <Canvas width={canvasSize.width} height={canvasSize.height} />
        </div>
        
        <Inspector />
      </div>
      
      {/* Status bar */}
      <StatusBar />
      
      {/* Dialogs */}
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
