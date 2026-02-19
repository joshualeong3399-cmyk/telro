// 4 级角色定义
export enum UserRole {
  ADMIN = 'admin',       // 管理员 - 全部权限
  OPERATOR = 'operator', // 运营 - 运营管理权限
  MERCHANT = 'merchant', // 商户 - 商户业务权限
  EMPLOYEE = 'employee', // 员工 - 基础操作权限
}

// 角色中文标签
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: '管理员',
  [UserRole.OPERATOR]: '运营',
  [UserRole.MERCHANT]: '商户',
  [UserRole.EMPLOYEE]: '员工',
}

// 角色权重（数值越高权限越大）
export const ROLE_WEIGHT: Record<UserRole, number> = {
  [UserRole.ADMIN]: 4,
  [UserRole.OPERATOR]: 3,
  [UserRole.MERCHANT]: 2,
  [UserRole.EMPLOYEE]: 1,
}

export interface User {
  id: number
  username: string
  displayName: string
  role: UserRole
  email?: string
  avatar?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}
