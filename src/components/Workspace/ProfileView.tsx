import { useState, useMemo, useEffect } from 'react'
import { 
  User,
  MapPin,
  Link as LinkIcon,
  Calendar,
  Star,
  GitFork,
  Users,
  Edit3,
  Camera,
  Activity,
  TrendingUp,
  Globe,
  Lock,
  Eye,
  UserPlus,
  UserMinus
} from 'lucide-react'
import { useAuthStore, useProjectStore } from '@/stores'
import { cn } from '@/utils'
import { EditProfileDialog } from '@/components/ProfileDialog'
import { usersApi } from '@/api'
import { useProfileModal } from '@/components/Profile/UserProfileModal'
import { UserAvatar } from '@/components/ui/UserAvatar'

type ProfileTab = 'overview' | 'projects' | 'stars' | 'activity' | 'followers' | 'following'

interface UserInfo {
  id: string
  username: string
  fullName: string
  email?: string
  avatarUrl?: string
  bio?: string
}

export function ProfileView() {
  const { user } = useAuthStore()
  const { openProfile } = useProfileModal()
  const { 
    projects, 
    starredProjects,
    fetchProjects,
    getOwnProjects,
    getStarredProjects,
    toggleStar
  } = useProjectStore()
  
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    fullName: user?.fullName || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || ''
  })
  
  // Followers/following state
  const [followers, setFollowers] = useState<UserInfo[]>([])
  const [followingUsers, setFollowingUsers] = useState<UserInfo[]>([])
  const [loadingFollowers, setLoadingFollowers] = useState(false)
  const [loadingFollowing, setLoadingFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  
  // Fetch projects and social data on mount
  useEffect(() => {
    fetchProjects()
    
    // Load followers/following counts on mount
    if (user) {
      usersApi.getFollowers(user.id)
        .then(response => {
          if (response.success && response.data) {
            setFollowers(response.data.users || [])
            setFollowersCount(response.data.total || response.data.users?.length || 0)
          }
        })
        .catch(console.error)
      
      usersApi.getFollowing(user.id)
        .then(response => {
          if (response.success && response.data) {
            setFollowingUsers(response.data.users || [])
            setFollowingCount(response.data.total || response.data.users?.length || 0)
          }
        })
        .catch(console.error)
    }
  }, [fetchProjects, user])
  
  // Fetch followers/following when tab changes
  useEffect(() => {
    if (activeTab === 'followers' && user) {
      setLoadingFollowers(true)
      usersApi.getFollowers(user.id)
        .then(response => {
          if (response.success && response.data) {
            setFollowers(response.data.users || [])
            setFollowersCount(response.data.total || response.data.users?.length || 0)
          }
        })
        .catch(console.error)
        .finally(() => setLoadingFollowers(false))
    }
    if (activeTab === 'following' && user) {
      setLoadingFollowing(true)
      usersApi.getFollowing(user.id)
        .then(response => {
          if (response.success && response.data) {
            setFollowingUsers(response.data.users || [])
            setFollowingCount(response.data.total || response.data.users?.length || 0)
          }
        })
        .catch(console.error)
        .finally(() => setLoadingFollowing(false))
    }
  }, [activeTab, user])
  
  // Update form when user changes
  useEffect(() => {
    if (user) {
      setEditForm({
        fullName: user.fullName || '',
        bio: user.bio || '',
        location: user.location || '',
        website: user.website || ''
      })
    }
  }, [user])
  
  const ownProjects = useMemo(() => getOwnProjects(), [projects])
  const starredProjectsList = useMemo(() => getStarredProjects(), [starredProjects, projects])
  
  // Generate contribution data (like GitHub)
  const contributionData = useMemo(() => {
    const data: { date: string; count: number }[] = []
    const today = new Date()
    
    // Create a map of project activity by date
    const activityByDate = new Map<string, number>()
    ownProjects.forEach(p => {
      const date = new Date(p.updatedAt).toISOString().split('T')[0]
      activityByDate.set(date, (activityByDate.get(date) || 0) + 1)
    })
    
    for (let i = 364; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      data.push({
        date: dateStr,
        count: activityByDate.get(dateStr) || 0
      })
    }
    return data
  }, [ownProjects])
  
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffDays < 1) return 'сегодня'
    if (diffDays === 1) return 'вчера'
    if (diffDays < 7) return `${diffDays} дн. назад`
    return date.toLocaleDateString('ru-RU')
  }
  
  const tabs = [
    { id: 'overview' as const, label: 'Обзор' },
    { id: 'projects' as const, label: 'Проекты', count: ownProjects.length },
    { id: 'stars' as const, label: 'Звёзды', count: starredProjectsList.length },
    { id: 'followers' as const, label: 'Подписчики', count: followersCount },
    { id: 'following' as const, label: 'Подписки', count: followingCount },
    { id: 'activity' as const, label: 'Активность' },
  ]
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-4 gap-6">
        {/* Profile sidebar */}
        <div className="col-span-1">
          {/* Avatar */}
          <div className="relative mb-4">
            <div className="w-full aspect-square rounded-full bg-primary/20 flex items-center justify-center border-4 border-background shadow-lg overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={80} className="text-primary" />
              )}
            </div>
            <button 
              onClick={() => setIsEditDialogOpen(true)}
              className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-secondary border flex items-center justify-center hover:bg-secondary/80 transition-colors shadow"
            >
              <Camera size={18} />
            </button>
          </div>
          
          {/* Name */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold">{user?.fullName || 'Пользователь'}</h1>
            <p className="text-xl text-muted-foreground">@{user?.username || user?.email?.split('@')[0] || 'username'}</p>
          </div>
          
          {/* Bio */}
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">
              {editForm.bio || 'Нет описания'}
            </p>
          </div>
          
          {/* Edit profile button */}
          <button 
            onClick={() => setIsEditDialogOpen(true)}
            className="w-full px-4 py-2 border rounded-lg text-sm hover:bg-secondary transition-colors flex items-center justify-center gap-2 mb-4"
          >
            <Edit3 size={14} />
            Редактировать профиль
          </button>
          
          {/* Followers/Following */}
          <div className="flex items-center gap-4 mb-4 text-sm">
            <button 
              onClick={() => setActiveTab('followers')}
              className="flex items-center gap-1 hover:text-primary"
            >
              <Users size={14} />
              <span className="font-bold">{followersCount}</span>
              <span className="text-muted-foreground">подписчиков</span>
            </button>
            <span className="text-muted-foreground">·</span>
            <button 
              onClick={() => setActiveTab('following')}
              className="flex items-center gap-1 hover:text-primary"
            >
              <span className="font-bold">{followingCount}</span>
              <span className="text-muted-foreground">подписок</span>
            </button>
          </div>
          
          {/* Info */}
          <div className="space-y-2 text-sm">
            {editForm.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin size={14} />
                <span>{editForm.location}</span>
              </div>
            )}
            {editForm.website && (
              <div className="flex items-center gap-2">
                <LinkIcon size={14} className="text-muted-foreground" />
                <a href={editForm.website} className="text-primary hover:underline">{editForm.website}</a>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar size={14} />
              <span>На платформе с {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : 'недавно'}</span>
            </div>
          </div>
        </div>
        
        {/* Main content */}
        <div className="col-span-3">
          {/* Tabs */}
          <div className="border-b mb-6">
            <div className="flex gap-6">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "pb-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id 
                      ? "border-primary text-foreground" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Tab content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Pinned projects */}
              <div>
                <h3 className="font-medium mb-4">Популярные проекты</h3>
                <div className="grid grid-cols-2 gap-4">
                  {ownProjects.filter(p => p.isPublic).slice(0, 4).map(project => (
                    <div
                      key={project.id}
                      className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium text-primary">{project.name}</h4>
                        {project.isPublic ? (
                          <span className="px-2 py-0.5 rounded-full border text-xs text-muted-foreground flex items-center gap-1">
                            <Globe size={10} /> Public
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full border text-xs text-muted-foreground flex items-center gap-1">
                            <Lock size={10} /> Private
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star size={12} />
                          {project.stars}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitFork size={12} />
                          {project.forks}
                        </span>
                      </div>
                    </div>
                  ))}
                  {ownProjects.filter(p => p.isPublic).length === 0 && (
                    <p className="text-sm text-muted-foreground col-span-2 text-center py-8">
                      Нет публичных проектов
                    </p>
                  )}
                </div>
              </div>
              
              {/* Contribution graph */}
              <div>
                <h3 className="font-medium mb-4">{ownProjects.length} проектов за последний год</h3>
                <div className="p-4 border rounded-lg">
                  <div className="flex flex-wrap gap-0.5">
                    {contributionData.map((day, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-3 h-3 rounded-sm",
                          day.count === 0 && "bg-secondary",
                          day.count === 1 && "bg-green-900/50",
                          day.count === 2 && "bg-green-700/50",
                          day.count === 3 && "bg-green-500/50",
                          day.count >= 4 && "bg-green-400"
                        )}
                        title={`${day.date}: ${day.count} действий`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
                    <span>Меньше</span>
                    <div className="flex gap-0.5">
                      <div className="w-3 h-3 rounded-sm bg-secondary" />
                      <div className="w-3 h-3 rounded-sm bg-green-900/50" />
                      <div className="w-3 h-3 rounded-sm bg-green-700/50" />
                      <div className="w-3 h-3 rounded-sm bg-green-500/50" />
                      <div className="w-3 h-3 rounded-sm bg-green-400" />
                    </div>
                    <span>Больше</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'projects' && (
            <div className="space-y-4">
              {ownProjects.map(project => (
                <div
                  key={project.id}
                  className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-primary hover:underline">{project.name}</h4>
                        {project.isPublic ? (
                          <span className="px-2 py-0.5 rounded-full border text-xs text-muted-foreground flex items-center gap-1">
                            <Globe size={10} /> Public
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full border text-xs text-muted-foreground flex items-center gap-1">
                            <Lock size={10} /> Private
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star size={12} />
                          {project.stars}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye size={12} />
                          {project.views}
                        </span>
                        <span>Обновлено {formatDate(project.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {ownProjects.length === 0 && (
                <p className="text-center text-muted-foreground py-8">У вас пока нет проектов</p>
              )}
            </div>
          )}
          
          {activeTab === 'stars' && (
            <div className="space-y-4">
              {starredProjectsList.map(project => (
                <div
                  key={project.id}
                  className="p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground">{project.owner?.username || 'Unknown'} /</span>
                        <h4 className="font-medium text-primary hover:underline">{project.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star size={12} />
                          {project.stars || 0}
                        </span>
                        <span>Обновлено {formatDate(project.updatedAt)}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => toggleStar(project.id)}
                      className="px-3 py-1.5 bg-secondary border rounded-lg text-sm hover:bg-secondary/80 transition-colors flex items-center gap-1"
                    >
                      <Star size={14} className="fill-current text-yellow-500" />
                      Starred
                    </button>
                  </div>
                </div>
              ))}
              {starredProjectsList.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Вы еще ничего не добавили в избранное
                </p>
              )}
            </div>
          )}
          
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <TrendingUp size={18} />
                  История активности
                </h3>
                <div className="space-y-4">
                  {[
                    { type: 'create', project: 'Архитектура системы', time: '2 часа назад' },
                    { type: 'star', project: 'awesome-diagrams', time: '5 часов назад' },
                    { type: 'update', project: 'UI Components', time: '1 день назад' },
                    { type: 'fork', project: 'architecture-patterns', time: '3 дня назад' },
                  ].map((activity, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        activity.type === 'create' && "bg-green-500/20 text-green-500",
                        activity.type === 'star' && "bg-yellow-500/20 text-yellow-500",
                        activity.type === 'update' && "bg-blue-500/20 text-blue-500",
                        activity.type === 'fork' && "bg-purple-500/20 text-purple-500"
                      )}>
                        {activity.type === 'create' && <Activity size={14} />}
                        {activity.type === 'star' && <Star size={14} />}
                        {activity.type === 'update' && <Edit3 size={14} />}
                        {activity.type === 'fork' && <GitFork size={14} />}
                      </div>
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">
                            {activity.type === 'create' && 'Создал(а)'}
                            {activity.type === 'star' && 'Добавил(а) в избранное'}
                            {activity.type === 'update' && 'Обновил(а)'}
                            {activity.type === 'fork' && 'Форкнул(а)'}
                          </span>
                          {' '}
                          <span className="text-primary">{activity.project}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'followers' && (
            <div className="space-y-4">
              {loadingFollowers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : followers.length > 0 ? (
                followers.map(follower => (
                  <button 
                    key={follower.id} 
                    onClick={() => openProfile(follower.id)}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary/50 transition-colors w-full text-left"
                  >
                    <UserAvatar 
                      src={follower.avatarUrl}
                      name={follower.fullName || follower.username}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{follower.fullName || follower.username}</h4>
                      <p className="text-sm text-muted-foreground">@{follower.username || follower.email?.split('@')[0]}</p>
                      {follower.bio && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{follower.bio}</p>
                      )}
                    </div>
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="px-4 py-2 bg-secondary border rounded-lg text-sm hover:bg-secondary/80 transition-colors flex items-center gap-2"
                    >
                      <UserPlus size={14} />
                      Подписаться
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  У вас пока нет подписчиков
                </p>
              )}
            </div>
          )}
          
          {activeTab === 'following' && (
            <div className="space-y-4">
              {loadingFollowing ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : followingUsers.length > 0 ? (
                followingUsers.map(followedUser => (
                  <button 
                    key={followedUser.id} 
                    onClick={() => openProfile(followedUser.id)}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary/50 transition-colors w-full text-left"
                  >
                    <UserAvatar 
                      src={followedUser.avatarUrl}
                      name={followedUser.fullName || followedUser.username}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{followedUser.fullName || followedUser.username}</h4>
                      <p className="text-sm text-muted-foreground">@{followedUser.username || followedUser.email?.split('@')[0]}</p>
                      {followedUser.bio && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{followedUser.bio}</p>
                      )}
                    </div>
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm hover:bg-destructive/20 transition-colors flex items-center gap-2"
                    >
                      <UserMinus size={14} />
                      Отписаться
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Вы ни на кого не подписаны
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Edit Profile Dialog */}
      <EditProfileDialog 
        isOpen={isEditDialogOpen} 
        onClose={() => setIsEditDialogOpen(false)} 
      />
    </div>
  )
}
