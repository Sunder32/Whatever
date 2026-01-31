import apiClient, { ApiResponse } from './client'

export interface SyncPullRequest {
  lastSyncAt?: string
  entityTypes?: ('schema' | 'project' | 'asset')[]
}

export interface SyncPullResponse {
  changes: SyncChange[]
  serverTime: string
  hasMore: boolean
}

export interface SyncChange {
  entityType: 'schema' | 'project' | 'asset'
  entityId: string
  operation: 'create' | 'update' | 'delete'
  data?: Record<string, unknown>
  timestamp: string
}

export interface SyncPushRequest {
  operations: SyncOperation[]
}

export interface SyncOperation {
  operationType: 'create' | 'update' | 'delete'
  entityType: 'schema' | 'project' | 'asset'
  entityId: string
  operationData: Record<string, unknown>
  clientTimestamp: string
}

export interface SyncPushResponse {
  processed: string[]
  failed: {
    entityId: string
    error: string
  }[]
  conflicts: SyncConflict[]
}

export interface SyncConflict {
  entityId: string
  entityType: 'schema' | 'project' | 'asset'
  clientVersion: Record<string, unknown>
  serverVersion: Record<string, unknown>
  conflictType: 'update' | 'delete'
}

export interface ResolveConflictRequest {
  entityId: string
  resolution: 'client' | 'server' | 'merge'
  mergedData?: Record<string, unknown>
}

export interface SyncStatusResponse {
  pendingOperations: number
  lastSyncAt: string | null
  isOnline: boolean
  conflicts: number
}

export const syncApi = {
  async pull(params?: SyncPullRequest): Promise<ApiResponse<SyncPullResponse>> {
    return apiClient.post<SyncPullResponse>('/sync/pull', params)
  },

  async push(data: SyncPushRequest): Promise<ApiResponse<SyncPushResponse>> {
    return apiClient.post<SyncPushResponse>('/sync/push', data)
  },

  async resolveConflict(data: ResolveConflictRequest): Promise<ApiResponse<void>> {
    return apiClient.post<void>('/sync/resolve', data)
  },

  async getStatus(): Promise<ApiResponse<SyncStatusResponse>> {
    return apiClient.get<SyncStatusResponse>('/sync/status')
  },
}

export default syncApi
