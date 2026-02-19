import api from './api'

export interface Queue {
  id: number
  name: string
  extension: string
  strategy: 'ringall' | 'leastrecent' | 'fewestcalls' | 'random' | 'rrmemory'
  maxWaitTime: number   // seconds
  maxCallers: number
  timeout: number       // ring timeout per member
  wrapUpTime: number
  musicOnHold: string
  announceFrequency: number
  members: QueueMember[]
  activeCallers?: number
  waitingCallers?: number
}

export interface QueueMember {
  agentId: number
  agentName: string
  agentNo: string
  penalty: number
  paused: boolean
}

export interface CreateQueueDto {
  name: string
  extension: string
  strategy: Queue['strategy']
  maxWaitTime: number
  maxCallers: number
  timeout: number
  wrapUpTime: number
  musicOnHold?: string
  announceFrequency?: number
  memberIds?: number[]
}

export const queueService = {
  list: (): Promise<Queue[]> => api.get('/queues'),
  get: (id: number): Promise<Queue> => api.get(`/queues/${id}`),
  create: (dto: CreateQueueDto): Promise<Queue> => api.post('/queues', dto),
  update: (id: number, dto: Partial<CreateQueueDto>): Promise<Queue> =>
    api.put(`/queues/${id}`, dto),
  delete: (id: number): Promise<void> => api.delete(`/queues/${id}`),
  syncAsterisk: (id: number): Promise<void> => api.post(`/queues/${id}/sync`),
}
