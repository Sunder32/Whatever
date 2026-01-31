import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'

// Use relative URL in production, localhost in development
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api/v1' : 'http://localhost:9000/api/v1')

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    page?: number
    pageSize?: number
    total?: number
    totalPages?: number
  }
}

export interface TokenPair {
  accessToken: string
  refreshToken?: string  // Optional - may be in HttpOnly cookie
  expiresAt: number
}

class ApiClient {
  private client: AxiosInstance
  private accessToken: string | null = null
  private refreshPromise: Promise<TokenPair> | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Important: send cookies with requests
    })

    this.loadTokens()
    this.setupInterceptors()
  }

  private loadTokens() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken')
      // Note: refreshToken is now in HttpOnly cookie, not localStorage
    }
  }

  private saveTokens(tokens: TokenPair) {
    this.accessToken = tokens.accessToken
    localStorage.setItem('accessToken', tokens.accessToken)
    localStorage.setItem('tokenExpiresAt', tokens.expiresAt.toString())
    // Note: refreshToken is set via HttpOnly cookie by server
  }

  clearTokens() {
    this.accessToken = null
    localStorage.removeItem('accessToken')
    localStorage.removeItem('tokenExpiresAt')
    // Note: HttpOnly cookie will be cleared by logout endpoint
  }

  private setupInterceptors() {
    // Request interceptor - add auth header
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor - handle token refresh and network errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        // Handle network errors (server offline, no connection)
        if (!error.response) {
          // Dispatch event for global toast notification
          window.dispatchEvent(new CustomEvent('api:network-error', { 
            detail: { message: 'Сервер недоступен. Проверьте подключение к интернету.' }
          }))
          return Promise.reject(error)
        }

        // Handle server errors (500+)
        if (error.response.status >= 500) {
          window.dispatchEvent(new CustomEvent('api:server-error', { 
            detail: { message: 'Ошибка сервера. Попробуйте позже.', status: error.response.status }
          }))
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            // Refresh will use HttpOnly cookie automatically with withCredentials
            const tokens = await this.refreshTokens()
            originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`
            return this.client(originalRequest)
          } catch (refreshError) {
            this.clearTokens()
            window.dispatchEvent(new CustomEvent('auth:logout'))
            return Promise.reject(refreshError)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  private async refreshTokens(): Promise<TokenPair> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = (async () => {
      // Send request with credentials (HttpOnly cookie will be sent automatically)
      const response = await axios.post<ApiResponse<{ tokens: TokenPair }>>(
        `${API_BASE_URL}/auth/refresh`,
        {}, // Empty body - refresh token is in HttpOnly cookie
        { withCredentials: true }
      )

      if (response.data.success && response.data.data?.tokens) {
        this.saveTokens(response.data.data.tokens)
        return response.data.data.tokens
      }

      throw new Error('Failed to refresh token')
    })()

    try {
      return await this.refreshPromise
    } finally {
      this.refreshPromise = null
    }
  }

  setTokens(tokens: TokenPair) {
    this.saveTokens(tokens)
  }

  isAuthenticated(): boolean {
    return !!this.accessToken
  }

  // Generic request methods
  async get<T>(url: string, params?: Record<string, unknown>): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, { params })
    return response.data
  }

  async post<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data)
    return response.data
  }

  async put<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data)
    return response.data
  }

  async patch<T>(url: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data)
    return response.data
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url)
    return response.data
  }

  // Upload file with FormData (for avatars, thumbnails, etc.)
  async uploadFile<T>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  // Update profile with optional avatar file
  async putFormData<T>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }
}

export const apiClient = new ApiClient()
export default apiClient
