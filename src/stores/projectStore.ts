import { create } from 'zustand'
import { projectsApi } from '@/api'
import { useAuthStore } from './authStore'
import { eventBus, AppEvents } from '@/services/eventBus'
import type { Project as BaseProject } from '@/types'

export interface ProjectOwner {
  id: string
  username: string
  fullName: string
  avatarUrl?: string
}

export interface ProjectCollaborator {
  id: string
  userId: string
  username: string
  fullName: string
  avatarUrl?: string
  role: 'editor' | 'viewer'
  addedAt: string
}

export interface ProjectInvitation {
  id: string
  projectId: string
  projectName: string
  invitedBy: ProjectOwner
  role: 'editor' | 'viewer'
  createdAt: string
  status: 'pending' | 'accepted' | 'declined'
}

// Extended project type with UI-specific fields
export interface Project extends BaseProject {
  owner?: ProjectOwner
  collaborators?: ProjectCollaborator[]
  stars?: number
  views?: number
  forks?: number
  thumbnailUrl?: string
  shareLink?: string
}

export interface UserFollowing {
  id: string
  username: string
  fullName: string
  avatarUrl?: string
  followedAt: string
}

interface ProjectStore {
  projects: Project[]
  starredProjects: string[]  // Project IDs
  following: string[]  // User IDs
  invitations: ProjectInvitation[]
  isLoading: boolean
  error: string | null
  
  // Project CRUD
  fetchProjects: () => Promise<void>
  createProject: (data: { name: string; description?: string; isPublic?: boolean }) => Promise<Project>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  archiveProject: (id: string) => Promise<void>
  duplicateProject: (id: string) => Promise<Project>
  
  // Visibility & Sharing
  toggleProjectVisibility: (id: string) => Promise<void>
  generateShareLink: (id: string) => Promise<string>
  
  // Collaborators
  addCollaborator: (projectId: string, email: string, role: 'editor' | 'viewer') => Promise<void>
  removeCollaborator: (projectId: string, userId: string) => Promise<void>
  updateCollaboratorRole: (projectId: string, userId: string, role: 'editor' | 'viewer') => Promise<void>
  
  // Invitations
  fetchInvitations: () => Promise<void>
  acceptInvitation: (invitationId: string) => Promise<void>
  declineInvitation: (invitationId: string) => Promise<void>
  
  // Social
  toggleStar: (projectId: string) => Promise<void>
  followUser: (userId: string) => Promise<void>
  unfollowUser: (userId: string) => Promise<void>
  fetchFollowing: () => Promise<void>
  
  // Get filtered projects
  getOwnProjects: () => Project[]
  getFollowingProjects: () => Project[]
  getStarredProjects: () => Project[]
  getProjectById: (id: string) => Project | undefined
  
  // Проверка прав доступа
  isProjectOwner: (projectId: string) => boolean
  canEditProject: (projectId: string) => boolean
  
  // Clear
  clearError: () => void
  
  // Reset store (on logout)
  resetStore: () => void
}

// Generate unique ID
const generateId = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)

