import apiClient, { ApiResponse } from './client'
import type { Schema, SchemaVersion, WtvFile } from '@/types'

export interface CreateSchemaRequest {
  projectId: string
  name: string
  fileName: string
  content: WtvFile['content']
  canvasState?: WtvFile['canvasState']
}

export interface UpdateSchemaRequest {
  name?: string
  content?: WtvFile['content']
  canvasState?: WtvFile['canvasState']
  metadata?: Record<string, unknown>
}

export interface CreateVersionRequest {
  commitMessage: string
  content: WtvFile['content']
}

export interface SearchSchemasRequest {
  query: string
  projectId?: string
  limit?: number
}

export const schemasApi = {
  async list(projectId?: string, page = 1, pageSize = 20): Promise<ApiResponse<Schema[]>> {
    return apiClient.get<Schema[]>('/schemas', { projectId, page, pageSize })
  },

  async getById(id: string): Promise<ApiResponse<Schema>> {
    return apiClient.get<Schema>(`/schemas/${id}`)
  },

  async create(data: CreateSchemaRequest): Promise<ApiResponse<Schema>> {
    return apiClient.post<Schema>('/schemas', data)
  },

  async update(id: string, data: UpdateSchemaRequest): Promise<ApiResponse<Schema>> {
    return apiClient.put<Schema>(`/schemas/${id}`, data)
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/schemas/${id}`)
  },

  async duplicate(id: string): Promise<ApiResponse<Schema>> {
    return apiClient.post<Schema>(`/schemas/${id}/duplicate`)
  },

  async search(params: SearchSchemasRequest): Promise<ApiResponse<Schema[]>> {
    return apiClient.get<Schema[]>('/schemas/search', params as unknown as Record<string, unknown>)
  },

  // Versions
  async getVersions(schemaId: string): Promise<ApiResponse<SchemaVersion[]>> {
    return apiClient.get<SchemaVersion[]>(`/schemas/${schemaId}/versions`)
  },

  async getVersion(schemaId: string, versionId: string): Promise<ApiResponse<SchemaVersion>> {
    return apiClient.get<SchemaVersion>(`/schemas/${schemaId}/versions/${versionId}`)
  },

  async createVersion(schemaId: string, data: CreateVersionRequest): Promise<ApiResponse<SchemaVersion>> {
    return apiClient.post<SchemaVersion>(`/schemas/${schemaId}/versions`, data)
  },

  async restoreVersion(schemaId: string, versionId: string): Promise<ApiResponse<Schema>> {
    return apiClient.post<Schema>(`/schemas/${schemaId}/versions/${versionId}/restore`)
  },
}

export default schemasApi
