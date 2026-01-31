import { v4 as uuidv4 } from 'uuid'
import { indexedDB } from './indexedDB'
import { syncApi, type SyncOperation } from '@/api'
import type { WtvFile, SyncQueueItem } from '@/types'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

// Helper to check if user is authenticated (has token)
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

interface SyncManagerOptions {
  autoSync?: boolean
  syncInterval?: number
  maxRetries?: number
  onStatusChange?: (status: SyncStatus) => void
  onConflict?: (conflict: ConflictInfo) => Promise<'client' | 'server' | 'merge'>
  onError?: (error: Error) => void
}

interface ConflictInfo {
  entityId: string
  entityType: 'schema' | 'project' | 'asset'
  clientData: Record<string, unknown>
  serverData: Record<string, unknown>
}

class SyncManager {
  private status: SyncStatus = 'idle'
  private isOnline = navigator.onLine
  private syncInterval: ReturnType<typeof setInterval> | null = null
  private options: SyncManagerOptions = {}
  private lastSyncAt: string | null = null
  private isSyncing = false

  constructor() {
    this.setupOnlineListeners()
  }

  init(options: SyncManagerOptions = {}) {
    this.options = {
      autoSync: true,
      syncInterval: 30000, // 30 seconds
      maxRetries: 3,
      ...options,
    }

    if (this.options.autoSync) {
      this.startAutoSync()
    }

    // Load last sync timestamp
    indexedDB.getSetting<string>('lastSyncAt').then(timestamp => {
      this.lastSyncAt = timestamp || null
    })
  }

  private setupOnlineListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.setStatus('idle')
      this.sync() // Trigger sync when coming back online
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.setStatus('offline')
    })
  }

  private setStatus(status: SyncStatus) {
    this.status = status
    this.options.onStatusChange?.(status)
  }

  getStatus(): SyncStatus {
    return this.status
  }

  isOnlineNow(): boolean {
    return this.isOnline
  }

  startAutoSync() {
    if (this.syncInterval) return

    this.syncInterval = setInterval(() => {
      // Only sync if online, not already syncing, and user is authenticated
      if (this.isOnline && !this.isSyncing && isAuthenticated()) {
        this.sync()
      }
    }, this.options.syncInterval || 30000)
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  async queueOperation(
    operationType: 'create' | 'update' | 'delete',
    entityType: 'schema' | 'project' | 'asset',
    entityId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: uuidv4(),
      userId: '', // Will be filled from auth context
      operationType,
      entityType,
      entityId,
      operationData: data,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      priority: operationType === 'delete' ? 10 : 5,
    }

    await indexedDB.addToSyncQueue(item)

    // Trigger sync if online
    if (this.isOnline && !this.isSyncing) {
      this.sync()
    }
  }

  async sync(): Promise<boolean> {
    // Don't sync if not authenticated
    if (!isAuthenticated()) {
      this.setStatus('idle')
      return false
    }
    
    if (!this.isOnline) {
      this.setStatus('offline')
      return false
    }

    if (this.isSyncing) {
      return false
    }

    this.isSyncing = true
    this.setStatus('syncing')

    try {
      // 1. Push local changes
      await this.pushChanges()

      // 2. Pull remote changes
      await this.pullChanges()

      // 3. Update last sync time
      this.lastSyncAt = new Date().toISOString()
      await indexedDB.setSetting('lastSyncAt', this.lastSyncAt)

      // 4. Clear completed items
      await indexedDB.clearCompletedSyncItems()

      this.setStatus('idle')
      return true
    } catch (error) {
      console.error('Sync failed:', error)
      this.setStatus('error')
      this.options.onError?.(error as Error)
      return false
    } finally {
      this.isSyncing = false
    }
  }

  private async pushChanges(): Promise<void> {
    const pendingItems = await indexedDB.getPendingSyncItems()

    if (pendingItems.length === 0) return

    // Sort by priority (higher first) and created date
    pendingItems.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    const operations: SyncOperation[] = pendingItems.map(item => ({
      operationType: item.operationType as 'create' | 'update' | 'delete',
      entityType: item.entityType as 'schema' | 'project' | 'asset',
      entityId: item.entityId,
      operationData: item.operationData,
      clientTimestamp: item.createdAt,
    }))

    const response = await syncApi.push({ operations })

    if (!response.success) {
      throw new Error(response.error || 'Push failed')
    }

    const result = response.data!

    // Mark processed items as completed
    for (const entityId of result.processed) {
      const item = pendingItems.find(i => i.entityId === entityId)
      if (item) {
        await indexedDB.updateSyncItem(item.id, { status: 'completed' })
      }
    }

    // Handle failed items
    for (const failed of result.failed) {
      const item = pendingItems.find(i => i.entityId === failed.entityId)
      if (item) {
        const retryCount = item.retryCount + 1
        const maxRetries = this.options.maxRetries || 3

        if (retryCount >= maxRetries) {
          await indexedDB.updateSyncItem(item.id, { 
            status: 'failed', 
            errorMessage: failed.error,
            retryCount 
          })
        } else {
          await indexedDB.updateSyncItem(item.id, { 
            retryCount,
            errorMessage: failed.error 
          })
        }
      }
    }

    // Handle conflicts
    for (const conflict of result.conflicts) {
      if (this.options.onConflict) {
        const resolution = await this.options.onConflict({
          entityId: conflict.entityId,
          entityType: conflict.entityType,
          clientData: conflict.clientVersion,
          serverData: conflict.serverVersion,
        })

        await syncApi.resolveConflict({
          entityId: conflict.entityId,
          resolution,
        })
      }
    }
  }

  private async pullChanges(): Promise<void> {
    const response = await syncApi.pull({
      lastSyncAt: this.lastSyncAt || undefined,
    })

    if (!response.success) {
      throw new Error(response.error || 'Pull failed')
    }

    const result = response.data!
    const changes = result.changes || []

    for (const change of changes) {
      switch (change.entityType) {
        case 'schema':
          if (change.operation === 'delete') {
            await indexedDB.deleteSchema(change.entityId)
          } else {
            await indexedDB.saveSchema(change.data as any, false)
          }
          break
        case 'project':
          if (change.operation === 'delete') {
            await indexedDB.deleteProject(change.entityId)
          } else {
            await indexedDB.saveProject(change.data as any, false)
          }
          break
      }
    }
  }

  async saveFileLocally(file: WtvFile): Promise<void> {
    await indexedDB.saveFile(file, true)
    
    // Queue for sync
    const existingFile = await indexedDB.getFile(file.id)
    const operationType = existingFile ? 'update' : 'create'
    
    await this.queueOperation(operationType, 'schema', file.id, {
      content: file.content,
      canvasState: file.canvasState,
      metadata: file.metadata,
    })
  }

  async getLocalFile(id: string): Promise<WtvFile | undefined> {
    return indexedDB.getFile(id)
  }

  async getAllLocalFiles(): Promise<WtvFile[]> {
    return indexedDB.getAllFiles()
  }

  async deleteLocalFile(id: string): Promise<void> {
    await indexedDB.deleteFile(id)
    await this.queueOperation('delete', 'schema', id, {})
  }

  destroy() {
    this.stopAutoSync()
  }
}

export const syncManager = new SyncManager()
export default syncManager
