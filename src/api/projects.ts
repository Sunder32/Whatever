import apiClient, { ApiResponse } from './client'
import type { Project, Collaborator } from '@/types'

export interface CreateProjectRequest {
  name: string
  description?: string
  isPublic?: boolean
  settings?: Record<string, unknown>
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  isPublic?: boolean
  isArchived?: boolean
  settings?: Record<string, unknown>
}

export interface ProjectListResponse {
  projects: Project[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface AddCollaboratorRequest {
  email: string
  permission: 'read' | 'write' | 'admin'
}

export const projectsApi = {
  async list(page = 1, pageSize = 20): Promise<ApiResponse<Project[]>> {
    return apiClient.get<Project[]>('/projects', { page, pageSize })
  },

  async getById(id: string): Promise<ApiResponse<Project>> {
    return apiClient.get<Project>(`/projects/${id}`)
  },

  async create(data: CreateProjectRequest): Promise<ApiResponse<Project>> {
    return apiClient.post<Project>('/projects', data)
  },

  async update(id: string, data: UpdateProjectRequest): Promise<ApiResponse<Project>> {
    return apiClient.put<Project>(`/projects/${id}`, data)
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${id}`)
  },

  async archive(id: string): Promise<ApiResponse<Project>> {
    return apiClient.post<Project>(`/projects/${id}/archive`)
  },

  async unarchive(id: string): Promise<ApiResponse<Project>> {
    return apiClient.post<Project>(`/projects/${id}/unarchive`)
  },

  async duplicate(id: string): Promise<ApiResponse<Project>> {
    return apiClient.post<Project>(`/projects/${id}/duplicate`)
  },

  // Collaborators
  async getCollaborators(projectId: string): Promise<ApiResponse<Collaborator[]>> {
    return apiClient.get<Collaborator[]>(`/projects/${projectId}/collaborators`)
  },

  async addCollaborator(projectId: string, data: AddCollaboratorRequest): Promise<ApiResponse<Collaborator>> {
    return apiClient.post<Collaborator>(`/projects/${projectId}/collaborators`, data)
  },

  async updateCollaborator(
    projectId: string, 
    userId: string, 
    data: Partial<AddCollaboratorRequest>
  ): Promise<ApiResponse<Collaborator>> {
    return apiClient.put<Collaborator>(`/projects/${projectId}/collaborators/${userId}`, data)
  },

  async removeCollaborator(projectId: string, userId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/projects/${projectId}/collaborators/${userId}`)
  },
}

export default projectsApi
