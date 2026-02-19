import api from './api'

export type AgentStatus = 'online' | 'busy' | 'away' | 'offline'

export interface Agent {
  id: number
  agentNo: string
  name: string
  extension: string
  status: AgentStatus
  skillGroup: string
}

export interface PageResult<T> {
  records: T[]
  total: number
}

export const agentService = {
  list: (p: { page: number; pageSize: number; keyword?: string }): Promise<PageResult<Agent>> =>
    api.get('/agents', { params: p }),

  create: (d: Omit<Agent, 'id'>): Promise<Agent> =>
    api.post('/agents', d),

  update: (id: number, d: Partial<Omit<Agent, 'id'>>): Promise<Agent> =>
    api.put(`/agents/${id}`, d),

  remove: (id: number): Promise<void> =>
    api.delete(`/agents/${id}`),
}
