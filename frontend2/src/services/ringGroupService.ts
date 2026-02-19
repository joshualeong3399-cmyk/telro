import api from './api'

export type RingStrategy = 'ringall' | 'hunt' | 'memoryhunt' | 'firstavailable' | 'random'

export interface RingGroup {
  id: number
  name: string
  extension: string
  strategy: RingStrategy
  ringTimeout?: number
  members: RingGroupMember[]
  failoverDestination?: string
  enabled: boolean
  description?: string
  createdAt: string
}

export interface RingGroupMember {
  extensionId: number
  extensionNumber: string
  name: string
  order: number
}

export interface CreateRingGroupDto {
  name: string
  extension: string
  strategy: RingStrategy
  ringTimeout?: number
  memberIds?: number[]
  failoverDestination?: string
  enabled?: boolean
  description?: string
}

export const ringGroupService = {
  list: (): Promise<RingGroup[]> => api.get('/ring-groups'),
  get: (id: number): Promise<RingGroup> => api.get(`/ring-groups/${id}`),
  create: (dto: CreateRingGroupDto): Promise<RingGroup> => api.post('/ring-groups', dto),
  update: (id: number, dto: Partial<CreateRingGroupDto>): Promise<RingGroup> =>
    api.put(`/ring-groups/${id}`, dto),
  delete: (id: number): Promise<void> => api.delete(`/ring-groups/${id}`),
}
