import api from './api'

export interface DashboardStats {
  todayCalls: number
  answeredCalls: number
  totalDuration: number   // 单位：秒
  onlineAgents: number
  queuedCalls: number
  recordingsCount: number
  monthlySpend: number    // 单位：元
  activeExtensions: number
}

export interface CallTrendItem {
  date: string   // 'YYYY-MM-DD'
  calls: number
}

export interface AgentCallItem {
  agent: string
  calls: number
}

export interface DashboardData {
  stats: DashboardStats
  callTrend: CallTrendItem[]   // 近 7 天
  agentCalls: AgentCallItem[]  // 今日坐席通话量
}

export const dashboardService = {
  /**
   * 获取仪表盘全量数据 GET /api/dashboard/stats
   */
  getStats: (): Promise<DashboardData> => api.get('/dashboard/stats'),
}
