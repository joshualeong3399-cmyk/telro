import api from './api'

export interface TimeRule {
  weekdays: number[]      // 0=Sun … 6=Sat
  startTime: string       // HH:mm
  endTime: string         // HH:mm
}

export interface TimeCondition {
  id: number
  name: string
  timezone?: string
  rules: TimeRule[]
  matchAction: string     // extension/queue/ivr id on match
  noMatchAction: string   // extension/queue/ivr id on no-match
  enabled: boolean
  description?: string
  createdAt: string
}

export interface CreateTimeConditionDto {
  name: string
  timezone?: string
  rules: TimeRule[]
  matchAction: string
  noMatchAction: string
  enabled?: boolean
  description?: string
}

export const timeConditionService = {
  list: (): Promise<TimeCondition[]> => api.get('/time-conditions'),
  get: (id: number): Promise<TimeCondition> => api.get(`/time-conditions/${id}`),
  create: (dto: CreateTimeConditionDto): Promise<TimeCondition> =>
    api.post('/time-conditions', dto),
  update: (id: number, dto: Partial<CreateTimeConditionDto>): Promise<TimeCondition> =>
    api.put(`/time-conditions/${id}`, dto),
  delete: (id: number): Promise<void> => api.delete(`/time-conditions/${id}`),
}
