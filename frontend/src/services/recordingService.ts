import api from './api'

export interface Recording {
  id: number
  filename: string
  duration: number    // seconds
  size: number        // bytes
  time: string
  url: string
}

export interface PageResult<T> {
  records: T[]
  total: number
}

export const recordingService = {
  list: (p: {
    page: number
    pageSize: number
    keyword?: string
    startDate?: string
    endDate?: string
  }): Promise<PageResult<Recording>> =>
    api.get('/recordings', { params: p }),

  remove: (id: number): Promise<void> =>
    api.delete(`/recordings/${id}`),
}
