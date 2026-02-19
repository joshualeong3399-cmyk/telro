import api from './api'

export type BillingType = 'minute' | 'count' | 'all'

export interface BillingSummary {
  totalCalls: number
  answeredCalls: number
  answerRate: number      // 百分比，如 88.5
  totalDuration: number   // 单位：分钟
  totalSpend: number      // 单位：元
}

export interface DailyStatItem {
  date: string            // 'YYYY-MM-DD'
  calls: number
  answered: number
  answerRate: number
  duration: number        // 分钟
  cost: number            // 元
}

export interface BillingRecord {
  id: number
  time: string            // ISO 时间字符串
  billingType: Exclude<BillingType, 'all'>
  callerNumber: string
  calleeNumber: string
  duration: number        // 秒
  cost: number            // 元
}

export interface BillingSummaryRes {
  summary: BillingSummary
  dailyStats: DailyStatItem[]
}

export interface BillingRecordsRes {
  records: BillingRecord[]
  total: number
}

export const billingService = {
  /**
   * 本月汇总 + 每日统计
   * GET /api/billing/summary?month=YYYY-MM
   */
  getSummary: (month: string): Promise<BillingSummaryRes> =>
    api.get('/billing/summary', { params: { month } }),

  /**
   * 账单明细
   * GET /api/billing/records?startDate=&endDate=&billingType=&page=&pageSize=
   */
  getRecords: (params: {
    startDate: string
    endDate: string
    billingType?: BillingType
    page?: number
    pageSize?: number
  }): Promise<BillingRecordsRes> =>
    api.get('/billing/records', { params }),
}
