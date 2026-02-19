import api from './api'

export interface OutboundRoute {
  id: number
  name: string
  pattern: string       // dial pattern e.g. _9NXXNXXXXXX
  stripDigits?: number
  prepend?: string
  trunkId: number
  trunkName: string
  callerId?: string
  priority: number
  enabled: boolean
  description?: string
  createdAt: string
}

export interface CreateOutboundRouteDto {
  name: string
  pattern: string
  stripDigits?: number
  prepend?: string
  trunkId: number
  callerId?: string
  priority?: number
  enabled?: boolean
  description?: string
}

export const outboundRouteService = {
  list: (): Promise<OutboundRoute[]> => api.get('/outbound-routes'),
  get: (id: number): Promise<OutboundRoute> => api.get(`/outbound-routes/${id}`),
  create: (dto: CreateOutboundRouteDto): Promise<OutboundRoute> =>
    api.post('/outbound-routes', dto),
  update: (id: number, dto: Partial<CreateOutboundRouteDto>): Promise<OutboundRoute> =>
    api.put(`/outbound-routes/${id}`, dto),
  delete: (id: number): Promise<void> => api.delete(`/outbound-routes/${id}`),
  reorder: (ids: number[]): Promise<void> => api.post('/outbound-routes/reorder', { ids }),
}
