import api from './api'

export type CallStatus = 'answered' | 'missed' | 'busy' | 'failed'

export interface CallRecord {
  id: number
  caller: string
  callee: string
  time: string
  duration: number    // seconds
  status: CallStatus
  recording: string | null
}

export interface PageResult<T> {
  records: T[]
  total: number
}

export const callHistoryService = {
  list: (p: {
    page: number
    pageSize: number
    keyword?: string
    status?: CallStatus | 'all'
    startDate?: string
    endDate?: string
  }): Promise<PageResult<CallRecord>> =>
    api.get('/calls', { params: p }),
}
