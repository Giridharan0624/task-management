import { apiClient } from './client'
import type { User } from '@/types/user'

export interface UpdateProfileData {
  name?: string
}

export async function getMyProfile(): Promise<User> {
  return apiClient.get<User>('/users/me')
}

export async function updateMyProfile(data: UpdateProfileData): Promise<User> {
  return apiClient.put<User>('/users/me', data)
}
