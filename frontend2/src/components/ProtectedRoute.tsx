import { Navigate } from 'react-router-dom'
import { Result, Button } from 'antd'
import type { ReactNode } from 'react'
import { getCookie, TOKEN_KEY } from '@/utils/cookie'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types/auth'

interface ProtectedRouteProps {
  children: ReactNode
  /** 允许访问的角色列表，不填则仅检查登录状态 */
  allowedRoles?: UserRole[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  // 优先从 Cookie 读 token（SSR 安全，也支持页面刷新后恢复）
  const token = getCookie(TOKEN_KEY)
  const { user, hasAnyRole } = useAuthStore()

  // 未登录 → 跳转登录页
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // 指定了角色限制，但当前用户角色不符合
  if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(allowedRoles)) {
    return (
      <Result
        status="403"
        title="403"
        subTitle={`您的角色（${user?.role ?? '未知'}）无权访问此页面`}
        extra={
          <Button type="primary" onClick={() => history.back()}>
            返回上一页
          </Button>
        }
      />
    )
  }

  return <>{children}</>
}

export default ProtectedRoute
