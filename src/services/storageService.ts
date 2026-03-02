import { v4 as uuidv4 } from 'uuid'
import { indexedDB } from './indexedDB'
import { schemasApi, projectsApi } from '@/api'
import type { WtvFile, Project } from '@/types'

export type StorageMode = 'local' | 'cloud' | 'syncing'

interface StorageState {
  mode: StorageMode
  isOnline: boolean
  lastSyncAt: string | null
  pendingChanges: number
}

// Helper to check authentication
function isAuthenticated(): boolean {
  try {
    const authData = localStorage.getItem('auth-storage')
    if (!authData) return false
    const parsed = JSON.parse(authData)
    return parsed?.state?.isAuthenticated === true
  } catch {
    return false
  }
}

class StorageService {
  private state: StorageState = {
    mode: 'local',
    isOnline: navigator.onLine,
    lastSyncAt: null,
    pendingChanges: 0,
  }
  
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null
  private syncInterval: ReturnType<typeof setInterval> | null = null
  private listeners: Set<(state: StorageState) => void> = new Set()
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
  
  async init(): Promise<void> {
    await indexedDB.init()
    
    // Setup online/offline listeners
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
    
    // Load last sync timestamp
    const lastSync = await indexedDB.getSetting<string>('lastSyncAt')
    this.state.lastSyncAt = lastSync || null
    
    // Count pending changes
    await this.updatePendingCount()
    
    // Start auto-save (every 5 seconds for local)
    this.startAutoSave()
    
    // Start sync check (every 30 seconds when online)
    this.startSyncInterval()
    
    this.notifyListeners()
  }
  
  private handleOnline() {
    this.state.isOnline = true
    this.state.mode = isAuthenticated() ? 'cloud' : 'local'
    this.notifyListeners()
    
    // Trigger sync when coming back online
    if (isAuthenticated()) {
      this.syncToCloud()
    }
  }
  
  private handleOffline() {
    this.state.isOnline = false
    this.state.mode = 'local'
    this.notifyListeners()
  }
  
  private startAutoSave() {
    // Auto-save is handled by useAutoSave hook (30s interval with change detection).
    // StorageService only persists on explicit save() calls now.
    // Keeping this method for API compatibility.
  }
  
  private startSyncInterval() {
    if (this.syncInterval) return
    
    this.syncInterval = setInterval(() => {
      if (this.state.isOnline && isAuthenticated() && this.state.pendingChanges > 0) {
        this.syncToCloud()
      }
    }, 30000)
  }
  
  // Save file immediately (debounced)
  async save(file: WtvFile): Promise<void> {
    // Clear previous timer
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
    }
    
