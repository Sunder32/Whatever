import apiClient, { ApiResponse } from './client'

export interface SchemaLock {
  id: string
  schemaId: string
  elementId: string
  lockedBy: string
  userName?: string
  lockType: string
  expiresAt: string
  createdAt: string
}

export interface CreateLockRequest {
  elementId: string
  lockType?: 'edit' | 'move' | 'exclusive'
}

export const locksApi = {
  /**
   * List active locks for a schema.
   */
  async list(schemaId: string): Promise<ApiResponse<SchemaLock[]>> {
    return apiClient.get<SchemaLock[]>(`/schemas/${schemaId}/locks`)
  },

  /**
   * Create (acquire) a lock on an element within a schema.
   */
  async create(schemaId: string, data: CreateLockRequest): Promise<ApiResponse<SchemaLock>> {
    return apiClient.post<SchemaLock>(`/schemas/${schemaId}/locks`, data)
  },

  /**
   * Release (delete) a lock.
   */
  async delete(schemaId: string, lockId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/schemas/${schemaId}/locks/${lockId}`)
  },
}
