/**
 * Cookie 工具函数
 * 统一管理 token 等敏感信息的 Cookie 读写
 */

const DEFAULT_EXPIRES_DAYS = 7

/**
 * 设置 Cookie
 */
export function setCookie(name: string, value: string, days = DEFAULT_EXPIRES_DAYS): void {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

/**
 * 读取 Cookie
 */
export function getCookie(name: string): string | null {
  const encodedName = encodeURIComponent(name)
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split('=')
    if (key === encodedName) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

/**
 * 删除 Cookie
 */
export function removeCookie(name: string): void {
  document.cookie = `${encodeURIComponent(name)}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`
}

// Token 专用常量
export const TOKEN_KEY = 'auth_token'
export const USER_KEY = 'auth_user'
