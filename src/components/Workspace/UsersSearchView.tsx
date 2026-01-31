import { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  User, 
  Users, 
  UserPlus, 
  UserMinus, 
  MapPin, 
  Link as LinkIcon,
  Loader2,
  X,
  Grid3X3
} from 'lucide-react'
import { usersApi, type UserSearchResult, type UserProfile } from '@/api'
import { useAuthStore, useProjectStore } from '@/stores'
import { cn } from '@/utils'

interface UserCardProps {
  user: UserSearchResult | UserProfile
  onFollow: (userId: string) => void
  onUnfollow: (userId: string) => void
  onViewProfile: (userId: string) => void
  isFollowing?: boolean
  isLoading?: boolean
}

function UserCard({ user, onFollow, onUnfollow, onViewProfile, isFollowing, isLoading }: UserCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {user.avatarUrl ? (
          <img 
            src={user.avatarUrl} 
            alt={user.fullName} 
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User size={24} className="text-primary" />
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <button 
          onClick={() => onViewProfile(user.id)}
          className="font-medium hover:text-primary transition-colors text-left"
        >
          {user.fullName}
        </button>
        <p className="text-sm text-muted-foreground">@{user.username}</p>
        {user.bio && (
          <p className="text-xs text-muted-foreground truncate mt-1">{user.bio}</p>
        )}
      </div>
      
      {/* Follow button */}
      <button
        onClick={() => isFollowing ? onUnfollow(user.id) : onFollow(user.id)}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          isFollowing 
            ? "bg-secondary hover:bg-destructive/10 hover:text-destructive"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isFollowing ? (
          <>
            <UserMinus size={14} />
            <span>Отписаться</span>
          </>
        ) : (
          <>
            <UserPlus size={14} />
            <span>Подписаться</span>
          </>
        )}
      </button>
    </div>
  )
}

interface UserProfileModalProps {
  userId: string
  onClose: () => void
}

