import apiClient, { ApiResponse, TokenPair } from './client'
import type { User } from '@/types'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  fullName: string
}

export interface AuthResponse {
  user: User
  tokens: TokenPair
}

export interface ProfileUpdateRequest {
  fullName?: string
  avatarUrl?: string
  avatarFile?: File  // For file upload
  preferences?: Record<string, unknown>
}

export interface PasswordChangeRequest {
  oldPassword: string
  newPassword: string
}

export const authApi = {
  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data)
    if (response.success && response.data?.tokens) {
      apiClient.setTokens(response.data.tokens)
    }
    return response
  },

  async login(data: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data)
    if (response.success && response.data?.tokens) {
      apiClient.setTokens(response.data.tokens)
    }
    return response
  },

  async logout(): Promise<ApiResponse<void>> {
    const response = await apiClient.post<void>('/auth/logout')
    apiClient.clearTokens()
    return response
  },

  async getProfile(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/auth/profile')
  },

  async updateProfile(data: ProfileUpdateRequest): Promise<ApiResponse<User>> {
    // If there's an avatar file, use FormData
    if (data.avatarFile) {
      const formData = new FormData()
      formData.append('avatar', data.avatarFile)
      if (data.fullName) {
        formData.append('fullName', data.fullName)
      }
      return apiClient.putFormData<User>('/auth/profile', formData)
    }
    // Otherwise use regular JSON
    return apiClient.put<User>('/auth/profile', data)
  },

  async changePassword(data: PasswordChangeRequest): Promise<ApiResponse<void>> {
    return apiClient.put<void>('/auth/password', data)
  },

  async validateToken(): Promise<ApiResponse<{ valid: boolean }>> {
    return apiClient.post<{ valid: boolean }>('/auth/validate')
  },

  isAuthenticated(): boolean {
    return apiClient.isAuthenticated()
  },
}

export default authApi
