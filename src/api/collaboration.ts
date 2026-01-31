import { apiClient } from './client'

export interface Collaborator {
  id: string
  userId: string
  email: string
  name: string
  avatar?: string
  permission: 'read' | 'write' | 'admin'
  invitedBy?: string
  createdAt?: string
}

export interface AddCollaboratorRequest {
  email: string
  permission: 'read' | 'write' | 'admin'
}

export const collaborationApi = {
  // Get all collaborators for a project
  getCollaborators: async (projectId: string): Promise<Collaborator[]> => {
    const response = await apiClient.get<Collaborator[]>(`/projects/${projectId}/collaborators`)
    return response.data || []
  },

  // Add a new collaborator
  addCollaborator: async (projectId: string, data: AddCollaboratorRequest): Promise<Collaborator> => {
    const response = await apiClient.post<Collaborator>(`/projects/${projectId}/collaborators`, data)
    return response.data!
  },

  // Update collaborator permission
  updateCollaborator: async (projectId: string, userId: string, permission: string): Promise<void> => {
    await apiClient.put(`/projects/${projectId}/collaborators/${userId}`, { permission })
  },

  // Remove a collaborator
  removeCollaborator: async (projectId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/collaborators/${userId}`)
  },

  // Set project visibility (public/private)
  setVisibility: async (projectId: string, isPublic: boolean): Promise<void> => {
    await apiClient.put(`/projects/${projectId}`, { isPublic })
  },

  // Generate share link
  generateShareLink: (projectId: string): string => {
    const baseUrl = window.location.origin
    return `${baseUrl}/shared/${projectId}`
  },
}

export default collaborationApi
