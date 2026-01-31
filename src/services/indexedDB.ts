import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { WtvFile, Project, Schema, SyncQueueItem } from '@/types'

interface DiagramAppDB extends DBSchema {
  files: {
    key: string
    value: WtvFile & { 
      localModified: boolean
      lastSyncAt?: string 
    }
    indexes: {
      'by-modified': string
      'by-project': string
    }
  }
  projects: {
    key: string
    value: Project & { 
      localModified: boolean
      lastSyncAt?: string 
    }
    indexes: {
      'by-updated': string
    }
  }
  schemas: {
    key: string
    value: Schema & { 
      localModified: boolean
      lastSyncAt?: string 
    }
    indexes: {
      'by-project': string
      'by-updated': string
    }
  }
  syncQueue: {
    key: string
    value: SyncQueueItem
    indexes: {
      'by-status': string
      'by-priority': number
      'by-created': string
    }
  }
  settings: {
    key: string
    value: unknown
  }
  cache: {
    key: string
    value: {
      data: unknown
      expiresAt: number
    }
  }
}

const DB_NAME = 'diagram-app-db'
const DB_VERSION = 1

class IndexedDBStore {
  private db: IDBPDatabase<DiagramAppDB> | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._init()
    return this.initPromise
  }

  private async _init(): Promise<void> {
    this.db = await openDB<DiagramAppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Files store
        if (!db.objectStoreNames.contains('files')) {
          const filesStore = db.createObjectStore('files', { keyPath: 'id' })
          filesStore.createIndex('by-modified', 'metadata.modified')
          filesStore.createIndex('by-project', 'projectId')
        }

        // Projects store
        if (!db.objectStoreNames.contains('projects')) {
          const projectsStore = db.createObjectStore('projects', { keyPath: 'id' })
          projectsStore.createIndex('by-updated', 'updatedAt')
        }

        // Schemas store
        if (!db.objectStoreNames.contains('schemas')) {
          const schemasStore = db.createObjectStore('schemas', { keyPath: 'id' })
          schemasStore.createIndex('by-project', 'projectId')
          schemasStore.createIndex('by-updated', 'updatedAt')
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
          syncStore.createIndex('by-status', 'status')
          syncStore.createIndex('by-priority', 'priority')
          syncStore.createIndex('by-created', 'createdAt')
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }

        // Cache store
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache')
        }
      },
    })
  }

  private ensureDb(): IDBPDatabase<DiagramAppDB> {
    if (!this.db) throw new Error('Database not initialized. Call init() first.')
    return this.db
  }

  // Files
  async saveFile(file: WtvFile, localModified = true): Promise<void> {
    const db = this.ensureDb()
    await db.put('files', { ...file, localModified, lastSyncAt: localModified ? undefined : new Date().toISOString() })
  }

  async getFile(id: string): Promise<WtvFile | undefined> {
    const db = this.ensureDb()
    const result = await db.get('files', id)
    return result
  }

  async getAllFiles(): Promise<WtvFile[]> {
    const db = this.ensureDb()
    return db.getAll('files')
  }

  async getModifiedFiles(): Promise<WtvFile[]> {
    const db = this.ensureDb()
    const all = await db.getAll('files')
    return all.filter(f => f.localModified)
  }

  async deleteFile(id: string): Promise<void> {
    const db = this.ensureDb()
    await db.delete('files', id)
  }

  async getFileByProject(projectId: string): Promise<WtvFile | undefined> {
    const db = this.ensureDb()
    const files = await db.getAllFromIndex('files', 'by-project', projectId)
    return files[0] // Return first file for this project
  }

  // Projects
  async saveProject(project: Project, localModified = true): Promise<void> {
    const db = this.ensureDb()
    await db.put('projects', { ...project, localModified })
  }

  async getProject(id: string): Promise<Project | undefined> {
    const db = this.ensureDb()
    return db.get('projects', id)
  }

  async getAllProjects(): Promise<Project[]> {
    const db = this.ensureDb()
    return db.getAll('projects')
  }

  async deleteProject(id: string): Promise<void> {
    const db = this.ensureDb()
    await db.delete('projects', id)
  }

  // Schemas
  async saveSchema(schema: Schema, localModified = true): Promise<void> {
    const db = this.ensureDb()
    await db.put('schemas', { ...schema, localModified })
  }

  async getSchema(id: string): Promise<Schema | undefined> {
    const db = this.ensureDb()
    return db.get('schemas', id)
  }

  async getSchemasByProject(projectId: string): Promise<Schema[]> {
    const db = this.ensureDb()
    return db.getAllFromIndex('schemas', 'by-project', projectId)
  }

  async deleteSchema(id: string): Promise<void> {
    const db = this.ensureDb()
    await db.delete('schemas', id)
  }

  // Sync Queue
  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    const db = this.ensureDb()
    await db.put('syncQueue', item)
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    const db = this.ensureDb()
    return db.getAllFromIndex('syncQueue', 'by-status', 'pending')
  }

  async updateSyncItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
    const db = this.ensureDb()
    const item = await db.get('syncQueue', id)
    if (item) {
      await db.put('syncQueue', { ...item, ...updates })
    }
  }

  async removeSyncItem(id: string): Promise<void> {
    const db = this.ensureDb()
    await db.delete('syncQueue', id)
  }

  async clearCompletedSyncItems(): Promise<void> {
    const db = this.ensureDb()
    const completed = await db.getAllFromIndex('syncQueue', 'by-status', 'completed')
    const tx = db.transaction('syncQueue', 'readwrite')
    await Promise.all(completed.map(item => tx.store.delete(item.id)))
    await tx.done
  }

  // Settings
  async getSetting<T>(key: string): Promise<T | undefined> {
    const db = this.ensureDb()
    return db.get('settings', key) as Promise<T | undefined>
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const db = this.ensureDb()
    await db.put('settings', value, key)
  }

  async deleteSetting(key: string): Promise<void> {
    const db = this.ensureDb()
    await db.delete('settings', key)
  }

  // Cache
  async getFromCache<T>(key: string): Promise<T | undefined> {
    const db = this.ensureDb()
    const cached = await db.get('cache', key)
    if (!cached) return undefined
    if (Date.now() > cached.expiresAt) {
      await db.delete('cache', key)
      return undefined
    }
    return cached.data as T
  }

  async setInCache<T>(key: string, data: T, ttlMs: number = 3600000): Promise<void> {
    const db = this.ensureDb()
    await db.put('cache', { data, expiresAt: Date.now() + ttlMs }, key)
  }

  async clearCache(): Promise<void> {
    const db = this.ensureDb()
    await db.clear('cache')
  }

  // Clear all data
  async clearAll(): Promise<void> {
    const db = this.ensureDb()
    await Promise.all([
      db.clear('files'),
      db.clear('projects'),
      db.clear('schemas'),
      db.clear('syncQueue'),
      db.clear('settings'),
      db.clear('cache'),
    ])
  }
}

export const indexedDB = new IndexedDBStore()
export default indexedDB
