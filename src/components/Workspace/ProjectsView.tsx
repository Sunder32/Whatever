import { useState, useMemo, useEffect } from 'react'
import { 
  Plus,
  Search,
  Grid,
  List,
  Star,
  Clock,
  Eye,
  Lock,
  Globe,
  MoreHorizontal,
  Trash2,
  Archive,
  Copy,
  LayoutDashboard
} from 'lucide-react'
import { useProjectStore, useAuthStore } from '@/stores'
import { cn } from '@/utils'

interface ProjectsViewProps {
  onOpenProject: (id: string) => void
  onNewProject: () => void
}

type ViewMode = 'grid' | 'list'
type SortBy = 'updated' | 'created' | 'name' | 'stars'
type FilterBy = 'all' | 'public' | 'private' | 'archived'

export function ProjectsView({ onOpenProject, onNewProject }: ProjectsViewProps) {
  const { user } = useAuthStore()
  const { 
    projects, 
    fetchProjects, 
    deleteProject, 
    archiveProject, 
    duplicateProject,
    toggleProjectVisibility,
    getOwnProjects
  } = useProjectStore()
  
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [filterBy, setFilterBy] = useState<FilterBy>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  
  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])
  
  // Get own projects
  const ownProjects = useMemo(() => getOwnProjects(), [projects, user])
  
  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = [...ownProjects]
    
    // Search
    if (searchQuery) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Filter
    switch (filterBy) {
      case 'public':
        result = result.filter(p => p.isPublic && !p.isArchived)
        break
      case 'private':
        result = result.filter(p => !p.isPublic && !p.isArchived)
        break
      case 'archived':
        result = result.filter(p => p.isArchived)
        break
      case 'all':
      default:
        result = result.filter(p => !p.isArchived)
    }
    
    // Sort
    switch (sortBy) {
      case 'created':
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'stars':
        result.sort((a, b) => (b.stars || 0) - (a.stars || 0))
        break
      case 'updated':
      default:
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    }
    
    return result
  }, [ownProjects, searchQuery, filterBy, sortBy])
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffDays < 1) return 'сегодня'
    if (diffDays === 1) return 'вчера'
    if (diffDays < 7) return `${diffDays} дн. назад`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`
    return date.toLocaleDateString('ru-RU')
  }
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Ваши проекты</h2>
          <p className="text-muted-foreground">{ownProjects.filter(p => !p.isArchived).length} проектов</p>
        </div>
        <button
          onClick={onNewProject}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={18} />
          Новый проект
        </button>
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Найти проект..."
              className="pl-9 pr-4 py-2 w-64 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          
          {/* Filter */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <button
              onClick={() => setFilterBy('all')}
              className={cn(
                "px-3 py-1.5 rounded text-sm transition-colors",
                filterBy === 'all' ? "bg-secondary" : "hover:bg-secondary/50"
              )}
            >
              Все
            </button>
            <button
              onClick={() => setFilterBy('public')}
              className={cn(
                "px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1",
                filterBy === 'public' ? "bg-secondary" : "hover:bg-secondary/50"
              )}
            >
              <Globe size={14} />
              Публичные
            </button>
            <button
              onClick={() => setFilterBy('private')}
              className={cn(
                "px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1",
                filterBy === 'private' ? "bg-secondary" : "hover:bg-secondary/50"
              )}
            >
              <Lock size={14} />
              Приватные
            </button>
            <button
              onClick={() => setFilterBy('archived')}
              className={cn(
                "px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1",
                filterBy === 'archived' ? "bg-secondary" : "hover:bg-secondary/50"
              )}
            >
              <Archive size={14} />
              Архив
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="updated">По обновлению</option>
            <option value="created">По созданию</option>
            <option value="name">По имени</option>
            <option value="stars">По звёздам</option>
          </select>
          
          {/* View mode */}
          <div className="flex items-center border rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded transition-colors",
                viewMode === 'grid' ? "bg-secondary" : "hover:bg-secondary/50"
              )}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded transition-colors",
                viewMode === 'list' ? "bg-secondary" : "hover:bg-secondary/50"
              )}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Projects grid/list */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              className="group border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => onOpenProject(project.id)}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-secondary flex items-center justify-center">
                {project.thumbnailUrl ? (
                  <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-6xl text-muted-foreground/30"><LayoutDashboard size={60} /></div>
                )}
              </div>
              
              {/* Content */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium group-hover:text-primary transition-colors">{project.name}</h3>
                    {project.isPublic ? (
                      <Globe size={14} className="text-muted-foreground" />
                    ) : (
                      <Lock size={14} className="text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === project.id ? null : project.id) }}
                      className="p-1.5 rounded hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    
                    {activeMenu === project.id && (
                      <div className="absolute right-0 top-8 bg-popover border rounded-lg shadow-lg py-1 z-10 w-40">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation()
                            toggleProjectVisibility(project.id)
                            setActiveMenu(null)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent"
                        >
                          {project.isPublic ? <Lock size={14} /> : <Globe size={14} />}
                          {project.isPublic ? 'Сделать приватным' : 'Сделать публичным'}
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation()
                            duplicateProject(project.id)
                            setActiveMenu(null)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent"
                        >
                          <Copy size={14} />
                          Дублировать
                        </button>
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation()
                            archiveProject(project.id)
                            setActiveMenu(null)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent"
                        >
                          <Archive size={14} />
                          В архив
                        </button>
                        <div className="border-t my-1" />
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation()
                            if (confirm('Удалить проект?')) {
                              deleteProject(project.id)
                            }
                            setActiveMenu(null)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 size={14} />
                          Удалить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                
                {/* Stats */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star size={12} />
                    {project.stars}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye size={12} />
                    {project.views}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock size={12} />
                    {formatDate(project.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              className="group flex items-center gap-4 p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => onOpenProject(project.id)}
            >
              {/* Thumbnail */}
              <div className="w-16 h-12 rounded bg-secondary flex items-center justify-center shrink-0">
                {project.thumbnailUrl ? (
                  <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover rounded" />
                ) : (
                  <div className="text-2xl text-muted-foreground/30"><LayoutDashboard size={24} /></div>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium group-hover:text-primary transition-colors">{project.name}</h3>
                  {project.isPublic ? (
                    <Globe size={14} className="text-muted-foreground" />
                  ) : (
                    <Lock size={14} className="text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{project.description}</p>
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                  <Star size={14} />
                  {project.stars}
                </span>
                <span className="flex items-center gap-1">
                  <Eye size={14} />
                  {project.views}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {formatDate(project.updatedAt)}
                </span>
              </div>
              
              {/* Menu */}
              <button
                onClick={(e) => { e.stopPropagation() }}
                className="p-2 rounded hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {filteredProjects.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Проекты не найдены</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-primary hover:underline"
            >
              Сбросить поиск
            </button>
          )}
        </div>
      )}
    </div>
  )
}
