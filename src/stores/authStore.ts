import { create } from 'zustand'
import { authApi } from '@/api'
import { eventBus, AppEvents, webSocketService, getWebSocketUrl } from '@/services'
import type { User } from '@/types'

interface UserPreferencesPartial {
  theme?: 'light' | 'dark' | 'system'
  language?: 'en' | 'ru'
  autoSaveInterval?: number
  gridSize?: number
  snapToGrid?: boolean
  showMiniMap?: boolean
  defaultFontFamily?: string
  defaultFontSize?: number
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; username: string; fullName: string }) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
  updatePreferences: (preferences: UserPreferencesPartial) => Promise<void>
  clearError: () => void
  checkAuth: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  (set, get) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await authApi.login({ email, password })
          
          if (!response.success) {
            throw new Error(response.error || 'Ошибка входа')
          }

          const { user } = response.data!
          
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          
          // Emit login event - projectStore will subscribe to this
          eventBus.emit(AppEvents.AUTH_LOGIN, { userId: user.id })
          
          // Initialize WebSocket connection
          const token = localStorage.getItem('accessToken')
          if (token) {
            webSocketService.init(getWebSocketUrl(), token)
            webSocketService.connect().catch(err => console.warn('WebSocket connect failed:', err))
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Ошибка входа'
          set({ isLoading: false, error: message })
          throw error
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await authApi.register(data)
          
          if (!response.success) {
            throw new Error(response.error || 'Ошибка регистрации')
          }

          const { user } = response.data!
          
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
          
          // Initialize WebSocket connection after registration
          const token = localStorage.getItem('accessToken')
          if (token) {
            webSocketService.init(getWebSocketUrl(), token)
            webSocketService.connect().catch(err => console.warn('WebSocket connect failed:', err))
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Ошибка регистрации'
          set({ isLoading: false, error: message })
          throw error
        }
      },

      logout: async () => {
        set({ isLoading: true })
        
        // Disconnect WebSocket before logout
        webSocketService.disconnect()
        
        try {
          await authApi.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          // Clear auth state
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
          
          // Emit logout event - other stores will subscribe and reset themselves
          eventBus.emit(AppEvents.AUTH_LOGOUT)
          
          // Clear local storage
          localStorage.removeItem('project-storage')
          localStorage.removeItem('auth-storage')
          localStorage.removeItem('app-storage')
        }
      },

      refreshProfile: async () => {
        const { isAuthenticated } = get()
        if (!isAuthenticated) return
        
        try {
          const response = await authApi.getProfile()
          
          if (response.success && response.data) {
            set({ user: response.data })
          }
        } catch (error) {
          console.error('Failed to refresh profile:', error)
        }
      },

      updateProfile: async (updates: Partial<User>) => {
        set({ isLoading: true, error: null })
        
        try {
          const response = await authApi.updateProfile({
            fullName: updates.fullName,
            avatarUrl: updates.avatarUrl,
            preferences: updates.preferences as unknown as Record<string, unknown>,
          })
          
          if (!response.success) {
            throw new Error(response.error || 'Ошибка обновления профиля')
          }

          set({
            user: response.data!,
            isLoading: false,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Ошибка обновления профиля'
          set({ isLoading: false, error: message })
          throw error
        }
      },

      updatePreferences: async (preferences: UserPreferencesPartial) => {
        const { user } = get()
        if (!user) return
        
        try {
          const newPreferences = { ...user.preferences, ...preferences }
          await get().updateProfile({ preferences: newPreferences } as Partial<User>)
        } catch (error) {
          throw error
        }
      },

      clearError: () => {
        set({ error: null })
      },

      checkAuth: async () => {
        const isAuth = authApi.isAuthenticated()
        
        if (!isAuth) {
          set({ isAuthenticated: false, user: null })
          return false
        }

        try {
          const response = await authApi.getProfile()
          
          if (response.success && response.data) {
            set({ user: response.data, isAuthenticated: true })
            
            // Initialize WebSocket connection on auth check
            const token = localStorage.getItem('accessToken')
            if (token) {
              webSocketService.init(getWebSocketUrl(), token)
              webSocketService.connect().catch(err => console.warn('WebSocket connect failed:', err))
            }
            
            // Emit event to fetch following data
            eventBus.emit(AppEvents.FETCH_FOLLOWING)
            
            return true
          }
          
          // Profile fetch failed - clear auth
          set({ isAuthenticated: false, user: null })
          return false
        } catch (error) {
          console.error('Auth check error:', error)
          set({ isAuthenticated: false, user: null })
          return false
        }
      },
    })
)

export default useAuthStore
