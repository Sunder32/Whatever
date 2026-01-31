import { useState, useEffect } from 'react'
import { 
  X, 
  UserPlus, 
  UserMinus, 
  MapPin, 
  Link as LinkIcon,
  Loader2,
  Grid3X3,
  ExternalLink
} from 'lucide-react'
import { usersApi, type UserSearchResult, type UserProfile } from '@/api'
import { useAuthStore, useProjectStore } from '@/stores'
import { cn } from '@/utils'
import { UserAvatar } from '@/components/ui/UserAvatar'

interface UserProfileModalProps {
  userId: string
  onClose: () => void
  onOpenProject?: (projectId: string) => void
  onViewUser?: (userId: string) => void
}

export function UserProfileModal({ userId, onClose, onOpenProject, onViewUser }: UserProfileModalProps) {
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
  
  const handleProjectClick = (projectId: string) => {
    if (onOpenProject) {
      onOpenProject(projectId)
      onClose()
    }
  }
  
  const handleUserClick = (clickedUserId: string) => {
    if (onViewUser && clickedUserId !== userId) {
      onViewUser(clickedUserId)
    }
  }
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-popover border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Профиль пользователя</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-muted-foreground" />
            </div>
          ) : profile ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <UserAvatar 
                  src={profile.avatarUrl} 
                  name={profile.fullName} 
                  size="xl" 
                />
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold truncate">{profile.fullName}</h3>
                  <p className="text-muted-foreground">@{profile.username}</p>
                  
                  {!isOwnProfile && (
                    <button
                      onClick={isFollowing ? handleUnfollow : handleFollow}
                      disabled={followLoading}
                      className={cn(
                        "mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
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
                <p className="text-sm text-muted-foreground">{profile.bio}</p>
              )}
              
              {/* Meta */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} />
                    {profile.location}
                  </div>
                )}
                {profile.website && (
                  <a 
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-primary transition-colors"
                  >
                    <LinkIcon size={14} />
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
              
              {/* Stats */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => setActiveTab('projects')}
                  className={cn(
                    "text-center flex-1 py-2.5 rounded-lg transition-colors",
                    activeTab === 'projects' ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <p className="text-xl font-bold">{profile.projectsCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Проектов</p>
                </button>
                <button
                  onClick={() => setActiveTab('followers')}
                  className={cn(
                    "text-center flex-1 py-2.5 rounded-lg transition-colors",
                    activeTab === 'followers' ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <p className="text-xl font-bold">{profile.followersCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Подписчиков</p>
                </button>
                <button
                  onClick={() => setActiveTab('following')}
                  className={cn(
                    "text-center flex-1 py-2.5 rounded-lg transition-colors",
                    activeTab === 'following' ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <p className="text-xl font-bold">{profile.followingCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Подписок</p>
                </button>
              </div>
              
              {/* Tab Content */}
              <div className="max-h-52 overflow-y-auto -mx-1 px-1">
                {tabLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : activeTab === 'projects' ? (
                  <div className="space-y-2">
                    {userProjects.length > 0 ? (
                      userProjects.map((project: any) => (
                        <button
                          key={project.id}
                          onClick={() => handleProjectClick(project.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Grid3X3 size={18} className="text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {project.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {project.description || 'Без описания'}
                            </p>
                          </div>
                          <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))
                    ) : (
                      <p className="text-center text-sm text-muted-foreground py-6">
                        Нет публичных проектов
                      </p>
                    )}
                  </div>
                ) : activeTab === 'followers' ? (
                  <div className="space-y-2">
                    {followers.length > 0 ? (
                      followers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => handleUserClick(user.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
                        >
                          <UserAvatar 
                            src={user.avatarUrl} 
                            name={user.fullName} 
                            size="sm" 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.fullName}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-center text-sm text-muted-foreground py-6">
                        Нет подписчиков
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {followingList.length > 0 ? (
                      followingList.map(user => (
                        <button
                          key={user.id}
                          onClick={() => handleUserClick(user.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-left"
                        >
                          <UserAvatar 
                            src={user.avatarUrl} 
                            name={user.fullName} 
                            size="sm" 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.fullName}</p>
                            <p className="text-xs text-muted-foreground">@{user.username}</p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-center text-sm text-muted-foreground py-6">
                        Нет подписок
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-12">
              Пользователь не найден
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Global state for profile modal
interface ProfileModalState {
  isOpen: boolean
  userId: string | null
  openProfile: (userId: string) => void
  closeProfile: () => void
}

import { create } from 'zustand'

export const useProfileModal = create<ProfileModalState>((set) => ({
  isOpen: false,
  userId: null,
  openProfile: (userId: string) => set({ isOpen: true, userId }),
  closeProfile: () => set({ isOpen: false, userId: null }),
}))

// Wrapper component that uses global state
export function GlobalUserProfileModal({ 
  onOpenProject 
}: { 
  onOpenProject?: (projectId: string) => void 
}) {
  const { isOpen, userId, closeProfile, openProfile } = useProfileModal()
  
  if (!isOpen || !userId) return null
  
  return (
    <UserProfileModal 
      userId={userId} 
      onClose={closeProfile}
      onOpenProject={onOpenProject}
      onViewUser={openProfile}
    />
  )
}

export default UserProfileModal
