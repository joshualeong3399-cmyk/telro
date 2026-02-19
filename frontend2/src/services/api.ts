import axios from 'axios'
import { getCookie, removeCookie, TOKEN_KEY, USER_KEY } from '@/utils/cookie'

/**
 * 统一 Axios 实例
 * - baseURL: /api
 * - 请求拦截器：从 Cookie 读取 token 并注入 Authorization header
 * - 响应拦截器：401 自动清除 Cookie 并跳转 /login
 */
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── 请求拦截器 ──────────────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = getCookie(TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── 响应拦截器 ──────────────────────────────────────────────────────────────
api.interceptors.response.use(
  // 直接返回 data 层，调用处无需 res.data
  (response) => response.data,
  (error) => {
    const status = error.response?.status

    if (status === 401) {
      // 清除 Cookie，跳转登录
      removeCookie(TOKEN_KEY)
      removeCookie(USER_KEY)
      window.location.replace('/login')
      return Promise.reject(error)
    }

    if (status === 403) {
      console.warn('[API] 无权限访问该资源')
    }

    if (status >= 500) {
      console.error('[API] 服务器错误', error.response?.data)
    }

    return Promise.reject(error)
  },
)

export default api
