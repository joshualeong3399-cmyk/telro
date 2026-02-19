import api from './api'
import type { LoginResponse, User } from '@/types/auth'

export const authService = {
  /**
   * 登录 - POST /api/auth/login
   */
  login: (username: string, password: string): Promise<LoginResponse> =>
    api.post('/auth/login', { username, password }),

  /**
   * 退出登录 - POST /api/auth/logout
   */
  logout: (): Promise<void> => api.post('/auth/logout'),

  /**
   * 获取当前用户信息 - GET /api/auth/profile
   */
  getProfile: (): Promise<User> => api.get('/auth/profile'),

  /**
   * 修改密码 - PUT /api/auth/password
   */
  changePassword: (oldPassword: string, newPassword: string): Promise<void> =>
    api.put('/auth/password', { oldPassword, newPassword }),
}
