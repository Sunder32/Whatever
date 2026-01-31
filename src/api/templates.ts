import apiClient, { ApiResponse } from './client'

export interface Template {
  id: string
  name: string
  description: string
  category: string
  content: {
    nodes: Array<{
      id: string
      type: string
      position: { x: number; y: number }
      size?: { width: number; height: number }
      label: string
      style?: Record<string, unknown>
    }>
    edges: Array<{
      id: string
      source: string
      target: string
      label?: string
    }>
    layers?: Array<{
      id: string
      name: string
      visible: boolean
      locked: boolean
      opacity: number
      order: number
    }>
  }
  tags: string[]
  usageCount: number
  isPublic: boolean
}

export const templatesApi = {
  /**
   * Get all public templates, optionally filtered by category
   */
  async list(category?: string): Promise<ApiResponse<Template[]>> {
    const params = category ? { category } : undefined
    return apiClient.get<Template[]>('/templates', params)
  },

  /**
   * Get a specific template by ID
   */
  async getById(id: string): Promise<ApiResponse<Template>> {
    return apiClient.get<Template>(`/templates/${id}`)
  },

  /**
   * Get all available template categories
   */
  async getCategories(): Promise<ApiResponse<string[]>> {
    return apiClient.get<string[]>('/templates/categories')
  },
}

export default templatesApi
