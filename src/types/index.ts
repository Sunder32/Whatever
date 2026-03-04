export * from './schema'

export interface User {
  id: string
  username: string
  email: string
  fullName: string
  avatarUrl?: string
  bio?: string
  location?: string
  website?: string
  preferences: UserPreferences
  createdAt: string
  lastLoginAt?: string
  isActive: boolean
  isVerified: boolean
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: 'en' | 'ru'
  autoSaveInterval: number
  gridSize: number
  snapToGrid: boolean
  showMiniMap: boolean
  defaultFontFamily: string
  defaultFontSize: number
}

export interface Project {
  id: string
  ownerId: string
  name: string
  description: string
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
  isArchived: boolean
  isPublic: boolean
}

export interface Schema {
  id: string
  projectId: string
  name: string
  fileName: string
  contentHash: string
  fileSize: number
  formatVersion: string
  thumbnailUrl?: string
  createdAt: string
  updatedAt: string
  isEncrypted: boolean
}

export interface SchemaVersion {
  id: string
  schemaId: string
  versionNumber: number
  contentHash: string
  createdBy: string
  createdAt: string
  commitMessage: string
  fileSize: number
}

export interface SyncQueueItem {
  id: string
  userId: string
  operationType: 'create' | 'update' | 'delete'
  entityType: 'schema' | 'project' | 'asset'
  entityId: string
  operationData: Record<string, unknown>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  retryCount: number
  createdAt: string
  processedAt?: string
  errorMessage?: string
  priority: number
}

export interface Collaborator {
  id: string
  projectId: string
  userId: string
  role: 'owner' | 'admin' | 'write' | 'read'
  permissions: Record<string, boolean>
  createdAt: string
  acceptedAt?: string
}

export interface Session {
  id: string
  userId: string
  token: string
  refreshToken: string
  deviceInfo: Record<string, unknown>
  ipAddress: string
  createdAt: string
  expiresAt: string
  isActive: boolean
}

export interface RealtimeSession {
  id: string
  userId: string
  schemaId?: string
  connectionId: string
  cursorPosition: { x: number; y: number }
  selectedElements: string[]
  status: 'active' | 'idle' | 'away'
  connectedAt: string
}

export type Tool = 
  | 'select' 
  | 'pan' 
  | 'rectangle' 
  | 'ellipse' 
  | 'diamond' 
  | 'triangle' 
  | 'line' 
  | 'arrow' 
  | 'text'
  | 'star'
  | 'hexagon'
  | 'cylinder'
  | 'cloud'
  | 'callout'
  | 'image'
  | 'freehand'
  | 'note'
  | 'container'

export interface AppState {
  currentTool: Tool
  isOnline: boolean
  isSyncing: boolean
  lastSaved?: string
  hasUnsavedChanges: boolean
}
