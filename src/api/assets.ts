import apiClient, { ApiResponse } from './client'

export interface Asset {
  id: string
  schemaId?: string
  uploadedBy: string
  fileName: string
  mimeType: string
  size: number
  storageType: string
  storageUrl?: string
  contentHash: string
  createdAt: string
  updatedAt: string
}

export interface UploadAssetResponse {
  id: string
  fileName: string
  mimeType: string
  size: number
  contentHash: string
  deduplicated: boolean
}

export const assetsApi = {
  /**
   * Upload an asset file (image). Max 10MB, image types only.
   */
  async upload(file: File, schemaId?: string): Promise<ApiResponse<UploadAssetResponse>> {
    const formData = new FormData()
    formData.append('file', file)
    if (schemaId) {
      formData.append('schemaId', schemaId)
    }
    return apiClient.uploadFile<UploadAssetResponse>('/assets', formData)
  },

  /**
   * Get asset metadata by ID.
   */
  async getById(id: string): Promise<ApiResponse<Asset>> {
    return apiClient.get<Asset>(`/assets/${id}`)
  },

  /**
   * Get the binary download URL for an asset.
   */
  getDownloadUrl(id: string): string {
    // The backend serves the binary directly at GET /assets/:id
    // For use in <img src=...> or direct fetch
    return `/api/v1/assets/${id}`
  },

  /**
   * Delete an asset (soft delete).
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/assets/${id}`)
  },
}
