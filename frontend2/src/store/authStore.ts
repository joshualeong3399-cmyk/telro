import { create } from 'zustand'
import { getCookie, setCookie, removeCookie, TOKEN_KEY, USER_KEY } from '@/utils/cookie'
import type { User, LoginResponse } from '@/types/auth'
import { UserRole } from '@/types/auth'

// 从 Cookie 还原 user 状态
function restoreUser(): User | null {
  try {
    const raw = getCookie(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  // 登录：接受后端响应，持久化到 Cookie
  loginSuccess: (res: LoginResponse) => void
  // 角色检查辅助
  hasRole: (role: UserRole) => boolean
  hasAnyRole: (roles: UserRole[]) => boolean
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: restoreUser(),
  token: getCookie(TOKEN_KEY),
  isAuthenticated: !!getCookie(TOKEN_KEY),

  loginSuccess: (res: LoginResponse) => {
    // token 存 Cookie（7 天），user 信息序列化后也存 Cookie
    setCookie(TOKEN_KEY, res.token, 7)
    setCookie(USER_KEY, JSON.stringify(res.user), 7)
    set({ token: res.token, user: res.user, isAuthenticated: true })
  },

  hasRole: (role: UserRole) => get().user?.role === role,

  hasAnyRole: (roles: UserRole[]) => {
    const userRole = get().user?.role
    return userRole ? roles.includes(userRole as UserRole) : false
  },

  logout: () => {
    removeCookie(TOKEN_KEY)
    removeCookie(USER_KEY)
    set({ user: null, token: null, isAuthenticated: false })
  },
}))
