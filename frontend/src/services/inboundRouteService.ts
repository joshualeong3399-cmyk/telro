import api from './api'

export type RouteAction = 'extension' | 'queue' | 'ivr' | 'ringgroup' | 'voicemail' | 'hangup'

export interface InboundRoute {
  id: number
  name: string
  did: string           // DID number pattern
  cidNumber?: string    // caller ID filter
  trunkId?: number
  trunkName?: string
  timeConditionId?: number
  timeConditionName?: string
  action: RouteAction
  actionTarget?: string // extension/queue id
  priority: number
  enabled: boolean
  description?: string
  createdAt: string
}

export interface CreateInboundRouteDto {
  name: string
  did: string
  cidNumber?: string
  trunkId?: number
  timeConditionId?: number
  action: RouteAction
  actionTarget?: string
  priority?: number
  enabled?: boolean
  description?: string
}

export const inboundRouteService = {
  list: (): Promise<InboundRoute[]> => api.get('/inbound-routes'),
  get: (id: number): Promise<InboundRoute> => api.get(`/inbound-routes/${id}`),
  create: (dto: CreateInboundRouteDto): Promise<InboundRoute> =>
    api.post('/inbound-routes', dto),
  update: (id: number, dto: Partial<CreateInboundRouteDto>): Promise<InboundRoute> =>
    api.put(`/inbound-routes/${id}`, dto),
  delete: (id: number): Promise<void> => api.delete(`/inbound-routes/${id}`),
  reorder: (ids: number[]): Promise<void> => api.post('/inbound-routes/reorder', { ids }),
}