function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'projects' | 'followers' | 'following'>('projects')
  const [userProjects, setUserProjects] = useState<any[]>([])
  const [followers, setFollowers] = useState<UserSearchResult[]>([])
  const [followingList, setFollowingList] = useState<UserSearchResult[]>([])
  const [tabLoading, setTabLoading] = useState(false)
  
  const { user: currentUser } = useAuthStore()
  const { followUser, unfollowUser, following } = useProjectStore()
  
  const isFollowing = following.includes(userId)
  const isOwnProfile = currentUser?.id === userId
  
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true)
      try {
        const response = await usersApi.getById(userId)
        if (response.success && response.data) {
          setProfile(response.data)
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error)
      }
      setIsLoading(false)
    }
    
    fetchProfile()
  }, [userId])
  
  // Load tab data when tab changes
  useEffect(() => {
    const loadTabData = async () => {
      if (!profile) return
      setTabLoading(true)
      try {
        if (activeTab === 'projects') {
          const response = await usersApi.getUserProjects(userId)
          if (response.success && response.data) {
            setUserProjects(response.data.projects || [])
          }
        } else if (activeTab === 'followers') {
          const response = await usersApi.getFollowers(userId)
          if (response.success && response.data) {
            setFollowers(response.data.users || [])
          }
        } else if (activeTab === 'following') {
          const response = await usersApi.getFollowing(userId)
          if (response.success && response.data) {
            setFollowingList(response.data.users || [])
          }
        }
      } catch (error) {
        // Tab data not available
      }
      setTabLoading(false)
    }
    
    loadTabData()
  }, [userId, activeTab, profile])
  
  const handleFollow = async () => {
    if (isOwnProfile) return
    setFollowLoading(true)
    try {
      await followUser(userId)
    } catch (error) {
      console.error('Failed to follow:', error)
    }
    setFollowLoading(false)
  }
  
  const handleUnfollow = async () => {
    if (isOwnProfile) return
    setFollowLoading(true)
    try {
      await unfollowUser(userId)
    } catch (error) {
      console.error('Failed to unfollow:', error)
    }
    setFollowLoading(false)
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-popover border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Профиль пользователя</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={32} className="animate-spin text-muted-foreground" />
            </div>
          ) : profile ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start gap-4">
                {profile.avatarUrl ? (
                  <img 
                    src={profile.avatarUrl} 
                    alt={profile.fullName} 
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={40} className="text-primary" />
                  </div>
                )}
                
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{profile.fullName}</h3>
                  <p className="text-muted-foreground">@{profile.username}</p>
                  
                  {!isOwnProfile && (
                    <button
                      onClick={isFollowing ? handleUnfollow : handleFollow}
                      disabled={followLoading}
                      className={cn(
                        "mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        isFollowing 
                          ? "bg-secondary hover:bg-destructive/10 hover:text-destructive"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      {followLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : isFollowing ? (
                        <>
                          <UserMinus size={14} />
                          Отписаться
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} />
                          Подписаться
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Bio */}
              {profile.bio && (
                <p className="text-sm">{profile.bio}</p>
              )}
              
              {/* Meta */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile.location && (
                  <div className="flex items-center gap-1">
                    <MapPin size={14} />
                    {profile.location}
                  </div>
                )}
                {profile.website && (
                  <a 
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <LinkIcon size={14} />
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
              
              {/* Stats */}
              <div className="flex gap-6 pt-4 border-t">
                <button
                  onClick={() => setActiveTab('projects')}
                  className={cn(
                    "text-center flex-1 py-2 rounded transition-colors",
                    activeTab === 'projects' && "bg-accent"
                  )}
                >
                  <p className="text-xl font-bold">{profile.projectsCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Проектов</p>
                </button>
                <button
                  onClick={() => setActiveTab('followers')}
                  className={cn(
                    "text-center flex-1 py-2 rounded transition-colors",
                    activeTab === 'followers' && "bg-accent"
                  )}
                >
                  <p className="text-xl font-bold">{profile.followersCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Подписчиков</p>
                </button>
                <button
                  onClick={() => setActiveTab('following')}
                  className={cn(
                    "text-center flex-1 py-2 rounded transition-colors",
                    activeTab === 'following' && "bg-accent"
                  )}
                >
                  <p className="text-xl font-bold">{profile.followingCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Подписок</p>
                </button>
              </div>
              
              {/* Tab Content */}
              <div className="mt-4 max-h-48 overflow-y-auto">
                {tabLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : activeTab === 'projects' ? (
                  <div className="space-y-2">
                    {userProjects.length > 0 ? (
                      userProjects.map((project: any) => (
                        <div key={project.id} className="flex items-center gap-2 p-2 rounded bg-secondary/50">
                          <Grid3X3 size={16} className="text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{project.name}</p>
                            <p className="text-xs text-muted-foreground">{project.description || 'Без описания'}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        Нет публичных проектов
                      </p>
                    )}
                  </div>
                ) : activeTab === 'followers' ? (
                  <div className="space-y-2">
                    {followers.length > 0 ? (
                      followers.map(user => (
                        <div key={user.id} className="flex items-center gap-2 p-2 rounded bg-secondary/50">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <User size={14} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.fullName}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        Нет подписчиков
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {followingList.length > 0 ? (
                      followingList.map(user => (
                        <div key={user.id} className="flex items-center gap-2 p-2 rounded bg-secondary/50">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <User size={14} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.fullName}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        Нет подписок
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Пользователь не найден
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function UsersSearchView() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [suggestedUsers, setSuggestedUsers] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [followingLoading, setFollowingLoading] = useState<Set<string>>(new Set())
  
  const { user: currentUser } = useAuthStore()
  const { followUser, unfollowUser, following } = useProjectStore()
  
  // Load suggested users on mount
  useEffect(() => {
    const loadSuggested = async () => {
      try {
        const response = await usersApi.getSuggested(10)
        if (response.success && response.data) {
          setSuggestedUsers(response.data)
        }
      } catch (error) {
        // Fallback to empty - API might not be available
        setSuggestedUsers([])
      }
    }
    
    loadSuggested()
  }, [])
  
  // Search debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await usersApi.search(searchQuery)
        if (response.success && response.data) {
          // Filter out current user from results
          setSearchResults(response.data.filter(u => u.id !== currentUser?.id))
        }
      } catch (error) {
        // Fallback - show mock results if API not available
        setSearchResults([])
      }
      setIsSearching(false)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [searchQuery, currentUser?.id])
  
  const handleFollow = useCallback(async (userId: string) => {
    setFollowingLoading(prev => new Set(prev).add(userId))
    try {
      await followUser(userId)
    } catch (error) {
      console.error('Failed to follow:', error)
    }
    setFollowingLoading(prev => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }, [followUser])
  
  const handleUnfollow = useCallback(async (userId: string) => {
    setFollowingLoading(prev => new Set(prev).add(userId))
    try {
      await unfollowUser(userId)
    } catch (error) {
      console.error('Failed to unfollow:', error)
    }
    setFollowingLoading(prev => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
  }, [unfollowUser])
  
  const displayUsers = searchQuery.length >= 2 ? searchResults : suggestedUsers
  
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
          <Users size={28} className="text-primary" />
          Поиск пользователей
        </h1>
        
        {/* Search input */}
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени или @username..."
            className="w-full pl-10 pr-4 py-3 bg-secondary border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-accent rounded"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      
      {/* Results */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {searchQuery.length >= 2 ? 'Результаты поиска' : 'Рекомендуемые пользователи'}
        </h2>
        
        {isSearching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-muted-foreground" />
          </div>
        ) : displayUsers.length > 0 ? (
          displayUsers.map(user => (
            <UserCard
              key={user.id}
              user={user}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              onViewProfile={setSelectedUserId}
              isFollowing={following.includes(user.id)}
              isLoading={followingLoading.has(user.id)}
            />
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery.length >= 2 
              ? 'Пользователи не найдены'
              : 'Начните вводить имя для поиска'
            }
          </div>
        )}
      </div>
      
      {/* Profile Modal */}
      {selectedUserId && (
        <UserProfileModal 
          userId={selectedUserId} 
          onClose={() => setSelectedUserId(null)} 
        />
      )}
    </div>
  )
}
