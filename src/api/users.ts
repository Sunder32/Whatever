import apiClient, { ApiResponse } from './client'

export interface UserSearchResult {
  id: string
  username: string
  fullName: string
  avatarUrl?: string
  bio?: string
  isFollowing?: boolean
}

export interface UserProfile {
  id: string
  username: string
  fullName: string
  email?: string
  avatarUrl?: string
  bio?: string
  location?: string
  website?: string
  createdAt: string
  projectsCount: number
  followersCount: number
  followingCount: number
  isFollowing?: boolean
}

export interface FollowersResponse {
  users: UserSearchResult[]
  total: number
}

export const usersApi = {
  // Search users by username or fullName
  async search(query: string, limit = 20): Promise<ApiResponse<UserSearchResult[]>> {
    return apiClient.get<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`)
  },

  // Get user profile by ID
  async getById(userId: string): Promise<ApiResponse<UserProfile>> {
    return apiClient.get<UserProfile>(`/users/${userId}`)
  },

  // Get user profile by username
  async getByUsername(username: string): Promise<ApiResponse<UserProfile>> {
    return apiClient.get<UserProfile>(`/users/username/${username}`)
  },

  // Follow a user
  async follow(userId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/users/${userId}/follow`)
  },

  // Unfollow a user
  async unfollow(userId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/users/${userId}/follow`)
  },

  // Get user's followers
  async getFollowers(userId: string, page = 1, limit = 20): Promise<ApiResponse<FollowersResponse>> {
    return apiClient.get<FollowersResponse>(`/users/${userId}/followers?page=${page}&limit=${limit}`)
  },

  // Get users that user is following
  async getFollowing(userId: string, page = 1, limit = 20): Promise<ApiResponse<FollowersResponse>> {
    return apiClient.get<FollowersResponse>(`/users/${userId}/following?page=${page}&limit=${limit}`)
  },

  // Get suggested users to follow
  async getSuggested(limit = 10): Promise<ApiResponse<UserSearchResult[]>> {
    return apiClient.get<UserSearchResult[]>(`/users/suggested?limit=${limit}`)
  },

  // Get user's public projects
  async getUserProjects(userId: string, page = 1, limit = 10): Promise<ApiResponse<{ projects: unknown[], total: number }>> {
    return apiClient.get<{ projects: unknown[], total: number }>(`/users/${userId}/projects?page=${page}&limit=${limit}`)
  },
}

export default usersApi
