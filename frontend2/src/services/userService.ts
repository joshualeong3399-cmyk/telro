import api from './api'
import type { UserRole } from '@/types/auth'

export interface SystemUser {
  id: number
  username: string
  displayName: string
  email?: string
  role: UserRole
  merchantId?: number
  extensionId?: number
  extensionNumber?: string
  enabled: boolean
  lastLogin?: string
  createdAt: string
}

export interface CreateUserDto {
  username: string
  password: string
  displayName: string
  email?: string
  role: UserRole
  merchantId?: number
  extensionId?: number
  enabled?: boolean
}

export interface UpdateUserDto {
  displayName?: string
  email?: string
  role?: UserRole
  extensionId?: number
  enabled?: boolean
  password?: string
}

export const userService = {
  list: (params?: { role?: UserRole; enabled?: boolean }): Promise<SystemUser[]> =>
    api.get('/users', { params }),

  get: (id: number): Promise<SystemUser> => api.get(`/users/${id}`),

  create: (dto: CreateUserDto): Promise<SystemUser> => api.post('/users', dto),

  update: (id: number, dto: UpdateUserDto): Promise<SystemUser> =>
    api.put(`/users/${id}`, dto),

  delete: (id: number): Promise<void> => api.delete(`/users/${id}`),

  resetPassword: (id: number, password: string): Promise<void> =>
    api.post(`/users/${id}/reset-password`, { password }),

  toggleEnabled: (id: number, enabled: boolean): Promise<SystemUser> =>
    api.patch(`/users/${id}`, { enabled }),
}
