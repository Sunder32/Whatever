import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  FolderOpen, 
  FileIcon, 
  ChevronRight, 
  ChevronDown,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Copy,
  Download,
  PanelLeftClose
} from 'lucide-react'
import { useDiagramStore, useAppStore } from '@/stores'
import { cn, formatDate, formatFileSize } from '@/utils'

interface FileItemProps {
  name: string
  isActive: boolean
  lastModified: string
  fileSize: number
  onClick: () => void
  onDelete?: () => void
  onRename?: () => void
  onDuplicate?: () => void
}

function FileItem({ 
  name, 
  isActive, 
  lastModified, 
  fileSize, 
  onClick,
  onDelete,
  onRename,
  onDuplicate
}: FileItemProps) {
  const { t } = useTranslation()
  const [showMenu, setShowMenu] = useState(false)
  
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-colors',
        'hover:bg-accent',
        isActive && 'bg-accent'
      )}
      onClick={onClick}
    >
      <FileIcon size={16} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(lastModified)} · {formatFileSize(fileSize)}
        </p>
      </div>
      <div className="relative">
        <button
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-background"
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
        >
          <MoreVertical size={14} />
        </button>
        
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 z-10 min-w-[140px] bg-popover border rounded-md shadow-lg py-1">
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
              onClick={(e) => {
                e.stopPropagation()
                onRename?.()
                setShowMenu(false)
              }}
            >
              <Edit size={14} />
              {t('fileExplorer.rename')}
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate?.()
                setShowMenu(false)
              }}
            >
              <Copy size={14} />
              {t('fileExplorer.duplicate')}
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(false)
              }}
            >
              <Download size={14} />
              {t('fileExplorer.export')}
            </button>
            <hr className="my-1 border-border" />
            <button
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.()
                setShowMenu(false)
              }}
            >
              <Trash2 size={14} />
              {t('fileExplorer.delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface ProjectSectionProps {
  name: string
  files: Array<{
    id: string
    name: string
    lastModified: string
    fileSize: number
  }>
  activeFileId?: string
  onFileClick: (id: string) => void
}

function ProjectSection({ name, files, activeFileId, onFileClick }: ProjectSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  
  return (
    <div className="mb-2">
      <button
        className="flex items-center gap-1 w-full px-2 py-1 text-sm font-medium hover:bg-accent rounded"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <FolderOpen size={14} className="text-muted-foreground" />
        <span className="flex-1 text-left truncate">{name}</span>
        <span className="text-xs text-muted-foreground">{files.length}</span>
      </button>
      
      {isExpanded && (
        <div className="ml-2 mt-1 space-y-0.5">
          {files.map(file => (
            <FileItem
              key={file.id}
              name={file.name}
              isActive={file.id === activeFileId}
              lastModified={file.lastModified}
              fileSize={file.fileSize}
              onClick={() => onFileClick(file.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileExplorer() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const file = useDiagramStore(state => state.file)
  const initNewFile = useDiagramStore(state => state.initNewFile)
  const panelVisibility = useAppStore(state => state.panelVisibility)
  const togglePanel = useAppStore(state => state.togglePanel)
  
  const handleNewFile = () => {
    const name = prompt(t('fileExplorer.enterFileName'))
    if (name) {
      initNewFile(name)
    }
  }
  
  const currentFiles = file ? [{
    id: file.id,
    name: file.metadata.name,
    lastModified: file.metadata.modified,
    fileSize: file.metadata.fileSize,
  }] : []
  
  // Collapsed state - don't render at all, let canvas take full width
  if (!panelVisibility.fileExplorer) {
    return null
  }
  
  return (
    <div className="flex flex-col h-full bg-background border-r w-72">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-base font-semibold">{t('fileExplorer.title')}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewFile}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title={t('fileExplorer.newFile')}
          >
            <Plus size={20} />
          </button>
          <button
            onClick={() => togglePanel('fileExplorer')}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title={t('fileExplorer.hide', 'Скрыть панель')}
          >
            <PanelLeftClose size={20} />
          </button>
        </div>
      </div>
      
      <div className="p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('fileExplorer.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-secondary rounded border-0 outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        <ProjectSection
          name={t('fileExplorer.myProject')}
          files={currentFiles}
          activeFileId={file?.id}
          onFileClick={() => {}}
        />
        
        {currentFiles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileIcon size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('fileExplorer.noFiles')}</p>
            <button
              onClick={handleNewFile}
              className="mt-2 text-sm text-primary hover:underline"
            >
              {t('fileExplorer.createNew')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
