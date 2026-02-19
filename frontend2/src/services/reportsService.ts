import api from './api'

export interface ReportSummary {
  date: string
  totalCalls: number
  answeredCalls: number
  missedCalls: number
  avgDuration: number   // seconds
  totalDuration: number // seconds
  answerRate: number    // 0–1
}

export interface AgentReport {
  agentId: number
  agentName: string
  agentNo: string
  totalCalls: number
  answeredCalls: number
  avgDuration: number
  totalTalkTime: number
  avgHandleTime: number
}

export interface ReportParams {
  startDate: string   // YYYY-MM-DD
  endDate: string
  agentId?: number
  campaignId?: number
}

export const reportsService = {
  getSummary: (params: ReportParams): Promise<ReportSummary[]> =>
    api.get('/reports/summary', { params }),

  getAgentReport: (params: ReportParams): Promise<AgentReport[]> =>
    api.get('/reports/agents', { params }),

  getHourlyDistribution: (params: ReportParams): Promise<{ hour: number; calls: number }[]> =>
    api.get('/reports/hourly', { params }),

  exportSummary: (params: ReportParams): string => {
    const qs = new URLSearchParams(params as unknown as Record<string, string>).toString()
    return `/api/reports/export/summary?${qs}`
  },
}
