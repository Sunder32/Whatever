import { useState, useEffect, useRef } from 'react'
import { 
  Home,
  FolderKanban,
  User,
  Settings,
  PenTool,
  Bell,
  Search,
  Plus,
  Menu,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
  Users
} from 'lucide-react'
import { useAuthStore, useProjectStore } from '@/stores'
import { useTheme } from '@/hooks'
import { cn } from '@/utils'
import { type TemplateType, getTemplateById } from '@/utils/diagramTemplates'
import { type Template } from '@/api'

// Views
import { DashboardView } from './DashboardView'
import { ProjectsView } from './ProjectsView'
import { ProfileView } from './ProfileView'
import { EditorViewNew as EditorView } from './EditorViewNew'
import { SettingsView } from './SettingsView'
import { NotificationsView } from './NotificationsView'
import { UsersSearchView } from './UsersSearchView'
import { GlobalUserProfileModal } from '@/components/Profile/UserProfileModal'

export type WorkspaceView = 'dashboard' | 'projects' | 'profile' | 'editor' | 'settings' | 'notifications' | 'users'

interface WorkspaceProps {
  initialView?: WorkspaceView
}

export function Workspace({ initialView = 'dashboard' }: WorkspaceProps) {
  const { theme, setTheme } = useTheme()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { createProject, fetchProjects, fetchFollowing } = useProjectStore()
  const [currentView, setCurrentView] = useState<WorkspaceView>(initialView)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const userMenuRef = useRef<HTMLDivElement>(null)
  
  // Store current project for editor
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  
  // Load initial data
  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects()
      fetchFollowing()
    }
  }, [isAuthenticated, fetchProjects, fetchFollowing])
  
  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const handleOpenProject = (projectId: string) => {
    setEditingProjectId(projectId)
    setCurrentView('editor')
  }
  
  // State for passing template to editor
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null)
  
  const handleNewProject = async (templateType?: TemplateType) => {
    const template = templateType ? getTemplateById(templateType) : null
    const templateName = template ? template.name : 'Новый проект'
    
    // Create a new project in store
    const newProject = await createProject({
      name: `${templateName} ${new Date().toLocaleDateString('ru-RU')}`,
      description: template?.description || '',
      isPublic: false
    })
    
    setSelectedTemplate(templateType || null)
    setEditingProjectId(newProject.id)
    setCurrentView('editor')
  }
  
  // Handler for creating project from server template (with content)
  const handleNewProjectFromTemplate = async (serverTemplate: Template) => {
    // Create a new project in store
    const newProject = await createProject({
      name: `${serverTemplate.name} ${new Date().toLocaleDateString('ru-RU')}`,
      description: serverTemplate.description || '',
      isPublic: false
    })
    
    // TODO: Apply server template content (nodes, edges, layers) to the project
    // This will require updating the diagram store after project is loaded in editor
    // For now we just open the editor - template content can be applied when loading
    if (import.meta.env.DEV) console.debug('Template content to apply:', serverTemplate.content)
    setEditingProjectId(newProject.id)
    setCurrentView('editor')
  }
  
  const navItems = [
    { id: 'dashboard' as const, icon: Home, label: 'Главная' },
    { id: 'projects' as const, icon: FolderKanban, label: 'Проекты' },
    { id: 'users' as const, icon: Users, label: 'Пользователи' },
    { id: 'profile' as const, icon: User, label: 'Профиль' },
  ]
  
  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar - hide in editor mode for full-screen editing */}
      {currentView !== 'editor' && (
      <aside className={cn(
        "flex flex-col bg-card/80 backdrop-blur-md border-r border-border/50 transition-all duration-300 shadow-xl",
        sidebarCollapsed ? "w-20" : "w-72"
      )}>
        {/* Logo - click to go to dashboard */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={cn(
              "flex items-center gap-3 rounded-xl transition-all hover:opacity-80",
              sidebarCollapsed && "justify-center"
            )}
            title="На главную"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
              <PenTool size={20} className="text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="font-bold text-xl text-foreground">Diagram</span>
            )}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2.5 rounded-xl hover:bg-accent transition-all"
          >
            <Menu size={20} />
          </button>
        </div>
        
        {/* New project button */}
        <div className="p-4">
          <button
            onClick={() => handleNewProject()}
            className={cn(
              "flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 transition-all hover:-translate-y-0.5",
              sidebarCollapsed && "px-3"
            )}
          >
            <Plus size={20} />
            {!sidebarCollapsed && <span>Новый проект</span>}
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                "flex items-center gap-4 w-full px-4 py-3 rounded-xl transition-all text-sm font-medium",
                currentView === item.id 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "hover:bg-accent text-muted-foreground hover:text-foreground",
                sidebarCollapsed && "justify-center px-3"
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={22} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        
        {/* Bottom actions */}
        <div className="px-3 py-2 border-t border-border/50 space-y-1">
          <button
            onClick={() => setCurrentView('notifications')}
            className={cn(
              "flex items-center gap-4 w-full px-4 py-3 rounded-xl transition-all text-sm font-medium",
              currentView === 'notifications' 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-accent text-muted-foreground hover:text-foreground",
              sidebarCollapsed && "justify-center px-3"
            )}
          >
            <Bell size={22} />
            {!sidebarCollapsed && <span>Уведомления</span>}
          </button>
          
          <button
            onClick={() => setCurrentView('settings')}
            className={cn(
              "flex items-center gap-4 w-full px-4 py-3 rounded-xl transition-all text-sm font-medium",
              currentView === 'settings' 
                ? "bg-primary/10 text-primary" 
                : "hover:bg-accent text-muted-foreground hover:text-foreground",
              sidebarCollapsed && "justify-center px-3"
            )}
          >
            <Settings size={22} />
            {!sidebarCollapsed && <span>Настройки</span>}
          </button>
        </div>
        
        {/* User section */}
        {isAuthenticated && user && (
          <div className="p-3 border-t border-border/50" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-3 rounded-xl hover:bg-accent transition-all",
                sidebarCollapsed && "justify-center"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-slate-600 flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-lg shadow-slate-500/20">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  user.fullName?.[0] || user.username?.[0] || 'U'
                )}
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold truncate">{user.fullName || user.username}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                  </div>
                  <ChevronDown size={14} className={cn("transition-transform", userMenuOpen && "rotate-180")} />
                </>
              )}
            </button>
            
            {/* User dropdown menu */}
            {userMenuOpen && (
              <div className={cn(
                "absolute bottom-16 bg-popover border rounded-lg shadow-lg py-1 z-50",
                sidebarCollapsed ? "left-16 w-48" : "left-2 w-60"
              )}>
                <button
                  onClick={() => { setCurrentView('profile'); setUserMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <User size={16} />
                  Ваш профиль
                </button>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                </button>
                <div className="border-t my-1" />
                <button
                  onClick={() => { logout(); setUserMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut size={16} />
                  Выйти
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
      )}
      
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background bg-pattern">
        {/* Top bar */}
        {currentView !== 'editor' && (
          <header className="flex items-center justify-between px-8 py-5 border-b bg-card/50 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground">
                {currentView === 'dashboard' && 'Главная'}
                {currentView === 'projects' && 'Проекты'}
                {currentView === 'profile' && 'Профиль'}
                {currentView === 'settings' && 'Настройки'}
                {currentView === 'notifications' && 'Уведомления'}
                {currentView === 'users' && 'Пользователи'}
              </h1>
            </div>
            
            {/* Search */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск проектов..."
                  className="pl-12 pr-5 py-3 w-80 rounded-xl bg-secondary/80 border border-border/50 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
          </header>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-auto scrollbar-thin">
          {currentView === 'dashboard' && (
            <DashboardView 
              onOpenProject={handleOpenProject}
              onNewProject={handleNewProject}
              onNewProjectFromTemplate={handleNewProjectFromTemplate}
            />
          )}
          {currentView === 'projects' && (
            <ProjectsView 
              onOpenProject={handleOpenProject}
              onNewProject={handleNewProject}
            />
          )}
          {currentView === 'profile' && (
            <ProfileView />
          )}
          {currentView === 'editor' && (
            <EditorView 
              projectId={editingProjectId}
              templateType={selectedTemplate}
              onBack={() => {
                setCurrentView('projects')
                setSelectedTemplate(null)
              }}
            />
          )}
          {currentView === 'settings' && (
            <SettingsView />
          )}
          {currentView === 'notifications' && (
            <NotificationsView />
          )}
          {currentView === 'users' && (
            <UsersSearchView />
          )}
        </div>
      </main>
      
      {/* Global User Profile Modal */}
      <GlobalUserProfileModal onOpenProject={handleOpenProject} />
    </div>
  )
}
