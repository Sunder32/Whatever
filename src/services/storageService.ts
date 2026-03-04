import { schemasApi } from '@/api'
import { apiClient } from '@/api/client'
import type { WtvFile } from '@/types'

export type StorageMode = 'cloud' | 'saving' | 'error' | 'offline'

interface StorageState {
  mode: StorageMode
  isOnline: boolean
  lastSaveAt: string | null
}

// Helper to check authentication — use apiClient which tracks access token
function isAuthenticated(): boolean {
  return apiClient.isAuthenticated()
}

class StorageService {
  private state: StorageState = {
    mode: 'cloud',
    isOnline: navigator.onLine,
    lastSaveAt: null,
  }

  private listeners: Set<(state: StorageState) => void> = new Set()
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private _isSaving = false

  async init(): Promise<void> {
    // Setup online/offline listeners
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
    this.notifyListeners()
  }

  private handleOnline() {
    this.state.isOnline = true
    this.state.mode = 'cloud'
    this.notifyListeners()
  }

  private handleOffline() {
    this.state.isOnline = false
    this.state.mode = 'offline'
    this.notifyListeners()
  }

  /**
   * Save file to the server (debounced, 500ms).
   * If the schema already exists on the server — updates it.
   * If not — creates a new schema under file.projectId.
   */
  async save(file: WtvFile): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
    }

    this.saveDebounceTimer = setTimeout(() => this._saveToCloud(file), 500)
  }

  /** Immediate save without debounce */
  async saveImmediate(file: WtvFile): Promise<void> {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
      this.saveDebounceTimer = null
    }
    await this._saveToCloud(file)
  }

  private async _saveToCloud(file: WtvFile): Promise<void> {
    if (!isAuthenticated() || !this.state.isOnline) {
      this.state.mode = 'offline'
      this.notifyListeners()
      return
    }

    // Prevent concurrent saves
    if (this._isSaving) return
    this._isSaving = true

    this.state.mode = 'saving'
    this.notifyListeners()

    try {
      // Check if user owns or can edit (collaborators with write/admin) the project
      if (file.projectId) {
        const { useProjectStore, useAuthStore } = await import('@/stores')
        const project = useProjectStore.getState().projects.find(p => p.id === file.projectId)
        const currentUserId = useAuthStore.getState().user?.id

        // If project exists and user is not owner and not a write/admin collaborator — skip
        if (project && project.ownerId !== currentUserId) {
          const canWrite = project.collaborators?.some(
            c => c.userId === currentUserId && (c.role === 'write' || c.role === 'admin')
          )
          if (!canWrite) {
            this.state.mode = 'cloud'
            this._isSaving = false
            this.notifyListeners()
            return
          }
        }
      }

      // Try to determine if schema exists
      let exists = false
      try {
        const existingResult = await schemasApi.getById(file.id)
        exists = existingResult.success && !!existingResult.data
      } catch {
        exists = false
      }

      if (exists) {
        await schemasApi.update(file.id, {
          name: file.metadata.name,
          content: file.content,
          canvasState: file.canvasState,
        })
      } else if (file.projectId) {
        const createResult = await schemasApi.create({
          projectId: file.projectId,
          name: file.metadata.name,
          fileName: `${file.metadata.name}.wtv`,
          content: file.content,
          canvasState: file.canvasState,
        })

        if (createResult.success && createResult.data) {
          const serverId = createResult.data.id
          if (serverId !== file.id) {
            // Update the file id in the Zustand store so future saves use the server-assigned id
            file.id = serverId
            try {
              const { useDiagramStore } = await import('@/stores')
              const currentFile = useDiagramStore.getState().file
              if (currentFile && currentFile.projectId === file.projectId) {
                useDiagramStore.getState().loadFile({ ...currentFile, id: serverId })
              }
            } catch {
              // Ignore store update errors
            }
          }
        }
      }

      this.state.lastSaveAt = new Date().toISOString()
      this.state.mode = 'cloud'
    } catch (error) {
      console.error('Cloud save error:', error)
      this.state.mode = 'error'
    }

    this._isSaving = false
    this.notifyListeners()
  }

  // Subscribe to state changes
  subscribe(listener: (state: StorageState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener({ ...this.state }))
  }

  getState(): StorageState {
    return { ...this.state }
  }

  destroy() {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
    }
    window.removeEventListener('online', () => this.handleOnline())
    window.removeEventListener('offline', () => this.handleOffline())
    this.listeners.clear()
  }
}

export const storageService = new StorageService()
