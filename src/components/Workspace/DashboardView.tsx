import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Clock, 
  Star, 
  Users, 
  TrendingUp,
  Plus,
  MoreHorizontal,
  Eye,
  GitFork,
  Lock,
  Globe,
  Filter,
  LayoutDashboard,
  Workflow,
  Database,
  Network,
  Lightbulb,
  Sparkles,
  Edit3,
  Trash2,
  Copy,
  Share2
} from 'lucide-react'
import { useAuthStore, useProjectStore } from '@/stores'
import { cn } from '@/utils'
import { usersApi, templatesApi, type UserSearchResult, type Template } from '@/api'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useProfileModal } from '@/components/Profile/UserProfileModal'
import { type TemplateType } from '@/utils/diagramTemplates'
import type { LucideIcon } from 'lucide-react'

// Map template category to icon
const templateIcons: Record<string, LucideIcon> = {
  'Business': Workflow,
  'Planning': Lightbulb,
  'Technical': Network,
  'Basic': LayoutDashboard,
}

interface DashboardViewProps {
  onOpenProject: (id: string) => void
  onNewProject: (templateType?: TemplateType) => void
  onNewProjectFromTemplate?: (template: Template) => void
}

export function DashboardView({ onOpenProject, onNewProject, onNewProjectFromTemplate }: DashboardViewProps) {
  const { user } = useAuthStore()
  const { 
    projects, 
    following, 
    fetchProjects, 
    getOwnProjects,
    getSharedProjects,
    getFollowingProjects,
    deleteProject,
    duplicateProject,
    toggleProjectVisibility,
    generateShareLink
  } = useProjectStore()
  const [feedFilter, setFeedFilter] = useState<'all' | 'own' | 'following'>('all')
  const { openProfile } = useProfileModal()
  
  const [followedUsers, setFollowedUsers] = useState<UserSearchResult[]>([])
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null)
  const [serverTemplates, setServerTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close project menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProjectMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])
  
  // Fetch templates from server with fallback to local
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await templatesApi.list()
        if (response.success && response.data && response.data.length > 0) {
          setServerTemplates(response.data)
        } else {
          // Fallback to local templates if server returns empty
          if (import.meta.env.DEV) console.debug('Using local templates as fallback')
        }
      } catch (error) {
        console.error('Failed to load templates from server:', error)
      } finally {
        setTemplatesLoading(false)
      }
    }
    loadTemplates()
  }, [])
  
  // Fetch followed users data
  useEffect(() => {
    if (following.length > 0) {
      Promise.all(following.map(id => usersApi.getById(id)))
        .then(responses => {
          const users = responses
            .filter(r => r.success && r.data)
            .map(r => r.data as UserSearchResult)
          setFollowedUsers(users)
        })
        .catch(console.error)
    } else {
      setFollowedUsers([])
    }
  }, [following])
  
  // Get projects based on filter
  const filteredProjects = useMemo(() => {
    if (!user) return []
    
    switch (feedFilter) {
      case 'own':
        return [...getOwnProjects(), ...getSharedProjects()]
      case 'following':
        return getFollowingProjects()
      default:
        // "All" - показываем: мои + публичные от подписок + публичные от других
        // Сортируем так, чтобы свои проекты были сверху
        const ownProjects = projects.filter(p => 
          p.ownerId === user.id || p.owner?.id === user.id
        )
        const followingPublic = projects.filter(p => 
          p.isPublic && 
          p.ownerId !== user.id && 
          p.owner?.id !== user.id &&
          (following.includes(p.owner?.id || '') || following.includes(p.ownerId || ''))
        )
        const otherPublic = projects.filter(p => 
          p.isPublic && 
          p.ownerId !== user.id && 
          p.owner?.id !== user.id &&
          !following.includes(p.owner?.id || '') && 
          !following.includes(p.ownerId || '')
        )
        return [...ownProjects, ...followingPublic, ...otherPublic]
    }
  }, [projects, feedFilter, user, following, getOwnProjects, getFollowingProjects])
  
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 60) return `${diffMins} мин. назад`
    if (diffHours < 24) return `${diffHours} ч. назад`
    if (diffDays < 7) return `${diffDays} дн. назад`
    return date.toLocaleDateString('ru-RU')
  }
  
  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="grid grid-cols-3 gap-8">
        {/* Main feed - 2 columns */}
        <div className="col-span-2 space-y-8">
          {/* Quick actions */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNewProject()}
              className="flex items-center gap-3 px-6 py-4 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-medium"
            >
              <Plus size={22} />
              Создать проект
            </motion.button>
          </motion.div>
          
          {/* Feed filter */}
          <div className="flex items-center gap-3 border-b border-border/50 pb-4">
            <Filter size={18} className="text-muted-foreground" />
            <button
              onClick={() => setFeedFilter('all')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                feedFilter === 'all' 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                  : "hover:bg-secondary text-muted-foreground"
              )}
            >
              Все
            </button>
            <button
              onClick={() => setFeedFilter('own')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                feedFilter === 'own' 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                  : "hover:bg-secondary text-muted-foreground"
              )}
            >
              Мои проекты
            </button>
            <button
              onClick={() => setFeedFilter('following')}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                feedFilter === 'following' 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                  : "hover:bg-secondary text-muted-foreground"
              )}
            >
              Подписки
            </button>
          </div>
          
          {/* Projects feed */}
          <div className="space-y-5">
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: index * 0.05,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                  whileHover={{ scale: 1.01, y: -2 }}
                  className="p-5 border border-border/50 rounded-2xl hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer group bg-card/50"
                  onClick={() => onOpenProject(project.id)}
                >
                <div className="flex items-start gap-5">
                  {/* Thumbnail */}
                  <div className="w-36 h-28 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden border border-border/50 relative">
                    {project.thumbnailUrl ? (
                      <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle,hsl(var(--muted-foreground)/0.15)_1px,transparent_1px)] bg-[size:8px_8px]">
                        <LayoutDashboard size={32} className="text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Бейдж "Только просмотр" для чужих проектов */}
                    {project.ownerId !== user?.id && project.owner?.id !== user?.id && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[10px] text-white/80 flex items-center gap-1">
                        <Eye size={10} />
                        Просмотр
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {/* Owner */}
                      <button 
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          const ownerId = project.owner?.id || project.ownerId
                          if (ownerId && ownerId !== user?.id) {
                            openProfile(ownerId)
                          }
                        }}
                      >
                        <UserAvatar 
                          src={project.owner?.avatarUrl}
                          name={project.owner?.fullName || user?.fullName || 'User'}
                          size="xs"
                          className="rounded-lg"
                        />
                        <span className="text-sm font-medium text-muted-foreground">
                          {project.ownerId === user?.id || project.owner?.id === user?.id 
                            ? 'Вы' 
                            : project.owner?.fullName || 'Пользователь'}
                        </span>
                      </button>
                      <span className="text-muted-foreground/50">/</span>
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{project.name}</h3>
                      {project.isPublic ? (
                        <Globe size={16} className="text-green-500" />
                      ) : (
                        <Lock size={16} className="text-muted-foreground" />
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {project.description || 'Без описания'}
                    </p>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Star size={16} className="text-yellow-500" />
                        {project.stars || 0}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Eye size={16} />
                        {project.views}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <GitFork size={16} />
                        {project.forks}
                      </span>
                      <span className="flex items-center gap-1.5 ml-auto">
                        <Clock size={16} />
                        {formatRelativeTime(project.updatedAt)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions - Project Menu */}
                  <div className="relative" ref={projectMenuOpen === project.id ? menuRef : undefined}>
                    <button
                      onClick={(e) => { 
                        e.stopPropagation()
                        setProjectMenuOpen(projectMenuOpen === project.id ? null : project.id)
                      }}
                      className="p-2.5 rounded-xl hover:bg-secondary opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {projectMenuOpen === project.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-xl shadow-lg py-1 z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenProject(project.id)
                            setProjectMenuOpen(null)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                        >
                          <Edit3 size={14} />
                          Открыть
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const duplicated = await duplicateProject(project.id)
                              if (duplicated) {
                                onOpenProject(duplicated.id)
                              }
                            } catch (err) {
                              console.error('Failed to duplicate project:', err)
                            }
                            setProjectMenuOpen(null)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                        >
                          <Copy size={14} />
                          Дублировать
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            try {
                              const link = await generateShareLink(project.id)
                              await navigator.clipboard.writeText(link)
                              alert('Ссылка скопирована в буфер обмена')
                            } catch (err) {
                              console.error('Failed to generate share link:', err)
                            }
                            setProjectMenuOpen(null)
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                        >
                          <Share2 size={14} />
                          Поделиться
                        </button>
                        {(project.ownerId === user?.id || project.owner?.id === user?.id) && (
                          <>
                            <div className="border-t border-border my-1" />
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await toggleProjectVisibility(project.id)
                                } catch (err) {
                                  console.error('Failed to toggle visibility:', err)
                                }
                                setProjectMenuOpen(null)
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                            >
                              {project.isPublic ? <Lock size={14} /> : <Globe size={14} />}
                              {project.isPublic ? 'Сделать приватным' : 'Сделать публичным'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (confirm('Удалить проект?')) {
                                  deleteProject(project.id)
                                }
                                setProjectMenuOpen(null)
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 size={14} />
                              Удалить
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
            
            {filteredProjects.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="py-12"
              >
                {/* Welcome Card */}
                <div className="p-8 rounded-2xl border border-border/50 bg-card/50 text-center max-w-lg mx-auto">
                  {/* Icon */}
                  <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center relative">
                    <LayoutDashboard size={48} className="text-primary" />
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Plus size={18} className="text-primary-foreground" />
                    </div>
                  </div>
                  
                  {/* Title */}
                  <h2 className="text-2xl font-bold mb-2">
                    Добро пожаловать{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}!
                  </h2>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    Начните работу над своей первой диаграммой. Выберите шаблон или создайте пустой проект.
                  </p>
                  
                  {/* Quick templates */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {[
                      { icon: Workflow, name: 'Блок-схема', templateType: 'flowchart' as TemplateType },
                      { icon: Database, name: 'ER-диаграмма', templateType: 'er-diagram' as TemplateType },
                      { icon: Network, name: 'Сетевая схема', templateType: 'network' as TemplateType },
                      { icon: Lightbulb, name: 'Mind Map', templateType: 'mindmap' as TemplateType },
                    ].map((template) => (
                      <button
                        key={template.name}
                        onClick={() => onNewProject(template.templateType)}
                        className="flex items-center gap-2 p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                      >
                        <template.icon size={18} className="text-muted-foreground" />
                        <span className="text-sm font-medium">{template.name}</span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Main CTA */}
                  <button
                    onClick={() => onNewProject()}
                    className="px-8 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-medium"
                  >
                    <Plus size={18} className="inline-block mr-2 -mt-0.5" />
                    Создать пустой проект
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
        
        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Quick Start Templates */}
          <div className="p-5 border border-border/50 rounded-2xl bg-card/50">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles size={18} className="text-primary" />
              </div>
              Быстрый старт
            </h3>
            <div className="space-y-2">
              {templatesLoading ? (
                <div className="py-4 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </div>
              ) : serverTemplates.length > 0 ? (
                // Render templates from server
                serverTemplates.slice(0, 4).map((template) => {
                  const IconComponent = templateIcons[template.category] || LayoutDashboard
                  return (
                    <button
                      key={template.id}
                      onClick={() => onNewProjectFromTemplate?.(template) || onNewProject()}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                        <IconComponent size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{template.name}</p>
                        <p className="text-xs text-muted-foreground">{template.description?.slice(0, 30) || template.category}</p>
                      </div>
                    </button>
                  )
                })
              ) : (
                // Fallback to local templates
                [
                  { icon: Workflow, name: 'Блок-схема', desc: 'Алгоритмы и процессы', templateType: 'flowchart' as TemplateType },
                  { icon: Database, name: 'ER-диаграмма', desc: 'Схема базы данных', templateType: 'er-diagram' as TemplateType },
                  { icon: Network, name: 'Сетевая схема', desc: 'Инфраструктура', templateType: 'network' as TemplateType },
                  { icon: Lightbulb, name: 'Mind Map', desc: 'Идеи и концепции', templateType: 'mindmap' as TemplateType },
                ].map((template) => (
                  <button
                    key={template.name}
                    onClick={() => onNewProject(template.templateType)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <template.icon size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted-foreground">{template.desc}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        
          {/* Recent activity */}
          <div className="p-5 border border-border/50 rounded-2xl bg-card/50">
            <h3 className="font-semibold text-lg mb-5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
              Последние обновления
            </h3>
            <div className="space-y-3">
              {projects
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .slice(0, 5)
                .map(project => (
                  <button
                    key={project.id}
                    onClick={() => onOpenProject(project.id)}
                    className="block w-full text-left p-3 rounded-xl hover:bg-accent transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        src={project.owner?.avatarUrl}
                        name={project.owner?.fullName || user?.fullName || 'User'}
                        size="sm"
                        className="rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(project.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground">Пока нет активности</p>
              )}
            </div>
          </div>
          
          {/* Discover / Trending */}
          <div className="p-5 border border-border/50 rounded-2xl bg-card/50">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Star size={16} className="text-yellow-500" />
              Популярное
            </h3>
            <div className="space-y-3">
              {projects
                .filter(p => p.isPublic)
                .sort((a, b) => (b.stars || 0) - (a.stars || 0))
                .slice(0, 3)
                .map(project => (
                  <button
                    key={project.id}
                    onClick={() => onOpenProject(project.id)}
                    className="block w-full text-left p-3 rounded-xl hover:bg-accent transition-colors"
                  >
                    <p className="text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Star size={12} className="text-yellow-500" /> {project.stars || 0}
                    </p>
                  </button>
                ))}
              {projects.filter(p => p.isPublic).length === 0 && (
                <p className="text-sm text-muted-foreground">Пока нет публичных проектов</p>
              )}
            </div>
          </div>
          
          {/* Following */}
          <div className="p-5 border border-border/50 rounded-2xl bg-card/50">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <Users size={16} className="text-primary" />
              Подписки
            </h3>
            <div className="space-y-2">
              {followedUsers.map(followedUser => (
                <button 
                  key={followedUser.id} 
                  onClick={() => openProfile(followedUser.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-accent transition-colors text-left"
                >
                  <UserAvatar 
                    src={followedUser.avatarUrl}
                    name={followedUser.fullName}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{followedUser.fullName}</p>
                    <p className="text-xs text-muted-foreground">@{followedUser.username}</p>
                  </div>
                </button>
              ))}
              {followedUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Вы пока ни на кого не подписаны</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