export const useProjectStore = create<ProjectStore>()(
  (set, get) => ({
    projects: [],
    starredProjects: [],
    following: [],
    invitations: [],
    isLoading: false,
    error: null,

    fetchProjects: async () => {
      set({ isLoading: true, error: null })
      try {
        const response = await projectsApi.list()
        if (response.success && response.data) {
          // Transform API response to our Project format
            const projects = response.data.map(p => ({
              ...p,
              owner: (p as Project).owner || { id: p.ownerId, username: '', fullName: '' },
              collaborators: (p as Project).collaborators || [],
              stars: (p as Project).stars || 0,
              views: (p as Project).views || 0,
              forks: (p as Project).forks || 0,
              isArchived: p.isArchived || false,
            })) as Project[]
            set({ projects, isLoading: false })
          } else {
            throw new Error(response.error || 'Failed to fetch projects')
          }
        } catch (error) {
          // Use local projects if API fails
          set({ isLoading: false })
        }
      },

      createProject: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const user = useAuthStore.getState().user
          
          // Create locally first for instant feedback
          const newProject: Project = {
            id: generateId(),
            name: data.name,
            description: data.description || '',
            ownerId: user?.id || 'local',
            settings: {},
            owner: {
              id: user?.id || 'local',
              username: user?.username || 'local',
              fullName: user?.fullName || 'Local User',
              avatarUrl: user?.avatarUrl,
            },
            isPublic: data.isPublic ?? false,
            isArchived: false,
            stars: 0,
            views: 0,
            forks: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            collaborators: [],
          }
          
          set(state => ({
            projects: [newProject, ...state.projects],
            isLoading: false
          }))
          
          // Try to sync with API
          try {
            const response = await projectsApi.create(data)
            if (response.success && response.data) {
              // Update with server ID
              set(state => ({
                projects: state.projects.map(p => 
                  p.id === newProject.id ? { ...newProject, ...response.data } : p
                )
              }))
            }
          } catch (err) {
            console.error('Failed to sync project to server:', err)
          }
          
          return newProject
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create project'
          set({ isLoading: false, error: message })
          throw error
        }
      },

      updateProject: async (id, data) => {
        // Check if user owns this project before updating on server
        const project = get().projects.find(p => p.id === id)
        const currentUserId = useAuthStore.getState().user?.id
        const isOwner = project?.ownerId === currentUserId
        
        // Always update locally
        set(state => ({
          projects: state.projects.map(p => 
            p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
          )
        }))
        
        // Only sync to server if user owns the project
        if (isOwner) {
          try {
            await projectsApi.update(id, data)
          } catch (err) {
            console.error('Failed to update project on server:', err)
            set({ error: 'Не удалось обновить проект на сервере' })
          }
        }
      },

      deleteProject: async (id) => {
        const previousProjects = get().projects
        set(state => ({
          projects: state.projects.filter(p => p.id !== id)
        }))
        
        try {
          await projectsApi.delete(id)
        } catch (err) {
          // Restore on error
          console.error('Failed to delete project on server:', err)
          set({ projects: previousProjects, error: 'Не удалось удалить проект' })
        }
      },

      archiveProject: async (id) => {
        set(state => ({
          projects: state.projects.map(p => 
            p.id === id ? { ...p, isArchived: true, updatedAt: new Date().toISOString() } : p
          )
        }))
        
        try {
          await projectsApi.archive(id)
        } catch (err) {
          console.error('Failed to archive project:', err)
          set(state => ({
            projects: state.projects.map(p => 
              p.id === id ? { ...p, isArchived: false } : p
            ),
            error: 'Не удалось архивировать проект'
          }))
        }
      },

      duplicateProject: async (id) => {
        const original = get().projects.find(p => p.id === id)
        if (!original) throw new Error('Project not found')
        
        const user = useAuthStore.getState().user
        
        // Try server-side duplicate first
        try {
          const response = await projectsApi.duplicate(id)
          if (response.success && response.data) {
            const duplicated: Project = {
              ...response.data,
              owner: {
                id: user?.id || 'local',
                username: user?.username || 'local',
                fullName: user?.fullName || 'Local User',
                avatarUrl: user?.avatarUrl,
              },
              stars: 0,
              views: 0,
              forks: 0,
              collaborators: [],
            }
            
            set(state => ({
              projects: [duplicated, ...state.projects]
            }))
            
            return duplicated
          }
        } catch (err) {
          console.error('Server duplicate failed, falling back to local:', err)
        }
        
        // Local fallback
        const duplicated: Project = {
          ...original,
          id: generateId(),
          name: `${original.name} (копия)`,
          owner: {
            id: user?.id || 'local',
            username: user?.username || 'local',
            fullName: user?.fullName || 'Local User',
            avatarUrl: user?.avatarUrl,
          },
          stars: 0,
          views: 0,
          forks: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          collaborators: [],
        }
        
        set(state => ({
          projects: [duplicated, ...state.projects]
        }))
        
        return duplicated
      },

      toggleProjectVisibility: async (id) => {
        const project = get().projects.find(p => p.id === id)
        if (!project) return
        
        set(state => ({
          projects: state.projects.map(p => 
            p.id === id ? { ...p, isPublic: !p.isPublic, updatedAt: new Date().toISOString() } : p
          )
        }))
        
        try {
          await projectsApi.update(id, { isPublic: !project.isPublic })
        } catch (err) {
          console.error('Failed to toggle visibility:', err)
          // Revert on error
          set(state => ({
            projects: state.projects.map(p => 
              p.id === id ? { ...p, isPublic: project.isPublic } : p
            ),
            error: 'Не удалось изменить видимость проекта'
          }))
        }
      },

      generateShareLink: async (id) => {
        const shareLink = `${window.location.origin}/shared/${id}`
        
        set(state => ({
          projects: state.projects.map(p => 
            p.id === id ? { ...p, shareLink } : p
          )
        }))
        
        return shareLink
      },

      addCollaborator: async (projectId, email, role) => {
        const user = useAuthStore.getState().user
        if (!user) return
        
        // Optimistic local update with temporary data
        const tempCollaborator: ProjectCollaborator = {
          id: generateId(),
          userId: generateId(),
          username: email.split('@')[0],
          fullName: email,
          role,
          addedAt: new Date().toISOString(),
        }
        
        set(state => ({
          projects: state.projects.map(p => 
            p.id === projectId ? { 
              ...p, 
              collaborators: [...(p.collaborators || []), tempCollaborator],
              updatedAt: new Date().toISOString()
            } : p
          )
        }))
        
        try {
          // Use collaborationApi which sends { email, permission } matching the Go backend
          const { collaborationApi } = await import('@/api')
          const permission = role === 'editor' ? 'write' : 'read'
          const result = await collaborationApi.addCollaborator(projectId, { email, permission })
          
          // Update with real server data
          if (result) {
            set(state => ({
              projects: state.projects.map(p => 
                p.id === projectId ? { 
                  ...p, 
                  collaborators: (p.collaborators || []).map(c => 
                    c.id === tempCollaborator.id ? { 
                      ...c, 
                      id: result.id || c.id, 
                      userId: result.userId || c.userId,
                      fullName: result.name || c.fullName,
                    } : c
                  )
                } : p
              )
            }))
          }
        } catch (error) {
          // Revert optimistic update on failure
          console.error('Failed to add collaborator:', error)
          set(state => ({
            projects: state.projects.map(p => 
              p.id === projectId ? { 
                ...p, 
                collaborators: (p.collaborators || []).filter(c => c.id !== tempCollaborator.id)
              } : p
            )
          }))
        }
      },

      removeCollaborator: async (projectId, userId) => {
        set(state => ({
          projects: state.projects.map(p => 
            p.id === projectId ? { 
              ...p, 
              collaborators: (p.collaborators || []).filter(c => c.userId !== userId),
              updatedAt: new Date().toISOString()
            } : p
          )
        }))
        
        try {
          await projectsApi.removeCollaborator(projectId, userId)
        } catch (err) {
          console.error('Failed to remove collaborator:', err)
          set({ error: 'Не удалось удалить участника' })
        }
      },

      updateCollaboratorRole: async (projectId, userId, role) => {
        set(state => ({
          projects: state.projects.map(p => 
            p.id === projectId ? { 
              ...p, 
              collaborators: (p.collaborators || []).map(c => 
                c.userId === userId ? { ...c, role } : c
              ),
              updatedAt: new Date().toISOString()
            } : p
          )
        }))
        
        try {
          const permissionMap: Record<string, 'read' | 'write' | 'admin'> = {
            viewer: 'read',
            editor: 'write',
            admin: 'admin',
          }
          await projectsApi.updateCollaborator(projectId, userId, { permission: permissionMap[role] || 'read' })
        } catch (err) {
          console.error('Failed to update collaborator role:', err)
          set({ error: 'Не удалось обновить роль участника' })
        }
      },

      fetchInvitations: async () => {
        // The Go backend uses direct-add collaboration model (no pending invitations).
        // Collaborators are added instantly via POST /projects/:id/collaborators.
        // This method is kept for interface compatibility.
        set({ invitations: [] })
      },

      acceptInvitation: async (invitationId) => {
        const invitation = get().invitations.find(i => i.id === invitationId)
        if (!invitation) return
        
        set(state => ({
          invitations: state.invitations.filter(i => i.id !== invitationId)
        }))
        
        // Refresh projects to include the new one
        await get().fetchProjects()
      },

      declineInvitation: async (invitationId) => {
        set(state => ({
          invitations: state.invitations.filter(i => i.id !== invitationId)
        }))
      },

      toggleStar: async (projectId) => {
        const isStarred = get().starredProjects.includes(projectId)
        
        if (isStarred) {
          set(state => ({
            starredProjects: state.starredProjects.filter(id => id !== projectId),
            projects: state.projects.map(p => 
              p.id === projectId ? { ...p, stars: Math.max(0, (p.stars || 0) - 1) } : p
            )
          }))
        } else {
          set(state => ({
            starredProjects: [...state.starredProjects, projectId],
            projects: state.projects.map(p => 
              p.id === projectId ? { ...p, stars: (p.stars || 0) + 1 } : p
            )
          }))
        }
      },

      followUser: async (userId) => {
        // Try to sync with API first
        try {
          const { usersApi } = await import('@/api')
          const response = await usersApi.follow(userId)
          
          if (response.success) {
            set(state => ({
              following: state.following.includes(userId) 
                ? state.following 
                : [...state.following, userId]
            }))
          }
        } catch (error) {
          console.error('Follow API error:', error)
        }
      },

      unfollowUser: async (userId) => {
        // Try to sync with API first
        try {
          const { usersApi } = await import('@/api')
          const response = await usersApi.unfollow(userId)
          
          if (response.success) {
            set(state => ({
              following: state.following.filter(id => id !== userId)
            }))
          }
        } catch (error) {
          console.error('Unfollow API error:', error)
        }
      },

      fetchFollowing: async () => {
        // Load following list from API
        const user = useAuthStore.getState().user
        if (!user) {
          set({ following: [] })
          return
        }
        
        try {
          const { usersApi } = await import('@/api')
          const response = await usersApi.getFollowing(user.id)
          
          if (response.success && response.data?.users) {
            const followingIds = response.data.users.map(u => u.id)
            set({ following: followingIds })
          } else {
            set({ following: [] })
          }
        } catch (error) {
          console.error('fetchFollowing error:', error)
          set({ following: [] })
        }
      },

      getOwnProjects: () => {
        const user = useAuthStore.getState().user
        if (!user) return []
        return get().projects.filter(p => 
          p.ownerId === user.id || 
          p.owner?.id === user.id || 
          p.ownerId === 'local' ||
          p.owner?.id === 'local'
        )
      },

      getFollowingProjects: () => {
        const followingIds = get().following
        return get().projects.filter(p => 
          (p.owner?.id && followingIds.includes(p.owner.id)) && p.isPublic
        )
      },

      getStarredProjects: () => {
        const starredIds = get().starredProjects
        return get().projects.filter(p => starredIds.includes(p.id))
      },

      getProjectById: (id) => {
        return get().projects.find(p => p.id === id)
      },
      
      // Проверка прав доступа
      isProjectOwner: (projectId: string) => {
        const user = useAuthStore.getState().user
        const project = get().projects.find(p => p.id === projectId)
        if (!user || !project) return false
        return project.ownerId === user.id || project.owner?.id === user.id
      },
      
      canEditProject: (projectId: string) => {
        const user = useAuthStore.getState().user
        const project = get().projects.find(p => p.id === projectId)
        
        // Если проект не найден, разрешаем редактирование (новый проект)
        if (!project) return true
        
        // Локальные проекты всегда можно редактировать
        if (project.ownerId === 'local' || project.owner?.id === 'local') return true
        
        // Если пользователь не авторизован, но проект локальный - можно редактировать
        if (!user) return project.ownerId === 'local'
        
        // Владелец или коллаборатор с правами editor
        const isOwner = project.ownerId === user.id || project.owner?.id === user.id
        const isEditor = project.collaborators?.some(
          c => c.userId === user.id && c.role === 'editor'
        )
        return isOwner || isEditor || false
      },

      clearError: () => set({ error: null }),
      
      resetStore: () => set({
        projects: [],
        starredProjects: [],
        following: [],
        invitations: [],
        isLoading: false,
        error: null,
      }),
    })
)

// Subscribe to auth events
eventBus.on(AppEvents.AUTH_LOGIN, () => {
  useProjectStore.setState({ following: [] })
  useProjectStore.getState().fetchFollowing()
})

eventBus.on(AppEvents.AUTH_LOGOUT, () => {
  useProjectStore.getState().resetStore()
})

eventBus.on(AppEvents.FETCH_FOLLOWING, () => {
  useProjectStore.getState().fetchFollowing()
})

export default useProjectStore
