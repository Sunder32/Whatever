import { apiClient } from './client'
import type { WtvFile } from '@/types'

export type ExportFormat = 'png' | 'svg' | 'pdf'

export interface ExportRequest {
  format: ExportFormat
  width?: number
  height?: number
  scale?: number
  quality?: number
  backgroundColor?: string
  content: {
    nodes: any[]
    edges: any[]
    layers?: any[]
  }
}

export interface ExportResponse {
  success: boolean
  data?: any
  error?: string
}

export const exportApi = {
  exportDiagram: async (file: WtvFile, format: ExportFormat): Promise<Blob> => {
    // Transform WtvFile to ExportRequest matching Python backend schema
    const requestData: ExportRequest = {
      format,
      width: 1920, 
      height: 1080,
      scale: 2.0,
      quality: 95,
      backgroundColor: '#ffffff',
      content: {
        nodes: file.content.nodes,
        edges: file.content.edges,
        layers: [],
      },
    }

    // Use apiClient for auth header, request blob via downloadable endpoint
    const response = await apiClient.post('/export', requestData) as unknown as Blob
    return response
  },

  checkHealth: async () => {
    return apiClient.get('/export/python-health')
  }
}