    // Debounce saves to prevent too many writes
    this.saveDebounceTimer = setTimeout(async () => {
      await this.saveLocal(file)
      
      // If online and authenticated, also save to cloud
      if (this.state.isOnline && isAuthenticated()) {
        await this.saveToCloud(file)
      }
    }, 500)
  }
  
  // Save to local IndexedDB
  async saveLocal(file: WtvFile): Promise<void> {
    try {
      await indexedDB.saveFile(file, true)
      await this.updatePendingCount()
      
      // Update project thumbnail if file has one
      if (file.projectId && file.thumbnail?.data) {
        try {
          const { useProjectStore } = await import('@/stores')
          useProjectStore.getState().updateProject(file.projectId, {
            thumbnailUrl: file.thumbnail.data
          })
        } catch {
          // Ignore thumbnail update errors
        }
      }
      
      this.notifyListeners()
    } catch (error) {
      console.error('Local save failed:', error)
    }
  }
  
  // Save to cloud PostgreSQL
  async saveToCloud(file: WtvFile): Promise<void> {
    if (!isAuthenticated()) return
    
    this.state.mode = 'syncing'
    this.notifyListeners()
    
    try {
      // Check if user owns the project before attempting cloud operations
      if (file.projectId) {
        const { useProjectStore, useAuthStore } = await import('@/stores')
        const project = useProjectStore.getState().projects.find(p => p.id === file.projectId)
        const currentUserId = useAuthStore.getState().user?.id
        
        // If project exists and user doesn't own it, only save locally
        if (project && project.ownerId !== currentUserId) {
          await indexedDB.saveFile(file, true)
          this.state.mode = 'local'
          await this.updatePendingCount()
          this.notifyListeners()
          return
        }
      }
      
      // Try to get existing schema
      let exists = false
      let schemaId = file.id
      
      try {
        const existingResult = await schemasApi.getById(file.id)
        exists = existingResult.success && !!existingResult.data
      } catch {
        // Schema doesn't exist on server (404) - will try to create
        exists = false
      }
      
      if (exists) {
        // Update existing
        await schemasApi.update(file.id, {
          name: file.metadata.name,
          content: file.content,
          canvasState: file.canvasState,
        })
      } else if (file.projectId) {
        // Schema doesn't exist but we have a projectId - create it on server
        const createResult = await schemasApi.create({
          projectId: file.projectId,
          name: file.metadata.name,
          fileName: `${file.metadata.name}.wtv`,
          content: file.content,
          canvasState: file.canvasState,
        })
        
        if (createResult.success && createResult.data) {
          // Update local file with server-assigned ID if different
          schemaId = createResult.data.id
          if (schemaId !== file.id) {
            // Update the file with server ID
            file.id = schemaId
          }
        } else {
          // Failed to create on server, save locally
          await indexedDB.saveFile(file, true)
          this.state.mode = 'local'
          await this.updatePendingCount()
          this.notifyListeners()
          return
        }
      } else {
        // No projectId - save locally only (local-only file)
        await indexedDB.saveFile(file, true)
        this.state.mode = 'local'
        await this.updatePendingCount()
        this.notifyListeners()
        return
      }
      
      // Mark as synced locally
      await indexedDB.saveFile(file, false)
      
      this.state.lastSyncAt = new Date().toISOString()
      await indexedDB.setSetting('lastSyncAt', this.state.lastSyncAt)
      
      this.state.mode = 'cloud'
    } catch (error) {
      // Only log actual errors, not 404s
      console.error('Cloud save error:', error)
      this.state.mode = 'local'
    }
    
    await this.updatePendingCount()
    this.notifyListeners()
  }
  
  // Sync all pending changes to cloud
  async syncToCloud(): Promise<void> {
    if (!isAuthenticated() || !this.state.isOnline) return
    
    this.state.mode = 'syncing'
    this.notifyListeners()
    
    try {
      const modifiedFiles = await indexedDB.getModifiedFiles()
      
      for (const file of modifiedFiles) {
        await this.saveToCloud(file)
      }
      
      this.state.lastSyncAt = new Date().toISOString()
      await indexedDB.setSetting('lastSyncAt', this.state.lastSyncAt)
      
      this.state.mode = 'cloud'
    } catch (error) {
      console.error('Sync failed:', error)
      this.state.mode = 'local'
    }
    
    await this.updatePendingCount()
    this.notifyListeners()
  }
  
  // Load file (prefer cloud if online and authenticated)
  async loadFile(id: string): Promise<WtvFile | null> {
    // Always try local first for speed
    const localFile = await indexedDB.getFile(id)
    
    if (this.state.isOnline && isAuthenticated()) {
      try {
        const cloudResult = await schemasApi.getById(id)
        if (cloudResult.success && cloudResult.data) {
          const schemaData = cloudResult.data as { content?: unknown }
          const cloudFile = (schemaData.content || cloudResult.data) as unknown as WtvFile
          
          // Compare timestamps
          if (localFile) {
            const localModified = new Date(localFile.metadata.modified).getTime()
            const cloudModified = new Date(cloudFile.metadata.modified).getTime()
            
            if (cloudModified > localModified) {
              // Cloud is newer, use it and update local
              await indexedDB.saveFile(cloudFile, false)
              return cloudFile
            } else if (localModified > cloudModified) {
              // Local is newer, push to cloud
              await this.saveToCloud(localFile)
              return localFile
            }
          }
          return cloudFile
        }
      } catch {
        // Fall back to local
      }
    }
    
    return localFile || null
  }
  
  // Get all files
  async getAllFiles(): Promise<WtvFile[]> {
    const localFiles = await indexedDB.getAllFiles()
    
    if (this.state.isOnline && isAuthenticated()) {
      try {
        // Could merge with cloud files here
        // For now just return local
      } catch {
        // Ignore
      }
    }
    
    return localFiles
  }
  
  // Delete file
  async deleteFile(id: string): Promise<void> {
    await indexedDB.deleteFile(id)
    
    if (this.state.isOnline && isAuthenticated()) {
      try {
        await schemasApi.delete(id)
      } catch {
        // Queue for later deletion
        await indexedDB.addToSyncQueue({
          id: uuidv4(),
          userId: '',
          operationType: 'delete',
          entityType: 'schema',
          entityId: id,
          operationData: {},
          status: 'pending',
          retryCount: 0,
          createdAt: new Date().toISOString(),
          priority: 10,
        })
      }
    }
    
    await this.updatePendingCount()
    this.notifyListeners()
  }
  
  // Projects
  async saveProject(project: Project): Promise<void> {
    await indexedDB.saveProject(project, true)
    
    if (this.state.isOnline && isAuthenticated()) {
      try {
        const existing = await projectsApi.getById(project.id)
        if (existing.success && existing.data) {
          await projectsApi.update(project.id, {
            name: project.name,
            description: project.description,
            isPublic: project.isPublic,
            settings: project.settings,
          })
        } else {
          await projectsApi.create({
            name: project.name,
            description: project.description,
            isPublic: project.isPublic,
            settings: project.settings,
          })
        }
        await indexedDB.saveProject(project, false)
      } catch {
        // Keep in local queue
      }
    }
    
    await this.updatePendingCount()
    this.notifyListeners()
  }
  
  async getAllProjects(): Promise<Project[]> {
    return indexedDB.getAllProjects()
  }
  
  private async updatePendingCount(): Promise<void> {
    const modifiedFiles = await indexedDB.getModifiedFiles()
    const pendingSync = await indexedDB.getPendingSyncItems()
    this.state.pendingChanges = modifiedFiles.length + pendingSync.length
  }
  
  // Subscribe to state changes
  subscribe(listener: (state: StorageState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }
  
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state))
  }
  
  getState(): StorageState {
    return { ...this.state }
  }
  
  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
    }
    this.listeners.clear()
  }
}

export const storageService = new StorageService()
