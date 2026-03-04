import { useState, useEffect, useMemo } from 'react'
import { 
  X, 
  User, 
  Shield, 
  Palette,
  HardDrive,
  Cloud,
  LogOut,
  Camera,
  Mail,
  Lock,
  Globe,
  Moon,
  Sun,
  Edit3,
  Link as LinkIcon,
  MapPin,
  Calendar,
  FolderKanban,
  Activity,
  Star,
  GitFork,
  Plus,
  TrendingUp,
  Check
} from 'lucide-react'
import { useAuthStore, useProjectStore } from '@/stores'
import { authApi } from '@/api'
import { storageService } from '@/services'
import { cn } from '@/utils'

interface ProfileDialogProps {
  isOpen: boolean
  onClose: () => void
}

type TabType = 'overview' | 'projects' | 'activity' | 'security' | 'storage' | 'settings'

// Mock activity data for demonstration
interface ActivityItem {
  id: string
  type: 'create' | 'edit' | 'share' | 'star' | 'comment'
  targetName: string
  targetType: 'diagram' | 'project'
  timestamp: Date
}

// Contribution grid component (like GitHub's green squares)
function ContributionGrid({ activities }: { activities: ActivityItem[] }) {
  const weeks = 52
  const days = 7
  
  // Generate contribution data for last year
  const contributions = useMemo(() => {
    const data: number[] = []
    const now = new Date()
    for (let i = weeks * days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      // Count activities for this day
      const count = activities.filter(a => {
        const activityDate = new Date(a.timestamp)
        return activityDate.toDateString() === date.toDateString()
      }).length
      data.push(count)
    }
    return data
  }, [activities])
  
  const getColor = (count: number) => {
    if (count === 0) return 'bg-secondary'
    if (count === 1) return 'bg-emerald-900'
    if (count === 2) return 'bg-emerald-700'
    if (count === 3) return 'bg-emerald-500'
    return 'bg-emerald-400'
  }
  
  const totalContributions = contributions.reduce((a, b) => a + b, 0)
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {totalContributions} действий за последний год
        </span>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="grid grid-flow-col gap-0.5" style={{ gridTemplateRows: `repeat(${days}, 10px)` }}>
          {contributions.map((count, i) => (
            <div
              key={i}
              className={cn(
                'w-2.5 h-2.5 rounded-sm transition-colors',
                getColor(count)
              )}
              title={`${count} действий`}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
        <span>Меньше</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-secondary" />
        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-900" />
        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-700" />
        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
        <span>Больше</span>
      </div>
    </div>
  )
}

// Project card component
function ProjectCard({ 
  name, 
  description, 
  isPublic,
  updatedAt 
}: { 
  name: string
  description: string
  isPublic: boolean
  updatedAt: Date
}) {
  return (
    <div className="p-4 rounded-lg border bg-secondary/30 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban size={16} className="text-primary" />
          <span className="font-medium text-primary hover:underline cursor-pointer">{name}</span>
          <span className={cn(
            'text-xs px-1.5 py-0.5 rounded-full border',
            isPublic ? 'border-muted-foreground/30' : 'border-yellow-500/30 text-yellow-500'
          )}>
            {isPublic ? 'Public' : 'Private'}
          </span>
        </div>
        <div className={cn(
          'w-2 h-2 rounded-full',
          isPublic ? 'bg-green-500' : 'bg-yellow-500'
        )} title={isPublic ? 'Публичный' : 'Приватный'} />
      </div>
      {description && (
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{description}</p>
      )}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Globe size={12} />
          {isPublic ? 'Публичный' : 'Приватный'}
        </span>
        <span>
          Обновлено {formatRelativeTime(updatedAt)}
        </span>
      </div>
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'сегодня'
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7) return `${diffDays} дней назад`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} мес. назад`
  return `${Math.floor(diffDays / 365)} г. назад`
}

export function ProfileDialog({ isOpen, onClose }: ProfileDialogProps) {
  const { user, updateProfile, logout } = useAuthStore()
  const { getOwnProjects } = useProjectStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [storageState, setStorageState] = useState(storageService.getState())
  
  // Profile editing states
  const [isEditingBio, setIsEditingBio] = useState(false)
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [website, setWebsite] = useState('')
  
  // Form states
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [_email] = useState(user?.email || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Get real user projects from store
  const ownProjects = useMemo(() => getOwnProjects(), [getOwnProjects])
  
  // Transform projects for display
  const userProjects = useMemo(() => 
    ownProjects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      isPublic: p.isPublic,
      updatedAt: new Date(p.updatedAt)
    })), 
  [ownProjects])
  
  // Build real activities from project data (create/update events)
  const realActivities = useMemo<ActivityItem[]>(() => {
    const activities: ActivityItem[] = []
    ownProjects.forEach(p => {
      activities.push({
        id: `create-${p.id}`,
        type: 'create',
        targetName: p.name,
        targetType: 'project',
        timestamp: new Date(p.createdAt),
      })
      if (p.updatedAt && p.updatedAt !== p.createdAt) {
        activities.push({
          id: `edit-${p.id}`,
          type: 'edit',
          targetName: p.name,
          targetType: 'diagram',
          timestamp: new Date(p.updatedAt),
        })
      }
    })
    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [ownProjects])
  
  useEffect(() => {
    if (isOpen) {
      const unsubscribe = storageService.subscribe(setStorageState)
      return () => unsubscribe()
    }
  }, [isOpen])
  
  const handleSaveProfile = async () => {
    setIsSaving(true)
    setMessage(null)
    
    try {
      await updateProfile({ fullName })
      setMessage({ type: 'success', text: 'Профиль успешно обновлён' })
    } catch {
      setMessage({ type: 'error', text: 'Ошибка при обновлении профиля' })
    }
    
    setIsSaving(false)
  }
  
  const handleChangePassword = async () => {
    if (!currentPassword) {
      setMessage({ type: 'error', text: 'Введите текущий пароль' })
      return
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Новый пароль должен быть не менее 6 символов' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Пароли не совпадают' })
      return
    }
    
    setIsSaving(true)
    setMessage(null)
    
    try {
      const response = await authApi.changePassword({
        oldPassword: currentPassword,
        newPassword,
      })
      if (response.success) {
        setMessage({ type: 'success', text: 'Пароль успешно изменён' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setMessage({ type: 'error', text: response.error || 'Неверный текущий пароль' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Ошибка при изменении пароля' })
    }
    
    setIsSaving(false)
  }
  
  const handleLogout = () => {
    logout()
    onClose()
  }
  
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Б'
    const k = 1024
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
  
  if (!isOpen) return null
  
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Обзор', icon: <User size={18} /> },
    { id: 'projects', label: 'Проекты', icon: <FolderKanban size={18} /> },
    { id: 'activity', label: 'Активность', icon: <Activity size={18} /> },
    { id: 'security', label: 'Безопасность', icon: <Shield size={18} /> },
    { id: 'storage', label: 'Хранилище', icon: <HardDrive size={18} /> },
    { id: 'settings', label: 'Настройки', icon: <Palette size={18} /> },
  ]
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl h-[700px] bg-popover border rounded-lg shadow-2xl overflow-hidden flex">
        {/* Sidebar - GitHub-style profile card */}
        <div className="w-72 bg-secondary/30 border-r flex flex-col">
          <div className="p-6 border-b">
            {/* Large avatar */}
            <div className="relative mb-4">
              <div className="w-48 h-48 mx-auto rounded-full bg-primary/20 flex items-center justify-center border-4 border-secondary">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User size={80} className="text-primary" />
                )}
              </div>
              <button className="absolute bottom-2 right-1/4 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
                <Camera size={16} />
              </button>
            </div>
            
            {/* User info */}
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold">{user?.fullName || 'Пользователь'}</h2>
              <p className="text-muted-foreground">@{user?.username || 'username'}</p>
            </div>
            
            {/* Bio section */}
            <div className="mb-4">
              {isEditingBio ? (
                <div className="space-y-2">
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Расскажите о себе..."
                    className="w-full px-3 py-2 text-sm rounded-lg bg-secondary border focus:ring-2 focus:ring-primary outline-none resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsEditingBio(false)}
                      className="flex-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      <Check size={12} className="inline mr-1" />
                      Сохранить
                    </button>
                    <button 
                      onClick={() => { setIsEditingBio(false); setBio('') }}
                      className="px-3 py-1.5 text-xs bg-secondary rounded hover:bg-secondary/80"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => setIsEditingBio(true)}
                  className="text-sm text-muted-foreground hover:text-foreground cursor-pointer p-2 rounded hover:bg-secondary/50 transition-colors"
                >
                  {bio || 'Добавить описание...'}
                </div>
              )}
            </div>
            
            {/* Stats */}
            <div className="flex justify-center gap-6 text-sm mb-4">
              <div className="text-center">
                <div className="font-bold">{userProjects.length}</div>
                <div className="text-muted-foreground text-xs">проектов</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{userProjects.filter(p => p.isPublic).length}</div>
                <div className="text-muted-foreground text-xs">публичных</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{ownProjects.length}</div>
                <div className="text-muted-foreground text-xs">файлов</div>
              </div>
            </div>
            
            {/* Profile details */}
            <div className="space-y-2 text-sm">
              {location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin size={14} />
                  <span>{location}</span>
                </div>
              )}
              {website && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LinkIcon size={14} />
                  <a href={website} className="text-primary hover:underline">{website}</a>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar size={14} />
                <span>На платформе с {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : 'недавно'}</span>
              </div>
            </div>
            
            {/* Edit profile button */}
            <button 
              onClick={() => setActiveTab('settings')}
              className="w-full mt-4 px-4 py-2 border rounded-lg text-sm hover:bg-secondary transition-colors flex items-center justify-center gap-2"
            >
              <Edit3 size={14} />
              Редактировать профиль
            </button>
          </div>
          
          <nav className="flex-1 p-2 overflow-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  activeTab === tab.id 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-secondary'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
          
          <div className="p-2 border-t">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut size={18} />
              Выйти
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">{tabs.find(t => t.id === activeTab)?.label}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-accent">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-6">
            {message && (
              <div className={cn(
                'mb-4 p-3 rounded-lg text-sm',
                message.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-destructive/20 text-destructive'
              )}>
                {message.text}
              </div>
            )}
            
            {/* Overview Tab - GitHub-like */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Popular projects */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Популярные проекты</h3>
                    <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('projects') }} className="text-sm text-primary hover:underline">
                      Все проекты
                    </a>
                  </div>
                  {userProjects.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {userProjects.slice(0, 4).map(project => (
                        <ProjectCard key={project.id} {...project} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FolderKanban size={40} className="mx-auto mb-2 opacity-50" />
                      <p>У вас пока нет проектов</p>
                      <p className="text-sm">Создайте свой первый проект на главной странице</p>
                    </div>
                  )}
                </div>
                
                {/* Contribution graph */}
                <div>
                  <h3 className="font-medium mb-4">Активность</h3>
                  <div className="p-4 rounded-lg border bg-secondary/30">
                    <ContributionGrid activities={realActivities} />
                  </div>
                </div>
                
                {/* Recent activity */}
                <div>
                  <h3 className="font-medium mb-4">Последние действия</h3>
                  <div className="space-y-3">
                    {realActivities.slice(0, 5).map(activity => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center',
                          activity.type === 'create' && 'bg-green-500/20 text-green-500',
                          activity.type === 'edit' && 'bg-blue-500/20 text-blue-500',
                          activity.type === 'share' && 'bg-purple-500/20 text-purple-500',
                          activity.type === 'star' && 'bg-yellow-500/20 text-yellow-500',
                          activity.type === 'comment' && 'bg-orange-500/20 text-orange-500',
                        )}>
                          {activity.type === 'create' && <Plus size={14} />}
                          {activity.type === 'edit' && <Edit3 size={14} />}
                          {activity.type === 'share' && <GitFork size={14} />}
                          {activity.type === 'star' && <Star size={14} />}
                          {activity.type === 'comment' && <Activity size={14} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">
                              {activity.type === 'create' && 'Создал(а)'}
                              {activity.type === 'edit' && 'Изменил(а)'}
                              {activity.type === 'share' && 'Поделился'}
                              {activity.type === 'star' && 'Добавил(а) в избранное'}
                              {activity.type === 'comment' && 'Прокомментировал(а)'}
                            </span>
                            {' '}
                            <span className="text-primary">{activity.targetName}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Найти проект..."
                      className="px-3 py-2 text-sm rounded-lg bg-secondary border focus:ring-2 focus:ring-primary outline-none w-64"
                    />
                  </div>
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm flex items-center gap-2">
                    <Plus size={16} />
                    Новый проект
                  </button>
                </div>
                
                {userProjects.length > 0 ? (
                  <div className="space-y-3">
                    {userProjects.map(project => (
                      <ProjectCard key={project.id} {...project} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FolderKanban size={48} className="mx-auto mb-3 opacity-50" />
                    <p className="text-lg mb-1">У вас пока нет проектов</p>
                    <p className="text-sm">Создайте свой первый проект, чтобы начать работу</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                <div className="p-4 rounded-lg border bg-secondary/30">
                  <ContributionGrid activities={realActivities} />
                </div>
                
                <div>
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <TrendingUp size={18} />
                    История активности
                  </h3>
                  <div className="space-y-3">
                    {realActivities.slice(0, 20).map(activity => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center',
                          activity.type === 'create' && 'bg-green-500/20 text-green-500',
                          activity.type === 'edit' && 'bg-blue-500/20 text-blue-500',
                          activity.type === 'share' && 'bg-purple-500/20 text-purple-500',
                          activity.type === 'star' && 'bg-yellow-500/20 text-yellow-500',
                          activity.type === 'comment' && 'bg-orange-500/20 text-orange-500',
                        )}>
                          {activity.type === 'create' && <Plus size={14} />}
                          {activity.type === 'edit' && <Edit3 size={14} />}
                          {activity.type === 'share' && <GitFork size={14} />}
                          {activity.type === 'star' && <Star size={14} />}
                          {activity.type === 'comment' && <Activity size={14} />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">
                              {activity.type === 'create' && 'Создал(а)'}
                              {activity.type === 'edit' && 'Изменил(а)'}
                              {activity.type === 'share' && 'Поделился'}
                              {activity.type === 'star' && 'Добавил(а) в избранное'}
                              {activity.type === 'comment' && 'Прокомментировал(а)'}
                            </span>
                            {' '}
                            <span className="text-primary">{activity.targetName}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <Lock size={16} />
                    Изменить пароль
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm mb-2">Текущий пароль</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-2">Новый пароль</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-2">Подтвердите пароль</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                    
                    <button
                      onClick={handleChangePassword}
                      disabled={isSaving || !currentPassword || !newPassword}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      Изменить пароль
                    </button>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-4">Активные сессии</h3>
                  <div className="p-3 rounded-lg bg-secondary/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe size={18} />
                      <div>
                        <p className="text-sm font-medium">Текущая сессия</p>
                        <p className="text-xs text-muted-foreground">Windows • Chrome</p>
                      </div>
                    </div>
                    <span className="text-xs text-green-500">Активна</span>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'storage' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 rounded-lg bg-secondary/50 border">
                    <div className="flex items-center gap-3 mb-3">
                      <Cloud size={20} className="text-green-500" />
                      <span className="font-medium">Облачное хранилище</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {storageState.mode === 'cloud' ? 'Подключено' : 
                       storageState.mode === 'saving' ? 'Сохранение...' :
                       storageState.mode === 'error' ? 'Ошибка' : 'Офлайн'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {storageState.isOnline ? 'Все данные хранятся в облаке' : 'Нет подключения к серверу'}
                    </p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-3">Статус</h3>
                  <div className="p-4 rounded-lg bg-secondary/50 border">
                    <div className="flex items-center justify-between mb-3">
                      <span>Режим:</span>
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        storageState.mode === 'cloud' && 'bg-green-500/20 text-green-500',
                        storageState.mode === 'saving' && 'bg-blue-500/20 text-blue-500',
                        storageState.mode === 'error' && 'bg-red-500/20 text-red-500',
                        storageState.mode === 'offline' && 'bg-yellow-500/20 text-yellow-500',
                      )}>
                        {storageState.mode === 'cloud' && 'Облако'}
                        {storageState.mode === 'saving' && 'Сохранение...'}
                        {storageState.mode === 'error' && 'Ошибка'}
                        {storageState.mode === 'offline' && 'Офлайн'}
                      </span>
                    </div>
                    
                    {storageState.lastSaveAt && (
                      <p className="text-sm text-muted-foreground">
                        Последнее сохранение: {new Date(storageState.lastSaveAt).toLocaleString('ru-RU')}
                      </p>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-3">Проекты</h3>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    {ownProjects.map(project => (
                      <div key={project.id} className="p-3 rounded-lg bg-secondary/50 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(project.updatedAt).toLocaleString('ru-RU')}
                          </p>
                        </div>
                      </div>
                    ))}
                    {ownProjects.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Нет проектов
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* Profile settings */}
                <div>
                  <h3 className="text-sm font-medium mb-4">Профиль</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Полное имя</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary outline-none"
                        placeholder="Введите ваше имя"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Местоположение</label>
                      <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-muted-foreground" />
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary outline-none"
                          placeholder="Москва, Россия"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Вебсайт</label>
                      <div className="flex items-center gap-2">
                        <LinkIcon size={18} className="text-muted-foreground" />
                        <input
                          type="url"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary outline-none"
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Email</label>
                      <div className="flex items-center gap-2">
                        <Mail size={18} className="text-muted-foreground" />
                        <input
                          type="email"
                          value={_email}
                          disabled
                          className="flex-1 px-3 py-2 rounded-lg bg-secondary/50 border text-muted-foreground"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Email нельзя изменить</p>
                    </div>
                    
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                  </div>
                </div>
                
                {/* Appearance */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-4">Тема оформления</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button className="p-4 rounded-lg border-2 border-primary bg-secondary/50 flex flex-col items-center gap-2">
                      <Moon size={24} />
                      <span className="text-sm">Тёмная</span>
                    </button>
                    <button className="p-4 rounded-lg border border-border bg-secondary/50 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors">
                      <Sun size={24} />
                      <span className="text-sm">Светлая</span>
                    </button>
                    <button className="p-4 rounded-lg border border-border bg-secondary/50 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors">
                      <Globe size={24} />
                      <span className="text-sm">Системная</span>
                    </button>
                  </div>
                </div>
                
                {/* Language */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-4">Язык интерфейса</h3>
                  <select className="w-full px-3 py-2 rounded-lg bg-secondary border focus:ring-2 focus:ring-primary outline-none">
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                  </select>
                </div>
                
                {/* Notifications */}
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-4">Уведомления</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="text-sm font-medium">Email уведомления</p>
                        <p className="text-xs text-muted-foreground">Получать уведомления о важных событиях</p>
                      </div>
                      <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="text-sm font-medium">Приглашения в проекты</p>
                        <p className="text-xs text-muted-foreground">Уведомлять о новых приглашениях</p>
                      </div>
                      <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div>
                        <p className="text-sm font-medium">Обновления системы</p>
                        <p className="text-xs text-muted-foreground">Информация о новых функциях</p>
                      </div>
                      <input type="checkbox" className="w-5 h-5 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
