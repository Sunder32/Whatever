import { apiClient } from './client'
import type { WtvFile } from '@/types'
import axios from 'axios'

export type ExportFormat = 'png' | 'svg' | 'pdf'

export interface ExportRequest {
  format: ExportFormat
  width?: number
  height?: number
  dpi?: number
  content: {
    nodes: any[]
    edges: any[]
  }
  canvas_state?: {
    zoom: number
    pan: { x: number; y: number }
  }
}

export interface ExportResponse {
  success: boolean
  data?: any // Blob or base64?
  url?: string
  error?: string
}

export const exportApi = {
  exportDiagram: async (file: WtvFile, format: ExportFormat): Promise<Blob> => {
    // Transform WtvFile to ExportRequest
    const requestData: ExportRequest = {
      format,
      // Default standard HD export
      width: 1920, 
      height: 1080,
      dpi: 300,
      content: {
        nodes: file.content.nodes,
        edges: file.content.edges
      },
      canvas_state: {
        zoom: file.canvasState.zoom,
        pan: file.canvasState.pan
      }
    }

    // Use axios directly for blob response type
    const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api/v1' : 'http://localhost:9000/api/v1')
    const response = await axios.post(`${API_BASE_URL}/export`, requestData, {
      responseType: 'blob',
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    })
    
    return response.data as Blob
  },

  checkHealth: async () => {
    return apiClient.get('/export/python-health')
  }
}
